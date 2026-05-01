// commit.show MCP server.
//
// Exposes commit.show's audit engine to MCP-speaking clients
// (Claude Desktop · Cursor · Cline · Windsurf · Continue · whatever).
// This is a thin stdio shim — it forwards every tool call to the public
// REST API at https://api.commit.show/audit, which already handles
// rate limits, snapshot caching, GitHub HEAD pre-flight, and the
// Claude orchestration. Keeping the shim thin means we don't drift
// from the CLI/web surface — there's one source of truth for scoring.
//
// Tools exposed:
//   · audit_repo      — run or read the live audit for a public repo
//   · project_status  — latest cached snapshot only (no re-run)
//
// Resources exposed:
//   · commitshow://docs/llms.txt
//       Mirrors https://commit.show/llms.txt so the host model can
//       read the canonical 'how to use commit.show' document on demand.
//
// Environment overrides (only useful for self-hosting / dev):
//   · COMMITSHOW_API_BASE   default https://api.commit.show
//   · COMMITSHOW_DOCS_BASE  default https://commit.show
//
// Distribution: npm publish from the mcp/ folder. Users wire it via
// the standard `command + args` shape any MCP host supports — see
// README.md for Claude Desktop / Cursor / Cline / Windsurf snippets.

import { McpServer }              from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport }   from '@modelcontextprotocol/sdk/server/stdio.js'
import { z }                       from 'zod'

const API_BASE  = process.env.COMMITSHOW_API_BASE  ?? 'https://api.commit.show'
const DOCS_BASE = process.env.COMMITSHOW_DOCS_BASE ?? 'https://commit.show'
const VERSION   = '0.1.0'

const server = new McpServer({
  name:    'commitshow',
  version: VERSION,
})

// ── Tool · audit_repo ────────────────────────────────────────────────
server.tool(
  'audit_repo',
  [
    'Run or read the live commit.show audit for a public GitHub repo.',
    'Returns a markdown summary by default (paste-ready) or the full JSON envelope when format=json.',
    'When the user asks for a project by name (e.g. "audit Supabase"), resolve the canonical github.com/owner/repo URL FIRST — do not guess. The endpoint HEAD-checks GitHub before spending audit budget; an invalid slug returns a not_found envelope.',
  ].join(' '),
  {
    repo:   z.string().describe('GitHub repo. Accepts a full URL, github.com/owner/repo, or the bare owner/repo slug.'),
    format: z.enum(['md', 'json']).optional().describe("Output format. 'md' (default) returns markdown for the user; 'json' returns the full audit envelope."),
  },
  async ({ repo, format = 'md' }) => {
    const url = `${API_BASE}/audit?repo=${encodeURIComponent(repo)}&format=${format}`
    let res: Response
    try {
      res = await fetch(url)
    } catch (e) {
      return { isError: true, content: [{ type: 'text', text: `Network error contacting ${API_BASE}: ${(e as Error).message}` }] }
    }
    const body = await res.text()
    if (!res.ok) {
      return {
        isError: true,
        content: [{ type: 'text', text: `commit.show responded ${res.status}.\n\n${body}` }],
      }
    }
    return { content: [{ type: 'text', text: body }] }
  },
)

// ── Tool · project_status ────────────────────────────────────────────
// Same endpoint, but we explicitly ask for json — useful when an agent
// only wants the score number to gate a workflow without re-running
// the analysis. Per the API contract, the cached snapshot is returned
// without spending quota when one exists.
server.tool(
  'project_status',
  [
    'Read the latest cached commit.show audit for a repo without forcing a re-run.',
    'Returns the JSON envelope (project + snapshot + scores). Quota state is in `.quota`.',
  ].join(' '),
  {
    repo: z.string().describe('GitHub repo (URL, github.com/owner/repo, or owner/repo).'),
  },
  async ({ repo }) => {
    const url = `${API_BASE}/audit?repo=${encodeURIComponent(repo)}&format=json`
    let res: Response
    try {
      res = await fetch(url)
    } catch (e) {
      return { isError: true, content: [{ type: 'text', text: `Network error: ${(e as Error).message}` }] }
    }
    const body = await res.text()
    if (!res.ok) {
      return {
        isError: true,
        content: [{ type: 'text', text: `commit.show responded ${res.status}.\n\n${body}` }],
      }
    }
    return { content: [{ type: 'text', text: body }] }
  },
)

// ── Tool · fetch_docs ────────────────────────────────────────────────
// Pulls the canonical llms.txt from commit.show on demand. Tools are
// stable across MCP SDK versions; the resource() API signature drifted
// between 0.x and 1.x, so we expose the docs as a callable tool rather
// than fighting the resource registration surface.
server.tool(
  'fetch_docs',
  'Fetch the canonical commit.show documentation (llms.txt). Use this when you need the full context — CLI commands, REST API shape, JSON contract, rate limits, graduation rules — to answer something specific.',
  {},
  async () => {
    let res: Response
    try {
      res = await fetch(`${DOCS_BASE}/llms.txt`)
    } catch (e) {
      return { isError: true, content: [{ type: 'text', text: `Network error: ${(e as Error).message}` }] }
    }
    const text = await res.text()
    if (!res.ok) {
      return { isError: true, content: [{ type: 'text', text: `commit.show responded ${res.status}.\n\n${text}` }] }
    }
    return { content: [{ type: 'text', text }] }
  },
)

// ── Boot ────────────────────────────────────────────────────────────
const transport = new StdioServerTransport()
await server.connect(transport)
