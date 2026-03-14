export { default } from './generate-report'

// Re-export runtime API for use in tests
export * from './runtime'

// Re-export storage for advanced usage
export {
  storeTestMetadata,
  consumeTestMetadata,
  peekTestMetadata,
  clearAllMetadata,
  getMetadataCount,
  type TestMetadata,
} from './storage'

// Re-export environment
export {
  default as CtrfJestEnvironment,
  createCtrfJestEnvironment,
  type CtrfJestConfig,
} from './environment'
