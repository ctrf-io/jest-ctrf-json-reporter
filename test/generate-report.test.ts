import GenerateCtrfReport from '../src/generate-report'
import { TestResult, Status } from '@jest/test-result'
import { type ReporterContext } from '@jest/reporters'
import { Config } from '@jest/types'

interface ReporterConfigOptions {
  outputFile?: string
}

describe('GenerateCtrfReport', () => {
  let reporter: GenerateCtrfReport
  beforeEach(() => {
    const mockGlobalConfig: Config.GlobalConfig = {} as Config.GlobalConfig
    const mockreporterOptions: ReporterConfigOptions = {
      minimal: true,
    } as ReporterConfigOptions
    const mockreporterContext: ReporterContext = {} as ReporterContext
    reporter = new GenerateCtrfReport(
      mockGlobalConfig,
      mockreporterOptions,
      mockreporterContext
    )
  })

  describe('Set config options', () => {
    describe('filename', () => {
      it('should set filename from reporterConfigOptions if present', () => {
        const mockFilename = 'mockFilename.json'
        const mockGlobalConfig: Config.GlobalConfig = {} as Config.GlobalConfig
        const mockreporterOptions: ReporterConfigOptions = {
          outputFile: mockFilename,
        } as ReporterConfigOptions
        const mockreporterContext: ReporterContext = {} as ReporterContext
        reporter = new GenerateCtrfReport(
          mockGlobalConfig,
          mockreporterOptions,
          mockreporterContext
        )

        expect((reporter as any).filename).toBe(mockFilename)
      })

      it('should use default filename if reporterConfigOptions filename is not present', () => {
        expect((reporter as any).filename).toBe(
          (reporter as any).defaultOutputFile
        )
      })
    })
  })

  describe('setFilename', () => {
    it('should add .json extension if none provided', () => {
      ;(reporter as any).setFilename('myReport')
      expect((reporter as any).filename).toBe('myReport.json')
    })

    it('should keep .json extension if already provided', () => {
      ;(reporter as any).setFilename('myReport.json')
      expect((reporter as any).filename).toBe('myReport.json')
    })

    it('should append .json to any other extensions', () => {
      ;(reporter as any).setFilename('myReport.txt')
      expect((reporter as any).filename).toBe('myReport.txt.json')
    })
  })

  describe('updateCtrfTestResultsFromTestResult', () => {
    it('should update the ctrfReport with required test properties', () => {
      const mockTestCaseResult = {
        status: 'passed' as Status,
        fullName: 'Test Case Full Name',
        duration: 100,
      }
      const mockResult: TestResult = {
        testResults: [mockTestCaseResult],
      } as TestResult

      ;(reporter as any).updateCtrfTestResultsFromTestResult(mockResult)

      const updatedTestResult = reporter['ctrfReport'].results.tests[0]

      expect(updatedTestResult.name).toBe(mockTestCaseResult.fullName)
      expect(updatedTestResult.status).toBe(mockTestCaseResult.status)
      expect(updatedTestResult.duration).toBe(mockTestCaseResult.duration)
    })

    it.each([
      ['Test 1', 'passed', 100],
      ['Test 2', 'failed', 200],
      ['Test 3', 'skipped', 300],
      ['Test 4', 'pending', 50],
    ])(
      'should correctly update the ctrfReport for test "%s" with status "%s" and duration %i',
      (testTitle, status, duration) => {
        const mockTestCaseResult = {
          status: status as Status,
          fullName: testTitle,
          duration: duration,
        }
        const mockResult: TestResult = {
          testResults: [mockTestCaseResult],
        } as TestResult

        ;(reporter as any).updateCtrfTestResultsFromTestResult(mockResult)

        const updatedTestResult =
          reporter['ctrfReport'].results.tests[
            reporter['ctrfReport'].results.tests.length - 1
          ]

        expect(updatedTestResult.name).toBe(testTitle)
        expect(updatedTestResult.status).toBe(status)
        expect(updatedTestResult.duration).toBe(duration)
      }
    )

    it.each([['todo'], ['disabled'], ['focused']])(
      'should correctly update the ctrfReport for test with status "%s" as other',
      (status) => {
        const mockTestCaseResult = {
          status: status as Status,
          fullName: 'testTitle',
          duration: 100,
        }
        const mockResult: TestResult = {
          testResults: [mockTestCaseResult],
        } as TestResult

        ;(reporter as any).updateCtrfTestResultsFromTestResult(mockResult)

        const updatedTestResult =
          reporter['ctrfReport'].results.tests[
            reporter['ctrfReport'].results.tests.length - 1
          ]

        expect(updatedTestResult.status).toBe('other')
      }
    )
  })

  describe('updateTotalsFromTestResult', () => {
    it('should update the total tests count', () => {
      const mockTestCaseResult = {
        status: 'passed' as Status,
        fullName: 'Test Case Full Name',
        duration: 100,
      }
      const mockResult: TestResult = {
        testResults: [mockTestCaseResult],
      } as TestResult

      ;(reporter as any).updateTotalsFromTestResult(mockResult)

      expect(reporter['ctrfReport'].results.summary.tests).toBe(1)
    })

    it.each([
      ['passed', 1, 0, 0, 0, 0],
      ['failed', 0, 1, 0, 0, 0],
      ['skipped', 0, 0, 1, 0, 0],
      ['pending', 0, 0, 0, 1, 0],
      ['todo', 0, 0, 0, 0, 1],
      ['disabled', 0, 0, 0, 0, 1],
      ['focused', 0, 0, 0, 0, 1],
    ])(
      'should update for status %s',
      (status, passed, failed, skipped, pending, other) => {
        const mockTestCaseResult = {
          status: status as Status,
          fullName: 'Test Case Full Name',
          duration: 100,
        }
        const mockResult: TestResult = {
          testResults: [mockTestCaseResult],
        } as TestResult

        ;(reporter as any).updateTotalsFromTestResult(mockResult)

        expect(reporter['ctrfReport'].results.summary.passed).toBe(passed)
        expect(reporter['ctrfReport'].results.summary.failed).toBe(failed)
        expect(reporter['ctrfReport'].results.summary.skipped).toBe(skipped)
        expect(reporter['ctrfReport'].results.summary.pending).toBe(pending)
        expect(reporter['ctrfReport'].results.summary.other).toBe(other)
      }
    )
  })
})


