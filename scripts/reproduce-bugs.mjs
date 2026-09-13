#!/usr/bin/env node
// This is an opt-in reproduction suite, not a test of correct release behavior.
// Exit 0 means every selected bug was reproduced; 1 means a mismatch or error.
import assert from 'node:assert/strict'
import { execFileSync, fork, spawn, spawnSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { isDeepStrictEqual, parseArgs, stripVTControlCharacters } from 'node:util'

const project = fileURLToPath(new URL('../', import.meta.url))
const script = fileURLToPath(import.meta.url)
const cli = join(project, 'dist/bin/bump-version.js')
const readJson = file => JSON.parse(readFileSync(file, 'utf8'))
const writeJson = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + '\n')
const readChangelog = cwd => readFileSync(join(cwd, 'CHANGELOG.md'), 'utf8')
const version = cwd => readJson(join(cwd, 'package.json')).version
const previousChangelog = '# Previous release\n'
let root
let api

class ReproductionError extends Error {}

function git(cwd, ...args) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 15000,
    }).trim()
  } catch (error) {
    throw new ReproductionError(`Fixture git ${args[0]} failed (exit ${error.status ?? 'unknown'})`)
  }
}

function fixture(name, initialVersion = '1.0.0', lockfileVersion = 3) {
  const cwd = join(root, name)
  mkdirSync(cwd, { recursive: true })
  const pkg = {
    name: 'reproduce-fixture',
    version: initialVersion,
    repository: 'https://github.com/example/reproduce-fixture.git',
  }
  writeJson(join(cwd, 'package.json'), pkg)
  writeJson(join(cwd, 'package-lock.json'), {
    name: pkg.name,
    version: initialVersion,
    lockfileVersion,
    packages: { '': { name: pkg.name, version: initialVersion } },
  })
  writeFileSync(join(cwd, 'CHANGELOG.md'), previousChangelog)
  git(cwd, 'init', '--initial-branch=main', '--template=')
  git(cwd, 'config', 'user.name', 'Reproduction Fixture')
  git(cwd, 'config', 'user.email', 'reproduce@example.invalid')
  git(cwd, 'config', 'commit.gpgsign', 'false')
  git(cwd, 'config', 'tag.gpgsign', 'false')
  git(cwd, 'config', 'core.hooksPath', join(cwd, '.disabled-hooks'))
  git(cwd, 'config', 'core.autocrlf', 'false')
  git(cwd, 'add', '.')
  git(cwd, 'commit', '-m', ':pushpin: Init: initial release')
  git(cwd, 'tag', 'v' + initialVersion)
  git(cwd, 'commit', '--allow-empty', '-m', ':sparkles: Feature(core): add feature')
  return cwd
}

// Use argument arrays for harness commands. Only the package under test invokes
// a shell, and the injection probe runs only a harmless echo in a fixture.
function runNode(cwd, file, args = [], confirm = true) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, [file, ...args], { cwd, stdio: 'pipe' })
    let output = ''
    let answered = false
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      child.kill()
    }, 20000)
    const receive = chunk => {
      output += stripVTControlCharacters(chunk.toString())
      if (confirm && !answered && output.includes('is it right?')) {
        answered = true
        setImmediate(() => {
          if (!child.stdin.destroyed) child.stdin.write('y\n')
        })
      }
    }
    child.stdout.on('data', receive)
    child.stderr.on('data', receive)
    child.stdin.on('error', () => {})
    child.once('error', () => {
      clearTimeout(timeout)
      reject(new ReproductionError('Could not start fixture command'))
    })
    child.once('close', code => {
      clearTimeout(timeout)
      if (timedOut) reject(new ReproductionError('Fixture command timed out'))
      else resolveResult({ code, output })
    })
  })
}

const runCli = (cwd, args = [], confirm = true) => runNode(cwd, cli, args, confirm)
function succeeded(result) {
  assert.equal(result.code, 0, 'Fixture command must succeed before checking its effects')
}

