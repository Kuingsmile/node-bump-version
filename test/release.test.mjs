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
import {
  doctorProject,
  executeRelease,
  initProject,
  mainLifeCycle,
  planRelease,
  recommendVersion,
} from '../dist/index.js'

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

function windowsShortPath(t, cwd) {
  const short = execFileSync('cmd.exe', ['/d', '/c', 'for %I in (.) do @echo %~fsI'], {
    cwd,
    encoding: 'utf8',
  }).trim()
  if (short.toLowerCase() === realpathSync.native(cwd).toLowerCase()) {
    t.skip('Windows short filenames are disabled on this volume')
    return null
  }
  return short
}

test(
  'release accepts Windows short paths for the package directory',
  { skip: process.platform !== 'win32' },
  async t => {
    const cwd = fixture(t)
    const short = windowsShortPath(t, cwd)
    if (!short) return
    const argv = { _: [], path: short, json: true }
    const preview = await planRelease({ ...argv, dry: true }, '1.0.0', '1.0.1')
    assert.equal(preview.path, realpathSync.native(cwd))
    assert.equal(git(cwd, 'status', '--porcelain'), '')
    await mainLifeCycle(argv, '1.0.0', '1.0.1')
    assert.equal(JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')).version, '1.0.1')
    assert.equal(git(cwd, 'tag', '--list', 'v1.0.1'), 'v1.0.1')
    assert.equal(git(cwd, 'status', '--porcelain'), '')
  },
)

test('init accepts Windows short paths at the Git root', { skip: process.platform !== 'win32' }, t => {
  const cwd = fixture(t)
  const short = windowsShortPath(t, cwd)
  if (!short) return
  const options = { _: ['init'], path: short, hooks: true }
  assert.ok(initProject({ ...options, dry: true }).files.length > 0)
  assert.equal(git(cwd, 'status', '--porcelain'), '')
  initProject(options)
  assert.match(readFileSync(join(cwd, '.husky/commit-msg'), 'utf8'), /commitlint/)
  assert.deepEqual(initProject(options).files, [])
})

function runCli(t, cwd, args, steps) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, '--interactive', ...args], { cwd, stdio: 'pipe' })
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

test('CLI rejects unknown options and malformed values before touching files', t => {
  const cwd = fixture(t)
  for (const args of [['--dry-rnu'], ['--push', 'false'], ['--dry=false'], ['--path'], ['--file='], ['-a', '-b']]) {
    const result = spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8', timeout: 5000 })
    assert.equal(result.status, 1, result.stdout + result.stderr)
    assert.doesNotMatch(result.stdout + result.stderr, /is it right/)
    assert.equal(git(cwd, 'status', '--porcelain'), '')
  }
})

test('CLI accepts --dry-run as a safe alias for --dry', async t => {
  const cwd = fixture(t)
  await runCli(t, cwd, ['--dry-run'], [{ prompt: 'is it right?', input: 'y\n' }])
  assert.equal(git(cwd, 'status', '--porcelain'), '')
  assert.equal(git(cwd, 'tag', '--list'), 'v1.0.0')
})

test('CLI supports machine-readable previews, noninteractive releases and custom prerelease ids', t => {
  const cwd = fixture(t)
  const run = args => spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8', timeout: 10000 })
  const preview = run(['--dry-run', '--json', '--type', 'preminor', '--preid', 'rc'])
  assert.equal(preview.status, 0, preview.stderr)
  const plan = JSON.parse(preview.stdout)
  assert.equal(plan.newVersion, '1.1.0-rc.0')
  assert.equal(plan.dryRun, true)
  assert.equal(plan.branch, 'main')
  assert.deepEqual(plan.files, ['package.json', 'package-lock.json', 'CHANGELOG.md'])
  assert.equal(git(cwd, 'status', '--porcelain'), '')
  const unattended = run([])
  assert.equal(unattended.status, 1)
  assert.match(unattended.stderr, /require --yes/)
  const invalid = run(['--json', '--invalid'])
  assert.equal(invalid.status, 1)
  assert.equal(JSON.parse(invalid.stdout).ok, false)
  const release = run(['--yes', '--json'])
  assert.equal(release.status, 0, release.stdout + release.stderr)
  assert.equal(JSON.parse(release.stdout).newVersion, '1.0.1')
  assert.equal(release.stderr, '')
  assert.equal(git(cwd, 'tag', '--list'), 'v1.0.0\nv1.0.1')
})

