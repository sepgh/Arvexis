/**
 * Forwards browser console.warn and console.error to the server so they
 * appear in the same log file as backend events.
 *
 * Import and call installClientLogger() once from main.tsx.
 * Only overrides warn and error — debug/info stay browser-only.
 */

const postLog = (level: string, args: unknown[]): void => {
  const message = args
    .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
    .join(' ')
  // Fire-and-forget; keepalive ensures delivery even on page unload
  fetch('/api/logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ level, message }),
    keepalive: true,
  }).catch(() => {
    /* ignore network errors — server may not be reachable */
  })
}

export function installClientLogger(): void {
  const originalWarn  = console.warn.bind(console)
  const originalError = console.error.bind(console)

  console.warn = (...args: unknown[]) => {
    originalWarn(...args)
    postLog('warn', args)
  }

  console.error = (...args: unknown[]) => {
    originalError(...args)
    postLog('error', args)
  }
}
