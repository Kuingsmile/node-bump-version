export interface BumpVersionArgs {
  _: string[]
  a?: boolean // preid-alpha
  b?: boolean // preid-beta
  d?: boolean // dry run
  f?: string // changelog file
  p?: string // package.json path
  h?: boolean // help
  t?: string // bump type
  dry?: boolean
  file?: string
  path?: string
  help?: boolean
  type?: string
  yes?: boolean
  json?: boolean
  version?: boolean
  interactive?: boolean
  preid?: string
  preset?: 'emoji' | 'conventional'
  hooks?: boolean
  'commit-helper'?: boolean
  'preid-alpha'?: boolean
  'preid-beta'?: boolean
  changelog?: boolean
  skipCommit?: boolean
  push?: boolean
  remote?: string
  branch?: string
  atomic?: boolean
  tag?: boolean
  'no-tag'?: boolean
  'no-changelog'?: boolean
  [key: string]: any
}

export interface PackageJson {
  name: string
  version: string
  description?: string
  main?: string
  types?: string
  bin?: Record<string, string> | string
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  [key: string]: any
}

/**
 * Available log levels for the logger utility
 */
export const LOG_LEVELS = ['success', 'info', 'warn', 'error'] as const
export type LogLevel = (typeof LOG_LEVELS)[number]

export type ReleaseType = 'major' | 'minor' | 'patch' | 'premajor' | 'preminor' | 'prepatch' | 'prerelease'

export interface ReleaseChoice {
  name: string
  value: string
}
