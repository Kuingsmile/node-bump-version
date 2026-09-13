import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const project = fileURLToPath(new URL('../', import.meta.url))
const temporary = realpathSync(tmpdir())
const root = mkdtempSync(join(temporary, 'node-bump-package-'))
const consumer = join(root, 'consumer')
mkdirSync(consumer)
const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: join(root, 'gitconfig'), HUSKY: '0' }
writeFileSync(env.GIT_CONFIG_GLOBAL, '')
const run = (command, args, cwd = consumer) =>
  execFileSync(command, args, {
    cwd,
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120000,
    maxBuffer: 4 * 1024 * 1024,
  })

const candidates = [process.env.npm_execpath]
for (const directory of [dirname(process.execPath), ...(process.env.PATH || process.env.Path || '').split(delimiter)]) {
  if (!directory) continue
  candidates.push(
    join(directory, 'node_modules/npm/bin/npm-cli.js'),
    resolve(directory, '../lib/node_modules/npm/bin/npm-cli.js'),
  )
}
const npm = candidates.find(candidate => candidate && /[/\\]npm-cli\.js$/.test(candidate) && existsSync(candidate))
assert.ok(npm, 'npm-cli.js must be available')
try {
  const [pack] = JSON.parse(
    run(process.execPath, [npm, 'pack', '--ignore-scripts', '--json', '--pack-destination', root], project),
  )
  assert.ok(pack.files.every(file => !/^(src\/|scripts\/|test\/|eslint|rollup)/.test(file.path)))
  for (const file of [
    'dist/index.d.ts',
    'dist/bin/bump-version.js',
    'dist/commitlint-standard/index.d.ts',
    '.cz-config.cjs',
    '.cz-config-conventional.cjs',
  ]) {
    assert.ok(
      pack.files.some(entry => entry.path === file),
      `Missing packed file: ${file}`,
    )
  }
  writeFileSync(
    join(consumer, 'package.json'),
    JSON.stringify({ name: 'packed-consumer', version: '1.0.0', private: true, type: 'module' }, null, 2) + '\n',
  )
  console.log('Installing the packed package in an isolated consumer...')
  try {
    run(process.execPath, [
      npm,
      'install',
      '--ignore-scripts',
      '--omit=optional',
      '--no-audit',
      '--no-fund',
      '--package-lock=true',
      join(root, pack.filename),
    ])
  } catch {
    throw new Error('Packed installation failed; check registry access and dependency compatibility')
  }
  for (const optional of ['husky', 'commitizen', 'cz-customizable', '@commitlint/cli']) {
    assert.equal(existsSync(join(consumer, 'node_modules', optional)), false, `${optional} should be optional`)
  }
  run(process.execPath, [
    '--input-type=module',
    '-e',
    "await import('node-bump-version'); await import('node-bump-version/commitlint'); await import('node-bump-version/commitlint/conventional'); await import('node-bump-version/changelog'); await import('node-bump-version/changelog/conventional'); await import('node-bump-version/dist/index.js');",
  ])
  const cli = join(consumer, 'node_modules/node-bump-version/dist/bin/bump-version.js')
  assert.match(run(process.execPath, [cli, '--help']), /Usage/)
  const git = (...args) => run('git', args).trim()
  git('init', '--initial-branch=main', '--template=')
  git('config', 'user.name', 'Package Test')
  git('config', 'user.email', 'package-test@example.invalid')
  git('config', 'commit.gpgsign', 'false')
  git('config', 'tag.gpgsign', 'false')
  git('config', 'core.hooksPath', join(root, 'disabled-hooks'))
  writeFileSync(join(consumer, '.gitignore'), 'node_modules/\n')
  git('add', '.')
  git('commit', '-m', ':pushpin: Init: packed consumer')
  git('tag', 'v1.0.0')
  git('commit', '--allow-empty', '-m', ':sparkles: Feature: consume the packed package')
  const preview = JSON.parse(run(process.execPath, [cli, '--type', 'auto', '--dry-run', '--json']))
  assert.equal(preview.newVersion, '1.1.0')
  assert.equal(git('status', '--porcelain'), '')
  const release = JSON.parse(run(process.execPath, [cli, '--yes', '--json']))
  assert.equal(release.newVersion, '1.0.1')
  const lock = JSON.parse(readFileSync(join(consumer, 'package-lock.json'), 'utf8'))
  assert.equal(lock.packages[''].version, '1.0.1')
  assert.equal(git('status', '--porcelain'), '')
  console.log(`Packed consumer passed: ${pack.entryCount} published files; optional integrations are absent.`)
} finally {
  assert.equal(dirname(realpathSync(root)), temporary)
  assert.ok(resolve(root).startsWith(join(temporary, 'node-bump-package-')))
  rmSync(root, { recursive: true, force: true })
}
