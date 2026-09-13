import { CommitParser } from 'conventional-commits-parser'
import * as semver from 'semver'

import recommended from './conventional-changelog-node/conventional-recommended-bump'
import customParser from './conventional-changelog-node/parser-opts'
import standardParser from './conventional-changelog-standard/parser-opts'
import exec from './exec'
import type { BumpVersionArgs, ReleaseType } from './types/index'

export interface VersionRecommendation {
  type: ReleaseType
  reason: string
  from: string | null
  commits: number
}

export async function recommendVersion(argv: BumpVersionArgs): Promise<VersionRecommendation> {
  const tags = (await exec(argv, 'git', ['tag', '--merged', 'HEAD', '--sort=-version:refname', '--list', 'v[0-9]*']))
    .trim()
    .split(/\r?\n/)
  const from = tags.find(tag => semver.valid(tag.slice(1))) || null
  const log = await exec(argv, 'git', ['log', '--format=%B%x00', from ? `${from}..HEAD` : 'HEAD', '--'])
  const parser = new CommitParser(argv.preset === 'conventional' ? standardParser : customParser)
  const commits = log
    .split('\0')
    .map(message => message.trim())
    .filter(Boolean)
    .map(message => parser.parse(message))
  if (!commits.length)
    throw new Error('No commits since the latest release; specify an explicit --type to release anyway')
  const normalized = commits.map(commit => ({
    ...commit,
    type: String(commit.type).toLowerCase() === 'feat' ? ':sparkles: Feature' : commit.type,
  }))
  const recommendation = recommended.whatBump(normalized)
  const type = (['major', 'minor', 'patch'] as const)[recommendation.level]
  return { type, reason: recommendation.reason, from, commits: commits.length }
}
