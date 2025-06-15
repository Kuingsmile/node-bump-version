import parserOpts from './parser-opts'
import writerOpts from './writer-opts'

export interface ConventionalChangelog {
  parserOpts: typeof parserOpts
  writerOpts: Awaited<typeof writerOpts>
}

const conventionalChangelog = Promise.all([parserOpts, writerOpts]).then(([parserOpts, writerOpts]) => {
  return { parserOpts, writerOpts }
})

export default conventionalChangelog
