import { readFileSync } from 'node:fs'
import * as path from 'node:path'

import inquirer from 'inquirer'
import * as semver from 'semver'

import { parseCliArgs } from '../cli-options.js'
import logger from '../logger.js'
import mainLifeCycle from '../mainLifeCycle.js'
import { BumpVersionArgs, PackageJson, ReleaseChoice, ReleaseType } from '../types/index.js'
import { helperMsg } from '../utils.js'

let argv: BumpVersionArgs
try {
  argv = { path: process.cwd(), file: 'CHANGELOG.md', ...parseCliArgs(process.argv.slice(2)) }
} catch (error) {
  logger(error instanceof Error ? error.message : 'Invalid command-line options', 'error')
  process.exit(1)
}

if (argv.help) {
  console.log(helperMsg)
  process.exit(0)
}

let pkg: PackageJson | undefined
try {
  pkg = JSON.parse(readFileSync(path.resolve(argv.path || process.cwd(), 'package.json'), 'utf8'))
} catch (error) {
  logger(error instanceof SyntaxError ? 'Invalid JSON in package.json!' : 'Unable to read package.json!', 'error')
  process.exit(1)
}

if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) {
  logger('package.json must contain an object!', 'error')
  process.exit(1)
}

const releaseTypes: ReleaseType[] = ['major', 'minor', 'patch', 'premajor', 'preminor', 'prepatch', 'prerelease']
const releaseType = (argv.type === undefined ? 'patch' : argv.type) as ReleaseType
if (!releaseTypes.includes(releaseType)) {
  logger('Invalid release type!', 'error')
  process.exit(1)
}
const currentVersion = pkg.version
if (currentVersion === undefined) {
  logger('Version field is not found in package.json!', 'error')
  process.exit(1)
}
if (!semver.valid(currentVersion)) {
  logger('Invalid version in package.json!', 'error')
  process.exit(1)
}

const preid = argv['preid-alpha'] ? 'alpha' : argv['preid-beta'] ? 'beta' : ''
const nextVersion = semver.inc(currentVersion, releaseType, preid)
if (!nextVersion) {
  logger('Unable to calculate the next version!', 'error')
  process.exit(1)
}

function generateReleaseTypes(types: ReleaseType[]): ReleaseChoice[] {
  return types.map((item: ReleaseType) => {
    const version = semver.inc(currentVersion, item, preid || 'alpha')
    return {
      name: `${item} - ${version}`,
      value: version || '',
    }
  })
}

let promptList: any[] = [
  {
    type: 'confirm',
    name: 'confirmVersion',
    message: `The next version is ${nextVersion}, is it right?`,
  },
]

console.log(
  `
BumpVersion -- By Kuingsmile
  `,
)

;(async () => {
  const answer = await inquirer.prompt(promptList)
  if ((answer as any).confirmVersion) {
    await mainLifeCycle(argv, currentVersion, nextVersion)
  } else {
    promptList = [
      {
        type: 'select',
        name: 'version',
        message: `The current version is ${currentVersion}\n Which version would you like to bump it?`,
        choices: [...generateReleaseTypes(releaseTypes), new inquirer.Separator(), 'custom version', 'never mind~'],
        pageSize: 10,
      },
    ]

    const answer = await inquirer.prompt(promptList)
    if ((answer as any).version === 'never mind~') {
      return console.log('Bye~')
    } else if ((answer as any).version === 'custom version') {
      promptList = [
        {
          type: 'input',
          name: 'version',
          message: 'Write down your custom version:',
        },
      ]

      const result = await inquirer.prompt(promptList)
      const customVersion = semver.valid((result as any).version)
      if (customVersion && semver.gt(customVersion, currentVersion)) {
        await mainLifeCycle(argv, currentVersion, customVersion)
      } else {
        process.exitCode = 1
        return logger('Invalid version!', 'error')
      }
    } else {
      await mainLifeCycle(argv, currentVersion, (answer as any).version)
    }
  }
})()