describe('GenerateDetailedCtrfReport', () => {
  let reporter: GenerateCtrfReport
  beforeEach(() => {
    const mockGlobalConfig: Config.GlobalConfig = {} as Config.GlobalConfig
    const mockreporterOptions: ReporterConfigOptions = {
      minimal: false
    } as ReporterConfigOptions
    const mockreporterContext: ReporterContext = {} as ReporterContext
    reporter = new GenerateCtrfReport(
      mockGlobalConfig,
      mockreporterOptions,
      mockreporterContext
    )
  })

  it('should update the ctrfReport message with error description from failureMessages on failed builds', () => {
    const mockTestCaseResult = {
      status: 'failed' as Status,
      fullName: 'Test Case Full Name',
      ancestorTitles: ['parent'],
      duration: 100,
      
      failureMessages: ['Error: \u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoBe\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m) // Object.is equality\u001b[22m\n\nExpected: \u001b[32m\"b\"\u001b[39m\nReceived: \u001b[31mundefined\u001b[39m\n    at Object.<anonymous> (/jest-ctrf-json-reporter/test/generate-report.test.ts:133:41)\n    at Promise.then.completed (/jest-ctrf-json-reporter/node_modules/jest-circus/build/utils.js:298:28)\n)'] 
    }
    const mockResult: TestResult = {
      testFilePath: '/path/to/test.ts',
      testResults: [mockTestCaseResult],
    } as TestResult

    ;(reporter as any).updateCtrfTestResultsFromTestResult(mockResult)

    const updatedTestResult = reporter['ctrfReport'].results.tests[0]

    expect(updatedTestResult.message).toBe('Error: expect(received).toBe(expected) // Object.is equality\n\nExpected: "b"\nReceived: undefined\n')
  })

  it('should update the ctrfReport trace with stack trace from failureMessage on failed builds', () => {
    const mockTestCaseResult = {
      status: 'failed' as Status,
      fullName: 'Test Case Full Name',
      ancestorTitles: ['parent'],
      duration: 100,
      
      failureMessages: ['Error: \u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoBe\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m) // Object.is equality\u001b[22m\n\nExpected: \u001b[32m\"b\"\u001b[39m\nReceived: \u001b[31mundefined\u001b[39m\n    at Object.<anonymous> (/jest-ctrf-json-reporter/test/generate-report.test.ts:133:41)\n    at Promise.then.completed (/jest-ctrf-json-reporter/node_modules/jest-circus/build/utils.js:298:28)\n'] 
    }
    const mockResult: TestResult = {
      testFilePath: '/path/to/test.ts',
      testResults: [mockTestCaseResult],
    } as TestResult

    ;(reporter as any).updateCtrfTestResultsFromTestResult(mockResult)

    const updatedTestResult = reporter['ctrfReport'].results.tests[0]

    expect(updatedTestResult.trace).toBe('at Object.<anonymous> (/jest-ctrf-json-reporter/test/generate-report.test.ts:133:41)\nat Promise.then.completed (/jest-ctrf-json-reporter/node_modules/jest-circus/build/utils.js:298:28)\n')
  })

})