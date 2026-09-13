import custom from '../commitlint-node/index'

export default {
  ...custom,
  parserPreset: '../conventional-changelog-standard/parser-opts.js',
  rules: {
    ...custom.rules,
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'perf', 'docs', 'chore', 'build', 'ci', 'refactor', 'test', 'style', 'revert'],
    ],
  },
}
