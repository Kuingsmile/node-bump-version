import { readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'

import inquirer from 'inquirer'
import * as semver from 'semver'

import { parseCliArgs } from '../cli-options.js'
import { executeRelease, planRelease, type ReleasePlan } from '../mainLifeCycle.js'
import { recommendVersion, type VersionRecommendation } from '../recommend-version.js'
import type { BumpVersionArgs, PackageJson, ReleaseChoice, ReleaseType } from '../types/index.js'
import { helperMsg } from '../utils.js'

let argv: BumpVersionArgs = { _: [] }
let recommendation: VersionRecommendation | undefined
const releaseTypes: ReleaseType[] = ['major', 'minor', 'patch', 'premajor', 'preminor', 'prepatch', 'prerelease']

function summary(plan: ReleasePlan) {
  return {
    path: plan.path,
    currentVersion: plan.currentVersion,
    newVersion: plan.newVersion,
    branch: plan.branch,
    tag: plan.tag,
    push: plan.push,
    files: plan.changes.map(change => relative(plan.path, change.path)),
    commit: !argv.skipCommit,
    recommendation,
  }
}

function showPreview(plan: ReleasePlan): void {
  if (argv.json) return
  if (recommendation) console.log(`Recommended ${recommendation.type}: ${recommendation.reason}`)
  const details = summary(plan)
  console.log(`Release plan: ${details.currentVersion} -> ${details.newVersion}`)
  console.log(`Package: ${details.path}\nBranch: ${details.branch}\nFiles: ${details.files.join(', ')}`)
  console.log(`Commit: ${details.commit ? 'yes' : 'no'}\nTag: ${details.tag || 'none'}`)
  console.log(`Push: ${details.push ? `${details.push.remote}/${details.push.branch}` : 'disabled'}`)
  if (argv.dry) console.log('Dry run: no files, commits or tags will change.')
}

async function main(): Promise<void> {
  argv = { path: process.cwd(), file: 'CHANGELOG.md', ...parseCliArgs(process.argv.slice(2)) }
  if (argv.help) {
    console.log(argv.json ? JSON.stringify({ help: helperMsg }) : helperMsg)
    return
  }
  if (argv.version) {
    const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))
    console.log(argv.json ? JSON.stringify({ version }) : version)
    return
  }
  let pkg: PackageJson
  try {
    pkg = JSON.parse(readFileSync(resolve(argv.path || '.', 'package.json'), 'utf8'))
  } catch (error) {
    throw new Error(error instanceof SyntaxError ? 'Invalid JSON in package.json!' : 'Unable to read package.json!', {
      cause: error,
    })
  }
  if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) throw new Error('package.json must contain an object!')
  if (typeof pkg.version !== 'string' || !semver.valid(pkg.version)) throw new Error('Invalid version in package.json!')
  const currentVersion = pkg.version
  if (argv.type === 'auto') recommendation = await recommendVersion(argv)
  const releaseType = (recommendation?.type || argv.type || 'patch') as ReleaseType
  if (!releaseTypes.includes(releaseType)) throw new Error('Invalid release type!')
  const preid = argv.preid || (argv['preid-alpha'] ? 'alpha' : argv['preid-beta'] ? 'beta' : '')
  if (preid && !semver.valid(`0.0.0-${preid}.0`)) throw new Error('Invalid prerelease identifier')
  let nextVersion = semver.inc(currentVersion, releaseType, preid)
  if (!nextVersion) throw new Error('Unable to calculate the next version!')
  const automatic = argv.yes || (argv.dry && !argv.interactive)
  if (!automatic && (argv.json || (!process.stdin.isTTY && !argv.interactive))) {
    throw new Error(
      'Noninteractive releases require --yes. Use --dry-run to preview or --interactive to enable prompts.',
    )
  }
  let plan = await planRelease(argv, currentVersion, nextVersion)
  showPreview(plan)
  if (!automatic) {
    const answer = await inquirer.prompt<{ confirmVersion: boolean }>([
      {
        type: 'confirm',
        name: 'confirmVersion',
        message: `The next version is ${nextVersion}, is it right?`,
        default: false,
      },
    ])
    if (!answer.confirmVersion) {
      const choices: ReleaseChoice[] = releaseTypes.map(type => ({
        name: `${type} - ${semver.inc(currentVersion, type, preid || 'alpha')}`,
        value: semver.inc(currentVersion, type, preid || 'alpha')!,
      }))
      const selected = await inquirer.prompt<{ version: string }>([
        {
          type: 'select',
          name: 'version',
          message: `The current version is ${currentVersion}\n Which version would you like to bump it?`,
          choices: [...choices, new inquirer.Separator(), 'custom version', 'never mind~'],
          pageSize: 10,
        },
      ])
      if (selected.version === 'never mind~') {
        console.log('Release cancelled.')
        return
      }
      if (selected.version === 'custom version') {
        const custom = await inquirer.prompt<{ version: string }>([
          { type: 'input', name: 'version', message: 'Write down your custom version:' },
        ])
        nextVersion = semver.valid(custom.version)
      } else nextVersion = selected.version
      if (!nextVersion || !semver.gt(nextVersion, currentVersion)) throw new Error('Invalid version!')
      plan = await planRelease(argv, currentVersion, nextVersion)
      showPreview(plan)
    }
  }
  await executeRelease(argv, plan)
  if (argv.json) console.log(JSON.stringify({ ok: true, dryRun: !!argv.dry, ...summary(plan) }))
}

main().catch((error: unknown) => {
  const cancelled = error instanceof Error && error.name === 'ExitPromptError'
  const message = cancelled ? 'Release cancelled.' : error instanceof Error ? error.message : 'Release failed'
  process.exitCode = cancelled ? 130 : 1
  // parse errors happen before argv exists; still honour an explicit --json request.
  if (argv.json || process.argv.includes('--json')) {
    console.log(JSON.stringify({ ok: false, error: { code: cancelled ? 'CANCELLED' : 'RELEASE_FAILED', message } }))
  } else console.error(message)
})