test('CLI --version works outside a package', () => {
  const result = spawnSync(process.execPath, [cli, '--version'], { cwd: tmpdir(), encoding: 'utf8' })
  assert.equal(result.status, 0)
  assert.equal(result.stdout.trim(), JSON.parse(readFileSync(join(project, 'package.json'), 'utf8')).version)
})

test('init preserves configuration, previews without writes and is idempotent', t => {
  const cwd = fixture(t)
  const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'))
  pkg.scripts = { prepare: 'node custom-setup.js', release: 'custom-release' }
  pkg.config = { existing: { keep: true } }
  writeFileSync(join(cwd, 'package.json'), JSON.stringify(pkg, null, 4) + '\n')
  const before = readFileSync(join(cwd, 'package.json'), 'utf8')
  const options = { _: ['init'], path: cwd, hooks: true, 'commit-helper': true, preset: 'conventional' }
  const preview = initProject({ ...options, dry: true })
  assert.ok(preview.files.length >= 3)
  assert.equal(readFileSync(join(cwd, 'package.json'), 'utf8'), before)
  assert.equal(existsSync(join(cwd, '.husky')), false)
  initProject(options)
  const result = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'))
  assert.equal(result.scripts.prepare, 'node custom-setup.js && husky')
  assert.equal(result.scripts.release, 'custom-release')
  assert.deepEqual(result.config.existing, { keep: true })
  assert.equal(result.bumpVersion.preset, 'conventional')
  assert.deepEqual(initProject(options).files, [])
  assert.equal(doctorProject({ _: [], path: cwd }).ok, false)
  assert.ok(doctorProject({ _: [], path: cwd }).checks.some(check => check.name === 'hooks' && !check.ok))
  mkdirSync(join(cwd, 'node_modules'))
  symlinkSync(project, join(cwd, 'node_modules/node-bump-version'), process.platform === 'win32' ? 'junction' : 'dir')
  const lint = spawnSync(process.execPath, [join(project, 'node_modules/@commitlint/cli/cli.js')], {
    cwd,
    input: 'feat: support stable imports\n',
    encoding: 'utf8',
  })
  assert.equal(lint.status, 0, lint.stdout + lint.stderr)
})

test('doctor and stable public exports work without releasing', t => {
  const cwd = fixture(t)
  const result = spawnSync(process.execPath, [cli, 'doctor', '--json'], { cwd, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stdout + result.stderr)
  assert.equal(JSON.parse(result.stdout).ok, true)
  const imports = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      "await import('node-bump-version/commitlint'); await import('node-bump-version/changelog/conventional'); await import('node-bump-version/dist/index.js');",
    ],
    { cwd: project, encoding: 'utf8' },
  )
  assert.equal(imports.status, 0, imports.stderr)
  assert.equal(git(cwd, 'status', '--porcelain'), '')
})

test('init refuses malformed configuration and preserves TypeScript commitlint files', t => {
  const cwd = fixture(t)
  const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'))
  const invalid = JSON.stringify({ ...pkg, scripts: [] })
  writeFileSync(join(cwd, 'package.json'), invalid)
  assert.throws(() => initProject({ _: ['init'], path: cwd, hooks: true }), /scripts must be an object/)
  assert.equal(readFileSync(join(cwd, 'package.json'), 'utf8'), invalid)
  writeFileSync(join(cwd, 'package.json'), JSON.stringify(pkg))
  writeFileSync(join(cwd, '.commitlintrc.mts'), 'export default { rules: {} }\n')
  initProject({ _: ['init'], path: cwd, hooks: true })
  assert.equal(existsSync(join(cwd, 'commitlint.config.cjs')), false)
  assert.equal(readFileSync(join(cwd, '.commitlintrc.mts'), 'utf8'), 'export default { rules: {} }\n')
})

