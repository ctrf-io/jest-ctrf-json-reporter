import {
  type TestResult,
  type Test,
  type Status,
  type AssertionResult,
} from '@jest/test-result'
import { type Reporter, type ReporterContext } from '@jest/reporters'
import { type Config } from '@jest/types'
import {
  type CtrfReport,
  type CtrfTestState,
  type CtrfEnvironment,
  type CtrfTest,
} from '../types/ctrf'

import * as fs from 'fs'
import path = require('path')

interface ReporterConfigOptions {
  outputFile?: string
  outputDir?: string
  minimal?: boolean
  testType?: string
  appName?: string | undefined
  appVersion?: string | undefined
  osPlatform?: string | undefined
  osRelease?: string | undefined
  osVersion?: string | undefined
  buildName?: string | undefined
  buildNumber?: string | undefined
}

class GenerateCtrfReport implements Reporter {
  readonly ctrfReport: CtrfReport
  readonly ctrfEnvironment: CtrfEnvironment
  readonly reporterConfigOptions: ReporterConfigOptions
  readonly reporterName = 'jest-ctrf-json-reporter'
  readonly defaultOutputFile = 'ctrf-report.json'
  readonly defaultOutputDir = 'ctrf'

  filename = this.defaultOutputFile

  constructor(
    _globalConfig: Config.GlobalConfig,
    reporterOptions: ReporterConfigOptions,
    _reporterContext: ReporterContext
  ) {
    this.reporterConfigOptions = {
      outputFile: reporterOptions?.outputFile ?? this.defaultOutputFile,
      outputDir: reporterOptions?.outputDir ?? this.defaultOutputDir,
      minimal: reporterOptions?.minimal ?? false,
      testType: reporterOptions.testType ?? 'unit',
      appName: reporterOptions?.appName ?? undefined,
      appVersion: reporterOptions?.appVersion ?? undefined,
      osPlatform: reporterOptions?.osPlatform ?? undefined,
      osRelease: reporterOptions?.osRelease ?? undefined,
      osVersion: reporterOptions?.osVersion ?? undefined,
      buildName: reporterOptions?.buildName ?? undefined,
      buildNumber: reporterOptions?.buildNumber ?? undefined,
    }

    this.ctrfReport = {
      results: {
        tool: {
          name: 'jest',
        },
        summary: {
          tests: 0,
          passed: 0,
          failed: 0,
          pending: 0,
          skipped: 0,
          other: 0,
          start: 0,
          stop: 0,
        },
        tests: [],
      },
    }

    this.ctrfEnvironment = {}

    if (this.reporterConfigOptions?.outputFile !== undefined)
      this.setFilename(this.reporterConfigOptions.outputFile)

    if (
      !fs.existsSync(
        this.reporterConfigOptions.outputDir ?? this.defaultOutputDir
      )
    ) {
      fs.mkdirSync(
        this.reporterConfigOptions.outputDir ?? this.defaultOutputDir,
        { recursive: true }
      )
    }
  }

  onRunStart(): void {
    this.ctrfReport.results.summary.start = Date.now()
    this.setEnvironmentDetails(this.reporterConfigOptions ?? {})
    if (this.hasEnvironmentDetails(this.ctrfEnvironment)) {
      this.ctrfReport.results.environment = this.ctrfEnvironment
    }
  }

  onTestStart(): void {}

  onTestResult(_test: Test, testResult: TestResult): void {
    this.updateCtrfTestResultsFromTestResult(testResult)
    this.updateTotalsFromTestResult(testResult)
  }

  onRunComplete(): void {
    this.ctrfReport.results.summary.stop = Date.now()
    this.writeReportToFile(this.ctrfReport)
  }

  private setFilename(filename: string): void {
    if (filename.endsWith('.json')) {
      this.filename = filename
    } else {
      this.filename = `${filename}.json`
    }
  }

  private updateCtrfTestResultsFromTestResult(testResult: TestResult): void {
    testResult.testResults.forEach((testCaseResult) => {
      const test: CtrfTest = {
        name: testCaseResult.fullName,
        duration: testCaseResult.duration ?? 0,
        status: this.mapStatus(testCaseResult.status),
      }

      if (this.reporterConfigOptions.minimal === false) {
        test.message = this.extractFailureDetails(testCaseResult).message
        test.trace = this.extractFailureDetails(testCaseResult).trace
        test.rawStatus = testCaseResult.status
        test.type = this.reporterConfigOptions.testType ?? 'unit'
        test.filePath = testResult.testFilePath
        test.retries = (testCaseResult.invocations ?? 1) - 1
        test.flaky =
          testCaseResult.status === 'passed' &&
          (testCaseResult.invocations ?? 1) - 1 > 0
        test.suite = this.buildSuitePath(testResult, testCaseResult)
      }

      this.ctrfReport.results.tests.push(test)
    })
  }