function findNpm() {
  // npm_execpath is npm-cli.js under npm, but yarn.js under Yarn.
  const candidates = [process.env.npm_execpath]
  for (const directory of [
    dirname(process.execPath),
    ...(process.env.PATH || process.env.Path || '').split(delimiter),
  ]) {
    if (!directory) continue
    candidates.push(join(directory, 'node_modules/npm/bin/npm-cli.js'))
    candidates.push(resolve(directory, '../lib/node_modules/npm/bin/npm-cli.js'))
    const executable = join(directory, 'npm')
    if (existsSync(executable)) candidates.push(realpathSync(executable))
  }
  const npm = candidates.find(candidate => candidate && /[/\\]npm-cli\.js$/.test(candidate) && existsSync(candidate))
  if (!npm) throw new ReproductionError('npm-cli.js not found; run this script with npm run reproduce:bugs')
  return npm
}

const cases = [
  {
    id: 1,
    severity: 'P1',
    title: 'Shell injection and paths containing spaces',
    correct: 'Spaces and shell characters are literal filenames; no command executes.',
    buggy: { spacesRejectedByGit: true, versionChangedBeforeFailure: '1.0.1', harmlessEchoExecuted: true },
    fixed: { spacesRejectedByGit: false, versionChangedBeforeFailure: '1.0.1', harmlessEchoExecuted: false },
    async run() {
      const spaced = fixture('repo with spaces')
      process.chdir(spaced)
      let failure
      try {
        await api.mainLifeCycle({ _: [], path: spaced, changelog: false }, '1.0.0', '1.0.1')
      } catch (error) {
        failure = error
      }
      if (failure) assert.match(failure.message, /outside repository|pathspec/)
      else {
        assert.equal(JSON.parse(git(spaced, 'show', 'v1.0.1:package.json')).version, '1.0.1')
        assert.equal(git(spaced, 'status', '--porcelain'), '')
      }
      const cwd = fixture('shell-filename')
      process.chdir(cwd)
      const marker = 'REPRODUCE_HARMLESS_ECHO'
      const file = process.platform === 'win32' ? `CHANGE&echo ${marker}&rem .md` : `CHANGE;echo ${marker};#.md`
      writeFileSync(join(cwd, file), 'Synthetic changelog\n')
      const output = await api.commit({ _: [], path: cwd, file }, '1.0.1')
      const harmlessEchoExecuted = (output || '').split(/\r?\n/).some(line => line.trim() === marker)
      if (!harmlessEchoExecuted) {
        assert.equal(git(cwd, 'show', `HEAD:${file}`), 'Synthetic changelog')
        assert.equal(git(cwd, 'status', '--porcelain'), '')
      }
      return {
        spacesRejectedByGit: /outside repository|pathspec/.test(failure?.message || ''),
        versionChangedBeforeFailure: version(spaced),
        harmlessEchoExecuted,
      }
    },
  },
  {
    id: 2,
    severity: 'P1',
    title: 'README npm dry command performs a real release',
    correct: 'The documented dry command leaves the version, HEAD, and tags unchanged.',
    buggy: {
      documentedUnsafeCommand: true,
      version: '1.0.1',
      releaseTagCreated: true,
      commitCreated: true,
      properlyForwardedDryIsClean: true,
    },
    fixed: {
      documentedUnsafeCommand: false,
      version: '1.0.0',
      releaseTagCreated: false,
      commitCreated: false,
      properlyForwardedDryIsClean: true,
    },
    async run() {
      const npm = findNpm()
      const cwd = fixture('npm-dry')
      const pkg = readJson(join(cwd, 'package.json'))
      // The shell script is constant. The absolute import is JS data, not shell text.
      pkg.scripts = { release: 'node release.mjs' }
      writeJson(join(cwd, 'package.json'), pkg)
      writeFileSync(join(cwd, 'release.mjs'), `await import(${JSON.stringify(pathToFileURL(cli).href)})\n`)
      git(cwd, 'add', '.')
      git(cwd, 'commit', '-m', ':package: Chore: configure release script')
      const head = git(cwd, 'rev-parse', 'HEAD')
      // Negative control: the corrected npm syntax really is dry.
      succeeded(await runNode(cwd, npm, ['run', 'release', '--', '--dry']))
      const properlyForwardedDryIsClean =
        git(cwd, 'status', '--porcelain') === '' &&
        git(cwd, 'rev-parse', 'HEAD') === head &&
        git(cwd, 'tag', '--list') === 'v1.0.0'
      assert.ok(properlyForwardedDryIsClean, 'Correctly forwarded dry mode must be a clean control')
      const documentedArgs = readFileSync(join(project, 'README.md'), 'utf8').match(/^npm run release (--.*)$/m)?.[1]
      assert.ok(['--dry', '-- --dry'].includes(documentedArgs), 'The README must document a recognized dry-run command')
      succeeded(await runNode(cwd, npm, ['run', 'release', ...documentedArgs.split(' ')]))
      return {
        documentedUnsafeCommand: documentedArgs === '--dry',
        version: version(cwd),
        releaseTagCreated: git(cwd, 'tag', '--list', 'v1.0.1') === 'v1.0.1',
        commitCreated: git(cwd, 'rev-parse', 'HEAD') !== head,
        properlyForwardedDryIsClean,
      }
    },
  },
  {
    id: 3,
    severity: 'P1',
    title: '--path takes the version from the caller',
    correct: 'Target package 5.0.0 becomes 5.0.1; the caller stays at 1.0.0.',
    buggy: { callerVersion: '1.0.0', targetVersion: '1.0.1' },
    async run() {
      const caller = fixture('wrong-version-caller')
      const target = fixture('wrong-version-target', '5.0.0')
      succeeded(await runCli(caller, ['--path', target, '--no-changelog', '--no-tag']))
      return { callerVersion: version(caller), targetVersion: version(target) }
    },
  },
  {
    id: 4,
    severity: 'P1',
    title: 'dry:false tags a package whose version was not bumped',
    correct: 'Explicit dry:false writes and tags package version 1.0.1.',
    buggy: { workingVersion: '1.0.0', taggedVersion: '1.0.0', changelogUpdated: true },
    async run() {
      const cwd = fixture('dry-false')
      process.chdir(cwd)
      await api.mainLifeCycle({ _: [], path: cwd, file: join(cwd, 'CHANGELOG.md'), dry: false }, '1.0.0', '1.0.1')
      return {
        workingVersion: version(cwd),
        taggedVersion: JSON.parse(git(cwd, 'show', 'v1.0.1:package.json')).version,
        changelogUpdated: readChangelog(cwd).includes('1.0.1'),
      }
    },
  },
  {
    id: 5,
    severity: 'P1',
    title: 'Invalid release type writes an empty version and tag v',
    correct: 'Invalid --type fails before changing files, commits, or tags.',
    buggy: { exitCode: 0, version: '', invalidTagCreated: true, commitCreated: true },
    async run() {
      const cwd = fixture('invalid-type')
      const head = git(cwd, 'rev-parse', 'HEAD')
      const result = await runCli(cwd, ['--type', 'typo', '--no-changelog'])
      return {
        exitCode: result.code,
        version: version(cwd),
        invalidTagCreated: git(cwd, 'tag', '--list', 'v') === 'v',
        commitCreated: git(cwd, 'rev-parse', 'HEAD') !== head,
      }
    },
  },
  {
    id: 6,
    severity: 'P2',
    title: 'Changelog is written in the caller directory',
    correct: 'Only the target changelog is updated and included in the release tag.',
    buggy: { callerChangelogChanged: true, targetChangelogUnchanged: true, taggedChangelogUnchanged: true },
    async run() {
      const caller = fixture('changelog-caller')
      const target = fixture('changelog-target')
      succeeded(await runCli(caller, ['--path', target]))
      return {
        callerChangelogChanged: readChangelog(caller).includes('1.0.1'),
        targetChangelogUnchanged: readChangelog(target) === previousChangelog,
        taggedChangelogUnchanged: git(target, 'show', 'v1.0.1:CHANGELOG.md') === previousChangelog.trim(),
      }
    },
  },
  {
    id: 7,
    severity: 'P2',
    title: 'Relative --path is resolved twice during Git operations',
    correct: 'A relative target path releases successfully with no uncommitted files.',
    buggy: { failedWithPathspec: true, targetVersion: '1.0.1', headUnchanged: true, filesLeftDirty: true },
    async run() {
      const caller = fixture('relative-caller')
      const target = fixture('relative-caller/child')
      const head = git(target, 'rev-parse', 'HEAD')
      const result = await runCli(caller, ['--path', 'child', '--no-changelog', '--no-tag'])
      return {
        failedWithPathspec: result.code !== 0 && /pathspec/.test(result.output),
        targetVersion: version(target),
        headUnchanged: git(target, 'rev-parse', 'HEAD') === head,
        filesLeftDirty: git(target, 'status', '--porcelain') !== '',
      }
    },
  },
  {
    id: 8,
    severity: 'P2',
    title: 'Lockfile v2/v3 root-package version stays stale',
    correct: 'Both lockfile version fields match package.json after a bump.',
    buggy: [2, 3].map(lockfileVersion => ({
      lockfileVersion,
      manifest: '1.0.1',
      topLevel: '1.0.1',
      rootPackage: '1.0.0',
    })),
    async run() {
      const observations = []
      for (const lockfileVersion of [2, 3]) {
        const cwd = fixture(`lockfile-v${lockfileVersion}`, '1.0.0', lockfileVersion)
        process.chdir(cwd)
        await api.bumpVersion({ _: [], path: cwd }, '1.0.1')
        const lock = readJson(join(cwd, 'package-lock.json'))
        observations.push({
          lockfileVersion,
          manifest: version(cwd),
          topLevel: lock.version,
          rootPackage: lock.packages[''].version,
        })
      }
      return observations
    },
  },
  {
    id: 9,
    severity: 'P2',
    title: 'Feature commits receive a patch recommendation',
    correct: 'The custom Feature commit recommends minor (level 1).',
    buggy: { parsedType: ':sparkles: Feature', level: 2, reason: 'There are 0 BREAKING CHANGES and 0 features' },
    async run() {
      const { CommitParser } = await import('conventional-commits-parser')
      const { default: parser } = await import('../dist/conventional-changelog-node/parser-opts.js')
      const { default: recommended } =
        await import('../dist/conventional-changelog-node/conventional-recommended-bump.js')
      const commit = new CommitParser(parser).parse(':sparkles: Feature(core): add feature')
      assert.equal(commit.type, ':sparkles: Feature', 'Parser must recognize the custom convention')
      return { parsedType: commit.type, ...recommended.whatBump([commit]) }
    },
  },
  {
    id: 10,
    severity: 'P2',
    title: 'Commit message hook does not enforce commitlint',
    correct: 'The configured commit-msg hook rejects an invalid message.',
    buggy: {
      legacyConfigurationPresent: true,
      invalidCommitAccepted: true,
      directLintRejects: true,
      validMessageAccepted: true,
      commitMsgHookExists: false,
    },
    async run() {
      const cwd = fixture('husky-hooks')
      const pkg = readJson(join(cwd, 'package.json'))
      const projectPackage = readJson(join(project, 'package.json'))
      pkg.husky = projectPackage.husky
      pkg.commitlint = { extends: [join(project, 'dist/commitlint-node/index.js')] }
      writeJson(join(cwd, 'package.json'), pkg)
      symlinkSync(
        join(project, 'node_modules'),
        join(cwd, 'node_modules'),
        process.platform === 'win32' ? 'junction' : 'dir',
      )
      // Exercise the current commit-msg hook, independent of pre-commit linting.
      if (existsSync(join(project, '.husky/commit-msg'))) {
        mkdirSync(join(cwd, '.husky'))
        copyFileSync(join(project, '.husky/commit-msg'), join(cwd, '.husky/commit-msg'))
      }
      git(cwd, 'config', '--unset', 'core.hooksPath')
      succeeded(await runNode(cwd, join(project, 'node_modules/husky/bin.js'), [], false))
      assert.equal(git(cwd, 'config', 'core.hooksPath'), '.husky/_', 'Husky must actually be installed')
      const lint = message =>
        spawnSync(process.execPath, [join(project, 'node_modules/@commitlint/cli/cli.js')], {
          cwd,
          input: message + '\n',
          encoding: 'utf8',
          timeout: 15000,
        })
      const valid = lint(':bug: Fix(core): handle input')
      const invalid = lint('invalid message')
      assert.equal(valid.status, 0, 'Commitlint configuration must accept a valid control')
      assert.match(
        invalid.stdout + invalid.stderr,
        /type-empty/,
        'Commitlint must reject the message for the expected reason',
      )
      git(cwd, 'add', 'package.json')
      const commit = spawnSync('git', ['commit', '-m', 'invalid message'], { cwd, encoding: 'utf8', timeout: 15000 })
      assert.ok(
        commit.status === 0 || /type-empty/.test(commit.stdout + commit.stderr),
        'Commit must succeed or fail specifically on commitlint validation',
      )
      const invalidCommitAccepted = commit.status === 0 && git(cwd, 'log', '-1', '--format=%s') === 'invalid message'
      const validCommit = spawnSync('git', ['commit', '--allow-empty', '-m', ':bug: Fix(core): handle input'], {
        cwd,
        encoding: 'utf8',
        timeout: 15000,
      })
      assert.equal(validCommit.status, 0, 'The installed hook must accept a valid control commit')
      return {
        legacyConfigurationPresent: Boolean(projectPackage.husky?.hooks?.['commit-msg']),
        invalidCommitAccepted,
        directLintRejects: invalid.status !== 0,
        validMessageAccepted: validCommit.status === 0,
        commitMsgHookExists: existsSync(join(cwd, '.husky/commit-msg')),
      }
    },
  },
  {
    id: 11,
    severity: 'P3',
    title: 'Help requires a package and startup errors exit successfully',
    correct: 'Help works without a package; missing and malformed packages fail with a nonzero exit.',
    buggy: { helpExitCode: 0, helpMissing: true, missingPackageExitCode: 0, malformedPackageExitCode: 0 },
    async run() {
      const cwd = join(root, 'empty')
      mkdirSync(cwd)
      const help = await runCli(cwd, ['--help'], false)
      const missing = await runCli(cwd, [], false)
      writeFileSync(join(cwd, 'package.json'), '{ invalid fixture json')
      const malformed = await runCli(cwd, [], false)
      return {
        helpExitCode: help.code,
        helpMissing: !help.output.includes('Usage') && help.output.includes('not found'),
        missingPackageExitCode: missing.code,
        malformedPackageExitCode: malformed.code,
      }
    },
  },
]

