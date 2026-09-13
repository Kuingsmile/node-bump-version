const custom = require('./.cz-config.cjs')
const names = ['feat', 'fix', 'refactor', 'chore', 'docs', 'test', 'perf', 'build', 'ci', 'style', 'revert']

module.exports = {
  ...custom,
  types: names.map(value => ({ value, name: value })),
  allowBreakingChanges: names,
}
