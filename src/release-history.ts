import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { readFileSync } from 'node:fs'

import * as semver from 'semver'

import exec from './exec.js'
import type { BumpVersionArgs } from './types/index.js'

// Read Git's NUL-terminated records without buffering an entire log or splitting UTF-8 characters.
export async function readGitRecords(argv: BumpVersionArgs, args: string[], visit: (record: string) => void) {
  const child = spawn('git', args, { cwd: argv.path, stdio: ['ignore', 'pipe', 'pipe'] })
  let stderr = ''
  child.stderr.setEncoding('utf8').on('data', chunk => (stderr += chunk))
  const consume = async () => {
    let fragments: string[] = []
    for await (const chunk of child.stdout.setEncoding('utf8')) {
      const parts = String(chunk).split('\0')
      fragments.push(parts[0])
      for (const part of parts.slice(1)) {
        visit(fragments.join(''))
        fragments = [part]
      }
    }
    const last = fragments.join('')
    if (last) visit(last)
  }
  try {
    const [[code]] = await Promise.all([once(child, 'close'), consume()])
    if (code !== 0) throw new Error(stderr.trim() || `git ${args[0]} failed`)
  } finally {
    if (child.exitCode === null) child.kill()
  }
}

function manifestVersion(file: string): string | null {
  try {
    return semver.valid(JSON.parse(file)?.version)
  } catch {
    return null
  }
}

export async function releaseHistory(argv: BumpVersionArgs, requireComplete: boolean, head?: string) {
  head ??= (await exec(argv, 'git', ['rev-parse', '--verify', 'HEAD'])).trim()
  let tag: string | undefined
  await readGitRecords(
    argv,
    ['for-each-ref', '--merged', head, '--format=%(refname:strip=2)%00', 'refs/tags/v[0-9]*'],
    record => {
      const name = record.trim()
      if (semver.valid(name.slice(1)) && (!tag || semver.gt(name, tag))) tag = name
    },
  )
  const tagRef = tag && `refs/tags/${tag}`
  const candidates: { hash: string; parent: string; version: string }[] = []
  // Older tagless releases have no marker beyond the tool's commit subject and the changed manifest.
  await readGitRecords(
    argv,
    [
      'log',
      '-z',
      '--format=%H%x09%P%x09%s%x09%D',
      '--decorate=full',
      '--decorate-refs=refs/tags/*',
      '--topo-order',
      '--no-merges',
      '--diff-filter=M',
      '--extended-regexp',
      '--grep=^(:tada: Release: v|chore\\(release\\): v)[0-9][^ ]*$',
      ...(tagRef ? ['--ancestry-path', `${tagRef}..${head}`] : [head]),
      '--',
      'package.json',
    ],
    record => {
      const [hash, parent, subject, refs] = record.split('\t')
      const version = /^(?:chore\(release\): v|:tada: Release: v)(\S+)$/.exec(subject)?.[1]
      if (parent && version && semver.valid(version) && !refs.split(', ').includes(`tag: refs/tags/v${version}`))
        candidates.push({ hash, parent, version })
    },
  )
  let releaseCommit: string | undefined
  for (const { hash, parent, version } of candidates) {
    const manifests = await Promise.all([parent, hash].map(ref => exec(argv, 'git', ['show', `${ref}:./package.json`])))
    // An actual release increased the target package's version to the one in its subject.
    const [before, after] = manifests.map(manifestVersion)
    if (after === version && before && semver.gt(version, before)) {
      releaseCommit = hash
      break
    }
  }
  const base = releaseCommit || tagRef
  const range = base ? `${base}..${head}` : head
  if (requireComplete && (await exec(argv, 'git', ['rev-parse', '--is-shallow-repository'])).trim() === 'true') {
    const file = (await exec(argv, 'git', ['rev-parse', '--path-format=absolute', '--git-path', 'shallow'])).trim()
    const shallow = new Set(readFileSync(file, 'utf8').trim().split(/\r?\n/))
    const roots = await exec(argv, 'git', ['rev-list', '--max-parents=0', range, '--'])
    if (
      roots
        .trim()
        .split(/\r?\n/)
        .some(hash => shallow.has(hash))
    )
      throw new Error(
        'Incomplete release history. Fetch full history and tags with git fetch --unshallow --tags, then retry.',
      )
  }
  return { from: releaseCommit || tag || null, base, head, range }
}
