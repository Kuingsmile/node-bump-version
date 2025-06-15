import conventionalChangelog from './conventional-changelog'
import recommendedBumpOpts from './conventional-recommended-bump'
import parserOpts from './parser-opts'
import writerOpts from './writer-opts'

const conventionalChangelogNode = Promise.all([conventionalChangelog, parserOpts, recommendedBumpOpts, writerOpts])
  .then(([conventionalChangelog, parserOpts, recommendedBumpOpts, writerOpts]) => {
    return { conventionalChangelog, parserOpts, recommendedBumpOpts, writerOpts }
  })

export default conventionalChangelogNode
export { conventionalChangelog, parserOpts, recommendedBumpOpts, writerOpts }
