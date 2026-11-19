import { spawnSync } from 'node:child_process'

import type { BumpVersionArgs } from './types/index.js'

export interface ReleaseCheck {
  name: string
  ok: boolean
  message: string
}

export function inspectReleaseGit(argv: BumpVersionArgs, files: string[], tag?: string) {
  const git = (...args: string[]) => spawnSync('git', args, { cwd: argv.path, encoding: 'utf8' })
  const checks: ReleaseCheck[] = []
  const check = (name: string, ok: boolean, success: string, failure: string) => {
    checks.push({ name, ok, message: ok ? success : failure })
  }
  const root = git('rev-parse', '--show-toplevel').stdout?.trim() || ''
  check('git', !!root, 'Git repository found', 'Install Git and run the command inside a repository')
  if (!root) return { root, head: '', branch: '', checks }
  const head = git('rev-parse', '--verify', '--quiet', 'HEAD^{commit}').stdout.trim()
  const branch = git('branch', '--show-current').stdout.trim()
  check('head', !!head, 'Initial commit exists', 'Create an initial Git commit before releasing')
  check('branch', !!branch, branch, 'Cannot release from detached HEAD. Check out a branch first.')
  if (tag) {
    const tags = git('tag', '--list', tag)
    check(
      'tag',
      tags.status === 0 && !tags.stdout.trim(),
      `Tag ${tag} is available`,
      `Tag ${tag} already exists or could not be checked. Choose another version.`,
    )
  }
  if (!argv.dry) {
    const tracked = git('status', '--porcelain', '--untracked-files=no')
    const release = git('--literal-pathspecs', 'status', '--porcelain', '--untracked-files=all', '--', ...files)
    check(
      'clean',
      tracked.status === 0 && release.status === 0 && !tracked.stdout && !release.stdout,
      'Tracked files and release files are clean',
      'Commit or stash changes to tracked/release files before releasing',
    )
    if (!argv.skipCommit || argv.tag !== false) {
      const identities = ['GIT_COMMITTER_IDENT', ...(!argv.skipCommit ? ['GIT_AUTHOR_IDENT'] : [])]
      check(
        'identity',
        identities.every(name => git('var', name).status === 0),
        'Git identity is configured',
        'Configure Git user.name and user.email for this release',
      )
    }
  }
  if (!argv.skipCommit && files.length) {
    const ignored = spawnSync('git', ['check-ignore', '-z', '--stdin'], {
      cwd: argv.path,
      encoding: 'utf8',
      input: files.join('\0') + '\0',
    })
    const paths = ignored.stdout.split('\0').filter(Boolean).join(', ')
    check(
      'ignored',
      ignored.status === 1,
      'Release files can be staged',
      paths
        ? `Git ignores release files: ${paths}. Track these files or update your ignore rules.`
        : ignored.stderr.trim(),
    )
  }
  return { root, head, branch, checks }
}
