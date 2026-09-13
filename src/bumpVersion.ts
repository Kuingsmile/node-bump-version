import { resolve } from 'node:path'

import * as semver from 'semver'

import { applyFileChanges, type FileChange, readOptionalFile } from './file-changes'
import type { BumpVersionArgs, PackageJson } from './types/index'

export function prepareVersionFiles(argv: BumpVersionArgs, version: string): FileChange[] {
  const normalizedVersion = semver.valid(version)
  if (!normalizedVersion) throw new Error('Invalid release version')
  return ['package.json', 'package-lock.json', 'npm-shrinkwrap.json'].flatMap(name => {
    const path = resolve(argv.path || '.', name)
    const before = readOptionalFile(path)
    if (before === null) {
      if (name === 'package.json') throw new Error('Unable to read package.json')
      return []
    }
    const parsed: PackageJson = JSON.parse(before)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`Invalid ${name} object`)
    parsed.version = normalizedVersion
    if (name !== 'package.json' && parsed.packages?.[''] !== undefined) {
      const rootPackage = parsed.packages['']
      if (!rootPackage || typeof rootPackage !== 'object' || Array.isArray(rootPackage)) {
        throw new Error(`Invalid root package metadata in ${name}`)
      }
      rootPackage.version = normalizedVersion
    }
    const indent = before.match(/\n([\t ]+)"/)?.[1] || '  '
    const newline = before.includes('\r\n') ? '\r\n' : '\n'
    return [{ path, before, after: (JSON.stringify(parsed, null, indent) + '\n').replace(/\n/g, newline) }]
  })
}

const bumpVersion = async (argv: BumpVersionArgs, version: string): Promise<void> => {
  const changes = prepareVersionFiles(argv, version)
  if (argv.dry) console.log('bump version to:', version)
  else applyFileChanges(changes)
}

export default bumpVersion
