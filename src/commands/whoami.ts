import { readConfig, writeConfig } from '../lib/config.js'
import { c } from '../lib/colors.js'

const DEFAULT_BASE_URL = 'https://tekemubwihsjdzittoqf.supabase.co'
const DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRla2VtdWJ3aWhzamR6aXR0b3FmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MzQ1NzUsImV4cCI6MjA5MjAxMDU3NX0.n2K-3lFVvlXQx-bV9evdNRSQCtG5oC4uQushxB2ja9Y'

async function verifyToken(token: string): Promise<{ id: string; email?: string | null } | null> {
  try {
    const res = await fetch(`${DEFAULT_BASE_URL}/auth/v1/user`, {
      headers: { apikey: DEFAULT_ANON_KEY, Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    const j = await res.json() as { id: string; email?: string }
    return { id: j.id, email: j.email ?? null }
  } catch { return null }
}

export async function whoami(args: string[]): Promise<number> {
  const cfg = readConfig()
  // --logout · convenience flag · clears token from local config.
  if (args.includes('--logout')) {
    if (!cfg.token) { console.log(c.dim('Already signed out.')); return 0 }
    const next = { ...cfg }
    delete next.token; delete next.member_id; delete next.display_name; delete next.refresh_token
    writeConfig(next)
    console.log(c.gold('✓ Signed out · token cleared from ~/.commitshow/config.json'))
    return 0
  }

  if (!cfg.token) {
    console.log(c.muted('Not signed in.'))
    console.log(c.dim('  Run `commitshow login` to authorize a 90-day API token.'))
    return 1
  }
  // Verify the saved token is still valid (not expired or revoked).
  const user = await verifyToken(cfg.token)
  if (!user) {
    console.log(c.scarlet('✗ Token rejected (expired or revoked).'))
    console.log(c.dim('  Re-run `commitshow login`.'))
    return 1
  }
  console.log('')
  if (cfg.display_name) console.log(`  ${c.cream(cfg.display_name)}`)
  if (user.email && user.email !== cfg.display_name) console.log(`  email:      ${user.email}`)
  console.log(`  member id:  ${user.id}`)
  console.log('')
  return 0
}
