# node-bump-version

Preview and automate Node.js version bumps, changelogs, release commits, and Git tags. Use the built-in emoji convention
or standard Conventional Commits, interactively or in CI.

Requires Git and Node.js **22.13.0+ on the 22.x line, or 24+** (`^22.13.0 || >=24.0.0`).

## Quick start

```bash
npm install -D node-bump-version
npx bump-version init
npx bump-version doctor
npm run release -- --dry-run
npm run release
```

With Yarn:

```bash
yarn add -D node-bump-version
yarn bump-version init
yarn release --dry-run
yarn release
```

In PowerShell, use `npm.cmd run release -- --dry-run` to preserve npm's argument separator. A release updates the
selected package, generates its changelog, commits the changes, and creates an annotated tag. Publishing to npm is a
separate step. Pushing is enabled only with `--push`.

## Optional commit tools

Husky, commitlint, Commitizen, and cz-customizable are optional integrations. Configure them with:

```bash
npx bump-version init --hooks --commit-helper --dry-run
npx bump-version init --hooks --commit-helper
npm install
npm run prepare
npm run cz
```

`init` adds missing scripts and configuration, preserving existing scripts, settings, and hook files. Run `init --hooks`
at the Git root. It declares optional development dependencies; installation and hook activation are explicit steps. Run
`doctor` afterwards to check the package version, Git branch, dependencies, and hooks.

For the standard convention, pass `--preset conventional` during initialization. The selection is stored in
`package.json`:

```json
{ "bumpVersion": { "preset": "conventional" } }
```

Command-line `--preset` overrides that setting for the current release. Existing commitlint and commit-helper
configurations are preserved, so ensure they match the selected convention.

