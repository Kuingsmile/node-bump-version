import { existsSync, realpathSync } from 'node:fs'
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path'

import * as semver from 'semver'

import { prepareVersionFiles, versionFiles } from './bumpVersion.js'
import { prepareChangelog } from './changelog.js'
import commit from './commit.js'
import exec from './exec.js'
import { applyFileChanges, type FileChange, restoreFileChanges } from './file-changes.js'
import spinner from './ora.js'
import { resolvePreset } from './project-config.js'
import { type PushTarget, resolvePushTarget } from './push-target.js'
import { inspectReleaseGit } from './release-checks.js'
import tag from './tag.js'
import type { BumpVersionArgs } from './types/index.js'

export interface ReleasePlan {
  options: BumpVersionArgs
  path: string
  currentVersion: string
  newVersion: string
  head: string
  branch: string
  tag: string | null
  push: PushTarget | null
  changes: FileChange[]
  releaseNotes: string | null
}

export async function planRelease(
  argv: BumpVersionArgs,
  currentVersion: string,
  version: string,
): Promise<ReleasePlan> {
  const newVersion = semver.valid(version)
  if (!semver.valid(currentVersion) || !newVersion || !semver.gt(newVersion, currentVersion)) {
    throw new Error('Release version must be valid and greater than the current version')
  }
  if (argv.skipCommit && (argv.tag !== false || argv.push)) {
    throw new Error('--skip-commit requires --no-tag and cannot be combined with --push')
  }
  // Native resolution expands Windows short names so paths agree with Git's output.
  const path = realpathSync.native(resolve(argv.path || '.'))
  argv = { ...argv, path, preset: resolvePreset({ ...argv, path }) }
  const targets = versionFiles(path)
  const changes = prepareVersionFiles(argv, newVersion, targets)
  if (JSON.parse(changes[0].before!).version !== currentVersion)
    throw new Error('Package version changed; preview again')
  const files = changes.map(change => change.path)
  let changelogPath: string | undefined
  if (argv.changelog !== false) {
    const file = resolve(path, argv.file || 'CHANGELOG.md')
    const canonical = resolve(realpathSync.native(dirname(file)), basename(file))
    if (targets.some(candidate => relative(candidate.path, canonical) === ''))
      throw new Error('Changelog must not overwrite a package manifest or lockfile')
    changelogPath = canonical
    files.push(canonical)
  }
  const releaseTag = argv.tag === false ? undefined : `v${newVersion}`
  const { root: gitRoot, head, branch, checks } = inspectReleaseGit(argv, files, releaseTag)
  const failed = checks.find(check => !check.ok)
  if (failed) throw new Error(failed.message)
  const root = realpathSync.native(gitRoot)
  for (const file of files) {
    const location = relative(root, file)
    if (isAbsolute(location) || location === '..' || location.startsWith(`..${sep}`)) {
      throw new Error('Release files must be inside the Git repository')
    }
  }
  const push = argv.push ? await resolvePushTarget(argv) : null
  const changelog = await prepareChangelog({ ...argv, file: changelogPath }, newVersion, head)
  if (changelog) changes.push({ path: changelog.path, before: changelog.before, after: changelog.after })
  return {
    options: { ...argv },
    path,
    currentVersion,
    newVersion,
    head,
    branch,
    tag: releaseTag ?? null,
    push,
    changes,
    releaseNotes: changelog?.releaseNotes ?? null,
  }
}

export async function executeRelease(argv: BumpVersionArgs, plan: ReleasePlan): Promise<void> {
  argv = { ...argv, path: plan.path, preset: resolvePreset({ ...argv, path: plan.path }) }
  for (const name of [
    'dry',
    'tag',
    'push',
    'skipCommit',
    'changelog',
    'file',
    'remote',
    'branch',
    'atomic',
    'preset',
  ] as const) {
    if (argv[name] !== plan.options[name]) throw new Error('Release options changed; preview again')
  }
  if (argv.dry) {
    if (!argv.json) {
      console.log('bump version to:', plan.newVersion)
      if (plan.releaseNotes !== null) console.log('Changelog is:\n' + plan.releaseNotes)
    }
    return
  }
  const files = plan.changes.map(change => change.path)
  const state = inspectReleaseGit(argv, files, plan.tag ?? undefined)
  if (state.head !== plan.head) throw new Error('HEAD changed; preview again')
  if (state.branch !== plan.branch) throw new Error('Branch changed; preview again')
  const failed = state.checks.find(check => !check.ok)
  if (failed) throw new Error(`Release state changed after preview. ${failed.message}`)
  for (const candidate of versionFiles(plan.path)) {
    if (!files.includes(candidate.path) && existsSync(candidate.path))
      throw new Error(`Lockfile appeared after preview: ${candidate.path}. Preview again.`)
  }
  if (!argv.json) spinner.start('Writing release files...')
  let written = false
  try {
    applyFileChanges(plan.changes)
    written = true
    spinner.text = 'Committing changes...'
    await commit(argv, plan.newVersion, files)
    spinner.text = 'Creating tag...'
    await tag(argv, plan.newVersion, plan.push || undefined)
    if (!argv.json) spinner.succeed('Done!')
  } catch (error) {
    if (!argv.json) spinner.fail('Failed!')
    const head = (await exec(argv, 'git', ['rev-parse', 'HEAD'])).trim()
    if (head !== plan.head) {
      throw new Error(
        `Release commit ${head} was kept. Resolve the tag/push failure and finish this release without bumping again.`,
        { cause: error },
      )
    }
    if (written) {
      const failures: unknown[] = []
      try {
        await exec(argv, 'git', ['--literal-pathspecs', 'reset', '--quiet', plan.head, '--', ...files])
      } catch (cleanupError) {
        failures.push(cleanupError)
      }
      try {
        restoreFileChanges(plan.changes)
      } catch (cleanupError) {
        failures.push(cleanupError)
      }
      if (failures.length) {
        const errors = [error, ...failures]
        throw new AggregateError(
          errors,
          errors.map(item => (item instanceof Error ? item.message : String(item))).join('\n'),
          { cause: error },
        )
      }
    }
    throw error
  }
}

const mainLifeCycle = async (argv: BumpVersionArgs, currentVersion: string, newVersion: string): Promise<void> => {
  await executeRelease(argv, await planRelease(argv, currentVersion, newVersion))
}

export default mainLifeCycle
