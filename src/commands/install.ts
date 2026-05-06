// `commitshow install <slug>` — fetch a marketplace pack and run its
// installer in the current working directory.
//
// Flow:
//   1. Look up the listing by slug via PostgREST (md_library_feed)
//   2. Download the bundle .tar.gz from Storage public URL
//   3. Verify sha256 against the listing's bundle_sha256
//   4. Untar to ~/.commitshow/cache/<slug>-<version>/
//   5. Run scripts/install.sh from the untarred bundle, with $PWD set
//      to the user's project directory. The installer itself prompts
//      for inputs (osascript on macOS, stdin elsewhere) and runs ALL
//      operations against the user's own credentials.
//
// commit.show is the bundle delivery channel only · no user secrets
// pass through any of our infrastructure.

import { spawn } from 'node:child_process'
import { createWriteStream, mkdtempSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { tmpdir, homedir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { Readable } from 'node:stream'
import { c } from '../lib/colors.js'

const PUBLIC_BASE = 'https://tekemubwihsjdzittoqf.supabase.co'
const ANON_KEY    = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRla2VtdWJ3aWhzamR6aXR0b3FmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MzQ1NzUsImV4cCI6MjA5MjAxMDU3NX0.n2K-3lFVvlXQx-bV9evdNRSQCtG5oC4uQushxB2ja9Y'

interface PackListing {
  id:                string
  slug:              string
  title:             string
  description:       string | null
  author_name:       string | null
  bundle_url:        string | null
  bundle_sha256:     string | null
  bundle_size_bytes: number | null
  bundle_version:    string | null
  manifest_version:  string | null
  target_format:     string | null
  imperative?:       boolean
}

async function fetchListing(slug: string): Promise<PackListing | null> {
  const url = `${PUBLIC_BASE}/rest/v1/md_library_feed`
            + `?slug=eq.${encodeURIComponent(slug)}`
            + `&select=id,slug,title,description,author_name,bundle_url,bundle_sha256,bundle_size_bytes,bundle_version,manifest_version,target_format`
            + `&limit=1`
  const res = await fetch(url, {
    headers: {
      apikey:        ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      Accept:        'application/json',
    },
  })
  if (!res.ok) {
    throw new Error(`Library lookup failed (HTTP ${res.status})`)
  }
  const rows = (await res.json()) as PackListing[]
  return rows[0] ?? null
}

async function downloadBundle(url: string, dest: string, expectedSha: string): Promise<void> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Bundle download failed (HTTP ${res.status})`)
  if (!res.body) throw new Error('Bundle download returned no body')

  // Stream to disk while computing sha256 inline. Avoids holding the
  // entire .tar.gz in memory, fast-fails on hash mismatch.
  const out  = createWriteStream(dest)
  const hash = createHash('sha256')
  await new Promise<void>((resolve, reject) => {
    const stream = Readable.fromWeb(res.body as never)
    stream.on('data', (chunk: Buffer) => hash.update(chunk))
    stream.on('error', reject)
    out.on('error', reject)
    out.on('finish', () => resolve())
    stream.pipe(out)
  })

  const got = hash.digest('hex')
  if (got !== expectedSha) {
    throw new Error(
      `Bundle integrity check failed.\n  expected: ${expectedSha}\n  got:      ${got}\n`
    + `  Refusing to run an install script with a mismatched hash. `
    + `Try again — if this persists report it to https://github.com/commitshow/cli/issues`,
    )
  }
}

function untar(tarball: string, into: string): Promise<void> {
  return new Promise((resolve, reject) => {
    mkdirSync(into, { recursive: true })
    const child = spawn('tar', ['-xzf', tarball, '-C', into], { stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`tar exited ${code}`)))
  })
}

function findInstallScript(extractRoot: string): string | null {
  // Bundles tar with the skill dir as the top-level entry, so after
  // extraction we expect: <extractRoot>/<slug>/scripts/install.sh
  // Handle both that shape and a flat shape where pack.yaml is at root.
  const direct = join(extractRoot, 'scripts', 'install.sh')
  if (existsSync(direct)) return direct
  // Find first child directory containing scripts/install.sh
  for (const ent of readdirSync(extractRoot, { withFileTypes: true })) {
    if (ent.isDirectory()) {
      const cand = join(extractRoot, ent.name, 'scripts', 'install.sh')
      if (existsSync(cand)) return cand
    }
  }
  return null
}

