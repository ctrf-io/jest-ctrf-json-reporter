import { type TestResult, type Test, type Status } from '@jest/test-result'
import { type Reporter, type ReporterContext } from '@jest/reporters'
import { type Config } from '@jest/types'
import {
  type CtrfReport,
  type CtrfTestState,
  type CtrfEnvironment,
} from '../types/ctrf'

import * as fs from 'fs'
import path = require('path')

interface ReporterConfigOptions {
  outputFile?: string
  outputDir?: string
  minimal?: boolean
  screenshot?: boolean
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
      this.ctrfReport.results.tests.push({
        name: testCaseResult.fullName,
        duration: testCaseResult.duration ?? 0,
        status: this.mapStatus(testCaseResult.status),
      })
    })
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
