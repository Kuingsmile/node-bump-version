import writerOpts from '../conventional-changelog-node/writer-opts'
import parserOpts from './parser-opts'

const types: Record<string, string> = {
  feat: ':sparkles: Feature',
  fix: ':bug: Fix',
  perf: ':zap: Perf',
  docs: ':pencil: Docs',
  chore: ':package: Chore',
  build: ':package: Chore',
  ci: ':package: Chore',
  refactor: ':hammer: Refactor',
  test: ':white_check_mark: Test',
  style: ':art: Style',
  revert: ':back: Revert',
}

export default writerOpts.then(writer => ({
  parser: parserOpts,
  parserOpts,
  writer: {
    ...writer,
    transform: ((commit, context, options) =>
      writer.transform!(
        { ...commit, type: types[String(commit.type).toLowerCase()] || commit.type },
        context,
        options,
      )) as typeof writer.transform,
  },
}))
