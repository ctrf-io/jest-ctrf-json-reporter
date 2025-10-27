# Jest JSON Test Results Report

> Save Jest test results as a JSON file

![Static Badge](https://img.shields.io/badge/official-red?label=ctrf&labelColor=green)
[![build](https://github.com/ctrf-io/jest-ctrf-json-reporter/actions/workflows/main.yaml/badge.svg)](https://github.com/ctrf-io/jest-ctrf-json-reporter/actions/workflows/main.yaml)
![NPM Downloads](https://img.shields.io/npm/d18m/jest-ctrf-json-reporter?logo=npm)
![npm bundle size](https://img.shields.io/bundlephobia/minzip/jest-ctrf-json-reporter?label=Size)
![GitHub Repo stars](https://img.shields.io/github/stars/ctrf-io/jest-ctrf-json-reporter)

A Jest test reporter to create test reports that follow the CTRF standard.

[Common Test Report Format](https://ctrf.io) ensures the generation of uniform JSON test reports, independent of programming languages or test framework in use.

<div align="center">
<div style="padding: 1.5rem; border-radius: 8px; margin: 1rem 0; border: 1px solid #30363d;">
<span style="font-size: 23px;">💚</span>
<h3 style="margin: 1rem 0;">CTRF tooling is open source and free to use</h3>
<p style="font-size: 16px;">Support the project by giving it a follow and a star ⭐</p>

<div style="margin-top: 1.5rem;">
<a href="https://github.com/ctrf-io/jest-ctrf-json-reporter">
<img src="https://img.shields.io/github/stars/ctrf-io/jest-ctrf-json-reporter?style=for-the-badge&color=2ea043" alt="GitHub stars">
</a>
<a href="https://github.com/ctrf-io">
<img src="https://img.shields.io/github/followers/ctrf-io?style=for-the-badge&color=2ea043" alt="GitHub followers">
</a>
</div>
</div>

<p style="font-size: 14px; margin: 1rem 0;">

Contributions are very welcome! <br/>
Explore more <a href="https://www.ctrf.io/integrations">integrations</a> <br/>
<a href="https://app.formbricks.com/s/cmefs524mhlh1tl01gkpvefrb">Let us know your thoughts</a>.

</p>
</div>

## Features

- Generate JSON test reports that are [CTRF](https://ctrf.io) compliant
- Straightforward integration with Jest

```json
{
  "results": {
    "tool": {
      "name": "jest"
    },
    "summary": {
      "tests": 1,
      "passed": 1,
      "failed": 0,
      "pending": 0,
      "skipped": 0,
      "other": 0,
      "start": 1706828654274,
      "stop": 1706828655782
    },
    "tests": [
      {
        "name": "ctrf should generate the same report with any tool",
        "status": "passed",
        "duration": 100
      }
    ],
    "environment": {
      "appName": "MyApp",
      "buildName": "MyBuild",
      "buildNumber": "1"
    }
  }
}
```

## What is CTRF?

CTRF is a universal JSON test report schema that addresses the lack of a standardized format for JSON test reports.

**Consistency Across Tools:** Different testing tools and frameworks often produce reports in varied formats. CTRF ensures a uniform structure, making it easier to understand and compare reports, regardless of the testing tool used.

**Language and Framework Agnostic:** It provides a universal reporting schema that works seamlessly with any programming language and testing framework.

**Facilitates Better Analysis:** With a standardized format, programatically analyzing test outcomes across multiple platforms becomes more straightforward.

## Installation

```bash
npm install --save-dev jest-ctrf-json-reporter
```

Add the reporter to your jest.config.js file:

```javascript
reporters: [
  'default',
  ['jest-ctrf-json-reporter', {}],
],
```

Run your tests:

```bash
npx jest
```

You'll find a JSON file named `ctrf-report.json` in the `ctrf` directory.

## Reporter Options

The reporter supports several configuration options:

```javascript
reporter: [
  ['jest-ctrf-json-reporter', {
    outputFile: 'custom-name.json', // Optional: Output file name. Defaults to 'ctrf-report.json'.
    outputDir: 'custom-directory',  // Optional: Output directory path. Defaults to 'ctrf'.
    minimal: true,                  // Optional: Generate a minimal report. Defaults to 'false'. Overrides screenshot and testType when set to true
    testType: 'unit',                // Optional: Specify the test type (e.g., 'unit', 'component'). Defaults to 'unit'.
    appName: 'MyApp',               // Optional: Specify the name of the application under test.
    appVersion: '1.0.0',            // Optional: Specify the version of the application under test.
    osPlatform: 'linux',            // Optional: Specify the OS platform.
    osRelease: '18.04',             // Optional: Specify the OS release version.
    osVersion: '5.4.0',             // Optional: Specify the OS version.
    buildName: 'MyApp Build',       // Optional: Specify the build name.
    buildNumber: '100',             // Optional: Specify the build number.
    buildUrl: "https://ctrf.io",    // Optional: Specify the build url.
    repositoryName: "ctrf-json",    // Optional: Specify the repository name.
    repositoryUrl: "https://gh.io", // Optional: Specify the repository url.
    branchName: "main",             // Optional: Specify the branch name.
    testEnvironment: "staging"      // Optional: Specify the test environment (e.g. staging, production).
  }]
],
```

## Test Object Properties

The test object in the report includes the following [CTRF properties](https://ctrf.io/docs/schema/test):

| Name        | Type    | Required | Details                                                                             |
| ----------- | ------- | -------- | ----------------------------------------------------------------------------------- |
| `name`      | String  | Required | The name of the test.                                                               |
| `status`    | String  | Required | The outcome of the test. One of: `passed`, `failed`, `skipped`, `pending`, `other`. |
| `duration`  | Number  | Required | The time taken for the test execution, in milliseconds.                             |
| `message`   | String  | Optional | The failure message if the test failed.                                             |
| `trace`     | String  | Optional | The stack trace captured if the test failed.                                        |
| `suite`     | String  | Optional | The suite or group to which the test belongs.                                       |
| `message`   | String  | Optional | The failure message if the test failed.                                             |
| `trace`     | String  | Optional | The stack trace captured if the test failed.                                        |
| `rawStatus` | String  | Optional | The original jest status of the test before mapping to CTRF status.                 |
| `type`      | String  | Optional | The type of test (e.g., `unit`, `component`).                                       |
| `filepath`  | String  | Optional | The file path where the test is located in the project.                             |
| `retries`   | Number  | Optional | The number of retries attempted for the test.                                       |
| `flaky`     | Boolean | Optional | Indicates whether the test result is flaky.                                         |

## Support Us

If you find this project useful, consider giving it a GitHub star ⭐ It means a lot to us.
