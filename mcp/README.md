<h1 align="center">commit.show MCP server</h1>

<p align="center">
  <strong>Model Context Protocol</strong> server for the commit.show audit engine.
  Plug it into Claude Desktop, Cursor, Cline, Windsurf, or any other MCP host
  and your model can score any public GitHub repo without you ever leaving the chat.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/commitshow-mcp"><img src="https://img.shields.io/npm/v/commitshow-mcp?color=F0C040&label=npm&style=flat-square" alt="npm"></a>
  <img src="https://img.shields.io/npm/l/commitshow-mcp?color=0F2040&style=flat-square" alt="MIT license">
  <img src="https://img.shields.io/node/v/commitshow-mcp?color=0F2040&style=flat-square" alt="node 20+">
</p>

```jsonc
// any MCP host config (Claude Desktop · Cursor · Cline · Windsurf · …)
{
  "mcpServers": {
    "commitshow": {
      "command": "npx",
      "args": ["-y", "commitshow-mcp"]
    }
  }
}
```

That's the entire install. No API key. The server is a stdio shim over the
public `https://api.commit.show` REST surface — same rate limits + snapshot
cache the CLI and website use.

---

## Tools exposed

| Tool | What it does |
|---|---|
| `audit_repo({ repo, format? })` | Run or read the live commit.show audit for a public repo. Returns paste-ready markdown by default; `format: "json"` returns the full envelope. |
| `project_status({ repo })` | Read the latest cached snapshot only (no re-run). JSON envelope. |
| `fetch_docs()` | Pull the canonical commit.show docs (llms.txt) — full CLI/API reference for when you need exact contract details. |

The host model decides when to call each tool from the user prompt.

> **Pass a real `owner/repo`, never a project name.** `audit_repo` does a HEAD
> pre-flight against `github.com/<owner>/<repo>`; an invented slug returns a
> `not_found` envelope before any audit budget is spent. If the user says
> "audit Supabase", resolve `supabase/supabase` first, then call.

## Host wiring snippets

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or
`%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```jsonc
{
  "mcpServers": {
    "commitshow": {
      "command": "npx",
      "args": ["-y", "commitshow-mcp"]
    }
  }
}
```

Restart Claude Desktop. The tools surface under the 🔌 icon.

### Cursor

`~/.cursor/mcp.json`:

```jsonc
{
  "mcpServers": {
    "commitshow": {
      "command": "npx",
      "args": ["-y", "commitshow-mcp"]
    }
  }
}
```

### Cline / Continue / Windsurf

Any MCP host that accepts a stdio `command + args` config works. Use the same
`npx -y commitshow-mcp` invocation.

### Run from source (development)

```bash
git clone https://github.com/commitshow/cli
cd cli/mcp
npm install
npm run build
node dist/index.js   # stdio server — pipe into your MCP host directly
```

## Self-hosting / dev overrides

Both base URLs are env-overridable so you can point the shim at staging or a
fork:

| Var | Default | Used by |
|---|---|---|
| `COMMITSHOW_API_BASE` | `https://api.commit.show` | `audit_repo` · `project_status` |
| `COMMITSHOW_DOCS_BASE` | `https://commit.show` | `fetch_docs` (llms.txt mirror) |

## Rate limits

Inherits the public REST surface caps:

- 5 audits per day per IP (anon)
- 5 audits per day per `github_url`
- 800 audits per day platform-wide cache-miss ceiling
- Cache-hit (audit < 7 days old, same URL): always free, doesn't count

Errors come back inside the tool result with `isError: true` and the upstream
JSON in `content[0].text`.

---

## Why MCP + REST + CLI all exist

| Surface | Best for |
|---|---|
| `commitshow` CLI | Shell-capable agents inside the user's repo (Cursor, Claude Code, Cline, Aider) — local-mode writes `.commitshow/audit.{md,json}` next to the code |
| `commitshow-mcp` (this server) | MCP-aware hosts that run their own model + UI (Claude Desktop, Cursor MCP panel, custom inspector apps) |
| `https://api.commit.show/audit` | Anything that can fetch a URL — Gemini, ChatGPT browse, n8n, Zapier, raw curl, custom scripts |

All three hit the same audit engine and snapshot cache. Pick whichever your
runtime supports — they don't compete, they cover different runtimes.

---

## Links

- Web — <https://commit.show>
- REST API — <https://api.commit.show>
- OpenAPI spec — <https://api.commit.show/openapi.json>
- CLI repo — <https://github.com/commitshow/cli>
- This package source — <https://github.com/commitshow/cli/tree/main/mcp>

MIT © 2026 commit.show
