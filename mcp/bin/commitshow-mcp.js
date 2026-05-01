#!/usr/bin/env node
import('../dist/index.js').catch((e) => {
  // eslint-disable-next-line no-console
  console.error('commitshow-mcp failed to start:', e && (e.stack || e.message || e))
  process.exit(1)
})
