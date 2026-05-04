// commitshow login — device-flow authorization.
//
// Default flow:
//   1. POST /functions/v1/cli-link-init · receive { code, poll_token, verification_url }
//   2. Print the code + URL · open the URL in the user's browser (unless --no-open)
//   3. Poll /functions/v1/cli-link-poll every 2s until 'ok' (token returned),
//      'expired', or timeout (10 min).
//   4. Save the api_token + member info to ~/.commitshow/config.json
//
// --token mode: skip the browser handshake and accept a pre-minted JWT
//   (useful for headless / CI environments).
//
// --no-open: don't auto-launch the browser, just print the URL.

import { readConfig, writeConfig } from '../lib/config.js'
import { c } from '../lib/colors.js'

const POLL_INTERVAL_MS = 2000
const POLL_TIMEOUT_MS  = 10 * 60 * 1000
const DEFAULT_BASE_URL = 'https://tekemubwihsjdzittoqf.supabase.co'
const DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRla2VtdWJ3aWhzamR6aXR0b3FmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MzQ1NzUsImV4cCI6MjA5MjAxMDU3NX0.n2K-3lFVvlXQx-bV9evdNRSQCtG5oC4uQushxB2ja9Y'

function baseUrl(): string {
  return readConfig().base_url ?? DEFAULT_BASE_URL
}

function tryOpen(url: string): void {
  // Best-effort cross-platform open. Failure is silent — user still has
  // the URL printed and can copy/paste manually.
  const cmd  = process.platform === 'darwin' ? 'open'
            : process.platform === 'win32'  ? 'cmd'
            : 'xdg-open'
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url]
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { spawn } = require('node:child_process')
    spawn(cmd, args, { stdio: 'ignore', detached: true }).unref()
  } catch { /* ignore */ }
}

async function fetchUser(token: string): Promise<{ id: string; email?: string | null } | null> {
  try {
    const res = await fetch(`${baseUrl()}/auth/v1/user`, {
      headers: { apikey: DEFAULT_ANON_KEY, Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    const j = await res.json() as { id: string; email?: string }
    return { id: j.id, email: j.email ?? null }
  } catch { return null }
}

export async function login(args: string[]): Promise<number> {
  const noOpen      = args.includes('--no-open')
  const tokenIdx    = args.indexOf('--token')
  const presetToken = tokenIdx >= 0 ? args[tokenIdx + 1] : null

  // Headless / CI path · skip the browser handshake.
  if (presetToken) {
    const user = await fetchUser(presetToken)
    if (!user) {
      console.error(c.scarlet('✗ Token rejected · invalid or expired.'))
      return 1
    }
    writeConfig({ ...readConfig(), token: presetToken, member_id: user.id, display_name: user.email ?? undefined })
    console.log(c.gold('✓ Logged in · token saved to ~/.commitshow/config.json'))
    return 0
  }

  // 1. Init the device-flow.
  let init: { code?: string; poll_token?: string; verification_url?: string; expires_in?: number; error?: string }
  try {
    const res = await fetch(`${baseUrl()}/functions/v1/cli-link-init`, {
      method: 'POST',
      headers: { apikey: DEFAULT_ANON_KEY, Authorization: `Bearer ${DEFAULT_ANON_KEY}`, 'Content-Type': 'application/json' },
      body: '{}',
    })
    init = await res.json() as typeof init
    if (!res.ok || !init.code || !init.poll_token) {
      console.error(c.scarlet(`✗ Init failed: ${init.error ?? `HTTP ${res.status}`}`))
      return 1
    }
  } catch (e) {
    console.error(c.scarlet(`✗ Init network error: ${(e as Error)?.message ?? e}`))
    return 1
  }

  console.log('')
  console.log(c.cream('  Authorize commitshow CLI to act on your account.'))
  console.log('')
  console.log(`  Verification code:  ${c.gold(init.code)}`)
  console.log(`  Approve at:         ${init.verification_url}`)
  console.log('')
  console.log(c.dim('  Waiting for approval (10 min timeout)…'))
  console.log('')

  if (!noOpen && init.verification_url) tryOpen(init.verification_url)

  // 2. Poll until approved / expired / timeout.
  const deadline = Date.now() + POLL_TIMEOUT_MS
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
    try {
      const res = await fetch(`${baseUrl()}/functions/v1/cli-link-poll`, {
        method: 'POST',
        headers: { apikey: DEFAULT_ANON_KEY, Authorization: `Bearer ${DEFAULT_ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ poll_token: init.poll_token }),
      })
      const resp = await res.json() as { status?: string; api_token?: string; user_id?: string; message?: string }
      if (resp.status === 'ok' && resp.api_token) {
        writeConfig({ ...readConfig(), token: resp.api_token, member_id: resp.user_id ?? undefined })
        console.log(c.gold('  ✓ Authorized · token saved to ~/.commitshow/config.json'))
        const user = await fetchUser(resp.api_token)
        if (user?.email) writeConfig({ ...readConfig(), display_name: user.email })
        return 0
      }
      if (resp.status === 'expired' || resp.status === 'consumed') {
        console.error(c.scarlet(`  ✗ ${resp.message ?? resp.status}`))
        return 1
      }
      // status === 'pending' · keep polling.
    } catch {
      // transient · keep polling.
    }
  }
  console.error(c.scarlet('  ✗ Timed out waiting for approval (10 min). Re-run commitshow login.'))
  return 1
}
