import { existsSync } from 'node:fs'
import { dirname, join, posix, relative, resolve, sep } from 'node:path'

import * as semver from 'semver'

import { applyFileChanges, type FileChange, readOptionalFile } from './file-changes.js'
import type { BumpVersionArgs, PackageJson } from './types/index.js'

const lockNames = ['package-lock.json', 'npm-shrinkwrap.json']

interface VersionFile {
  path: string
  workspace?: string
}

export function versionFiles(path: string): VersionFile[] {
  const directory = resolve(path)
  const files: VersionFile[] = ['package.json', ...lockNames].map(name => ({ path: join(directory, name) }))
  let parent = directory
  while (!existsSync(join(parent, '.git')) && parent !== dirname(parent)) {
    parent = dirname(parent)
    const manifest = readOptionalFile(join(parent, 'package.json'))
    if (!manifest) continue
    const { workspaces } = JSON.parse(manifest)
    const patterns: unknown = Array.isArray(workspaces) ? workspaces : workspaces?.packages
    if (!Array.isArray(patterns)) continue
    const workspace = relative(parent, directory).split(sep).join('/')
    let member = false
    for (const pattern of patterns) {
      if (typeof pattern !== 'string') continue
      const glob = pattern.replace(/^!/, '').replace(/^\.\//, '').replace(/\/+$/, '')
      if (posix.matchesGlob(workspace, glob)) member = !pattern.startsWith('!')
    }
    if (member) {
      files.push(...lockNames.map(name => ({ path: join(parent, name), workspace })))
      break
    }
  }
  return files
}

export function prepareVersionFiles(
  argv: BumpVersionArgs,
  version: string,
  targets = versionFiles(argv.path || '.'),
): FileChange[] {
  const normalizedVersion = semver.valid(version)
  if (!normalizedVersion) throw new Error('Invalid release version')
  return targets.flatMap(({ path, workspace }, index) => {
    const before = readOptionalFile(path)
    if (before === null) {
      if (index === 0) throw new Error('Unable to read package.json')
      return []
    }
    const parsed: PackageJson = JSON.parse(before)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`Invalid ${path} object`)
    if (!workspace) parsed.version = normalizedVersion
    const key = workspace ?? ''
    if (workspace || (index > 0 && parsed.packages?.[key] !== undefined)) {
      const entry = parsed.packages?.[key]
      if (!entry || typeof entry !== 'object' || Array.isArray(entry))
        throw new Error(
          `Missing or invalid package metadata for "${key}" in ${path}. Refresh the npm lockfile before releasing.`,
        )
      entry.version = normalizedVersion
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
