import { realpathSync } from 'node:fs'
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path'

import * as semver from 'semver'

import { prepareVersionFiles } from './bumpVersion'
import { prepareChangelog } from './changelog'
import commit from './commit'
import exec from './exec'
import { applyFileChanges, type FileChange, restoreFileChanges } from './file-changes'
import spinner from './ora'
import { type PushTarget, resolvePushTarget } from './push-target'
import tag from './tag'
import type { BumpVersionArgs } from './types/index'

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
  const path = realpathSync(resolve(argv.path || '.'))
  argv = { ...argv, path }
  const changes = prepareVersionFiles(argv, newVersion)
  if (JSON.parse(changes[0].before!).version !== currentVersion)
    throw new Error('Package version changed; preview again')
  const root = realpathSync((await exec(argv, 'git', ['rev-parse', '--show-toplevel'])).trim())
  const branch = (await exec(argv, 'git', ['branch', '--show-current'])).trim()
  if (!branch) throw new Error('Cannot release from detached HEAD; check out a branch first')
  const head = (await exec(argv, 'git', ['rev-parse', 'HEAD'])).trim()
  const push = argv.push ? await resolvePushTarget(argv) : null
  if (argv.tag !== false && (await exec(argv, 'git', ['tag', '--list', `v${newVersion}`])).trim()) {
    throw new Error(`Tag v${newVersion} already exists; choose another version`)
  }
  const changelog = await prepareChangelog(argv, newVersion)
  if (changelog) changes.push(changelog)
  const unique = new Set<string>()
  for (const change of changes) {
    const parent = realpathSync(dirname(change.path))
    const location = relative(root, parent)
    if (isAbsolute(location) || location === '..' || location.startsWith(`..${sep}`)) {
      throw new Error('Release files must be inside the Git repository')
    }
    change.path = resolve(parent, basename(change.path))
    const key = process.platform === 'win32' ? change.path.toLowerCase() : change.path
    if (unique.has(key)) throw new Error('Changelog must not overwrite a package manifest or lockfile')
    unique.add(key)
  }
  if (!argv.dry) {
    const tracked = await exec(argv, 'git', ['status', '--porcelain', '--untracked-files=no'])
    const releaseFiles = await exec(argv, 'git', [
      '--literal-pathspecs',
      'status',
      '--porcelain',
      '--',
      ...changes.map(c => c.path),
    ])
    if (tracked.trim() || releaseFiles.trim())
      throw new Error('Commit or stash changes to tracked/release files before releasing')
    await exec(argv, 'git', ['var', 'GIT_AUTHOR_IDENT'])
  }
  return {
    options: { ...argv },
    path,
    currentVersion,
    newVersion,
    head,
    branch,
    tag: argv.tag === false ? null : `v${newVersion}`,
    push,
    changes,
  }
}

export async function executeRelease(argv: BumpVersionArgs, plan: ReleasePlan): Promise<void> {
  argv = { ...argv, path: plan.path }
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
      if (argv.changelog !== false) console.log('Changelog is:\n' + plan.changes.at(-1)!.after)
    }
    return
  }
  if ((await exec(argv, 'git', ['rev-parse', 'HEAD'])).trim() !== plan.head)
    throw new Error('HEAD changed; preview again')
  if ((await exec(argv, 'git', ['branch', '--show-current'])).trim() !== plan.branch)
    throw new Error('Branch changed; preview again')
  if ((await exec(argv, 'git', ['status', '--porcelain', '--untracked-files=no'])).trim()) {
    throw new Error('Tracked files changed after preview; commit or stash them first')
  }
  if (plan.tag && (await exec(argv, 'git', ['tag', '--list', plan.tag])).trim())
    throw new Error('Tag appeared after preview')
  if (!argv.json) spinner.start('Writing release files...')
  let written = false
  try {
    applyFileChanges(plan.changes)
    written = true
    spinner.text = 'Committing changes...'
    await commit(argv, plan.newVersion)
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
      await exec(argv, 'git', ['--literal-pathspecs', 'restore', '--staged', '--', ...plan.changes.map(c => c.path)])
      restoreFileChanges(plan.changes)
    }
    throw error
  }
}

const mainLifeCycle = async (argv: BumpVersionArgs, currentVersion: string, newVersion: string): Promise<void> => {
  await executeRelease(argv, await planRelease(argv, currentVersion, newVersion))
}

export default mainLifeCycle
