# Jest JSON Reporter - CTRF

A Jest test reporter to generate JSON test reports that are [CTRF](https://ctrf.io) compliant.

[Common Test Report Format](https://ctrf.io) helps you generate consistent JSON reports that are agnostic of specific programming languages or test frameworks.

## Features

- Generate JSON test reports that are [CTRF](https://ctrf.io) compliant
- Straightforward integration with Jest

## What is CTRF?

A JSON test report schema that is the same structure, no matter which testing tool is used. It's created to provide consistent test reporting agnostic of specific programming languages or testing frameworks. Where many testing frameworks exist, each generating JSON reports in their own way, CTRF provides a standardised schema helping you generate the same report anywhere.

## Installation

```bash
npm install --save-dev jest-ctrf-json-reporter
```

Add the reporter to your Jest.config.ts file:

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

You'll find a JSON file named `ctrf-report.json` in the root of your project.

## Reporter Options

The reporter supports several configuration options:

```javascript
reporter: [
    ['jest-ctrf-json-reporter', {
        outputFile: 'custom-name.json', // Optional: Output file name. Defaults to 'ctrf-report.json'.
        outputDir: 'custom-directory',  // Optional: Output directory path. Defaults to 'ctrf'.
        appName: 'MyApp',               // Optional: Specify the name of the application under test.
        appVersion: '1.0.0',            // Optional: Specify the version of the application under test.
        osPlatform: 'linux',            // Optional: Specify the OS platform.
        osRelease: '18.04',             // Optional: Specify the OS release version.
        osVersion: '5.4.0',             // Optional: Specify the OS version.
        buildName: 'MyApp Build',       // Optional: Specify the build name.
        buildNumber: '100',             // Optional: Specify the build number.
    }]
  ],
```

## Test Object Properties

The test object in the report includes the following [CTRF properties](https://ctrf.io/docs/schema/test):

| Name       | Type   | Required | Details                                                                             |
| ---------- | ------ | -------- | ----------------------------------------------------------------------------------- |
| `name`     | String | Required | The name of the test.                                                               |
| `status`   | String | Required | The outcome of the test. One of: `passed`, `failed`, `skipped`, `pending`, `other`. |
| `duration` | Number | Required | The time taken for the test execution, in milliseconds.                             |

|
