/** @type {import('ts-jest').JestConfigWithTsJest} */
const appName = process.env.APP_NAME
const appVersion = process.env.APP_VERSION
const osPlatform = process.env.OS_PLATFORM
const osRelease = process.env.OS_RELEASE
const osVersion = process.env.OS_VERSION
const buildName = process.env.BUILD_NAME
const buildNumber = process.env.BUILD_NUMBER

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  reporters: [
    'default',
    [
      './dist/generate-report.js',
      {
        appName,
        appVersion,
        osPlatform,
        osRelease,
        osVersion,
        buildName,
        buildNumber,
      },
    ],
  ],
}