test('automatic recommendations drive the CLI and explain breaking custom commits', t => {
  const cwd = fixture(t)
  const result = spawnSync(process.execPath, [cli, '--type', 'auto', '--dry-run', '--json'], { cwd, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stdout + result.stderr)
  const output = JSON.parse(result.stdout)
  assert.equal(output.newVersion, '2.0.0')
  assert.equal(output.recommendation.type, 'major')
  assert.match(output.recommendation.reason, /1 BREAKING CHANGE/)
})

test('conventional preset supports feat, fix, breaking ! headers and commitlint', async t => {
  const cwd = fixture(t)
  git(cwd, 'tag', '-f', 'v1.0.0')
  git(cwd, 'commit', '--allow-empty', '-m', 'feat(core): introduce a standard feature')
  const argv = { _: [], path: cwd, preset: 'conventional' }
  assert.equal((await recommendVersion(argv)).type, 'minor')
  git(cwd, 'commit', '--allow-empty', '-m', 'refactor(api)!: replace the interface')
  assert.equal((await recommendVersion(argv)).type, 'major')
  const config = join(project, 'dist/commitlint-standard/index.js')
  const lint = message =>
    spawnSync(process.execPath, [join(project, 'node_modules/@commitlint/cli/cli.js'), '--config', config], {
      cwd,
      encoding: 'utf8',
      input: message + '\n',
    })
  assert.equal(lint('feat(core): introduce a standard feature').status, 0)
  assert.equal(lint('refactor(api)!: replace the interface').status, 0)
  assert.equal(lint('invalid message').status, 1)
  await mainLifeCycle(argv, '1.0.0', '2.0.0')
  const content = readFileSync(join(cwd, 'CHANGELOG.md'), 'utf8')
  assert.match(content, /introduce a standard feature/)
  assert.match(content, /BREAKING CHANGES/)
  assert.match(content, /replace the interface/)
  assert.equal(git(cwd, 'log', '-1', '--format=%s'), 'chore(release): v2.0.0')
  await assert.rejects(recommendVersion(argv), /No commits since/)
})

test('release preflight rejects duplicate tags, invalid lockfiles and unsafe options without writes', async t => {
  for (const scenario of ['tag', 'lockfile', 'skip', 'dirty', 'collision', 'detached']) {
    const cwd = fixture(t)
    const head = git(cwd, 'rev-parse', 'HEAD')
    if (scenario === 'tag') git(cwd, 'tag', 'v1.0.1')
    if (scenario === 'lockfile') writeFileSync(join(cwd, 'package-lock.json'), '{ invalid json')
    if (scenario === 'dirty') writeFileSync(join(cwd, 'CHANGELOG.md'), 'Uncommitted work\n')
    if (scenario === 'detached') git(cwd, 'checkout', '--detach')
    const before = git(cwd, 'status', '--porcelain')
    await assert.rejects(
      mainLifeCycle(
        {
          _: [],
          path: cwd,
          skipCommit: scenario === 'skip',
          file: scenario === 'collision' ? 'package.json' : 'CHANGELOG.md',
        },
        '1.0.0',
        '1.0.1',
      ),
    )
    assert.equal(JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')).version, '1.0.0')
    assert.equal(git(cwd, 'rev-parse', 'HEAD'), head)
    assert.equal(git(cwd, 'status', '--porcelain'), before)
  }
})

test('failed commit restores release files and staging while preserving unrelated untracked files', async t => {
  const cwd = fixture(t)
  const original = readFileSync(join(cwd, 'package.json'), 'utf8')
  writeFileSync(join(cwd, 'notes.txt'), 'User notes\n')
  mkdirSync(join(cwd, '.test-hooks'))
  writeFileSync(join(cwd, '.test-hooks/pre-commit'), '#!/bin/sh\nexit 1\n', { mode: 0o755 })
  git(cwd, 'config', 'core.hooksPath', join(cwd, '.test-hooks'))
  const before = git(cwd, 'status', '--porcelain')
  await assert.rejects(mainLifeCycle({ _: [], path: cwd }, '1.0.0', '1.0.1'))
  assert.equal(readFileSync(join(cwd, 'package.json'), 'utf8'), original)
  assert.equal(git(cwd, 'status', '--porcelain'), before)
  assert.equal(readFileSync(join(cwd, 'notes.txt'), 'utf8'), 'User notes\n')
})

test('release refuses files changed after its preview', async t => {
  const cwd = fixture(t)
  const argv = { _: [], path: cwd }
  const plan = await planRelease(argv, '1.0.0', '1.0.1')
  writeFileSync(join(cwd, 'CHANGELOG.md'), 'Concurrent edit\n')
  await assert.rejects(executeRelease(argv, plan), /changed after preview/)
  assert.equal(JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')).version, '1.0.0')
  assert.equal(readFileSync(join(cwd, 'CHANGELOG.md'), 'utf8'), 'Concurrent edit\n')
})

test('release binds the preview to its branch and preset', async t => {
  const cwd = fixture(t)
  const argv = { _: [], path: cwd }
  const plan = await planRelease(argv, '1.0.0', '1.0.1')
  await assert.rejects(executeRelease({ ...argv, preset: 'conventional' }, plan), /options changed/)
  git(cwd, 'switch', '-c', 'other')
  await assert.rejects(executeRelease(argv, plan), /Branch changed/)
  assert.equal(git(cwd, 'status', '--porcelain'), '')
})

test('changelog aliases cannot overwrite a manifest through a directory link', async t => {
  const cwd = fixture(t)
  const linked = join(cwd, 'alias')
  symlinkSync(cwd, linked, process.platform === 'win32' ? 'junction' : 'dir')
  await assert.rejects(
    mainLifeCycle({ _: [], path: cwd, file: 'alias/package.json' }, '1.0.0', '1.0.1'),
    /must not overwrite/,
  )
  assert.equal(JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')).version, '1.0.0')
})

test('push releases to the upstream branch and sends only the intended tag', async t => {
  const cwd = fixture(t)
  const remote = fixture(t)
  const bare = join(remote, 'remote.git')
  git(remote, 'init', '--bare', bare)
  git(cwd, 'remote', 'add', 'backup', bare)
  git(cwd, 'config', 'branch.main.remote', 'backup')
  git(cwd, 'config', 'branch.main.merge', 'refs/heads/stable')
  git(cwd, 'tag', '-a', 'unrelated', '-m', 'unrelated tag')
  git(cwd, 'config', 'push.followTags', 'true')
  await mainLifeCycle({ _: [], path: cwd, push: true }, '1.0.0', '1.0.1')
  assert.equal(git(bare, 'rev-parse', 'refs/heads/stable'), git(cwd, 'rev-parse', 'HEAD'))
  assert.equal(git(bare, 'tag', '--list'), 'v1.0.1')
})

test('missing push targets fail during preflight and explicit destinations work without tags', async t => {
  const cwd = fixture(t)
  await assert.rejects(mainLifeCycle({ _: [], path: cwd, push: true }, '1.0.0', '1.0.1'), /not configured/)
  assert.equal(git(cwd, 'status', '--porcelain'), '')
  const remote = fixture(t)
  const bare = join(remote, 'destination.git')
  git(remote, 'init', '--bare', bare)
  git(cwd, 'remote', 'add', 'destination', bare)
  await mainLifeCycle(
    { _: [], path: cwd, push: true, remote: 'destination', branch: 'release', tag: false },
    '1.0.0',
    '1.0.1',
  )
  assert.equal(git(bare, 'rev-parse', 'refs/heads/release'), git(cwd, 'rev-parse', 'HEAD'))
  assert.equal(git(bare, 'tag', '--list'), '')
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
