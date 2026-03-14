/**
 * CTRF Jest Environment
 *
 * A Jest Environment that enables runtime API binding for CTRF.
 * This environment:
 * - Extends a base Jest Environment (node or jsdom)
 * - Hooks into test lifecycle via handleTestEvent
 * - Provides runtime message handling for metadata collection
 *
 * ## Configuration
 *
 * In jest.config.js:
 * ```js
 * module.exports = {
 *   testEnvironment: 'jest-ctrf-json-reporter/environment',
 * }
 * ```
 */

import type {
  EnvironmentContext,
  JestEnvironment,
  JestEnvironmentConfig,
} from '@jest/environment'
import type { Circus, Config as JestConfig } from '@jest/types'
import * as path from 'path'
import { CTRF_RUNTIME_KEY, type CtrfRuntimeMessage } from './runtime'
import { storeTestMetadata, type TestMetadata } from './storage'

/**
 * Configuration options for the CTRF Jest Environment
 */
export interface CtrfJestConfig {
  resultsDir?: string
  outputFile?: string
  minimal?: boolean
  testType?: string
  appName?: string
  appVersion?: string
  buildName?: string
  buildNumber?: string
  buildUrl?: string
  repositoryName?: string
  repositoryUrl?: string
  branchName?: string
  testEnvironment?: string
}

/**
 * Extended Jest config with CTRF options
 */
type CtrfJestEnvironmentConfig = JestEnvironmentConfig & {
  projectConfig: JestConfig.ProjectConfig & {
    testEnvironmentOptions?: CtrfJestConfig
  }
}

type CtrfJestProjectConfig = JestConfig.ProjectConfig & {
  testEnvironmentOptions?: CtrfJestConfig
}

/**
 * Context for the current test run
 */
interface RunContext {
  /** Stack of current executable UUIDs (tests/hooks) */
  executables: string[]
  /** Stack of scope UUIDs (describe blocks) */
  scopes: string[]
  /** Tests collected during the run */
  tests: Map<
    string,
    {
      name: string
      fullName: string
      filePath: string
      startedAt: number
      duration: number
      status: string
      errorMessage?: string
      errorTrace?: string
      metadata: TestMetadata
    }
  >
}

/**
 * Generate a unique test ID from the test path
 * Uses space separator to match Jest's fullName format
 */
function getTestId(testPath: string[]): string {
  return testPath.join(' ')
}

/**
 * Get the path of describe blocks leading to a test
 */
function getTestPath(test: Circus.TestEntry | Circus.DescribeBlock): string[] {
  const path: string[] = []
  let current: Circus.TestEntry | Circus.DescribeBlock | undefined = test

  while (current && current.name !== 'ROOT_DESCRIBE_BLOCK') {
    path.unshift(current.name)
    current = current.parent
  }

  return path
}

/**
 * Create CTRF Jest Environment factory.
 * Extends a base environment to add runtime API support.
 */
