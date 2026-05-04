<h1 align="center">commit.show CLI</h1>

<p align="center">
  <strong>Audit any vibe-coded project from your terminal.</strong><br>
  Score · 3-axis breakdown · 3 strengths + 2 concerns · rank · delta — in one command.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/commitshow"><img src="https://img.shields.io/npm/v/commitshow?color=F0C040&label=npm&style=flat-square" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/commitshow"><img src="https://img.shields.io/npm/dw/commitshow?color=0F2040&style=flat-square" alt="weekly downloads"></a>
  <img src="https://img.shields.io/node/v/commitshow?color=0F2040&style=flat-square" alt="node">
  <img src="https://img.shields.io/npm/l/commitshow?color=0F2040&style=flat-square" alt="MIT license">
</p>

```bash
npx commitshow@latest audit github.com/owner/repo
```

```
   ██████╗  ██████╗  ███╗   ███╗ ███╗   ███╗ ██╗ ████████╗     ███████╗ ██╗  ██╗  ██████╗  ██╗    ██╗
  ██╔════╝ ██╔═══██╗ ████╗ ████║ ████╗ ████║ ██║ ╚══██╔══╝     ██╔════╝ ██║  ██║ ██╔═══██╗ ██║    ██║
  ██║      ██║   ██║ ██╔████╔██║ ██╔████╔██║ ██║    ██║        ███████╗ ███████║ ██║   ██║ ██║ █╗ ██║
  ██║      ██║   ██║ ██║╚██╔╝██║ ██║╚██╔╝██║ ██║    ██║        ╚════██║ ██╔══██║ ██║   ██║ ██║███╗██║
  ╚██████╗ ╚██████╔╝ ██║ ╚═╝ ██║ ██║ ╚═╝ ██║ ██║    ██║    ██╗ ███████║ ██║  ██║ ╚██████╔╝ ╚███╔███╔╝
   ╚═════╝  ╚═════╝  ╚═╝     ╚═╝ ╚═╝     ╚═╝ ╚═╝    ╚═╝    ╚═╝ ╚══════╝ ╚═╝  ╚═╝  ╚═════╝   ╚══╝╚══╝

╭────────────────────────────────────────────────────────╮
│ ✻ commit.show — Audit report                           │
╰────────────────────────────────────────────────────────╯

  commitshow   github.com/commitshow/commitshow

  Findings  · 1 critical · 1 warning · 3 strengths

  ┌────────────────────────────────────────────────────────┐
  │ What this build missed                                 │
  │ ✕ 25 FK columns unindexed — fk_columns_seen=100 vs in… │
  │ ⚠ Zero observability libs in 17 deps — no Sentry, Pin… │
  │                                                        │
  │ What it got right                                      │
  │ ↑ 56 RLS policies cover all 19 tables — gap_estimate=… │
  │ ↑ Lighthouse accessibility 93, best practices 96, SEO… │
  │ ↑ Rate-limit middleware active on API routes — vibe_c… │
  └────────────────────────────────────────────────────────┘

  ┌────────────────────────────────────────────────────────┐
  │ AI Coder 7 Frames · what AI ships without              │
  │                                                        │
  │ ✕ Error tracking                                       │
  │   no sentry / datadog / pino / winston / otel lib in…  │
  │ ⚠ Database indexes                                     │
  │   100 FK columns · 75 indexes · 25 unindexed           │
  │   → supabase/schema.sql · id → auth                    │
  │ ✓ RLS coverage                                         │
  │   19 tables · 56 policies · all covered                │
  │ ✓ Secret in client code                                │
  │   no service-role keys in client paths                 │
  │ ✓ API rate limiting                                    │
  │   custom middleware detected                           │
  └────────────────────────────────────────────────────────┘

  Δ        +20           since last audit

  → https://commit.show/projects/1c262df3-…

  next  · feed your AI loop  → commitshow audit . --json

                ╔════════════════════════════╗
                ║   commitshow/commitshow    ║
                ║                            ║
                ║     ███████╗  ███████╗     ║
                ║     ╚════██║  ╚════██║     ║
                ║         ██╔╝      ██╔╝     ║
                ║        ██╔╝      ██╔╝      ║
                ║        ██║       ██║       ║
                ║        ╚═╝       ╚═╝       ║
                ║                            ║
                ║  / 100 · walk-on · strong  ║
                ╚════════════════════════════╝
       audition unlocks final 5 · max walk-on score 95

    Audit  35/50    ▰▰▰▰▰▰▰▰▰▰▰▰▰▰▱▱▱▱▱▱
    Scout  —/30     ─ audition unlocks ─
    Comm.  —/20     ─ audition unlocks ─

                                               commit.show
```

