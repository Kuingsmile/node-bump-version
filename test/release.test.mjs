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
import { delimiter, dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
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
  assert.equal(result.scripts.cz, 'czg --config=.cz-config.cjs')
  assert.ok(result.devDependencies.czg)
  assert.equal(result.devDependencies.commitizen, undefined)
  assert.match(readFileSync(join(cwd, '.cz-config.cjs'), 'utf8'), /commitizen\/conventional/)
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

test('init keeps existing Commitizen projects on their configured adapter', t => {
  const cwd = fixture(t)
  const manifest = join(cwd, 'package.json')
  const pkg = JSON.parse(readFileSync(manifest, 'utf8'))
  pkg.config = { commitizen: { path: 'cz-customizable' }, 'cz-customizable': { config: 'custom.cjs' } }
  writeFileSync(manifest, JSON.stringify(pkg))
  const options = { _: ['init'], path: cwd, 'commit-helper': true }
  initProject(options)
  const result = JSON.parse(readFileSync(manifest, 'utf8'))
  assert.deepEqual(result.config, pkg.config)
  assert.equal(result.scripts.cz, 'git-cz')
  assert.ok(result.devDependencies.commitizen && result.devDependencies['cz-customizable'])
  assert.equal(result.devDependencies.czg, undefined)
  assert.equal(existsSync(join(cwd, '.cz-config.cjs')), false)
  assert.deepEqual(initProject(options).files, [])
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
  mkdirSync(join(cwd, '.husky'))
  for (const hook of ['pre-commit', 'commit-msg']) {
    copyFileSync(join(project, '.husky', hook), join(cwd, '.husky', hook))
  }
  // pnpm may install before running a script. Give this fixture its own modules directory.
  const env = {
    ...process.env,
    PATH: [join(project, 'node_modules/.bin'), process.env.PATH].join(delimiter),
    HUSKY: '1',
    XDG_CONFIG_HOME: join(cwd, '.config'),
  }
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
  assert.doesNotMatch(output.join('\n'), /# Previous release/)
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
  assert.ok(readFileSync(join(cwd, 'CHANGELOG.md'), 'utf8').endsWith('# Previous release\n'))
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

test('ignored release paths are rejected before writing and checked again after planning', async t => {
  const cwd = fixture(t)
  const argv = { _: [], path: cwd, json: true, file: 'notes.md' }
  const before = readFileSync(join(cwd, 'package.json'), 'utf8')
  const plan = await planRelease(argv, '1.0.0', '1.0.1')
  writeFileSync(join(cwd, '.git/info/exclude'), 'notes.md\n')
  await assert.rejects(executeRelease(argv, plan), /Git ignores release files/)
  await assert.rejects(planRelease(argv, '1.0.0', '1.0.1'), /Git ignores release files/)
  assert.ok(doctorProject(argv).checks.some(check => check.name === 'ignored' && !check.ok))
  assert.equal(existsSync(join(cwd, 'notes.md')), false)
  assert.equal(readFileSync(join(cwd, 'package.json'), 'utf8'), before)
  assert.equal(git(cwd, 'status', '--porcelain'), '')
})

test('a locked Git index cannot prevent rollback of release files', async t => {
  const cwd = fixture(t)
  const argv = { _: [], path: cwd, file: 'notes.md', json: true }
  const plan = await planRelease(argv, '1.0.0', '1.0.1')
  writeFileSync(join(cwd, '.git/index.lock'), 'another process')
  await assert.rejects(executeRelease(argv, plan), /index\.lock/)
  assert.equal(readFileSync(join(cwd, '.git/index.lock'), 'utf8'), 'another process')
  for (const change of plan.changes) {
    if (change.before === null) assert.equal(existsSync(change.path), false)
    else assert.equal(readFileSync(change.path, 'utf8'), change.before)
  }
  assert.equal(git(cwd, 'rev-parse', 'HEAD'), plan.head)
  assert.equal(git(cwd, 'diff', '--cached', '--name-only'), '')
})

test('a lockfile created after planning is preserved and requires a fresh preview', async t => {
  const cwd = fixture(t)
  const argv = { _: [], path: cwd, json: true }
  const plan = await planRelease(argv, '1.0.0', '1.0.1')
  const lock = join(cwd, 'npm-shrinkwrap.json')
  const before = '{"version":"1.0.0"}\n'
  writeFileSync(lock, before)
  await assert.rejects(executeRelease(argv, plan), /Lockfile appeared after preview/)
  assert.equal(readFileSync(lock, 'utf8'), before)
  assert.equal(git(cwd, 'rev-parse', 'HEAD'), plan.head)
  assert.equal(git(cwd, 'diff', '--cached', '--name-only'), '')
})

test('stable tags take precedence over RCs for recommendations and notes', async t => {
  const cwd = fixture(t)
  git(cwd, 'tag', 'v1.0.0-rc.1', 'HEAD~2')
  git(cwd, 'tag', '-f', 'v1.0.0')
  const argv = { _: [], path: cwd, dry: true }
  await assert.rejects(recommendVersion(argv), /No commits since/)
  git(cwd, 'commit', '--allow-empty', '-m', ':bug: Fix: after stable')
  const recommendation = await recommendVersion(argv)
  assert.deepEqual([recommendation.type, recommendation.from, recommendation.commits], ['patch', 'v1.0.0', 1])
  const plan = await planRelease(argv, '1.0.0', '1.0.1')
  assert.match(plan.releaseNotes, /after stable/)
  assert.doesNotMatch(plan.releaseNotes, /add a feature|Previous release/)
  const file = join(cwd, 'package.json')
  const manifest = JSON.parse(readFileSync(file, 'utf8'))
  writeFileSync(file, JSON.stringify({ ...manifest, description: 'maintenance' }))
  git(cwd, 'commit', '-am', 'chore(release): v1.0.0')
  assert.equal((await recommendVersion(argv)).from, 'v1.0.0')
})

test('shallow recommendations require the full range up to the release', async t => {
  const source = fixture(t)
  const cwd = join(source, 'shallow')
  git(source, 'clone', '--depth=1', pathToFileURL(source).href, cwd)
  const argv = { _: [], path: cwd, dry: true }
  await assert.rejects(recommendVersion(argv), /git fetch --unshallow --tags/)
  git(cwd, 'fetch', '--unshallow', '--tags')
  assert.deepEqual(await recommendVersion(argv), await recommendVersion({ ...argv, path: source }))
  git(source, 'tag', '-f', 'v1.0.0', 'HEAD~1')
  const covered = join(source, 'shallow-with-release-tag')
  git(source, 'clone', '--depth=2', pathToFileURL(source).href, covered)
  assert.equal(git(covered, 'rev-parse', '--is-shallow-repository'), 'true')
  assert.deepEqual(
    await recommendVersion({ ...argv, path: covered }),
    await recommendVersion({ ...argv, path: source }),
  )
})

test('tagless releases use the preceding release of the target package in both presets', async t => {
  for (const preset of ['emoji', 'conventional']) {
    const cwd = fixture(t)
    const argv = { _: [], path: cwd, preset, tag: false, json: true }
    await mainLifeCycle(argv, '1.0.0', '2.0.0')
    const previous = git(cwd, 'rev-parse', 'HEAD')
    await assert.rejects(recommendVersion(argv), /No commits since/)
    git(cwd, 'commit', '--allow-empty', '-m', preset === 'emoji' ? ':bug: Fix: later fix' : 'fix: later fix')
    const result = await recommendVersion(argv)
    assert.deepEqual([result.from, result.type, result.commits], [previous, 'patch', 1])
    const plan = await planRelease(argv, '2.0.0', '2.0.1')
    assert.match(plan.releaseNotes, /later fix/)
    assert.doesNotMatch(plan.releaseNotes, /add a feature|Previous release|\bv2\.0\.0\b/)
    const priorNotes = readFileSync(join(cwd, 'CHANGELOG.md'), 'utf8')
    await executeRelease(argv, plan)
    assert.equal(readFileSync(join(cwd, 'CHANGELOG.md'), 'utf8'), plan.releaseNotes + priorNotes)
  }
})

test('recommendations stream large messages and use the configured preset across API and CLI', async t => {
  const cwd = fixture(t)
  const manifest = join(cwd, 'package.json')
  const pkg = JSON.parse(readFileSync(manifest, 'utf8'))
  writeFileSync(manifest, JSON.stringify({ ...pkg, bumpVersion: { preset: 'conventional' } }))
  git(cwd, 'commit', '-am', 'chore: configure preset')
  git(cwd, 'tag', '-f', 'v1.0.0')
  execFileSync('git', ['commit', '--allow-empty', '-F', '-'], {
    cwd,
    input: 'feat: stream history\n\n' + 'a'.repeat(1100000),
  })
  const argv = { _: [], path: cwd, dry: true, json: true }
  const api = await recommendVersion(argv)
  assert.equal(api.type, 'minor')
  assert.equal((await recommendVersion({ ...argv, preset: 'emoji' })).type, 'patch')
  const plan = await planRelease(argv, '1.0.0', '1.1.0')
  const preview = JSON.parse(
    execFileSync(process.execPath, [cli, '--dry-run', '--type', 'auto', '--json'], { cwd, encoding: 'utf8' }),
  )
  assert.deepEqual(preview.recommendation, api)
  assert.match(plan.releaseNotes, /stream history/)
  assert.equal(preview.releaseNotes, plan.releaseNotes)
  assert.doesNotMatch(preview.releaseNotes, /Previous release/)
  assert.equal((await planRelease({ ...argv, changelog: false }, '1.0.0', '1.1.0')).releaseNotes, null)
  await mainLifeCycle({ ...argv, dry: false }, '1.0.0', '1.1.0')
  assert.equal(git(cwd, 'log', '-1', '--format=%s'), 'chore(release): v1.1.0')
})

test('workspace releases update only the selected package in the owning npm lockfiles', async t => {
  const root = fixture(t)
  const cwd = join(root, 'packages', 'alpha')
  mkdirSync(cwd, { recursive: true })
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  writeFileSync(join(root, 'package.json'), JSON.stringify({ ...pkg, workspaces: ['packages/*'] }))
  writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'alpha', version: '0.1.0' }))
  const packages = {
    '': { version: '1.0.0' },
    'packages/alpha': { version: '0.1.0' },
    'packages/beta': { version: '0.3.0' },
  }
  for (const [file, lockfileVersion] of [
    ['package-lock.json', 3],
    ['npm-shrinkwrap.json', 2],
  ]) {
    writeFileSync(join(root, file), JSON.stringify({ version: '1.0.0', lockfileVersion, packages }, null, 4) + '\n')
  }
  git(root, 'add', '.')
  git(root, 'commit', '-m', 'chore: set up workspace')
  const argv = { _: [], path: cwd, json: true }
  const plan = await planRelease(argv, '0.1.0', '0.1.1')
  await executeRelease(argv, plan)
  for (const file of ['package-lock.json', 'npm-shrinkwrap.json']) {
    const lock = JSON.parse(git(root, 'show', `v0.1.1:${file}`))
    assert.equal(lock.version, '1.0.0')
    assert.deepEqual(lock.packages, { ...packages, 'packages/alpha': { version: '0.1.1' } })
  }
  assert.equal(git(root, 'status', '--porcelain'), '')
  await mainLifeCycle({ ...argv, tag: false }, '0.1.1', '0.1.2')
  await assert.rejects(recommendVersion(argv), /No commits since/)
  writeFileSync(join(root, 'package-lock.json'), JSON.stringify({ lockfileVersion: 1, version: '1.0.0' }))
  await assert.rejects(planRelease(argv, '0.1.2', '0.1.3'), /Refresh the npm lockfile/)
})

test('doctor reports an unborn branch and only requires identity for Git writes', async t => {
  const parent = fixture(t)
  const remoteCheck = spawnSync(process.execPath, [cli, 'doctor', '--push', '--json'], {
    cwd: parent,
    encoding: 'utf8',
  })
  assert.equal(remoteCheck.status, 1)
  assert.ok(JSON.parse(remoteCheck.stdout).checks.some(check => !check.ok && /remote/i.test(check.message)))
  assert.equal(git(parent, 'status', '--porcelain'), '')
  const cwd = join(parent, 'new')
  mkdirSync(cwd)
  git(cwd, 'init', '-b', 'main')
  copyFileSync(join(parent, 'package.json'), join(cwd, 'package.json'))
  const argv = { _: [], path: cwd, json: true }
  assert.ok(
    doctorProject(argv).checks.some(
      check => check.name === 'head' && !check.ok && /initial Git commit/i.test(check.message),
    ),
  )
  await assert.rejects(planRelease(argv, '1.0.0', '1.0.1'), /initial Git commit/i)
  git(cwd, 'add', '.')
  git(
    cwd,
    '-c',
    'user.name=Review',
    '-c',
    'user.email=review@example.invalid',
    '-c',
    'commit.gpgsign=false',
    'commit',
    '-m',
    'initial',
  )
  git(cwd, 'config', 'user.name', '')
  git(cwd, 'config', 'user.email', '')
  assert.ok(doctorProject(argv).checks.some(check => check.name === 'identity' && !check.ok))
  const filesOnly = { ...argv, skipCommit: true, tag: false }
  assert.equal(doctorProject(filesOnly).ok, true)
  await mainLifeCycle(filesOnly, '1.0.0', '1.0.1')
  assert.equal(JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')).version, '1.0.1')
})
