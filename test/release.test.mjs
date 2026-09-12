import assert from 'node:assert/strict'
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { stripVTControlCharacters } from 'node:util'

import { ConventionalChangelog } from 'conventional-changelog'

import changelogPreset from '../dist/conventional-changelog-node/conventional-changelog.js'
import preset from '../dist/conventional-changelog-node/index.js'
import { mainLifeCycle } from '../dist/index.js'

const project = fileURLToPath(new URL('../', import.meta.url))
const cli = join(project, 'dist/bin/bump-version.js')

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

function fixture(t) {
  const root = realpathSync(tmpdir())
  const cwd = mkdtempSync(join(root, 'node-bump-version-test-'))
  t.after(() => {
    assert.equal(dirname(realpathSync(cwd)), root)
    assert.ok(resolve(cwd).startsWith(join(root, 'node-bump-version-test-')))
    rmSync(cwd, { recursive: true, force: true })
  })
  const pkg = {
    name: 'release-fixture',
    version: '1.0.0',
    repository: 'https://github.com/example/release-fixture.git',
  }
  writeFileSync(join(cwd, 'package.json'), JSON.stringify(pkg, null, 2) + '\n')
  writeFileSync(
    join(cwd, 'package-lock.json'),
    JSON.stringify({ name: pkg.name, version: pkg.version, lockfileVersion: 1 }) + '\n',
  )
  writeFileSync(join(cwd, 'CHANGELOG.md'), '# Previous release\n')
  git(cwd, 'init', '--initial-branch=main')
  git(cwd, 'config', 'user.name', 'Release Test')
  git(cwd, 'config', 'user.email', 'release-test@example.invalid')
  git(cwd, 'config', 'commit.gpgsign', 'false')
  git(cwd, 'config', 'tag.gpgsign', 'false')
  git(cwd, 'config', 'core.hooksPath', join(cwd, '.disabled-hooks'))
  git(cwd, 'config', 'core.autocrlf', 'false')
  git(cwd, 'add', '.')
  git(cwd, 'commit', '-m', ':pushpin: Init: initial release')
  git(cwd, 'tag', 'v1.0.0')
  git(
    cwd,
    'commit',
    '--allow-empty',
    '-m',
    ':sparkles: Feature(core): add a feature #42',
    '-m',
    'BREAKING CHANGE: change the fixture API',
  )
  git(cwd, 'commit', '--allow-empty', '-m', ':bug: Fix(core): handle missing input')
  return cwd
}

