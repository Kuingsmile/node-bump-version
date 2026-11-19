import type { Commit } from 'conventional-commits-parser'

import parserOpts from './parser-opts.js'

export interface RecommendedBumpOpts {
  parserOpts: typeof parserOpts
  whatBump: (commits: Pick<Commit, 'type' | 'notes'>[]) => {
    level: number
    reason: string
  }
}

interface Counts {
  features: number
  breakings: number
}

export function countCommit(counts: Counts, commit: { notes: Commit['notes']; type?: unknown }) {
  if (commit.notes.length) counts.breakings += commit.notes.length
  else if (commit.type === ':sparkles: Feature' || String(commit.type).toLowerCase() === 'feat') counts.features++
}

export function describeBump({ breakings, features }: Counts) {
  return {
    level: breakings ? 0 : features ? 1 : 2,
    reason: `${breakings === 1 ? 'There is 1 BREAKING CHANGE' : `There are ${breakings} BREAKING CHANGES`} and ${features} feature${features === 1 ? '' : 's'}`,
  }
}

const recommendedBumpOpts: RecommendedBumpOpts = {
  parserOpts,
  whatBump: commits => {
    const counts = { features: 0, breakings: 0 }
    for (const commit of commits) countCommit(counts, commit)
    return describeBump(counts)
  },
}

export default recommendedBumpOpts
