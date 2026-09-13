import exec from './exec'
import type { BumpVersionArgs } from './types/index'

export interface PushTarget {
  remote: string
  branch: string
  atomic: boolean
}

export async function resolvePushTarget(argv: BumpVersionArgs): Promise<PushTarget> {
  const current = (await exec(argv, 'git', ['branch', '--show-current'])).trim()
  if (!current) throw new Error('Cannot push a release from detached HEAD')
  const upstream = (
    await exec(argv, 'git', [
      'for-each-ref',
      '--format=%(upstream:remotename)%00%(upstream:remoteref)',
      `refs/heads/${current}`,
    ])
  )
    .trim()
    .split('\0')
  const remote = argv.remote || upstream[0] || 'origin'
  const remotes = (await exec(argv, 'git', ['remote'])).trim().split(/\r?\n/)
  if (!remotes.includes(remote)) throw new Error(`Remote "${remote}" is not configured; choose --remote NAME`)
  const branch =
    argv.branch ||
    (!argv.remote || argv.remote === upstream[0] ? upstream[1]?.replace(/^refs\/heads\//, '') : '') ||
    current
  await exec(argv, 'git', ['check-ref-format', `refs/heads/${branch}`])
  return { remote, branch, atomic: argv.atomic !== false }
}
