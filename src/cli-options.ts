import { parseArgs } from 'node:util'

import type { BumpVersionArgs } from './types/index'

export const parseCliArgs = (args: string[]): BumpVersionArgs => {
  const { values, tokens } = parseArgs({
    args,
    strict: true,
    allowPositionals: false,
    allowNegative: true,
    tokens: true,
    options: {
      'preid-alpha': { type: 'boolean', short: 'a' },
      'preid-beta': { type: 'boolean', short: 'b' },
      dry: { type: 'boolean', short: 'd' },
      'dry-run': { type: 'boolean' },
      file: { type: 'string', short: 'f' },
      path: { type: 'string', short: 'p' },
      help: { type: 'boolean', short: 'h' },
      type: { type: 'string', short: 't' },
      push: { type: 'boolean' },
      remote: { type: 'string' },
      branch: { type: 'string' },
      atomic: { type: 'boolean' },
      tag: { type: 'boolean' },
      changelog: { type: 'boolean' },
      skipCommit: { type: 'boolean' },
      'skip-commit': { type: 'boolean' },
    },
  })
  const result: BumpVersionArgs = { _: [], ...values }
  // Aliases share one value, including when a later --no-* reverses it.
  for (const token of tokens) {
    if (token.kind !== 'option') continue
    const name = token.name.replace(/^no-/, '')
    if (name === 'dry' || name === 'dry-run') result.dry = !token.name.startsWith('no-')
    if (name === 'skipCommit' || name === 'skip-commit') result.skipCommit = !token.name.startsWith('no-')
  }
  if (result['preid-alpha'] && result['preid-beta']) {
    throw new Error('Choose only one prerelease identifier: alpha or beta')
  }
  for (const name of ['path', 'file', 'type', 'remote', 'branch'] as const) {
    if (result[name] !== undefined && !result[name]?.trim()) throw new Error(`--${name} must not be empty`)
  }
  return result
}
