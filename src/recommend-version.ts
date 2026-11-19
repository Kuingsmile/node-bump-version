import { CommitParser } from 'conventional-commits-parser'

import { countCommit, describeBump } from './conventional-changelog-node/conventional-recommended-bump.js'
import customParser from './conventional-changelog-node/parser-opts.js'
import standardParser from './conventional-changelog-standard/parser-opts.js'
import { resolvePreset } from './project-config.js'
import { readGitRecords, releaseHistory } from './release-history.js'
import type { BumpVersionArgs, ReleaseType } from './types/index.js'

export interface VersionRecommendation {
  type: ReleaseType
  reason: string
  from: string | null
  commits: number
}

export async function recommendVersion(argv: BumpVersionArgs): Promise<VersionRecommendation> {
  const parser = new CommitParser(resolvePreset(argv) === 'conventional' ? standardParser : customParser)
  const { from, range } = await releaseHistory(argv, true)
  const counts = { features: 0, breakings: 0 }
  let commits = 0
  await readGitRecords(argv, ['log', '-z', '--format=%B', range, '--'], message => {
    if (!message.trim()) return
    countCommit(counts, parser.parse(message.trim()))
    commits++
  })
  if (!commits) throw new Error('No commits since the latest release; specify an explicit --type to release anyway')
  const { level, reason } = describeBump(counts)
  return { type: (['major', 'minor', 'patch'] as const)[level], reason, from, commits }
}
