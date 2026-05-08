// Target detection — turns the CLI positional arg into a canonical
// { kind: 'remote-url', github_url } or { kind: 'local', path, github_url? }
// or { kind: 'site-url', site_url } (§15-E URL fast lane).
//
// Accepted inputs:
//   · (omitted)                                       → cwd · read `git remote get-url origin`
//   · ./my-repo · /abs/path                           → local dir · same remote inference
//   · github.com/owner/repo                           → bare host shorthand
//   · https://github.com/owner/repo                   → full URL
//   · git@github.com:owner/repo.git                   → ssh form (common in `git remote`)
//   · owner/repo                                      → last-ditch shorthand (2 segments, no dot)
//   · github.com/owner/repo/apps/web                  → inline workspace
//   · https://github.com/owner/repo/tree/main/apps/web → GitHub browse URL (paste-friendly)
//   · yoursite.com  /  https://yoursite.com           → site URL (§15-E URL Fast Lane · NEW)
//                                                       routes to audit-site-preview ·
//                                                       partial cap ~32/50 · no repo needed
//
// Workspace selection precedence (repo lanes only):
//   1. --workspace <path> CLI flag (highest · explicit override)
//   2. Inline path in target URL (sub-path after <owner>/<repo>)
//   3. Auto-pick on the server (Edge Function priority-name → repo-name → file count)

import { execSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

export interface Target {
  kind: 'remote-url' | 'local' | 'site-url'
  /** Canonical https://github.com/owner/repo — no trailing slash, no .git.
   *  EMPTY string for site-url targets (no repo). */
  github_url: string
  /** Only set when kind === 'site-url' · canonical https://host (no path). */
  site_url?: string
  /** Only set when kind === 'local' */
  localPath?: string
  /** owner/repo for repo lanes · bare host for site-url lane */
  slug: string
  /** Explicit workspace override (repo lanes only).
   *  null = let the server auto-pick. site-url lane ignores this. */
  workspace: string | null
}

export class TargetError extends Error {}

/**
 * Cheap HEAD request against github.com/<owner>/<repo> so an agent that
 * confidently invented a repo URL ('warp' → 'warpdotdev/warp' that doesn't
 * exist) gets a clean 'no such repo' error before we burn an audit-preview
 * call + Claude credits. Returns:
 *   · { exists: true }              — 2xx/3xx response (or rate-limited; we
 *                                     allow through rather than false-flag)
 *   · { exists: false, status: 404 } — repo missing, private, or renamed
 *   · { exists: true, ambiguous: true } — network/CORS/transient failure;
 *                                     don't block the audit, let the
 *                                     server-side path produce its own error
 */
export async function verifyRemoteExists(
  githubUrl: string,
): Promise<{ exists: boolean; status?: number; ambiguous?: boolean }> {
  if (!/^https?:\/\/github\.com\//i.test(githubUrl)) return { exists: true, ambiguous: true }
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 5000)
    const r = await fetch(githubUrl, {
      method:   'HEAD',
      redirect: 'follow',
      signal:   ctrl.signal,
    })
    clearTimeout(t)
    if (r.status === 404) return { exists: false, status: 404 }
    return { exists: true, status: r.status }
  } catch {
    return { exists: true, ambiguous: true }
  }
}

// `github_url` patterns. Each captures (owner, repo, optional sub-path).
// The sub-path lets users inline a workspace inside the URL itself instead
// of using the --workspace flag (`github.com/o/r/apps/web` or paste of a
// GitHub browse URL `https://github.com/o/r/tree/main/apps/web`).
const GITHUB_URL_RE  = /^https?:\/\/github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?(?:\/(.+))?\/?$/i
const GITHUB_HOST_RE = /^github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?(?:\/(.+))?\/?$/i
const GITHUB_SSH_RE  = /^git@github\.com:([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i
const SLUG_RE        = /^([A-Za-z0-9][\w.-]*)\/([A-Za-z0-9][\w.-]*)$/

function canonical(owner: string, repo: string): string {
  return `https://github.com/${owner}/${repo.replace(/\.git$/, '')}`
}

/**
 * Normalize the sub-path portion of a GitHub URL into a workspace path.
 * Handles the GitHub browse URL prefixes (`tree/<branch>/...` ·
 * `blob/<branch>/...`) so users can paste any URL they're looking at.
 *
 * Rejects non-workspace prefixes (issues · pulls · actions · settings ·
 * releases · wiki · etc.) — those aren't workspaces, returning null
 * means "no inline workspace" rather than a confusing error.
 */
function normalizeSubpath(raw: string | undefined | null): string | null {
  if (!raw) return null
  let s = raw.replace(/^\/+/, '').replace(/\/+$/, '')
  if (!s) return null
  // GitHub browse URL prefixes — strip and keep the path part
  const browseMatch = s.match(/^(?:tree|blob)\/[^/]+\/(.+)$/i)
  if (browseMatch) s = browseMatch[1]
  // Non-workspace GitHub URL prefixes — ignore the sub-path entirely
  const NON_WORKSPACE_PREFIXES = [
    'issues', 'pull', 'pulls', 'actions', 'settings', 'releases',
    'wiki', 'security', 'pulse', 'graphs', 'network', 'commits',
    'commit', 'compare', 'tags', 'branches', 'discussions', 'projects',
  ]
  const head = s.split('/')[0].toLowerCase()
  if (NON_WORKSPACE_PREFIXES.includes(head)) return null
  return s
}

function matchUrl(raw: string): { owner: string; repo: string; workspace: string | null } | null {
  const s = raw.trim()
  const urlMatch = s.match(GITHUB_URL_RE) ?? s.match(GITHUB_HOST_RE)
  if (urlMatch) {
    return {
      owner:     urlMatch[1],
      repo:      urlMatch[2],
      workspace: normalizeSubpath(urlMatch[3]),
    }
  }
  const sshMatch = s.match(GITHUB_SSH_RE)
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2], workspace: null }
  }
  const slug = s.match(SLUG_RE)
  if (slug && !slug[2].includes('.')) {
    return { owner: slug[1], repo: slug[2], workspace: null }
  }
  return null
}

