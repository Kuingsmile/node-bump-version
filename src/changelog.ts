import * as path from 'node:path'

import { ConventionalChangelog } from 'conventional-changelog'

import conventionalChangelogNode from './conventional-changelog-node/index'
import { applyFileChanges, type FileChange, readOptionalFile } from './file-changes'
import { BumpVersionArgs } from './types/index'

export const prepareChangelog = async (argv: BumpVersionArgs, newVersion: string): Promise<FileChange | undefined> => {
  if (argv.changelog === false) {
    return undefined
  }

  const changelogFile = path.resolve(argv.path || './', argv.file || 'CHANGELOG.md')
  const oldContent = readOptionalFile(changelogFile)
  const config = await conventionalChangelogNode
  const cc = new ConventionalChangelog(argv.path || './')
    .readPackage(path.resolve(argv.path || './', 'package.json'))
    .config({
      parser: config.parserOpts,
      writer: config.writerOpts,
    })
    .context({ version: newVersion })
  let content = ''
  const stream = cc.writeStream()

  for await (const chunk of stream) {
    content += chunk.toString()
  }

  return { path: changelogFile, before: oldContent, after: content + (oldContent || '') }
}

const changelog = async (argv: BumpVersionArgs, newVersion: string): Promise<void> => {
  const change = await prepareChangelog(argv, newVersion)
  if (!change) return
  if (argv.dry) {
    console.log('Changelog is:')
    console.log(change.after)
  } else {
    applyFileChanges([change])
  }
}

export default changelog
