/**
 * TEMPORARY diagnostic instrumentation for the P1 tab-refocus/state-loss
 * investigation (Pre-Integration Stabilization Gate). Logs concise,
 * ordered lifecycle events with a single grep-able prefix so the exact
 * runtime trigger can be captured from a live (production) repro with
 * DevTools Console open, filtered to "[ELIORA-LIFECYCLE]".
 *
 * MUST BE REMOVED once the root cause is confirmed and properly fixed —
 * this file and every call site exist only to gather evidence, not as
 * permanent product logging. Logs no tokens, secrets, session contents,
 * or PII — user ids only, and only when explicitly useful.
 */

const PREFIX = '[ELIORA-LIFECYCLE]'
let seq = 0

export function logLifecycle(label: string, data?: Record<string, unknown>): void {
  seq += 1
  const t = performance.now().toFixed(0)
  if (data && Object.keys(data).length > 0) {
    // eslint-disable-next-line no-console
    console.log(`${PREFIX} #${seq} [+${t}ms] ${label}`, data)
  } else {
    // eslint-disable-next-line no-console
    console.log(`${PREFIX} #${seq} [+${t}ms] ${label}`)
  }
}