export function createCtrfJestEnvironment<T extends typeof JestEnvironment>(
  Base: T
): T {
  // @ts-expect-error TypeScript mixin class limitation
  return class CtrfJestEnvironment extends Base {
    private testPath: string
    private config: CtrfJestConfig
    private runContext: RunContext = {
      executables: [],
      scopes: [],
      tests: new Map(),
    }
    private runStart: number = 0

    constructor(
      config: CtrfJestEnvironmentConfig | CtrfJestProjectConfig,
      context: EnvironmentContext
    ) {
      super(config as JestEnvironmentConfig, context)

      // Handle both Jest v28+ and older versions
      const projectConfig =
        'projectConfig' in config ? config.projectConfig : config
      this.config = projectConfig?.testEnvironmentOptions || {}
      this.testPath = path.relative(projectConfig.rootDir, context.testPath)
    }

    async setup(): Promise<void> {
      await super.setup()
      this.runStart = Date.now()

      // Register the runtime handler in Jest's sandboxed global scope.
      // Jest uses `this.global` as the global object for test execution,
      // which is separate from Node's `globalThis`. Test code accesses
      // globals through this sandboxed scope, so we must inject here.
      const handler = (message: CtrfRuntimeMessage) => {
        this.handleRuntimeMessage(message)
      }
      ;(this.global as any)[CTRF_RUNTIME_KEY] = handler
    }

    async teardown(): Promise<void> {
      delete (this.global as any)[CTRF_RUNTIME_KEY]
      await super.teardown()
    }

    /**
     * Handle runtime messages from test code
     */
    handleRuntimeMessage(message: CtrfRuntimeMessage): void {
      const currentTestId = this.getCurrentTestId()
      if (!currentTestId) {
        // Outside test context - silently ignore
        return
      }

      const testData = this.runContext.tests.get(currentTestId)
      if (!testData) {
        return
      }

      if (message.type === 'extra') {
        testData.metadata.extra = this.deepMerge(
          testData.metadata.extra,
          message.data as Record<string, unknown>
        )
      }
    }

    /**
     * Deep merge two objects following CTRF merge rules:
     * - Arrays: concatenated
     * - Objects: recursively merged
     * - Primitives: overwritten
     */
    private deepMerge(
      target: Record<string, unknown>,
      source: Record<string, unknown>
    ): Record<string, unknown> {
      const result = { ...target }

      for (const [key, sourceValue] of Object.entries(source)) {
        const targetValue = result[key]

        if (Array.isArray(sourceValue)) {
          result[key] = Array.isArray(targetValue)
            ? [...targetValue, ...sourceValue]
            : [...sourceValue]
        } else if (
          sourceValue !== null &&
          typeof sourceValue === 'object' &&
          !Array.isArray(sourceValue)
        ) {
          result[key] =
            targetValue !== null &&
            typeof targetValue === 'object' &&
            !Array.isArray(targetValue)
              ? this.deepMerge(
                  targetValue as Record<string, unknown>,
                  sourceValue as Record<string, unknown>
                )
              : { ...sourceValue }
        } else {
          result[key] = sourceValue
        }
      }

      return result
    }

    /**
     * Get the current test ID from the run context
     */
    private getCurrentTestId(): string | undefined {
      if (this.runContext.executables.length === 0) {
        return undefined
      }
      return this.runContext.executables[this.runContext.executables.length - 1]
    }

    /**
     * Handle Jest Circus test events
     */
    handleTestEvent = (event: Circus.Event, _state: Circus.State): void => {
      switch (event.name) {
        case 'run_describe_start':
          this.handleSuiteStart()
          break
        case 'run_describe_finish':
          this.handleSuiteEnd()
          break
        case 'test_fn_start':
          this.handleTestStart(event.test)
          break
        case 'test_fn_success':
          this.handleTestPass(event.test)
          break
        case 'test_fn_failure':
          this.handleTestFail(event.test)
          break
        case 'test_skip':
          this.handleTestSkip(event.test)
          break
        case 'test_todo':
          this.handleTestTodo(event.test)
          break
        case 'run_finish':
          this.handleRunFinish()
          break
      }
    }

    private handleSuiteStart(): void {
      const scopeId = Math.random().toString(36).substring(2, 15)
      this.runContext.scopes.push(scopeId)
    }

    private handleSuiteEnd(): void {
      this.runContext.scopes.pop()
    }

    private handleTestStart(test: Circus.TestEntry): void {
      const testPath = getTestPath(test)
      const testId = getTestId(testPath)
      const fullName = `${this.testPath} > ${testId}`

      this.runContext.tests.set(testId, {
        name: test.name,
        fullName,
        filePath: this.testPath,
        startedAt: test.startedAt ?? Date.now(),
        duration: 0,
        status: 'other', // Will be updated
        metadata: {
          extra: {},
        },
      })

      this.runContext.executables.push(testId)
    }

    private handleTestPass(test: Circus.TestEntry): void {
      const testId = this.getCurrentTestId()
      if (!testId) return

      const testData = this.runContext.tests.get(testId)
      if (testData) {
        testData.status = 'passed'
        testData.duration = test.duration ?? 0
      }

      this.runContext.executables.pop()
    }

    private handleTestFail(test: Circus.TestEntry): void {
      const testId = this.getCurrentTestId()
      if (!testId) return

      const testData = this.runContext.tests.get(testId)
      if (testData) {
        testData.status = 'failed'
        testData.duration = test.duration ?? 0

        // Extract error information
        if (test.errors && test.errors.length > 0) {
          const error = test.errors[0]
          const errorObj = Array.isArray(error) ? error[0] : error

          if (errorObj instanceof Error) {
            testData.errorMessage = errorObj.message
            testData.errorTrace = errorObj.stack
          } else if (typeof errorObj === 'string') {
            testData.errorMessage = errorObj
          } else if (errorObj && typeof errorObj === 'object') {
            testData.errorMessage =
              (errorObj as any).message || String(errorObj)
            testData.errorTrace = (errorObj as any).stack
          }
        }
      }

      this.runContext.executables.pop()
    }

    private handleTestSkip(test: Circus.TestEntry): void {
      const testPath = getTestPath(test)
      const testId = getTestId(testPath)
      const fullName = `${this.testPath} > ${testId}`

      this.runContext.tests.set(testId, {
        name: test.name,
        fullName,
        filePath: this.testPath,
        startedAt: Date.now(),
        duration: 0,
        status: 'skipped',
        metadata: {
          extra: {},
        },
      })
    }

    private handleTestTodo(test: Circus.TestEntry): void {
      const testPath = getTestPath(test)
      const testId = getTestId(testPath)
      const fullName = `${this.testPath} > ${testId}`

      this.runContext.tests.set(testId, {
        name: test.name,
        fullName,
        filePath: this.testPath,
        startedAt: Date.now(),
        duration: 0,
        status: 'pending',
        metadata: {
          extra: {},
        },
      })
    }

    private handleRunFinish(): void {
      // Store metadata for each test so the reporter can consume it
      // The key is the test's fullName which matches what Jest Reporter receives
      for (const [_id, testData] of this.runContext.tests) {
        // Build the fullName that matches Jest's AssertionResult.fullName
        // Jest uses: "describe block > nested describe > test name"
        const fullName = testData.fullName.replace(`${this.testPath} > `, '')

        storeTestMetadata(fullName, {
          extra: { ...testData.metadata.extra },
        })
      }
    }
  }
}

// Default export: load NodeEnvironment
import NodeEnvironment from 'jest-environment-node'

// Create and export the default environment
export default createCtrfJestEnvironment(NodeEnvironment)
