import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { versionFiles } from './bumpVersion.js'
import exec from './exec.js'
import { resolvePreset } from './project-config.js'
import { BumpVersionArgs } from './types/index.js'

const commit = async (argv: BumpVersionArgs, newVersion: string, files?: string[]): Promise<string | void> => {
  if (argv.skipCommit || argv.dry) return
  if (!files) {
    const directory = argv.path || '.'
    files = versionFiles(directory).map(file => file.path)
    if (argv.changelog !== false) files.push(resolve(directory, argv.file || 'CHANGELOG.md'))
    files = files.filter(file => existsSync(file))
  }
  if (!files.length) return
  const releaseMsg =
    resolvePreset(argv) === 'conventional' ? `chore(release): v${newVersion}` : `:tada: Release: v${newVersion}`

  await exec(argv, 'git', ['--literal-pathspecs', 'add', '--', ...files])
  return await exec(argv, 'git', ['--literal-pathspecs', 'commit', '-m', releaseMsg, '--', ...files])
}

export default commit