Existing users of the transitive commit helper should add `commitizen` and `cz-customizable` as development
dependencies, or run `init --commit-helper` followed by installation. When migrating from Husky 4, remove the old
top-level `husky` configuration and move hooks into `.husky/` files. See the
[Husky migration guide](https://typicode.github.io/husky/migrate-from-v4.html).

## Release commands

```bash
bump-version --type minor
bump-version --type auto --dry-run
bump-version --type auto --preset conventional --yes
bump-version --type preminor --preid rc --yes
bump-version --path ./packages/example --file HISTORY.md --dry-run
bump-version --no-changelog --no-tag --yes
bump-version --version
bump-version --help
```

| Option                                   | Behavior                                                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `-t, --type`                             | `patch` by default; also `auto`, `major`, `minor`, `premajor`, `preminor`, `prepatch`, or `prerelease` |
| `-d, --dry, --dry-run`                   | Preview without changing files, commits, or tags                                                       |
| `-y, --yes`                              | Accept the calculated version without prompting                                                        |
| `--json`                                 | Emit one structured result; use `--yes` for a real release                                             |
| `--interactive`                          | Explicitly enable prompts when input is piped                                                          |
| `--preid ID`                             | Prerelease identifier, such as `alpha`, `beta`, or `rc`                                                |
| `-a, --preid-alpha` / `-b, --preid-beta` | Compatibility shortcuts for prerelease identifiers                                                     |
| `-p, --path`                             | Package directory; defaults to the current directory                                                   |
| `-f, --file`                             | Changelog path relative to the package; defaults to `CHANGELOG.md`                                     |
| `--preset`                               | `emoji` or `conventional`                                                                              |
| `--no-tag` / `--no-changelog`            | Disable those release steps                                                                            |
| `--skip-commit`                          | Leave changes uncommitted; requires `--no-tag` and forbids `--push`                                    |
| `--push`                                 | Push to the upstream, or `origin` and the current branch                                               |
| `--remote NAME` / `--branch NAME`        | Override the push destination                                                                          |
| `--no-atomic`                            | Permit a non-atomic push when the server lacks atomic support                                          |
| `-h, --help` / `-v, --version`           | Show help or the tool version without requiring a project                                              |

Unknown options and unexpected positional arguments fail before releasing. Boolean switches take no value: use `--push`
or `--no-push`, never `--push false`.

## Recommendations and changelogs

`--type auto` inspects commits since the highest reachable valid `v` version tag. It recommends major for breaking
changes, minor for features, and patch otherwise, and explains the recommendation. If there are no commits since that
tag, choose an explicit release type to release anyway. The default release type remains `patch`.

The default emoji convention uses headers such as:

```text
:sparkles: Feature(core): add automatic recommendations
:bug: Fix(cli): handle missing input
:hammer: Refactor(api): replace the configuration format

BREAKING CHANGE: use the new configuration format
```

The standard preset accepts:

```text
feat(core): add automatic recommendations
fix(cli): handle missing input
refactor(api)!: replace the configuration format
```

Standard breaking changes can use `!`, `BREAKING CHANGE:`, or `BREAKING-CHANGE:` on any commit type. Both presets
include breaking-change notes in the changelog. Standard releases use `chore(release): v1.2.0`; emoji releases use
`:tada: Release: v1.2.0`. Use imperative subjects, lower-case scopes, and a complete header no longer than **100
characters**, including its type and scope.

## Release safety and recovery

Before writing, the tool checks the version, manifests and npm lockfiles, branch, tag availability, file paths, and
configured push destination. Real releases require clean tracked files and clean release files. Unrelated untracked
files are preserved; dry previews may inspect uncommitted work. `package.json`, `package-lock.json`, and
`npm-shrinkwrap.json` are updated together, retaining indentation and line endings. The changelog is prepared before any
file is written.

If a write or commit fails, the tool restores its own changes where safe. Concurrent edits are preserved and reported
for manual recovery. If a commit succeeds but tagging or pushing fails, the release commit is retained. Resolve the
reported cause and finish tagging/pushing that existing commit; do not rerun the version bump. Only the intended release
tag is pushed, together with the release branch. Pushes are atomic by default and fail if the server cannot support
them.

`--path` targets one package. Workspace dependency ranges and coordinated multi-package releases are not automated.

## CI and JSON output

```bash
bump-version --type auto --dry-run --json
bump-version --type minor --yes --json
bump-version doctor --json
```

Dry runs do not prompt unless `--interactive` is set. Real releases with piped input require `--yes`. JSON mode emits
one result to stdout without spinner output. Successful release results include `ok`, `dryRun`, `path`,
`currentVersion`, `newVersion`, `files`, `branch`, `commit`, `tag`, and `push`, plus a recommendation when requested.
Failures return an `error` object with `code` and `message` and exit 1. Interrupting an interactive prompt exits 130.

## Public API and presets

```js
import { planRelease, executeRelease } from 'node-bump-version'

const options = { _: [], path: process.cwd(), dry: true }
const plan = await planRelease(options, '1.0.0', '1.1.0')
await executeRelease(options, plan)
```

A plan records the inputs, Git revision, and file contents. Execution rejects changed release options, revisions, or
files. The existing `mainLifeCycle`, `bumpVersion`, `changelog`, `commit`, and `tag` exports remain available. Low-level
file helpers do not perform the full lifecycle's Git preflight checks.

| Import                                      | Purpose                              |
| ------------------------------------------- | ------------------------------------ |
| `node-bump-version/commitlint`              | Emoji commitlint preset              |
| `node-bump-version/commitlint/conventional` | Standard commitlint preset           |
| `node-bump-version/changelog`               | Emoji changelog preset               |
| `node-bump-version/changelog/conventional`  | Standard changelog preset            |
| `node-bump-version/commitizen`              | Emoji commit-helper configuration    |
| `node-bump-version/commitizen/conventional` | Standard commit-helper configuration |

For manual commitlint setup, create `commitlint.config.cjs`:

```js
module.exports = {
  extends: [require.resolve('node-bump-version/commitlint')],
}
```

Use `require.resolve` because commitlint prefixes bare names in `extends`. Existing documented `dist/*` and
`.cz-config.cjs` imports remain available.

## Development

This repository uses Yarn **1.22.22**, pinned in `packageManager`.

```bash
yarn install --frozen-lockfile
yarn build
yarn lint:check
yarn typecheck
yarn test
yarn test:regressions
yarn test:package
```

Build before the first commit: the local commitlint configuration loads from `dist/`. The pre-commit hook runs
`yarn lint`; the commit-msg hook runs commitlint. Use `git add .` followed by `yarn cz` to compose a commit.

The build compiles all JavaScript entry points in one pass and declarations in a second pass, sharing common modules.
Build outputs are cleaned first. The existing `--forceExit` workaround is retained so completed builds terminate
reliably.

CI covers Windows, Linux, and macOS on Node 22.13.0, current 22.x, 24.x, and 26.x. It checks lint, types, release tests,
the 11 audit regressions, and an isolated installation of the npm tarball. `test:package` requires registry access and
an existing build; it installs runtime dependencies without optional integrations and performs a release in a temporary
local repository. Tests never publish packages or use this project's remotes. See [scripts/README.md](scripts/README.md)
for regression commands.

## License

[MIT](LICENSE). Inspired by [@picgo/bump-version](https://github.com/PicGo/bump-version).
