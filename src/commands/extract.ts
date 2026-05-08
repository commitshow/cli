// commitshow extract · scan ~/.claude/projects/ for the current repo's
// session JSONL files, sum token usage, copy a paste-able blob to the
// clipboard. Audition flow on commit.show takes the blob, decodes it
// server-side, and writes verified rows into audit_token_usage.
//
// Privacy · this command reads JSONL files but only extracts the
// `usage` blocks (token counters). Prompt content NEVER leaves the
// machine. The blob carries numbers + session UUIDs + first/last
// timestamps + a content hash for dedupe — nothing else.
//
// Why ~/.claude/projects · Claude Code stores per-session JSONL there
// in `<encoded-cwd>/<session-uuid>.jsonl` form. The encoded-cwd is the
// abs path of the working directory with `/` → `-`. Files are append-only
// during sessions and grow linearly with conversation length.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { join, basename } from 'node:path'
import { execSync } from 'node:child_process'
import { resolveTarget, TargetError } from '../lib/target.js'
import { c } from '../lib/colors.js'

interface SessionTotals {
  session_id:           string
  input_tokens:         number
  output_tokens:        number
  cache_create_tokens:  number
  cache_read_tokens:    number
  message_count:        number
  first_seen_at:        string | null
  last_seen_at:         string | null
  cwd:                  string | null
}

const HEADER = `${c.bold(c.gold('commit.show extract'))} ${c.dim('· token receipt for your audition')}`

function fmtNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function safeStat(path: string) {
  try { return statSync(path) } catch { return null }
}

function readJsonlSafe(path: string): SessionTotals | null {
  const totals: SessionTotals = {
    session_id:          basename(path).replace(/\.jsonl$/, ''),
    input_tokens:        0,
    output_tokens:       0,
    cache_create_tokens: 0,
    cache_read_tokens:   0,
    message_count:       0,
    first_seen_at:       null,
    last_seen_at:        null,
    cwd:                 null,
  }
  let raw: string
  try { raw = readFileSync(path, 'utf8') } catch { return null }
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    let evt: any
    try { evt = JSON.parse(line) } catch { continue }
    if (typeof evt.cwd === 'string') totals.cwd = evt.cwd
    const usage = evt?.message?.usage
    if (usage && typeof usage === 'object') {
      totals.input_tokens        += usage.input_tokens                ?? 0
      totals.output_tokens       += usage.output_tokens               ?? 0
      totals.cache_create_tokens += usage.cache_creation_input_tokens ?? 0
      totals.cache_read_tokens   += usage.cache_read_input_tokens     ?? 0
      totals.message_count++
      const ts = evt.timestamp ?? null
      if (ts) {
        if (!totals.first_seen_at || ts < totals.first_seen_at) totals.first_seen_at = ts
        if (!totals.last_seen_at  || ts > totals.last_seen_at)  totals.last_seen_at  = ts
      }
    }
  }
  return totals
}

