import * as fs from 'node:fs'

import { ConventionalChangelog } from 'conventional-changelog'

import conventionalChangelogNode from './conventional-changelog-node/index'
import { BumpVersionArgs } from './types/index'

const changelog = async (argv: BumpVersionArgs, newVersion: string): Promise<void> => {
  if (argv.changelog === false) {
    return Promise.resolve()
  }
  
  let oldContent = ''
  
  try {
    oldContent = fs.readFileSync(argv.file || 'CHANGELOG.md', 'utf8')
  } catch (e) {
    oldContent = ''
  }  const config = await conventionalChangelogNode
  const cc = new ConventionalChangelog(argv.path || './')
  
  // Use type assertion to bypass the strict type checking
  cc.config({
    parserOpts: config.parserOpts,
    writerOpts: config.writerOpts
  } as any)
  
  if (argv.dry) {
    cc.context({ version: newVersion })
  }  
  let content = ''
  const stream = cc.writeStream()
  
  for await (const chunk of stream) {
    content += chunk.toString()
  }
  
  if (argv.dry) {
    console.log('Changelog is:')
    console.log(content + oldContent)
  } else {
    fs.writeFileSync(argv.file || 'CHANGELOG.md', content + oldContent)
  }

}

export default changelog