> [⭐ Star us on GitHub](https://github.com/commitshow/cli) if `commitshow audit` saved you a `// TODO`.

---

## Why

Vibe-coded projects ship fast and break differently. The CLI gives you a
**zero-config**, **walk-on** lane to commit.show's audit engine — the same
Claude-grade analysis used in our 3-week leagues, minus the signup, fee,
and league commitment. You get a snapshot of where the build sits, what's
strong, what's wobbling, and how it ranks against everyone else this week.

Local runs also drop `.commitshow/audit.md` and `.commitshow/audit.json`
into your repo, so your AI coding agent can read the report on the next
turn without a prompt-engineering ritual.

When a project is ready for the full season — Scout forecasts, season
ranking, Backstage prompt extraction, Hall of Fame — it auditions at
[commit.show/submit](https://commit.show/submit).

> The npm package + command is `commitshow` (no dot — npm doesn't allow
> it in package names). Everywhere else uses the brand **commit.show**.

## Install

```bash
# one-shot (recommended for trying it on someone else's repo)
npx commitshow@latest audit <target>

# or global, if you'll run it daily
npm i -g commitshow
commitshow audit <target>
```

Requires **Node 20+**.

## Usage

| Command | What it does |
|---|---|
| `commitshow audit [target] [--json] [--refresh] [--source=<tag>]` | Fetch + render the latest audit, write `.commitshow/audit.{md,json}` |
| `commitshow status [target]` | Same render as `audit`, no re-run |
| `commitshow login [--no-open] [--token <jwt>]` | Device-flow sign-in via browser approval |
| `commitshow whoami [--logout]` | Print the linked account · `--logout` clears the saved token |
| `commitshow submit [target]` | Audition a project (coming soon · needs login) |
| `commitshow install <pack>` | Install a Library artifact (coming soon) |

### Sign in for higher rate limits

```bash
npx commitshow@latest login
```

Opens `commit.show/cli/link?code=<6-hex>` in your browser. After you
click Authorize there, the CLI receives a 90-day JWT and saves it to
`~/.commitshow/config.json` (file mode 0600). Subsequent calls send
the token in the Authorization header automatically.

What changes once signed in:

- Per-IP rate cap goes from **20 audits/day** to **50/day**
- Newly audited preview projects auto-claim ownership (visible at
  [commit.show/me](https://commit.show/me) → MY AUDITS)
- `commitshow whoami` prints your member id + email

Headless / CI? Use `--token <jwt>` to skip the browser handshake.

### Telemetry source flag

`--source=<tag>` lets you self-report how the call originated:

```bash
npx commitshow audit . --source=claude-code
COMMITSHOW_SOURCE=cursor npx commitshow audit .
```

Common tags: `claude-code` · `cursor` · `gemini-cli` · `codex` ·
`antigravity` · `production-audit-skill` · any 64-char string. Drops
into the maintainer's admin breakdown so we can see which agent
ecosystems are driving installs. Skip the flag to stay anonymous.

### Target forms

`audit` and `status` accept a positional target that auto-detects:

| Form | Example |
|---|---|
| cwd (omitted) | `commitshow audit` · infers from `git remote get-url origin` |
| Local path | `commitshow audit ./my-repo` |
| Remote URL | `commitshow audit github.com/owner/repo` · `commitshow audit https://github.com/owner/repo` |
| SSH remote | `commitshow audit git@github.com:owner/repo.git` (auto-converted) |
| Shorthand | `commitshow audit owner/repo` |

Remote-URL mode works from any directory, which makes one-line X posts
(`npx commitshow@latest audit <their-url>`) trivial.

> **AI agents — read this before invoking.** The CLI does **not** look up
> projects by name. `commitshow audit warp` will error: there is no
> agreed-upon mapping from the word "warp" to a single GitHub repo.
> If a user asks you to audit something by name, **first resolve the
> canonical `github.com/<owner>/<repo>` URL** (ask the user, or search
> github.com), then invoke `commitshow audit <that-url>`. The CLI does
> a HEAD pre-flight against `github.com/<owner>/<repo>` before any audit
> spend, so a hallucinated slug is rejected with a `not_found` error
> before we burn Claude credits — but you should still get the URL right
> on the first try by asking, not guessing.

## The AI-coding loop

`commitshow audit` in local mode writes to `.commitshow/audit.md` **and**
`.commitshow/audit.json` after every run. Point your coding agent at them
and it picks up exactly what the audit flagged, with no prompt engineering:

```
You are pairing on <repo>. Read .commitshow/audit.md before each turn.
Pick the top concern and propose a minimal change; I'll run
`commitshow audit` again to check the delta.
```

## For agents: `--json`

`commitshow` is built on a simple idea — **CLI + stable JSON is the universal
contract** between agent ecosystems. No SDK, no MCP server, no vendor lock.
Any agent that can shell out to a subprocess can use commit.show.

```bash
# Human
commitshow audit github.com/owner/repo

# Agent
commitshow audit github.com/owner/repo --json | jq '.concerns[].bullet'
```

### Example agent workflow

> "Check my commit.show score and fix anything under 80."

```
score=$(commitshow audit --json | jq '.score.total')
if [ "$score" -lt 80 ]; then
  commitshow audit --json | jq -r '.concerns[0].bullet'
  # → agent reads this concern, picks a fix, applies edits, re-audits
fi
```

### Auditing someone else's project (agent recipe)

When a user says "audit warp" or "what does commit.show say about Postiz",
**don't guess the slug.** Walk this loop:

```
1. Ask the user (or search github.com) for the canonical
   `github.com/<owner>/<repo>` URL. Don't invent one — repo names are
   ambiguous and a single wrong guess wastes an audit call.
2. Run:
     commitshow audit <that-url> --json
3. If stdout starts with `{"error":"not_found"`, the URL was wrong.
   Re-confirm with the user before retrying.
4. Otherwise parse `score.total`, `score.band`, `concerns[]` and
   answer the user with those exact numbers — don't paraphrase the
   score.
```

The CLI HEAD-checks `github.com/<owner>/<repo>` before any audit spend,
so a hallucinated slug fails fast with a clear `not_found` envelope.
The friendly error in the message body explicitly tells you to ask the
user instead of guessing again.

### JSON shape (v1 schema)

Stable by contract — additive fields don't bump `schema_version`; breaking
changes do. Known keys: `project`, `score`, `standing`, `strengths`, `concerns`,
`snapshot`. See `commitshow audit --json` output for the canonical example.

### Works with

- **Claude Code**, **Cursor**, **Windsurf** — any agent with shell access
- **GitHub Actions** — gate PRs on score band or axis scores
- **n8n / Zapier** — trigger workflows when scores move
- **AutoGPT / crewAI / LangChain** — subprocess tool node
- **Your own script** — 10 lines of bash + jq is the whole integration

## What's in the report

Top-to-bottom, what each section gives you:

- **COMMIT.SHOW masthead** · ANSI Shadow wordmark on terminals ≥ 100 cols. The thin rounded `╭ ✻ commit.show — Audit report ╮` strip is always rendered as the title fallback.
- **Findings counter** · `Findings · 1 critical · 1 warning · 3 strengths` — scan one line, you know the tone before reading the bullets.
- **What this build missed** · errors-first box. First concern is `✕` scarlet (highest-impact), the rest are `⚠` gold. Engine ranks them by decision-impact, not by severity tier.
- **What it got right** · `↑` teal · 3 bullets · for context only. Don't lead with these.
- **AI Coder 7 Frames** · the deterministic pillar — RLS coverage, secret-in-bundle, API rate limiting, prompt-injection surface, DB indexes, mock data in prod, error tracking. Pass / warn / fail per frame, with file paths.
- **Δ since last audit** · positive = improving · negative = regressed · null on first run.
- **`next:` hint** · one-line nudge to feed `--json | jq .concerns` into your coding agent.
- **Trophy block** · score billboard (metallic-gold gradient · ANSI Shadow digits) with the repo slug embedded so a screenshot crop is self-contained. Axis bars (Audit / Scout / Community) sit directly under it as the per-pillar breakdown. `commit.show` wordmark anchors the bottom-right.

Walk-on auditions cap the `Audit` axis at `45/50` and lock `Scout` / `Community` behind the audition gate; the captions explicitly call this out.

## Roadmap

- `0.1` — ✓ read-only audit · status · `--json` · target auto-detect · sidecar files
- `0.3` — ✓ device-flow login · `--source` telemetry · User-Agent self-report · MCP server (`commitshow-mcp`)
- `0.4` — `commitshow submit` · `--watch` mode · CI exit-code gate · refresh-token flow
- `0.5` — `commitshow install <pack>` with {{VARIABLE}} substitution

## Links

- Home — <https://commit.show>
- Source — <https://github.com/commitshow/cli>
- Issues — <https://github.com/commitshow/cli/issues>
- The platform repo — <https://github.com/commitshow/commitshow>

---

<p align="center">
  <strong>Built one repo at a time. <a href="https://commit.show">commit.show</a></strong>
</p>

<p align="center">
  MIT © 2026 commit.show
</p>
