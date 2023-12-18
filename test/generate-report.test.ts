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
    const mockreporterOptions: ReporterConfigOptions =
      {} as ReporterConfigOptions
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