async function baseline() {
  const cwd = fixture('control')
  const head = git(cwd, 'rev-parse', 'HEAD')
  succeeded(await runCli(cwd, ['--dry']))
  assert.equal(git(cwd, 'status', '--porcelain'), '')
  assert.equal(git(cwd, 'rev-parse', 'HEAD'), head)
  assert.equal(git(cwd, 'tag', '--list'), 'v1.0.0')
  succeeded(await runCli(cwd))
  assert.equal(version(cwd), '1.0.1')
  assert.equal(JSON.parse(git(cwd, 'show', 'v1.0.1:package.json')).version, '1.0.1')
  assert.equal(git(cwd, 'status', '--porcelain'), '')
  return { status: 'PASS', title: 'Control: dry run and ordinary release work' }
}

function worker(id, directory, env) {
  return new Promise(resolveResult => {
    const child = fork(script, ['--worker', String(id), '--root', directory], {
      cwd: project,
      env,
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    })
    // Do not dump arbitrary subprocess output or inherited environment values.
    child.stdout.resume()
    child.stderr.resume()
    let result
    const timeout = setTimeout(() => child.kill(), 60000)
    child.on('message', message => {
      result = message
    })
    child.once('error', () => {
      clearTimeout(timeout)
      resolveResult({ id, status: 'ERROR', error: 'Could not start isolated worker' })
    })
    child.once('close', code => {
      clearTimeout(timeout)
      resolveResult(result || { id, status: 'ERROR', error: `Worker exited without a result (code ${code})` })
    })
  })
}

