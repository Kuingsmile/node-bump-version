import parserOpts from './parser-opts.js'
import writerOpts from './writer-opts.js'

export interface ConventionalChangelog {
  parserOpts: typeof parserOpts
  writerOpts: Awaited<typeof writerOpts>
}

const conventionalChangelog = Promise.all([parserOpts, writerOpts])
  .then(([parserOpts, writerOpts]) => {
    return { parserOpts, writerOpts }
  })

export default conventionalChangelog
