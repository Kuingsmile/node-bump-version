#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { relative } from 'node:path'

import confirm from '@inquirer/confirm'
import input from '@inquirer/input'
import select, { Separator } from '@inquirer/select'
import * as semver from 'semver'

import { parseCliArgs } from '../cli-options.js'
import { executeRelease, planRelease, type ReleasePlan } from '../mainLifeCycle.js'
import { prereleaseId, readPackage, resolvePreset } from '../project-config.js'
import { recommendVersion, type VersionRecommendation } from '../recommend-version.js'
import { doctorProject, initProject } from '../setup.js'
import type { BumpVersionArgs, ReleaseType } from '../types/index.js'
import { helperMsg } from '../utils.js'

let argv: BumpVersionArgs = { _: [] }
let recommendation: VersionRecommendation | undefined
const releaseTypes: ReleaseType[] = ['major', 'minor', 'patch', 'premajor', 'preminor', 'prepatch', 'prerelease']

async function proposedVersion() {
  const { pkg } = readPackage(argv.path || '.')
  const currentVersion = pkg.version
  if (typeof currentVersion !== 'string' || !semver.valid(currentVersion))
    throw new Error('Invalid version in package.json!')
  argv.preset = resolvePreset(argv, pkg)
  if (argv.type === 'auto') recommendation = await recommendVersion(argv)
  const releaseType = (recommendation?.type || argv.type || 'patch') as ReleaseType
  if (!releaseTypes.includes(releaseType)) throw new Error('Invalid release type!')
  const preid = prereleaseId(argv)
  if (preid && !semver.valid(`0.0.0-${preid}.0`)) throw new Error('Invalid prerelease identifier')
  const proposed = semver.inc(currentVersion, releaseType, preid)
  if (!proposed) throw new Error('Unable to calculate the next version!')
  return { currentVersion, preid, proposed }
}

function summary(plan: ReleasePlan) {
  return {
    path: plan.path,
    currentVersion: plan.currentVersion,
    newVersion: plan.newVersion,
    branch: plan.branch,
    tag: plan.tag,
    push: plan.push,
    files: plan.changes.map(change => relative(plan.path, change.path)),
    releaseNotes: plan.releaseNotes,
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
  if (argv._[0] === 'init') {
    const result = initProject(argv)
    console.log(
      argv.json
        ? JSON.stringify({ ok: true, ...result })
        : `${result.dryRun ? 'Would update' : 'Updated'}: ${result.files.join(', ') || 'already configured'}\n${result.nextSteps.join('\n')}`,
    )
    return
  }
  if (argv._[0] === 'doctor') {
    const result = doctorProject(argv)
    if (result.ok) {
      try {
        const { currentVersion, proposed } = await proposedVersion()
        await planRelease(argv, currentVersion, proposed)
      } catch (error) {
        result.ok = false
        result.checks.push({
          name: 'release',
          ok: false,
          message: error instanceof Error ? error.message : String(error),
        })
      }
    }
    console.log(
      argv.json
        ? JSON.stringify(result)
        : result.checks.map(check => `${check.ok ? 'PASS' : 'FAIL'} ${check.name}: ${check.message}`).join('\n'),
    )
    if (!result.ok) process.exitCode = 1
    return
  }
  const { currentVersion, preid, proposed } = await proposedVersion()
  let nextVersion = proposed
  const automatic = argv.yes || (argv.dry && !argv.interactive)
  if (!automatic && (argv.json || (!process.stdin.isTTY && !argv.interactive))) {
    throw new Error(
      'Noninteractive releases require --yes. Use --dry-run to preview or --interactive to enable prompts.',
    )
  }
  let plan = await planRelease(argv, currentVersion, nextVersion)
  showPreview(plan)
  if (!automatic) {
    const confirmed = await confirm({ message: `The next version is ${nextVersion}, is it right?`, default: false })
    if (!confirmed) {
      const choices = releaseTypes.map(type => {
        const value = semver.inc(currentVersion, type, preid || 'alpha')!
        return { name: `${type} - ${value}`, value }
      })
      const selected = await select({
        message: `The current version is ${currentVersion}\n Which version would you like to bump it?`,
        choices: [...choices, new Separator(), { value: 'custom version' }, { value: 'never mind~' }],
        pageSize: 10,
      })
      if (selected === 'never mind~') {
        console.log('Release cancelled.')
        return
      }
      if (selected === 'custom version') {
        const custom = await input({ message: 'Write down your custom version:' })
        nextVersion = semver.valid(custom) || ''
      } else nextVersion = selected
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
