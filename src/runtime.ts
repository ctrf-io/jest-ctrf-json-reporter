/**
 * CTRF Runtime API for Jest
 *
 * Enables enriching CTRF test reports with custom metadata at runtime.
 * Metadata is collected via the Jest Environment and consolidated
 * into the test's `extra` field in the CTRF JSON.
 *
 * ## Usage
 *
 * ```ts
 * import { extra, ctrf } from 'jest-ctrf-json-reporter/runtime'
 *
 * test('checkout flow', () => {
 *   extra({ owner: 'checkout-team', priority: 'P1' })
 *   // or
 *   ctrf.extra({ owner: 'checkout-team', priority: 'P1' })
 * })
 * ```
 *
 * ## API
 *
 * - `extra(data)` / `ctrf.extra(data)` - Attach arbitrary key-value metadata
 *
 * ## Behavior
 *
 * - Call multiple times; all data is collected and deep merged
 * - Arrays are concatenated
 * - Nested objects are recursively merged
 * - Primitives are overwritten by later calls
 * - Works from any function in the call stack during test execution
 * - Silently ignored when called outside test context
 */

/**
 * Runtime message types
 */
export type CtrfRuntimeMessageType = 'extra'

/**
 * A runtime message sent from test code to the environment
 */
export interface CtrfRuntimeMessage {
  type: CtrfRuntimeMessageType
  data: unknown
}

/**
 * Global key for the runtime function.
 * The Jest Environment sets this so runtime calls can find the handler.
 * @internal - exported for consistency between environment and runtime
 */
export const CTRF_RUNTIME_KEY = '__ctrfTestRuntime'

/**
 * Get the runtime handler from global context.
 * Returns undefined if not in a test context.
 */
function getRuntime(): ((message: CtrfRuntimeMessage) => void) | undefined {
  return (globalThis as any)[CTRF_RUNTIME_KEY]
}

/**
 * Send a runtime message if we're in test context.
 * Silently no-ops if outside test context.
 */
function sendMessage(message: CtrfRuntimeMessage): void {
  const runtime = getRuntime()
  if (runtime) {
    runtime(message)
  }
}

/**
 * Attach arbitrary key-value metadata to the current test.
 * Multiple calls are deep-merged.
 *
 * @param data - An object containing metadata to attach
 */
export function extra(data: Record<string, unknown>): void {
  sendMessage({ type: 'extra', data })
}

/**
 * CTRF namespace for convenience.
 * Provides the same API as the direct exports for users who prefer `ctrf.extra()` syntax.
 */
export const ctrf = {
  extra,
} as const

// --------------------
// Internal exports for the environment
// --------------------

/**
 * Register the runtime handler (called by Jest Environment).
 * @internal
 */
export function __setRuntime(
  handler: (message: CtrfRuntimeMessage) => void
): void {
  ;(globalThis as any)[CTRF_RUNTIME_KEY] = handler
}

/**
 * Clear the runtime handler (called by Jest Environment on teardown).
 * @internal
 */
export function __clearRuntime(): void {
  delete (globalThis as any)[CTRF_RUNTIME_KEY]
}

/**
 * Export the runtime key for testing/debugging.
 * @internal
 */
export const __RUNTIME_KEY = CTRF_RUNTIME_KEY
