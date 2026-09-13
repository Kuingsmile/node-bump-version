import exec from './exec.js'
import { type PushTarget, resolvePushTarget } from './push-target.js'
import { BumpVersionArgs } from './types/index'

const tag = async (argv: BumpVersionArgs, newVersion: string, target?: PushTarget): Promise<string | void> => {
  if (argv.dry) {
    return Promise.resolve()
  }

  let flow: Promise<string | void>
  if (argv.push) target ??= await resolvePushTarget(argv)

  if (argv.tag === false) {
    flow = Promise.resolve()
  } else {
    flow = exec(argv, 'git', ['tag', '-a', `v${newVersion}`, '-m', `v${newVersion}`])
  }

  await flow
  if (target) {
    await exec(argv, 'git', [
      'push',
      target.atomic ? '--atomic' : '--no-atomic',
      '--no-follow-tags',
      '--',
      target.remote,
      `HEAD:refs/heads/${target.branch}`,
      ...(argv.tag === false ? [] : [`refs/tags/v${newVersion}:refs/tags/v${newVersion}`]),
    ])
  }
  return await Promise.resolve()
}

export default tag
