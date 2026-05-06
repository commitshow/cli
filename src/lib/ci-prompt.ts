// Post-audit nudge · ask the user whether to wire the audit into CI
// by writing .github/workflows/audit.yml in their repo. Highest-intent
// moment (they just saw their score and concerns) and the cheapest
// possible install path (one file, one commit).
//
// Skipped silently when:
//   · stdout/stdin isn't a TTY (CI, scripted use)
//   · target isn't a git repo
//   · the repo has no github.com remote
//   · the workflow file already exists (don't overwrite)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { c } from './colors.js'

const WORKFLOW_REL_PATH = '.github/workflows/audit.yml'
const WORKFLOW_BODY = `name: audit
on:
  pull_request:

permissions:
  pull-requests: write

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: commitshow/audit-action@v1
`

function isGitRepo(path: string): boolean {
  return existsSync(join(path, '.git'))
}

function hasGithubRemote(path: string): boolean {
  try {
    const cfg = readFileSync(join(path, '.git', 'config'), 'utf8')
    return /url\s*=\s*[^\n]*github\.com/i.test(cfg)
  } catch {
    return false
  }
}

function existingWorkflow(path: string): boolean {
  return existsSync(join(path, WORKFLOW_REL_PATH))
}

async function ask(question: string, defaultYes = true): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const raw = await rl.question(question + ' ')
    const ans = raw.trim().toLowerCase()
    if (ans === '') return defaultYes
    return ans === 'y' || ans === 'yes'
  } finally {
    rl.close()
  }
}

export async function maybeOfferCi(localPath: string): Promise<void> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return
  if (!isGitRepo(localPath))       return
  if (!hasGithubRemote(localPath)) return
  if (existingWorkflow(localPath)) return

  console.log('')
  console.log(c.muted('  Want this audit to run on every pull request?'))
  console.log(c.muted(`  Drops a single file at ${WORKFLOW_REL_PATH} that uses commitshow/audit-action@v1.`))
  console.log(c.muted('  The action posts a sticky comment on each PR so regressions surface in review.'))

  let yes: boolean
  try {
    yes = await ask(c.gold('  Add the workflow? [Y/n]'), true)
  } catch {
    // Reading from stdin can throw on unusual terminal states (e.g. piped
    // input that closes mid-read). Treat as "no" rather than crashing.
    return
  }
  if (!yes) {
    console.log(c.dim('  Skipped. Run again later or copy the YAML from https://github.com/commitshow/audit-action.'))
    return
  }

  try {
    const dir = join(localPath, '.github', 'workflows')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(localPath, WORKFLOW_REL_PATH), WORKFLOW_BODY, 'utf8')
    console.log(c.gold(`  ✓ Wrote ${WORKFLOW_REL_PATH}`))
    console.log(c.muted('  Next: commit and push, then open a pull request — the score will post automatically.'))
  } catch (e) {
    console.log(c.scarlet(`  Could not write ${WORKFLOW_REL_PATH}: ${(e as Error).message}`))
  }
}
