import * as path from 'node:path'

import { ConventionalChangelog } from 'conventional-changelog'

import conventionalChangelogNode from './conventional-changelog-node/index.js'
import conventionalChangelogStandard from './conventional-changelog-standard/index.js'
import { applyFileChanges, type FileChange, readOptionalFile } from './file-changes.js'
import { resolvePreset } from './project-config.js'
import { releaseHistory } from './release-history.js'
import { BumpVersionArgs } from './types/index.js'

export const prepareChangelog = async (
  argv: BumpVersionArgs,
  newVersion: string,
  head?: string,
): Promise<(FileChange & { releaseNotes: string }) | undefined> => {
  if (argv.changelog === false) {
    return undefined
  }

  const changelogFile = path.resolve(argv.path || './', argv.file || 'CHANGELOG.md')
  const oldContent = readOptionalFile(changelogFile)
  const config = await (resolvePreset(argv) === 'conventional'
    ? conventionalChangelogStandard
    : conventionalChangelogNode)
  const history = await releaseHistory(argv, false, head)
  const cc = new ConventionalChangelog(argv.path || './')
    .readPackage(path.resolve(argv.path || './', 'package.json'))
    .config({
      parser: config.parserOpts,
      writer: { ...config.writer, generateOn: () => false },
      commits: { from: history.base, to: history.head },
    })
    .context({ version: newVersion })
  let content = ''
  const stream = cc.writeStream()

  for await (const chunk of stream) {
    content += chunk.toString()
  }

  return { path: changelogFile, before: oldContent, after: content + (oldContent || ''), releaseNotes: content }
}

const changelog = async (argv: BumpVersionArgs, newVersion: string): Promise<void> => {
  const result = await prepareChangelog(argv, newVersion)
  if (!result) return
  if (argv.dry) {
    console.log('Changelog is:')
    console.log(result.releaseNotes)
  } else {
    applyFileChanges([result])
  }
}

export default changelog