function assertChangelog(content, version) {
  assert.ok(content.includes(`:tada: ${version}`))
  assert.match(content, /### :sparkles: Features/)
  assert.match(content, /### :bug: Bug Fixes/)
  assert.match(content, /\* \*\*core:\*\* add a feature/)
  assert.match(content, /\[#42\]\(https:\/\/github.com\/example\/release-fixture\/issues\/42\)/)
  assert.match(content, /### BREAKING CHANGES/)
  assert.match(content, /change the fixture API/)
  assert.match(content, /# Previous release/)
  assert.doesNotMatch(content, /initial release/)
}

function runCli(t, cwd, args, steps) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], { cwd, stdio: 'pipe' })
    let output = ''
    let next = 0
    const timeout = setTimeout(() => {
      child.kill()
      reject(new Error(`CLI timed out after prompt ${next}: ${output}`))
    }, 15000)
    t.after(() => {
      clearTimeout(timeout)
      if (child.exitCode === null) child.kill()
    })
    const receive = chunk => {
      output += stripVTControlCharacters(chunk.toString())
      if (next < steps.length && output.includes(steps[next].prompt)) {
        const input = steps[next++].input
        setImmediate(() => child.stdin.write(input))
      }
    }
    child.stdout.on('data', receive)
    child.stderr.on('data', receive)
    child.on('error', reject)
    child.on('close', code => {
      clearTimeout(timeout)
      if (code !== 0 || next !== steps.length) {
        reject(new Error(`CLI exited ${code} after ${next}/${steps.length} prompts: ${output}`))
      } else {
        resolve(output)
      }
    })
  })
}

test('built CLI displays help', () => {
  const output = execFileSync(process.execPath, [cli, '--help'], { cwd: project, encoding: 'utf8' })
  assert.match(output, /Usage/)
  assert.match(output, /--dry/)
})

test('commitlint accepts the custom convention and rejects invalid messages', () => {
  const command = join(project, 'node_modules/@commitlint/cli/cli.js')
  for (const message of [':sparkles: Feature(core): add a feature', ':tada: Release: v1.1.0']) {
    const result = spawnSync(process.execPath, [command], { cwd: project, input: message + '\n', encoding: 'utf8' })
    assert.equal(result.status, 0, result.stdout + result.stderr)
  }
  const result = spawnSync(process.execPath, [command], { cwd: project, input: 'invalid message\n', encoding: 'utf8' })
  assert.notEqual(result.status, 0)
  assert.match(result.stdout + result.stderr, /type-empty/)
})

test('Husky runs pre-commit and enforces commit messages through Git', t => {
  const cwd = fixture(t)
  const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'))
  pkg.scripts = {
    lint: "node -e \"require('node:fs').writeFileSync('.pre-commit-ran', '')\"",
  }
  pkg.commitlint = { extends: [join(project, 'dist/commitlint-node/index.js')] }
  writeFileSync(join(cwd, 'package.json'), JSON.stringify(pkg, null, 2) + '\n')
  symlinkSync(
    join(project, 'node_modules'),
    join(cwd, 'node_modules'),
    process.platform === 'win32' ? 'junction' : 'dir',
  )
  mkdirSync(join(cwd, '.husky'))
  for (const hook of ['pre-commit', 'commit-msg']) {
    copyFileSync(join(project, '.husky', hook), join(cwd, '.husky', hook))
  }
  const env = { ...process.env, HUSKY: '1', XDG_CONFIG_HOME: join(cwd, '.config') }
  execFileSync(process.execPath, [join(project, 'node_modules/husky/bin.js')], { cwd, env, stdio: 'pipe' })
  assert.equal(git(cwd, 'config', 'core.hooksPath'), '.husky/_')
  const runGit = (...args) => spawnSync('git', args, { cwd, env, encoding: 'utf8', timeout: 30000 })
  const head = git(cwd, 'rev-parse', 'HEAD')

  const invalid = runGit('commit', '--allow-empty', '-m', 'invalid message')
  assert.equal(invalid.status, 1, invalid.stdout + invalid.stderr)
  assert.match(invalid.stdout + invalid.stderr, /type-empty/)
  assert.equal(git(cwd, 'rev-parse', 'HEAD'), head)
  assert.ok(existsSync(join(cwd, '.pre-commit-ran')), 'Git must also execute the migrated pre-commit hook')

  for (const message of [':bug: Fix(core): handle input', ':tada: Release: v1.1.0']) {
    const valid = runGit('commit', '--allow-empty', '-m', message)
    assert.equal(valid.status, 0, valid.stdout + valid.stderr)
    assert.equal(git(cwd, 'log', '-1', '--format=%s'), message)
  }

  const messageFile = join(cwd, '.git', 'commit message.txt')
  writeFileSync(messageFile, ':bug: Fix(core): support paths with spaces\n')
  const spacedPath = runGit('hook', 'run', 'commit-msg', '--', messageFile)
  assert.equal(spacedPath.status, 0, spacedPath.stdout + spacedPath.stderr)
  writeFileSync(messageFile, 'invalid message\n')
  const invalidSpacedPath = runGit('hook', 'run', 'commit-msg', '--', messageFile)
  assert.equal(invalidSpacedPath.status, 1, invalidSpacedPath.stdout + invalidSpacedPath.stderr)
  assert.match(invalidSpacedPath.stdout + invalidSpacedPath.stderr, /type-empty/)
})

test('dry release generates the custom changelog without changing files, commits or tags', async t => {
  const cwd = fixture(t)
  const head = git(cwd, 'rev-parse', 'HEAD')
  const output = []
  t.mock.method(console, 'log', (...args) => output.push(args.join(' ')))
  await mainLifeCycle({ _: [], path: cwd, file: join(cwd, 'CHANGELOG.md'), dry: true }, '1.0.0', '2.0.0')
  assertChangelog(output.join('\n'), '2.0.0')
  assert.equal(git(cwd, 'status', '--porcelain'), '')
  assert.equal(git(cwd, 'rev-parse', 'HEAD'), head)
  assert.equal(git(cwd, 'tag', '--list'), 'v1.0.0')
})

test('exported presets work with the updated conventional-changelog API', async t => {
  const cwd = fixture(t)
  for (const config of [preset, changelogPreset]) {
    const generator = new ConventionalChangelog(cwd)
      .readPackage(join(cwd, 'package.json'))
      .config(config)
      .context({ version: '2.0.0' })
    let content = ''
    for await (const chunk of generator.write()) content += chunk
    assertChangelog(content + '# Previous release\n', '2.0.0')
  }
})

test('release updates versions and changelog, commits the files and creates an annotated tag', async t => {
  const cwd = fixture(t)
  await mainLifeCycle({ _: [], path: cwd, file: join(cwd, 'CHANGELOG.md') }, '1.0.0', '2.0.0')
  for (const file of ['package.json', 'package-lock.json']) {
    assert.equal(JSON.parse(readFileSync(join(cwd, file), 'utf8')).version, '2.0.0')
  }
  assertChangelog(readFileSync(join(cwd, 'CHANGELOG.md'), 'utf8'), '2.0.0')
  assert.equal(git(cwd, 'log', '-1', '--format=%s'), ':tada: Release: v2.0.0')
  assert.equal(git(cwd, 'cat-file', '-t', 'v2.0.0'), 'tag')
  assert.equal(git(cwd, 'rev-parse', 'v2.0.0^{}'), git(cwd, 'rev-parse', 'HEAD'))
  assert.equal(git(cwd, 'status', '--porcelain'), '')
})

test('interactive CLI accepts the proposed version in dry mode', async t => {
  const cwd = fixture(t)
  const output = await runCli(t, cwd, ['--dry', '--type', 'major'], [{ prompt: 'is it right?', input: 'y\n' }])
  assertChangelog(output, '2.0.0')
  assert.equal(git(cwd, 'status', '--porcelain'), '')
  assert.equal(git(cwd, 'tag', '--list'), 'v1.0.0')
})

test('interactive CLI can choose an alternative version', async t => {
  const cwd = fixture(t)
  const output = await runCli(
    t,
    cwd,
    ['--dry'],
    [
      { prompt: 'is it right?', input: 'n\n' },
      { prompt: 'Which version would you like to bump it?', input: '\n' },
    ],
  )
  assertChangelog(output, '2.0.0')
  assert.equal(git(cwd, 'status', '--porcelain'), '')
})

test('interactive CLI respects --no-changelog and --no-tag', async t => {
  const cwd = fixture(t)
  await runCli(t, cwd, ['--no-changelog', '--no-tag'], [{ prompt: 'is it right?', input: 'y\n' }])
  assert.equal(JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')).version, '1.0.1')
  assert.equal(readFileSync(join(cwd, 'CHANGELOG.md'), 'utf8'), '# Previous release\n')
  assert.equal(git(cwd, 'log', '-1', '--format=%s'), ':tada: Release: v1.0.1')
  assert.equal(git(cwd, 'tag', '--list'), 'v1.0.0')
  assert.equal(git(cwd, 'status', '--porcelain'), '')
})