function runInstallScript(scriptPath: string, projectDir: string): Promise<number> {
  return new Promise(resolve => {
    const child = spawn('bash', [scriptPath, projectDir], {
      stdio: 'inherit',
      env:   { ...process.env },
    })
    child.on('exit', code => resolve(code ?? 1))
    child.on('error', err => {
      console.error(c.scarlet(`  install.sh failed to launch: ${err.message}`))
      resolve(1)
    })
  })
}

export async function install(args: string[]): Promise<number> {
  const slug = args.find(a => !a.startsWith('-'))
  if (!slug) {
    console.error(c.scarlet('  usage: commitshow install <slug>'))
    console.error(c.muted('  e.g.   commitshow install supabase-resend-auth'))
    return 2
  }

  console.log('')
  console.log(c.muted(`→ Looking up `) + c.gold(slug) + c.muted(` in commit.show Library...`))

  let listing: PackListing | null
  try {
    listing = await fetchListing(slug)
  } catch (e) {
    console.error(c.scarlet(`  ${(e as Error).message}`))
    return 1
  }
  if (!listing) {
    console.error(c.scarlet(`  No published pack with slug '${slug}'.`))
    console.error(c.muted(`  Browse https://commit.show/library to find the right slug.`))
    return 1
  }
  if (!listing.bundle_url || !listing.bundle_sha256) {
    console.error(c.scarlet(`  '${slug}' is listed but has no installable bundle yet.`))
    console.error(c.muted(`  This pack may be content-only (Apply-to-my-repo on the web).`))
    return 1
  }

  const sizeKb = listing.bundle_size_bytes ? (listing.bundle_size_bytes / 1024).toFixed(1) : '?'
  console.log('')
  console.log(c.cream(`  ${listing.title}`) + c.muted(`  v${listing.bundle_version ?? '?'}`))
  if (listing.description) {
    console.log(c.muted(`  ${listing.description.split('\n')[0]}`))
  }
  console.log(c.dim(`  by ${listing.author_name ?? 'unknown'} · ${sizeKb} KB · sha256 ${listing.bundle_sha256.slice(0, 12)}…`))
  console.log('')

  // Cache layout: ~/.commitshow/cache/<slug>-<version>/
  const cacheRoot = join(homedir(), '.commitshow', 'cache')
  const stagingDir = mkdtempSync(join(tmpdir(), `commitshow-${slug}-`))
  const versionTag = listing.bundle_version || 'unversioned'
  const finalDir   = join(cacheRoot, `${slug}-${versionTag}`)

  try {
    await mkdir(cacheRoot, { recursive: true })

    // If already cached with the right hash, skip download
    const cachedScript = existsSync(finalDir) ? findInstallScript(finalDir) : null
    let installScript: string | null = null
    if (cachedScript) {
      console.log(c.muted(`  using cached bundle at ${finalDir}`))
      installScript = cachedScript
    } else {
      const tarball = join(stagingDir, 'bundle.tar.gz')
      console.log(c.muted(`→ Downloading bundle...`))
      await downloadBundle(listing.bundle_url, tarball, listing.bundle_sha256)
      console.log(c.muted(`  ✓ sha256 verified`))
      console.log(c.muted(`→ Extracting to ${finalDir}`))
      // Clear any old version of this slug+version dir
      await rm(finalDir, { recursive: true, force: true })
      await untar(tarball, finalDir)
      installScript = findInstallScript(finalDir)
    }

    if (!installScript) {
      console.error(c.scarlet(`  Bundle extracted but no scripts/install.sh found.`))
      console.error(c.muted(`  Pack may be malformed · please report to the publisher.`))
      return 1
    }

    console.log(c.muted(`→ Running installer in ${process.cwd()}`))
    console.log(c.dim(`  (the script prompts for YOUR Supabase + Resend credentials below)`))
    const exitCode = await runInstallScript(installScript, process.cwd())

    if (exitCode === 0) {
      console.log('')
      console.log(c.gold('✓ ') + c.cream(`${listing.title} installed`))
      console.log('')
    } else {
      console.error('')
      console.error(c.scarlet(`✗ Installer exited with code ${exitCode}`))
      console.error(c.muted(`  See the messages above. The bundle is cached at:`))
      console.error(c.muted(`    ${finalDir}`))
      console.error(c.muted(`  · re-run with: bash ${installScript}`))
    }
    return exitCode
  } finally {
    await rm(stagingDir, { recursive: true, force: true }).catch(() => {})
  }
}
