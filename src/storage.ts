/**
 * CTRF Jest Runtime Storage
 *
 * Shared storage for runtime metadata between Jest Environment and Reporter.
 * The Environment writes metadata during test execution.
 * The Reporter reads metadata when generating the CTRF report.
 */

/**
 * Runtime metadata collected for a single test
 */
export interface TestMetadata {
  extra: Record<string, unknown>
}

/**
 * Global key for runtime metadata storage
 */
const CTRF_METADATA_STORE_KEY = '__ctrfMetadataStore'

/**
 * Get or create the metadata store
 */
function getStore(): Map<string, TestMetadata> {
  const g = globalThis as any
  if (!g[CTRF_METADATA_STORE_KEY]) {
    g[CTRF_METADATA_STORE_KEY] = new Map<string, TestMetadata>()
  }
  return g[CTRF_METADATA_STORE_KEY]
}

/**
 * Store metadata for a test (called by Environment)
 * @param testId - Unique test identifier (typically fullName)
 * @param metadata - The metadata to store
 */
export function storeTestMetadata(
  testId: string,
  metadata: TestMetadata
): void {
  getStore().set(testId, metadata)
}

/**
 * Retrieve and remove metadata for a test (called by Reporter)
 * @param testId - Unique test identifier
 * @returns The metadata if found, undefined otherwise
 */
export function consumeTestMetadata(testId: string): TestMetadata | undefined {
  const store = getStore()
  const metadata = store.get(testId)
  if (metadata) {
    store.delete(testId)
  }
  return metadata
}

/**
 * Get metadata without removing it (for debugging)
 * @param testId - Unique test identifier
 */
export function peekTestMetadata(testId: string): TestMetadata | undefined {
  return getStore().get(testId)
}

/**
 * Clear all stored metadata
 */
export function clearAllMetadata(): void {
  getStore().clear()
}

/**
 * Get count of stored metadata entries (for debugging)
 */
export function getMetadataCount(): number {
  return getStore().size
}
