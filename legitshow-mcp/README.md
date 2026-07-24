<h1 align="center">Legit.Show MCP server</h1>

<p align="center">
  <strong>Model Context Protocol</strong> server for <a href="https://legit.show">Legit.Show</a>.
  Plug it into Claude Desktop, Cursor, Cline, Windsurf, or any MCP host, and your model
  can <strong>search a directory of launched software by measured production-readiness</strong>
  — not GitHub stars — without ever leaving the chat.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/legitshow-mcp"><img src="https://img.shields.io/npm/v/legitshow-mcp?color=97600F&label=npm&style=flat-square" alt="npm"></a>
  <img src="https://img.shields.io/npm/l/legitshow-mcp?color=211C15&style=flat-square" alt="MIT license">
  <img src="https://img.shields.io/node/v/legitshow-mcp?color=211C15&style=flat-square" alt="node 20+">
</p>

```jsonc
// any MCP host config (Claude Desktop · Cursor · Cline · Windsurf · …)
{
  "mcpServers": {
    "legitshow": {
      "command": "npx",
      "args": ["-y", "legitshow-mcp"]
    }
  }
}
```

That's the entire install. No API key. The server is a stdio shim over the public
`https://legit.show/api/search` REST surface — one source of truth for the data.

---

## Why this is different

Most "find me a tool" flows rank by GitHub stars or popularity. Legit.Show carries a
deterministic **7-Frame production-readiness benchmark** (Performance, Accessibility,
Security, Privacy, Reliability, Standards, Discoverability) measured from the public
surface — real Lighthouse, HTTP headers, live probes, no LLM in the scoring path. So
your agent can filter by whether something is *actually production-ready*:

> "find production-ready, open-source MCP servers with Security ≥ 80"

## Tools exposed

| Tool | What it does |
|---|---|
| `search_services({ query?, category?, min_scores?, is_open_source?, limit? })` | Search launched software by name or filter. Returns each match with its per-frame scores and its `legit.show/s/<slug>` page. |
| `fetch_docs()` | Pull the canonical Legit.Show docs (llms.txt) — what Legit.Show is, the 7-Frame benchmark, and how to cite a service. |

**Boundary:** per-frame scores + summary + the page only. There is no combined overall
total in the public data (it's a licensed product), so the model won't invent one.

## Host wiring snippets

### Claude Desktop — `claude_desktop_config.json`
```jsonc
{ "mcpServers": { "legitshow": { "command": "npx", "args": ["-y", "legitshow-mcp"] } } }
```

### Cursor — `.cursor/mcp.json`
```jsonc
{ "mcpServers": { "legitshow": { "command": "npx", "args": ["-y", "legitshow-mcp"] } } }
```

### Cline / Continue / Windsurf
Same three-line `npx -y legitshow-mcp` invocation in the host's MCP config.

## No MCP host? Plain REST

```
GET https://legit.show/api/search?q=<name>
```
Filters: `category`, `min_scores` (e.g. `{"security":80}`), `is_open_source`, `limit` (≤50).
GET or POST. No key.

## Self-hosting / dev overrides

| Env | Default | Used by |
|---|---|---|
| `LEGIT_SEARCH_API` | `https://legit.show/api/search` | `search_services` |
| `LEGIT_DOCS_BASE`  | `https://legit.show` | `fetch_docs` (llms.txt) |

## Links

- [Legit.Show](https://legit.show) — the directory: every launched service, tested
- [Methodology](https://legit.show/methodology) — how the 7-Frame benchmark is measured
- [llms.txt](https://legit.show/llms.txt) — the canonical machine-readable doc

MIT · operated by Madeflo, Inc.