// Site URL detection (§15-E URL Fast Lane).
// Accepts:
//   · https://example.com  / http://example.com         → full URL
//   · example.com  / sub.example.com                    → bare host (added https://)
//   · example.com/path                                  → host + path · we strip path (origin only)
// Rejects:
//   · github.com URLs (those go to remote-url path · matchUrl above)
//   · localhost / private IPs / 1-segment hosts (no dot)
//   · commit.show itself (reflexive)
function matchSiteUrl(raw: string): { origin: string; host: string } | null {
  const s = raw.trim()
  if (!s) return null
  // owner/repo shorthand has no dot in the second segment — handled by matchUrl.
  // Anything reaching here that contains "github.com" is a github form we already
  // tried · don't double-route.
  if (/github\.com/i.test(s)) return null
  const candidate = /^https?:\/\//i.test(s) ? s : `https://${s}`
  let u: URL
  try { u = new URL(candidate) }
  catch { return null }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
  const host = u.host.toLowerCase().replace(/^www\./, '')
  if (!host.includes('.')) return null                                    // localhost · single-label hosts
  if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return null
  if (host === 'commit.show' || host.endsWith('.commit.show')) return null
  return { origin: `${u.protocol}//${host}`, host }
}

function gitRemoteOrigin(cwd: string): string | null {
  try {
    const out = execSync('git remote get-url origin', {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    if (!out) return null
    // Strip embedded userinfo (credentials) before parsing — safer and matches
    // how the canonical URL should look. e.g. https://x-access-token:ghp_…@github.com/foo/bar
    return out.replace(/^(https?:\/\/)[^@\/]+@/, '$1')
  } catch {
    return null
  }
}

export function resolveTarget(
  rawArg: string | undefined,
  opts: { workspace?: string | null } = {},
): Target {
  // Workspace precedence: --workspace flag wins over inline URL path.
  // Both normalized through the same path so the server receives a
  // single shape.
  const flagWorkspace = normalizeSubpath(opts.workspace ?? null)

  // 1 · Explicit URL forms — github first (most common · most specific)
  if (rawArg) {
    const m = matchUrl(rawArg)
    if (m) {
      return {
        kind: 'remote-url',
        github_url: canonical(m.owner, m.repo),
        slug: `${m.owner}/${m.repo.replace(/\.git$/, '')}`,
        workspace: flagWorkspace ?? m.workspace ?? null,
      }
    }
    // 1b · Site URL fast lane (§15-E) — anything URL-shaped that isn't
    //      github.com / a local path. Routes to audit-site-preview.
    const site = matchSiteUrl(rawArg)
    if (site) {
      return {
        kind: 'site-url',
        github_url: '',
        site_url: site.origin,
        slug: site.host,
        workspace: null,
      }
    }
  }

  // 2 · Local path (arg resolves to a directory) or cwd
  const path = resolve(rawArg ?? '.')
  if (!existsSync(path) || !statSync(path).isDirectory()) {
    throw new TargetError(
      `Not a repo I can audit: "${rawArg ?? path}".\n` +
      `  Expected: github URL, owner/repo shorthand, or a local git repo path.`,
    )
  }

  const remote = gitRemoteOrigin(path)
  if (!remote) {
    throw new TargetError(
      `No git remote found in ${path}.\n` +
      `  Either run this inside a git repo with a GitHub remote, or pass the URL directly:\n` +
      `    commitshow audit github.com/owner/repo`,
    )
  }

  const m = matchUrl(remote)
  if (!m) {
    // Don't echo `remote` — it may contain credentials. Ask for explicit target instead.
    throw new TargetError(
      `Couldn't parse the git remote for ${path} as a GitHub repo.\n` +
      `  commitshow currently supports GitHub-hosted projects only.\n` +
      `  Try passing the URL directly: commitshow audit github.com/owner/repo`,
    )
  }

  return {
    kind: 'local',
    github_url: canonical(m.owner, m.repo),
    localPath: path,
    slug: `${m.owner}/${m.repo.replace(/\.git$/, '')}`,
    workspace: flagWorkspace,    // local repos don't carry an inline URL workspace
  }
}
