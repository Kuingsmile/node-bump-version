import exec from './exec'
import { BumpVersionArgs } from './types/index'
import { checkFileAndGetPath } from './utils'

const commit = async (argv: BumpVersionArgs, newVersion: string): Promise<string | void> => {
  const changedFiles = ['package.json', 'package-lock.json', 'npm-shrinkwrap.json']

  if (argv.changelog !== false) {
    changedFiles.push(argv.file || 'CHANGELOG.md')
  }

  const releaseMsg = `:tada: Release: v${newVersion}`

  if ((argv as any).skipCommit) return Promise.resolve()

  const files = checkFileAndGetPath(argv, changedFiles)

  if (files.length === 0 || argv.dry) {
    return Promise.resolve()
  }

  await exec(argv, 'git', ['--literal-pathspecs', 'add', '--', ...files])
  return await exec(argv, 'git', ['--literal-pathspecs', 'commit', '-m', releaseMsg, '--', ...files])
}

export default commit