async function main() {
  const { values } = parseArgs({
    options: {
      help: { type: 'boolean', short: 'h' },
      case: { type: 'string', multiple: true },
      'skip-build': { type: 'boolean' },
      'verify-fixed': { type: 'boolean' },
      'temp-dir': { type: 'string' },
      worker: { type: 'string' },
      root: { type: 'string' },
    },
  })
  if (values.help) {
    console.log('Usage: node scripts/reproduce-bugs.mjs [--case 1] [--case 2] [--skip-build] [--temp-dir PATH]')
    console.log('Builds first, then checks all 11 bugs in fresh temporary repositories. Requires Git and npm.')
    console.log('Exit 0: all selected bugs reproduced. Exit 1: mismatch or harness error. Fixtures are retained.')
    console.log('--verify-fixed: exit 0 only when every selected case matches its verified correct behavior.')
    for (const item of cases) console.log(`${item.id}. [${item.severity}] ${item.title}`)
    return
  }
  if (values.worker) {
    assert.ok(process.send, 'Workers must be started by this script')
    root = realpathSync(values.root)
    api = await import('../dist/index.js')
    const id = Number(values.worker)
    if (id === 0) process.send(await baseline())
    else {
      const item = cases.find(item => item.id === id)
      const observed = await item.run()
      process.send({
        id,
        severity: item.severity,
        title: item.title,
        status: isDeepStrictEqual(observed, item.buggy)
          ? 'REPRODUCED'
          : isDeepStrictEqual(observed, item.fixed)
            ? 'FIXED'
            : 'NOT REPRODUCED',
        correctBehavior: item.correct,
        observed,
      })
    }
    return
  }
  const ids = values.case?.map(Number) || cases.map(item => item.id)
  assert.ok(ids.length && ids.every(id => cases.some(item => item.id === id)), '--case must be a number from 1 to 11')
  if (!values['skip-build']) {
    console.log('Building current source...')
    execFileSync(process.execPath, [join(project, 'node_modules/rollup/dist/bin/rollup'), '-c'], {
      cwd: project,
      stdio: 'pipe',
      timeout: 120000,
    })
  }
  assert.ok(existsSync(cli), 'Built CLI not found; run yarn build')
  const parent = realpathSync(values['temp-dir'] ? resolve(values['temp-dir']) : tmpdir())
  assert.ok(
    !/[\s&;|<>^%!"'`$()]/.test(parent),
    'Use --temp-dir with a path without spaces or shell characters to isolate the filename bug',
  )
  root = mkdtempSync(join(parent, 'node-bump-version-reproduce-'))
  // Isolate global Git settings, hooks, repository overrides, and npm settings.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !/^(GIT_|HUSKY$|npm_config_)/i.test(key)),
  )
  Object.assign(env, {
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: join(root, 'gitconfig'),
    GIT_TERMINAL_PROMPT: '0',
    HUSKY: '1',
    npm_config_userconfig: join(root, 'user.npmrc'),
    npm_config_globalconfig: join(root, 'global.npmrc'),
    npm_config_offline: 'true',
    npm_config_audit: 'false',
    npm_config_update_notifier: 'false',
    XDG_CONFIG_HOME: join(root, 'xdg-config'),
    NO_COLOR: '1',
  })
  writeFileSync(env.GIT_CONFIG_GLOBAL, '')
  writeFileSync(env.npm_config_userconfig, '')
  writeFileSync(env.npm_config_globalconfig, '')
  console.log(`Fixtures: ${root}`)
  const control = await worker(0, root, env)
  console.log(`[${control.status}] ${control.title || control.error}`)
  if (control.status !== 'PASS') {
    writeJson(join(root, 'results.json'), { control, results: [] })
    process.exitCode = 1
    return
  }
  const results = []
  for (const id of new Set(ids)) {
    const result = await worker(id, root, env)
    results.push(result)
    console.log(`[${result.status}] #${id} ${result.severity || ''} ${result.title || result.error}`)
    if (result.observed) console.log(`  Observed: ${JSON.stringify(result.observed)}`)
    if (result.correctBehavior) console.log(`  Expected: ${result.correctBehavior}`)
  }
  const reproduced = results.filter(result => result.status === 'REPRODUCED').length
  const fixed = results.filter(result => result.status === 'FIXED').length
  writeJson(join(root, 'results.json'), { node: process.version, platform: process.platform, control, results })
  console.log(
    `\n${reproduced}/${results.length} reported bugs reproduced. A reproduced bug is not a passing correctness test.`,
  )
  console.log(`Evidence and repositories retained at: ${root}`)
  console.log(`${fixed}/${results.length} cases verified fixed.`)
  if (values['verify-fixed'] ? fixed !== results.length : reproduced !== results.length) process.exitCode = 1
}

try {
  await main()
} catch (error) {
  // Only assertion messages and our own diagnostics are printed, not command
  // output that might contain private paths or configuration data.
  const message = error.code?.startsWith('ERR_PARSE_ARGS_')
    ? 'Invalid arguments; run node scripts/reproduce-bugs.mjs --help. Pass options directly to Node to avoid shell argument forwarding.'
    : error instanceof assert.AssertionError || error instanceof ReproductionError
      ? error.message
      : 'Reproduction setup or command failed; check dependencies and the selected fixture.'
  if (process.send) process.send({ status: 'ERROR', error: message })
  else console.error(message)
  process.exitCode = 1
}
