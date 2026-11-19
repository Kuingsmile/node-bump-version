import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { readOptionalFile } from './file-changes.js'
import type { BumpVersionArgs, PackageJson } from './types/index.js'

export function readPackage(path: string): { before: string; pkg: PackageJson } {
  const before = readOptionalFile(join(path, 'package.json'))
  if (before === null) throw new Error('Unable to read package.json')
  let pkg: PackageJson
  try {
    pkg = JSON.parse(before)
  } catch (error) {
    throw new Error('Invalid JSON in package.json', { cause: error })
  }
  if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) throw new Error('package.json must contain an object')
  return { before, pkg }
}

export function resolvePreset(argv: BumpVersionArgs, pkg?: PackageJson): NonNullable<BumpVersionArgs['preset']> {
  const path = argv.path || '.'
  if (argv.preset === undefined && !pkg && existsSync(join(path, 'package.json'))) pkg = readPackage(path).pkg
  const preset = argv.preset ?? pkg?.bumpVersion?.preset ?? 'emoji'
  if (preset !== 'emoji' && preset !== 'conventional') throw new Error('Invalid bumpVersion.preset')
  return preset
}

export function prereleaseId(argv: BumpVersionArgs): string {
  return argv.preid || (argv['preid-alpha'] ? 'alpha' : argv['preid-beta'] ? 'beta' : '')
}
