import { parseArgs } from 'node:util'

import type { BumpVersionArgs } from './types/index'

export const parseCliArgs = (args: string[]): BumpVersionArgs => {
  const { values, tokens, positionals } = parseArgs({
    args,
    strict: true,
    allowPositionals: true,
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
      yes: { type: 'boolean', short: 'y' },
      json: { type: 'boolean' },
      version: { type: 'boolean', short: 'v' },
      interactive: { type: 'boolean' },
      preid: { type: 'string' },
      preset: { type: 'string' },
      hooks: { type: 'boolean' },
      'commit-helper': { type: 'boolean' },
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
  const { preset, ...otherValues } = values
  if (preset !== undefined && preset !== 'emoji' && preset !== 'conventional')
    throw new Error('--preset must be emoji or conventional')
  if (positionals.length > 1 || (positionals.length && !['init', 'doctor'].includes(positionals[0])))
    throw new Error('Unexpected positional argument; supported commands are init and doctor')
  const result: BumpVersionArgs = { _: positionals, ...otherValues, preset }
  if (positionals[0] !== 'init' && (result.hooks || result['commit-helper']))
    throw new Error('--hooks and --commit-helper require init')
  // Aliases share one value, including when a later --no-* reverses it.
  for (const token of tokens) {
    if (token.kind !== 'option') continue
    const name = token.name.replace(/^no-/, '')
    if (name === 'dry' || name === 'dry-run') result.dry = !token.name.startsWith('no-')
    if (name === 'skipCommit' || name === 'skip-commit') result.skipCommit = !token.name.startsWith('no-')
  }
  if ([result['preid-alpha'], result['preid-beta'], result.preid !== undefined].filter(Boolean).length > 1) {
    throw new Error('Choose only one prerelease identifier')
  }
  for (const name of ['path', 'file', 'type', 'remote', 'branch', 'preid'] as const) {
    if (result[name] !== undefined && !result[name]?.trim()) throw new Error(`--${name} must not be empty`)
  }
  if (result.interactive && (result.yes || result.json))
    throw new Error('--interactive cannot be combined with --yes or --json')
  return result
}
