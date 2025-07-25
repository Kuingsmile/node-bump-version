import parserOpts from './parser-opts'

export interface RecommendedBumpOpts {
  parserOpts: typeof parserOpts
  whatBump: (commits: any[]) => {
    level: number
    reason: string
  }
}

const recommendedBumpOpts: RecommendedBumpOpts = {
  parserOpts,

  whatBump: commits => {
    let level = 2
    let breakings = 0
    let features = 0

    commits.forEach(commit => {
      if (commit.notes.length > 0) {
        breakings += commit.notes.length
        level = 0
      } else if (commit.type === 'feat') {
        features += 1
        if (level === 2) {
          level = 1
        }
      }
    })

    return {
      level,
      reason:
        breakings === 1
          ? `There is ${breakings} BREAKING CHANGE and ${features} features`
          : `There are ${breakings} BREAKING CHANGES and ${features} features`
    }
  }
}

export default recommendedBumpOpts