  extractFailureDetails(testResult: AssertionResult): Partial<CtrfTest> {
    const messageStackTracePattern = /^\s{4}at/mu
    // eslint-disable-next-line no-control-regex
    const colorCodesPattern = /\x1b\[\d+m/gmu

    if (
      testResult.status === 'failed' &&
      testResult.failureMessages !== undefined
    ) {
      const failureDetails: Partial<CtrfTest> = {}
      if (testResult.failureMessages !== undefined) {
        const joinedMessages = testResult.failureMessages.join('\n')
        const match = joinedMessages.match(messageStackTracePattern)
        failureDetails.message = joinedMessages
          .slice(0, match?.index)
          .replace(colorCodesPattern, '')
        failureDetails.trace = joinedMessages
          .slice(match?.index)
          .split('\n')
          .map((line) => {
            return line.trim()
          })
          .join('\n')
      }

      if (testResult.failureDetails !== undefined) {
        failureDetails.trace = testResult.failureMessages.join('\r\n')
      }
      return failureDetails
    }
    return {}
  }

  private updateTotalsFromTestResult(testResult: TestResult): void {
    testResult.testResults.forEach((testCaseResult) => {
      const ctrfStatus = this.mapStatus(testCaseResult.status)
      this.ctrfReport.results.summary[ctrfStatus]++
      this.ctrfReport.results.summary.tests++
    })
  }

  private mapStatus(jestStatus: Status): CtrfTestState {
    switch (jestStatus) {
      case 'passed':
        return 'passed'
      case 'failed':
        return 'failed'
      case 'skipped':
        return 'skipped'
      case 'pending':
        return 'pending'
      case 'todo':
      case 'disabled':
      case 'focused':
      default:
        return 'other'
    }
  }

  setEnvironmentDetails(reporterConfigOptions: ReporterConfigOptions): void {
    if (reporterConfigOptions.appName !== undefined) {
      this.ctrfEnvironment.appName = reporterConfigOptions.appName
    }
    if (reporterConfigOptions.appVersion !== undefined) {
      this.ctrfEnvironment.appVersion = reporterConfigOptions.appVersion
    }
    if (reporterConfigOptions.osPlatform !== undefined) {
      this.ctrfEnvironment.osPlatform = reporterConfigOptions.osPlatform
    }
    if (reporterConfigOptions.osRelease !== undefined) {
      this.ctrfEnvironment.osRelease = reporterConfigOptions.osRelease
    }
    if (reporterConfigOptions.osVersion !== undefined) {
      this.ctrfEnvironment.osVersion = reporterConfigOptions.osVersion
    }
    if (reporterConfigOptions.buildName !== undefined) {
      this.ctrfEnvironment.buildName = reporterConfigOptions.buildName
    }
    if (reporterConfigOptions.buildNumber !== undefined) {
      this.ctrfEnvironment.buildNumber = reporterConfigOptions.buildNumber
    }
  }

  hasEnvironmentDetails(environment: CtrfEnvironment): boolean {
    return Object.keys(environment).length > 0
  }

  buildSuitePath(
    testResult: TestResult,
    testCaseResult: AssertionResult
  ): string {
    const fileName = testResult.testFilePath.split('/').pop() ?? ''
    const suiteParts = [fileName, ...testCaseResult.ancestorTitles]
    return suiteParts.join(' > ')
  }

  private writeReportToFile(data: CtrfReport): void {
    const filePath = path.join(
      this.reporterConfigOptions.outputDir ?? this.defaultOutputDir,
      this.filename
    )
    const str = JSON.stringify(data, null, 2)
    try {
      fs.writeFileSync(filePath, str + '\n')
      console.log(
        `${this.reporterName}: successfully written ctrf json to %s/%s`,
        this.reporterConfigOptions.outputDir,
        this.filename
      )
    } catch (error) {
      console.error(`Error writing ctrf json report:, ${String(error)}`)
    }
  }
}

export default GenerateCtrfReport
