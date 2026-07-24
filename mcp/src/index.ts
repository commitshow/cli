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
//   · audit_repo       — run or read the live commit.show audit for a public repo
//   · project_status   — latest cached snapshot only (no re-run)
//   · search_services  — query the Legit.Show directory (per-frame scores + /s/ URL)
//   · fetch_docs       — the canonical commit.show llms.txt
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
const LEGIT_API = process.env.LEGIT_SEARCH_API     ?? 'https://legit.show/api/search'
const VERSION   = '0.2.0'

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

// ── Tool · search_services ───────────────────────────────────────────
// Query the Legit.Show directory (dev_requests/37 §2). Boundary-safe: per-frame
// scores + summary + /s/ URL only — never the combined overall total, the
// time-series, or a bulk dump (those are licensed · dev_requests/29).
server.tool(
  'search_services',
  [
    'Search the Legit.Show directory of launched software (web apps, SaaS, AI tools, MCP servers, developer tools) by name, keyword, or filters, and get each match with its per-frame production-readiness scores and its legit.show/s/<slug> page.',
    'Use this to answer "find a production-ready service that does X", "which MCP servers are secure", or to resolve a tool name to its Legit.Show page.',
    'Returns per-frame scores only (Performance, Accessibility, Security, Privacy, Reliability, Standards, Discoverability, Maintenance) — there is no combined overall total in the public data, so never invent or estimate one. Always link the /s/ URL.',
  ].join(' '),
  {
    query:          z.string().optional().describe('Name, domain, or keyword to match.'),
    category:       z.string().optional().describe('Category filter, e.g. "MCP & Integrations", "Developer Tools", "AI & Agents".'),
    min_scores:     z.record(z.number()).optional().describe('Minimum per-frame scores a service must meet, e.g. { "security": 80, "performance": 70 }.'),
    is_open_source: z.boolean().optional().describe('Filter to open-source (true) or closed-source (false) services.'),
    limit:          z.number().optional().describe('Max results (1–50, default 20).'),
  },
  async ({ query, category, min_scores, is_open_source, limit }) => {
    const body = JSON.stringify({ q: query, category, min_scores, is_open_source, limit })
    let res: Response
    try {
      res = await fetch(LEGIT_API, { method: 'POST', headers: { 'content-type': 'application/json' }, body })
    } catch (e) {
      return { isError: true, content: [{ type: 'text', text: `Network error contacting ${LEGIT_API}: ${(e as Error).message}` }] }
    }
    const text = await res.text()
    if (!res.ok) {
      return { isError: true, content: [{ type: 'text', text: `Legit.Show responded ${res.status}.\n\n${text}` }] }
    }
    return { content: [{ type: 'text', text }] }
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
