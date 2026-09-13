import { spawnSync } from 'node:child_process'
import { mkdirSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'

import * as semver from 'semver'

import toolPackage from '../package.json'
import { applyFileChanges, type FileChange, readOptionalFile } from './file-changes'
import type { BumpVersionArgs, PackageJson } from './types/index'

function readPackage(path: string): { before: string; pkg: PackageJson } {
  const before = readOptionalFile(join(path, 'package.json'))
  if (before === null) throw new Error('Unable to read package.json')
  const pkg: PackageJson = JSON.parse(before)
  if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) throw new Error('package.json must contain an object')
  return { before, pkg }
}

export function initProject(argv: BumpVersionArgs): { files: string[]; dryRun: boolean; nextSteps: string[] } {
  const path = realpathSync(resolve(argv.path || '.'))
  const { before, pkg } = readPackage(path)
  const preset = argv.preset || pkg.bumpVersion?.preset || 'emoji'
  if (pkg.bumpVersion?.preset && argv.preset && pkg.bumpVersion.preset !== argv.preset) {
    throw new Error('Existing bumpVersion.preset conflicts with --preset; edit it explicitly before initializing')
  }
  pkg.scripts ??= {}
  pkg.scripts.release ??= 'bump-version'
  pkg.bumpVersion ??= {}
  pkg.bumpVersion.preset ??= preset
  const extras: FileChange[] = []
  const nextSteps: string[] = []
  const dev = (name: string) => {
    pkg.devDependencies ??= {}
    const versions: Record<string, string> = { ...toolPackage.dependencies, ...toolPackage.devDependencies }
    if (!pkg.dependencies?.[name]) pkg.devDependencies[name] ??= versions[name]
  }
  if (argv.hooks) {
    const root = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: path, encoding: 'utf8' })
    if (root.status !== 0 || realpathSync(root.stdout.trim()) !== path)
      throw new Error('Run init --hooks at the Git root')
    dev('husky')
    dev('@commitlint/cli')
    const existingConfig = [
      'commitlint.config.js',
      'commitlint.config.cjs',
      'commitlint.config.mjs',
      'commitlint.config.ts',
      '.commitlintrc',
      '.commitlintrc.json',
      '.commitlintrc.js',
      '.commitlintrc.cjs',
      '.commitlintrc.yml',
      '.commitlintrc.yaml',
    ].some(name => readOptionalFile(join(path, name)) !== null)
    if (!pkg.commitlint && !existingConfig)
      extras.push({
        path: join(path, 'commitlint.config.cjs'),
        before: null,
        after: `module.exports = { extends: [require.resolve('node-bump-version/commitlint${preset === 'conventional' ? '/conventional' : ''}')] }\n`,
      })
    const prepare = pkg.scripts.prepare
    if (!prepare || !/(^|[\s;&])husky(?:\s|$)/.test(prepare))
      pkg.scripts.prepare = prepare ? `${prepare} && husky` : 'husky'
    const hook = join(path, '.husky/commit-msg')
    if (readOptionalFile(hook) === null)
      extras.push({ path: hook, before: null, after: 'npx --no -- commitlint --edit "$1"\n' })
    nextSteps.push("Install dependencies, then run your package manager's prepare script to activate Husky.")
  }
  if (argv['commit-helper']) {
    dev('commitizen')
    dev('cz-customizable')
    pkg.scripts.cz ??= 'git-cz'
    pkg.config ??= {}
    pkg.config.commitizen ??= { path: 'cz-customizable' }
    pkg.config['cz-customizable'] ??= { config: '.cz-config.cjs' }
    const config = join(path, '.cz-config.cjs')
    if (readOptionalFile(config) === null)
      extras.push({
        path: config,
        before: null,
        after: `module.exports = require('node-bump-version/commitizen${preset === 'conventional' ? '/conventional' : ''}')\n`,
      })
    nextSteps.push("Install dependencies, then run your package manager's cz script to compose a commit.")
  }
  const indent = before.match(/\n([\t ]+)"/)?.[1] || '  '
  const newline = before.includes('\r\n') ? '\r\n' : '\n'
  const after = (JSON.stringify(pkg, null, indent) + '\n').replace(/\n/g, newline)
  const changes = [{ path: join(path, 'package.json'), before, after }, ...extras].filter(
    change => change.before !== change.after,
  )
  if (!argv.dry && changes.length) {
    if (extras.some(change => change.path === join(path, '.husky/commit-msg')))
      mkdirSync(join(path, '.husky'), { recursive: true })
    applyFileChanges(changes)
  }
  return { files: changes.map(change => change.path), dryRun: !!argv.dry, nextSteps }
}

export function doctorProject(argv: BumpVersionArgs) {
  const path = resolve(argv.path || '.')
  const checks: { name: string; ok: boolean; message: string }[] = []
  const check = (name: string, ok: boolean, message: string) => checks.push({ name, ok, message })
  check(
    'node',
    semver.satisfies(process.versions.node, toolPackage.engines.node),
    `Requires Node ${toolPackage.engines.node}`,
  )
  let pkg: PackageJson
  try {
    pkg = readPackage(path).pkg
  } catch {
    check('package', false, 'A valid package.json object is required')
    return { ok: false, checks }
  }
  check(
    'version',
    typeof pkg.version === 'string' && !!semver.valid(pkg.version),
    'package.json must have a valid semantic version',
  )
  const git = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: path, encoding: 'utf8' })
  check('git', git.status === 0, 'Git must be installed and the package must be in a repository')
  const require = createRequire(join(path, 'package.json'))
  for (const dependency of [
    ...(pkg.scripts?.prepare?.includes('husky') ? ['husky', '@commitlint/cli'] : []),
    ...(pkg.config?.commitizen ? ['commitizen', 'cz-customizable'] : []),
  ]) {
    let installed = true
    try {
      require.resolve(dependency)
    } catch {
      installed = false
    }
    check(dependency, installed, `Install ${dependency} in this project`)
  }
  if (git.status === 0) {
    const branch = spawnSync('git', ['branch', '--show-current'], { cwd: path, encoding: 'utf8' })
    check('branch', !!branch.stdout?.trim(), 'Check out a branch before releasing')
    if (pkg.scripts?.prepare?.includes('husky')) {
      const root = git.stdout.trim()
      const hook = readOptionalFile(join(root, '.husky/commit-msg'))
      check('commit-msg', !!hook?.includes('commitlint'), 'Configure a commit-msg hook that invokes commitlint')
      const config = spawnSync('git', ['config', '--get', 'core.hooksPath'], { cwd: root, encoding: 'utf8' })
      check(
        'hooks',
        config.status === 0 && resolve(root, config.stdout.trim()) === resolve(root, '.husky/_'),
        'Run the prepare script to activate Husky',
      )
    }
  }
  return { ok: checks.every(item => item.ok), checks }
}
