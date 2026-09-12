import parserOpts from './parser-opts'
import writerOpts from './writer-opts'

export interface ConventionalChangelog {
  parser: typeof parserOpts
  writer: Awaited<typeof writerOpts>
  parserOpts: typeof parserOpts
  writerOpts: Awaited<typeof writerOpts>
}

const conventionalChangelog = Promise.all([parserOpts, writerOpts]).then(([parserOpts, writerOpts]) => {
  return { parser: parserOpts, writer: writerOpts, parserOpts, writerOpts }
})

export default conventionalChangelog
