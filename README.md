# node-bump-version

[English](README.md) | [简体中文](README.zh-CN.md)

Preview and automate Node.js version bumps, changelogs, release commits, and Git tags. Use the built-in emoji convention
or standard Conventional Commits, interactively or in CI.

A release updates the package version and changelog, commits those changes, and creates an annotated Git tag such as
`v1.2.0`. It pushes only when you pass `--push`. Publishing to npm is a separate step.

- [Install and make your first release](#install-and-make-your-first-release)
- [Migrate from v2.0 to v3.0](#migrate-from-v20-to-v30)
- [Choose optional commit tools](#choose-optional-commit-tools)
- [Configure your project](#configure-your-project)
- [Release commands](#release-commands)
- [Troubleshooting](#troubleshooting)

## Install and make your first release

### 1. Check the requirements

- Node.js **22.13.0+ on the 22.x line, or 24+** (`^22.13.0 || >=24.0.0`; Node 23 is not supported).
- Git installed, with your author name and email configured for commits.
- A project with a `package.json` containing a valid version, such as `"version": "1.0.0"`.
- A Git repository with at least one commit, checked out on a branch.

Run the following commands from your project's directory. For a new project, create `package.json` with `npm init -y`
and initialize Git with `git init` first. Make an initial commit before previewing a release.

### 2. Install and initialize

**Only `node-bump-version` is needed for releases.** No global installation or optional commit tools are required.

With npm:

```bash
npm install -D node-bump-version
npx bump-version init
```

With Yarn:

```bash
yarn add -D node-bump-version
yarn bump-version init
```

By default, `init` adds these fields to `package.json` if they are missing:

```json
{
  "scripts": {
    "release": "bump-version"
  },
  "bumpVersion": {
    "preset": "emoji"
  }
}
```

If your commits look like `feat: add a feature` or `fix: fix a bug`, use `npx bump-version init --preset conventional`
instead of plain `init` (Yarn: `yarn bump-version init --preset conventional`). See
[Choose a commit convention](#choose-a-commit-convention) for examples.

`init` preserves an existing `release` script. If your project already has one, merge `bump-version` into it as needed,
or run `npx bump-version` directly. You can also skip `init` and use the CLI directly with its defaults.

### 3. Check and preview

With npm:

```bash
npx bump-version doctor
npm run release -- --dry-run
```

With Yarn:

```bash
yarn bump-version doctor
yarn release --dry-run
```

`doctor` checks the project setup. `--dry-run` previews a patch release, including the files, changelog, commit, and
tag, without writing anything. For example, `1.0.0` becomes `1.0.1`. Add `--type auto` to calculate the release type
from your commits instead.

**PowerShell:** use `npm.cmd` for npm commands that forward options, for example `npm.cmd run release -- --dry-run`, to
preserve the `--` argument separator. This applies to later examples too.

### 4. Make the release

Review and commit the installation/setup changes, including your lockfile, before making a real release. Tracked files
and release files must be clean. If you want commit checks or a commit helper, set them up below before this step.

```bash
npm run release
```

Or run `yarn release`. In an interactive terminal, the tool asks you to confirm the next version. The release stays in
your local repository unless you add `--push`.

## Migrate from v2.0 to v3.0

The package name and `bump-version` command stay the same. Your existing `"release": "bump-version"` script, emoji
commit convention, and default patch bump still work. Automatic version recommendations and Conventional Commits are
opt-in; upgrading does not require rewriting commit history.

### 1. Update Node.js and the package

Update local development and CI to Node.js **22.13.0+ on the 22.x line, or 24+** (`^22.13.0 || >=24.0.0`). Node 23 is
not supported. Once v3 is published, upgrade the development dependency:

```bash
npm install -D node-bump-version@^3.0.0
# Or, with Yarn:
yarn add -D node-bump-version@^3.0.0
```

### 2. Keep the commit tools you use

In v2, `husky`, `@commitlint/cli`, `commitizen`, and `cz-customizable` were installed as runtime dependencies of
`node-bump-version`. In v3, they are **optional peer dependencies**. Projects using hooks or `npm run cz` must declare
the relevant tools directly. Projects using only the release CLI can skip this step.

For both commit-message checks and the interactive helper, run these commands at the Git repository root:

```bash
npx bump-version init --hooks --commit-helper --dry-run
npx bump-version init --hooks --commit-helper
npm install
npm run prepare
```

Use only `--hooks` or `--commit-helper` if you need just one integration; `npm run prepare` is needed for hooks.
`init` adds missing dependencies and configuration, but preserves existing scripts, dependency versions, configs, and
hook files. If you already declare older tool versions, update the tools you use to the supported ranges:
`husky@^9.1.7`, `@commitlint/cli@^21.2.2`, `commitizen@^4.3.2`, and `cz-customizable@^7.5.4`.

### 3. Migrate legacy hooks and review preset paths

If you copied the v2 README's top-level `"husky": { "hooks": ... }` configuration in `package.json`, move those commands
into `.husky/` hook files and remove the old `husky` field. The old `commitlint -E HUSKY_GIT_PARAMS` command becomes this
line in `.husky/commit-msg`:

```sh
npx --no -- commitlint --edit "$1"
```

The `prepare` script must run `husky`; `init --hooks` adds it. Move any other old hooks, such as a pre-commit lint
command, manually. Existing `.husky/commit-msg` files are preserved by `init`, so update that file yourself if needed,
then run `npm run prepare` to activate the hooks.

The documented v2 `dist/*` and `.cz-config.cjs` import paths remain available. For new configuration, prefer the
public preset paths shown in [Commitlint and Husky configuration](#commitlint-and-husky-configuration) and
[Commit-helper configuration](#commit-helper-configuration): `node-bump-version/commitlint` and
`node-bump-version/commitizen`. Edit your existing commitlint configuration instead of adding a second one.

Keep the default `emoji` preset for existing v2 messages. If you choose to switch to standard Conventional Commits,
follow [Choose a commit convention](#choose-a-commit-convention) and align the release, commitlint, and helper presets.

### 4. Review release scripts and CI

- **Clean working tree:** real releases now require clean tracked files and clean release files, a branch checkout,
  and at least one commit. Commit the migration changes, including manifests and lockfiles, before releasing.
- **Unattended releases:** use `--yes` in CI instead of piping answers to the prompt. Dry runs do not prompt by
  default. Use `--json` if automation needs structured output; failures exit with status 1.
- **Strict arguments:** remove unknown options and positional arguments. Boolean flags take no value; replace
  `--push false` with `--no-push`. Existing `--dry`/`-d` and alpha/beta shortcuts remain supported.
- **Push destination:** v2 pushed to `origin master`. In v3, `--push` uses the configured upstream, falling back to
  `origin` and the current branch. To keep an explicit destination, use `--push --remote origin --branch master`.
  Only the release tag is pushed with the branch, and pushes are atomic by default. Use `--no-atomic` only if your
  server does not support atomic pushes.
- **Skipping the commit:** if your script used `--skipCommit`, prefer `--skip-commit`. It now requires `--no-tag` and
  cannot be combined with `--push`.

### 5. Verify before your first v3 release

```bash
npx bump-version doctor
npx bump-version --dry-run
```

Review the proposed version, changelog, files, commit, and tag. These commands do not make a release. To preview through
your npm script, use `npm run release -- --dry-run` (`npm.cmd run release -- --dry-run` in PowerShell). With Yarn, use
`yarn bump-version doctor` and `yarn release --dry-run`.

After committing the migration changes, use your usual release command; add `--yes` for an unattended release.
Publishing to npm remains a separate step. See [Release safety and recovery](#release-safety-and-recovery) for handling
a failure after the release commit has been created.

## Choose optional commit tools

These tools help you **write or check commit messages**. Version bumps, automatic recommendations, changelogs, and tags
work without them, provided you write commits that match your chosen convention.

| What you want                                            | Tools to install                                                                    | Setup option                   |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------ |
| Release from commits you write yourself                  | No extra tools                                                                      | Plain `init`                   |
| Reject invalid commit messages when running `git commit` | `husky` runs Git hooks; `@commitlint/cli` checks the message                        | `init --hooks`                 |
| Answer prompts to compose a commit message               | `commitizen` provides `git-cz`; `cz-customizable` supplies the configurable prompts | `init --commit-helper`         |
| Both guided commits and commit checks                    | All four tools above                                                                | `init --hooks --commit-helper` |

The two integrations are independent. A commit helper does not enforce messages written with `git commit`; hooks can
check messages without a helper. These packages are optional peer dependencies: install them in each project that uses
the integration. `node-bump-version` already includes the presets; no separate preset package is needed.

### Add commit-message checks

Run this at the **Git repository root**, where `package.json` is located:

```bash
npx bump-version init --hooks --dry-run
npx bump-version init --hooks
npm install
npm run prepare
npx bump-version doctor
```

`init --hooks` declares `husky` and `@commitlint/cli` in `devDependencies`, creates a commitlint config and a
`.husky/commit-msg` hook if missing, and adds Husky to the `prepare` script. **It does not install packages or activate
hooks itself.** `npm install` installs them; `npm run prepare` activates Husky. Installation may already run `prepare`,
but you can run it explicitly to ensure hooks are active.

After setup, use `git commit` as usual. The hook rejects messages that do not match the configured commitlint rules.
Each contributor must install development dependencies and activate the hooks in their own checkout.

### Add an interactive commit helper

```bash
npx bump-version init --commit-helper --dry-run
npx bump-version init --commit-helper
npm install
```

This declares `commitizen` and `cz-customizable` in `devDependencies`, adds a `cz` script and helper settings to
`package.json`, and creates `.cz-config.cjs` if needed. Stage the files you want to commit with `git add`, then run:

```bash
npm run cz
```

The helper asks for the commit type, scope, and message, then creates the commit. Husky is not needed to use the helper.

To enable both integrations in one step, use `npx bump-version init --hooks --commit-helper`, then run `npm install` and
`npm run prepare`. On a project that has not selected a preset yet, append `--preset conventional` if needed.

For Yarn, replace `npx bump-version` with `yarn bump-version`, `npm install` with `yarn install`, `npm run prepare` with
`yarn prepare`, and `npm run cz` with `yarn cz`.

## Configure your project

### Choose a commit convention

| Preset            | Example commit                         | When to choose it                               |
| ----------------- | -------------------------------------- | ----------------------------------------------- |
| `emoji` (default) | `:sparkles: Feature(core): add search` | You want this project's emoji convention        |
| `conventional`    | `feat(core): add search`               | Your project uses standard Conventional Commits |

The persistent release setting is `bumpVersion.preset` in `package.json`:

```json
{
  "bumpVersion": {
    "preset": "conventional"
  }
}
```

The release CLI uses, in order: `--preset`, then `package.json`'s `bumpVersion.preset`, then `emoji`. A command-line
override applies to that release only:

```bash
npx bump-version --type auto --preset conventional --dry-run
```

To **switch an existing project**, edit `bumpVersion.preset` explicitly, then update any commitlint and commit-helper
configs to use the matching exports below. `init --preset conventional` refuses to replace an existing `emoji` setting,
and rerunning `init` preserves existing config and hook files.

### Set release defaults

`bumpVersion.preset` is the only setting read from `package.json`'s `bumpVersion` object. Put other defaults in your
release script or pass them as CLI options. For example, to recommend a version from commit history on every release:

```json
{
  "scripts": {
    "release": "bump-version --type auto"
  }
}
```

Use `npm run release -- --dry-run` to preview that script. See [Release commands](#release-commands) for changelog
paths, prereleases, push destinations, and other options.

### Commitlint and Husky configuration

After installing the [commit-message checks](#add-commit-message-checks), `commitlint.config.cjs` uses this config for
the emoji preset:

```js
module.exports = {
  extends: [require.resolve('node-bump-version/commitlint')],
}
```

For standard Conventional Commits, change the export path to `node-bump-version/commitlint/conventional`. Use
`require.resolve` because commitlint prefixes bare names in `extends`. If you already configure commitlint elsewhere,
edit that config instead of adding a second one.

The `.husky/commit-msg` file contains:

```sh
npx --no -- commitlint --edit "$1"
```

The `prepare` script in `package.json` runs `husky`. If you already have a `prepare` script, `init --hooks` appends
`&& husky` when needed. Existing hook files are preserved, so add the commitlint command yourself if your current
`commit-msg` hook does not run it. This integration checks commit messages; it does not add a pre-commit lint/test hook.

### Commit-helper configuration

After installing the [commit helper](#add-an-interactive-commit-helper), these settings connect its components in
`package.json`. Merge them with your existing scripts and config:

```json
{
  "scripts": {
    "cz": "git-cz"
  },
  "config": {
    "commitizen": {
      "path": "cz-customizable"
    },
    "cz-customizable": {
      "config": ".cz-config.cjs"
    }
  }
}
```

The `.cz-config.cjs` file selects the helper's preset:

```js
module.exports = require('node-bump-version/commitizen')
```

For standard Conventional Commits, use `node-bump-version/commitizen/conventional`. You can customize prompts or scopes
in this file, for example:

```js
const preset = require('node-bump-version/commitizen/conventional')

module.exports = {
  ...preset,
  scopes: ['core', 'cli', 'docs'],
  allowCustomScopes: true,
}
```

Keep the release, commitlint, and helper presets aligned. Changing `bumpVersion.preset` alone does not change what the
helper writes or what commitlint accepts.

## Release commands

```bash
npx bump-version --type minor
npx bump-version --type auto --dry-run
npx bump-version --type auto --preset conventional --yes
npx bump-version --type preminor --preid rc --yes
npx bump-version --path ./packages/example --file HISTORY.md --dry-run
npx bump-version --no-changelog --no-tag --yes
npx bump-version --version
npx bump-version --help
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
npx bump-version --type auto --dry-run --json
npx bump-version --type minor --yes --json
npx bump-version doctor --json
```

Dry runs do not prompt unless `--interactive` is set. Real releases with piped input require `--yes`. JSON mode emits
one result to stdout without spinner output. Successful release results include `ok`, `dryRun`, `path`,
`currentVersion`, `newVersion`, `files`, `branch`, `commit`, `tag`, and `push`, plus a recommendation when requested.
Failures return an `error` object with `code` and `message` and exit 1. Interrupting an interactive prompt exits 130.

## Troubleshooting

Start with `npx bump-version doctor` (or `yarn bump-version doctor`). It checks Node, the package version, Git and the
branch, plus dependencies and hook setup for integrations detected in your configuration.

| Problem                                               | What to do                                                                                                              |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Release fails after installation or setup             | Review and commit the changed manifests, lockfile, and config files. Real releases require clean tracked/release files. |
| Missing `husky`, `commitlint`, or `git-cz`            | Run `npm install` after the relevant `init` command, with development dependencies enabled.                             |
| Commits are not checked                               | Run `npm run prepare` at the Git root and ensure `.husky/commit-msg` invokes commitlint. Check the `doctor` results.    |
| A valid-looking commit or release commit is rejected  | Make the release, commitlint, and helper configs use the same preset. Existing configs are preserved by `init`.         |
| `init --preset` reports a conflict                    | Edit the existing `bumpVersion.preset` in `package.json` explicitly, then align the optional-tool configs.              |
| `init --hooks` fails in a workspace package           | Run hook setup at the Git root. Use `--path` to target a package when releasing.                                        |
| `--type auto` finds no commits since the last release | Add new commits, or choose an explicit type such as `--type patch` if you intend to release anyway.                     |
| Release fails in CI with a prompt error               | Use `--yes` for a real release or `--dry-run` for a preview, and check out a branch instead of detached HEAD.           |

Upgrading an older setup? Add `commitizen` and `cz-customizable` as direct development dependencies by running
`init --commit-helper` and then installing dependencies. For Husky 4, remove the old top-level `husky` configuration and
move hooks into `.husky/` files; see the [Husky migration guide](https://typicode.github.io/husky/migrate-from-v4.html).

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

Existing documented `dist/*` and `.cz-config.cjs` imports remain available.

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
