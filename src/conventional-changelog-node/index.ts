import conventionalChangelog from './conventional-changelog.js'
import recommendedBumpOpts from './conventional-recommended-bump.js'
import parserOpts from './parser-opts.js'
import writerOpts from './writer-opts.js'

const conventionalChangelogNode = Promise.all([conventionalChangelog, parserOpts, recommendedBumpOpts, writerOpts])
  .then(([conventionalChangelog, parserOpts, recommendedBumpOpts, writerOpts]) => {
    return { conventionalChangelog, parserOpts, recommendedBumpOpts, writerOpts }
  })

export default conventionalChangelogNode
export { conventionalChangelog, parserOpts, recommendedBumpOpts, writerOpts }