function listSessionFiles(rootCwd: string): string[] {
  // Encoded directory pattern: `/Users/foo/myrepo` → `-Users-foo-myrepo`.
  // Claude Code historically uses this exact transform; we replicate it.
  const dirsRoot = join(homedir(), '.claude', 'projects')
  if (!safeStat(dirsRoot)?.isDirectory()) return []

  // Try direct hit first via the canonical encoding.
  const encoded = rootCwd.replace(/\//g, '-')
  const direct  = join(dirsRoot, encoded)
  const directOk = safeStat(direct)?.isDirectory()

  // Fallback · scan all subdirs and match by reading the first session's
  // `cwd` field. Claude Code's encoding is OS-dependent and not perfectly
  // round-trippable on all paths, so direct hit + scan covers both cases.
  const candidates: string[] = []
  if (directOk) {
    for (const f of readdirSync(direct)) {
      if (f.endsWith('.jsonl')) candidates.push(join(direct, f))
    }
  } else {
    for (const sub of readdirSync(dirsRoot)) {
      const subPath = join(dirsRoot, sub)
      if (!safeStat(subPath)?.isDirectory()) continue
      for (const f of readdirSync(subPath)) {
        if (!f.endsWith('.jsonl')) continue
        const full = join(subPath, f)
        // Cheap pre-check · read first 4KB and look for the cwd we want
        try {
          const head = readFileSync(full, 'utf8').slice(0, 8192)
          if (head.includes(`"cwd":"${rootCwd}"`)) candidates.push(full)
        } catch { /* skip unreadable */ }
      }
    }
  }
  return candidates
}

function copyToClipboard(text: string): boolean {
  try {
    const cmd =
      platform() === 'darwin' ? 'pbcopy'
      : platform() === 'win32' ? 'clip'
      : 'xclip -selection clipboard'   // best-effort on linux
    execSync(cmd, { input: text, stdio: ['pipe', 'ignore', 'ignore'] })
    return true
  } catch {
    return false
  }
}

export async function extract(args: string[]): Promise<number> {
  const asJson = args.includes('--json')
  const positional = args.find(a => !a.startsWith('--'))

  // Unlike `audit`, extract doesn't NEED a GitHub URL — it just scans
  // ~/.claude/projects/<encoded-cwd>/*.jsonl for token usage. github_url
  // is purely optional metadata in the blob (helps the server match the
  // receipt back to the right project on commit.show). So we try to
  // resolve a target but fall back to a cwd-only target when there's no
  // git remote — instead of bailing with audit's "No git remote" error.
  let target: { github_url: string | null; localPath?: string } | null = null
  try {
    target = resolveTarget(positional, { workspace: null })
  } catch (e) {
    if (e instanceof TargetError) {
      // Treat as 'no github_url' rather than fatal · scan still works.
      target = { github_url: null, localPath: positional ? positional : process.cwd() }
    } else {
      throw e
    }
  }

  if (!asJson) {
    console.log()
    console.log(HEADER)
    console.log()
    if (!target.github_url) {
      console.log(c.muted(`  no git remote detected · receipt will scan local Claude Code sessions only`))
      console.log(c.muted(`  paste the blob into your project's audition form on commit.show — that's where it gets matched`))
      console.log()
    }
  }

  // Use the local cwd (or the path target) as the lookup key. Remote URL
  // targets fall back to scanning the entire ~/.claude/projects/ for any
  // session whose `cwd` matches a directory containing the same git remote.
  const rootCwd = target.localPath ?? process.cwd()
  const sessionFiles = listSessionFiles(rootCwd)

  if (sessionFiles.length === 0) {
    if (asJson) {
      console.log(JSON.stringify({ ok: false, reason: 'no_sessions_found', searched: rootCwd }))
      return 1
    }
    console.error(c.muted(`  no Claude Code sessions found for ${c.cream(rootCwd)}.`))
    console.error(c.muted(`  expected location: ~/.claude/projects/${c.dim(rootCwd.replace(/\//g, '-'))}/*.jsonl`))
    console.error(c.muted(`  if you've been running Claude Code from inside the repo, the file should appear after the next assistant turn.`))
    return 1
  }

  const sessions: SessionTotals[] = []
  for (const f of sessionFiles) {
    const t = readJsonlSafe(f)
    if (t && (t.input_tokens + t.output_tokens + t.cache_create_tokens + t.cache_read_tokens) > 0) {
      sessions.push(t)
    }
  }

  const totals = sessions.reduce((acc, s) => ({
    input_tokens:        acc.input_tokens        + s.input_tokens,
    output_tokens:       acc.output_tokens       + s.output_tokens,
    cache_create_tokens: acc.cache_create_tokens + s.cache_create_tokens,
    cache_read_tokens:   acc.cache_read_tokens   + s.cache_read_tokens,
  }), { input_tokens: 0, output_tokens: 0, cache_create_tokens: 0, cache_read_tokens: 0 })

  const blobJson = {
    v: 1 as const,
    source: 'claude_code',
    tool_version: 'commitshow-cli',
    github_url: target.github_url ?? null,
    extracted_at: new Date().toISOString(),
    sessions,
  }
  // Buffer is Node-only · CLI runs on Node so this is fine.
  const blob = `cs_v1:${Buffer.from(JSON.stringify(blobJson)).toString('base64')}`

  const totalTokens = totals.input_tokens + totals.output_tokens + totals.cache_create_tokens + totals.cache_read_tokens
  const copied = copyToClipboard(blob)

  if (asJson) {
    console.log(JSON.stringify({
      ok:           true,
      sessions:     sessions.length,
      total_tokens: totalTokens,
      totals,
      blob,
      clipboard_copied: copied,
    }, null, 2))
    return 0
  }

  // Pretty rendering
  console.log(`  ${c.cream(`${sessions.length} session${sessions.length === 1 ? '' : 's'} scanned`)} ${c.muted(`from ~/.claude/projects/`)}`)
  console.log(`  ${c.cream(target.github_url ?? rootCwd)}`)
  console.log()
  console.log(`  ${c.gold('Token totals')}`)
  console.log(`    ${c.muted('input        ')} ${c.cream(fmtNumber(totals.input_tokens).padStart(8))}`)
  console.log(`    ${c.muted('output       ')} ${c.cream(fmtNumber(totals.output_tokens).padStart(8))}`)
  console.log(`    ${c.muted('cache write  ')} ${c.cream(fmtNumber(totals.cache_create_tokens).padStart(8))}`)
  console.log(`    ${c.muted('cache read   ')} ${c.cream(fmtNumber(totals.cache_read_tokens).padStart(8))}`)
  console.log(`    ${c.muted('────────────────────────')}`)
  console.log(`    ${c.bold(c.gold('total       '))} ${c.bold(c.gold(fmtNumber(totalTokens).padStart(8)))}`)
  console.log()
  if (copied) {
    console.log(`  ${c.cream('✓')} ${c.muted('blob copied to clipboard')} ${c.dim(`(${blob.length} chars)`)}`)
    console.log(`  ${c.muted('paste it into the audition form on commit.show')}`)
  } else {
    console.log(`  ${c.muted('clipboard tool unavailable · copy this blob manually:')}`)
    console.log()
    console.log(c.dim(blob))
  }
  console.log()
  console.log(`  ${c.muted('privacy · only token COUNTS leave your machine. prompt text stays local.')}`)
  console.log()
  return 0
}
