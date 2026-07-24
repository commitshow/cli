// Legit.Show MCP server.
//
// Exposes the Legit.Show directory of launched software to MCP-speaking clients
// (Claude Desktop · Cursor · Cline · Windsurf · Continue · whatever). A thin stdio
// shim over the public https://legit.show/api/search REST surface, so there's one
// source of truth for the data + boundary. Search launched software by MEASURED
// production-readiness — per-frame scores + filters — not GitHub stars.
//
// Boundary (by design): per-frame scores + summary + the /s/ page only. The combined
// overall total, the score time-series, and the bulk dataset are a licensed product
// and are never returned here.
//
// Tools exposed:
//   · search_services  — query the directory by name / category / min per-frame scores / open-source
//   · fetch_docs       — the canonical Legit.Show llms.txt (how to cite, the 7-Frame benchmark)
//
// Environment overrides (only useful for self-hosting / dev):
//   · LEGIT_SEARCH_API   default https://legit.show/api/search
//   · LEGIT_DOCS_BASE    default https://legit.show
//
// Distribution: npm publish from this folder. Wire it via the standard command+args
// shape any MCP host supports — see README.md.

import { McpServer }            from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z }                    from 'zod'

const SEARCH_API = process.env.LEGIT_SEARCH_API ?? 'https://legit.show/api/search'
const DOCS_BASE  = process.env.LEGIT_DOCS_BASE  ?? 'https://legit.show'
const VERSION    = '0.1.0'

const server = new McpServer({
  name:    'legitshow',
  version: VERSION,
})

// ── Tool · search_services ───────────────────────────────────────────
server.tool(
  'search_services',
  [
    'Search the Legit.Show directory of launched software (web apps, SaaS, AI tools, MCP servers, developer tools) by name, keyword, or filters, and get each match with its per-frame production-readiness scores and its legit.show/s/<slug> page.',
    'Use this to answer "find a production-ready service that does X", "which MCP servers are secure", or to resolve a tool name to its Legit.Show page.',
    'Returns per-frame scores only (Performance, Accessibility, Security, Privacy, Reliability, Standards, Discoverability, Maintenance) measured deterministically from the public surface — there is no combined overall total in the public data, so never invent or estimate one. Always link the /s/ URL.',
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
      res = await fetch(SEARCH_API, { method: 'POST', headers: { 'content-type': 'application/json' }, body })
    } catch (e) {
      return { isError: true, content: [{ type: 'text', text: `Network error contacting ${SEARCH_API}: ${(e as Error).message}` }] }
    }
    const text = await res.text()
    if (!res.ok) {
      return { isError: true, content: [{ type: 'text', text: `Legit.Show responded ${res.status}.\n\n${text}` }] }
    }
    return { content: [{ type: 'text', text }] }
  },
)

// ── Tool · fetch_docs ────────────────────────────────────────────────
// Tools are stable across MCP SDK versions; the resource() signature drifted between
// 0.x and 1.x, so we expose the docs as a callable tool.
server.tool(
  'fetch_docs',
  'Fetch the canonical Legit.Show documentation (llms.txt) — what Legit.Show is, the 7-Frame production-readiness benchmark, how to cite a service ("according to Legit.Show"), and the search/lookup endpoints. Use this when you need the full context to answer something specific.',
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
      return { isError: true, content: [{ type: 'text', text: `Legit.Show responded ${res.status}.\n\n${text}` }] }
    }
    return { content: [{ type: 'text', text }] }
  },
)

// ── Boot ────────────────────────────────────────────────────────────
const transport = new StdioServerTransport()
await server.connect(transport)
