# PicGo BumpVersion

A full `git commit` -> `changelog` -> `release` workflow & convention.

It's now only available for Node.js projects. Thanks [@picgo/bump-version](https://github.com/PicGo/bump-version) for the inspiration.

## Installation

Requires **Node.js 22.13.0 or newer on the 22.x line, or Node.js 24+** (`^22.13.0 || >=24.0.0`).

```bash
npm install -D node-bump-version husky@^9 @commitlint/cli

#or

yarn add -D node-bump-version husky@^9 @commitlint/cli
```

Also, add the following data at the top level in your `package.json` to properly config `bump-version` (replace old `config` if you have already configured `commitizen` or `cz-customizable` before):

```json
"config": {
  "commitizen": {
    "path": "./node_modules/cz-customizable"
  },
  "cz-customizable": {
    "config": "./node_modules/node-bump-version/.cz-config.cjs"
  }
},
"commitlint": {
  "extends": ["./node_modules/node-bump-version/dist/commitlint-node/index.js"]
}
```

And then add the following (inside the braces) to the `scripts` field of your package.json:

```json
"scripts": {
  "prepare": "husky",
  "cz": "git-cz",
  "release": "bump-version"
}
```

If you already have a `prepare` script, append `&& husky` to it.

Create `.husky/commit-msg` with the following contents (save it as UTF-8 with LF line endings, including on Windows):

```sh
npx --no -- commitlint --edit "$1"
```

Run the setup once from your project's Git root:

```bash
npm run prepare
# or
yarn run prepare
```

Commit `.husky/commit-msg` with your package configuration so other contributors receive the hook. npm and Yarn 1 run `prepare` on subsequent installs; with Yarn 2+, run `yarn run prepare` explicitly after installing.

When upgrading from Husky 4, remove the old top-level `husky` configuration and move any other hooks into matching files under `.husky/`. Husky 9 uses Git's positional arguments such as `$1` for the commit message file. See the [Husky migration guide](https://typicode.github.io/husky/migrate-from-v4.html).

Then you can use `npm run cz` for committing standard message and use `npm run release` to bump version & auto generate changelog in your project!

If you are using [yarn](https://yarnpkg.com/), then it will be more simple just like:

```bash
# to commit
yarn cz

# to bump version
yarn release
```

So the workflow is the following:

1. `git add` something changed
2. `npm run cz` to commit
3. `npm run release` to release or deploy

## Usage

> If you installed bump-version in a project, then you can just write down the `bump-version` command in your `package.json`'s `scripts` field. Then just `npm run you-command`.

### Commit

```bash
npm run cz

# or

yarn cz
```

This leads to an interactive submit message interface:

```bash
? Select the type of change that you're committing: (Use arrow keys)
❯ Feature:  when adding new features 
  Fix:      when fixing bugs 
  WIP:      when working in progress 
  Refactor: when changing the code without adding features or fixing bugs 
  Chore:    when changing the build process or auxiliary tools and libraries such as documentation generation 
  Style:    when improving the format/structure of the code 
  Upgrade:  when upgrading dependencies
```

You can use this interface to quickly generate commit information that is compliant with the convention.

### Bump version

```bash
npm run release

# or

yarn run cz
```

```txt
Usage
  bump-version

Example
  bump-version -t major

Options
  -a, --preid-alpha             Prerelease id: alpha. Exp. 1.0.0.alpha-0

  -b, --preid-beta              Prerelease id: beta.  Exp. 1.0.0.beta-0

  -d, --dry, --dry-run          Preview the release without changing files, commits or tags

  -f, --file                    Read and write the CHANGELOG file, relative to package.json's path
                                Default: CHANGELOG.md

  -p, --path                    A filepath of where your package.json is located
                                Default: ./

  -h, --help                    Display help message

  -t, --type                    Release type. [major, minor, patch, premajor, preminor, prepatch, prerelease]
                                Default: patch

  --push                        Push the current release to its upstream (or origin/current branch)
                                Default: false

  --no-tag                      Tag won't be created
                                Default: tag will be created

  --no-changelog                Changelog won't be created
                                Default: changelog will be created
```

Don't know which version should be the next? Never mind:

Unknown options, missing values, and positional arguments are rejected before the release starts.
Boolean switches take no value: use `--push` or `--no-push`, never `--push false`.

Releases require a branch, valid manifests/lockfiles, an unused version tag, and clean tracked/release files.
Unrelated untracked files are left alone. Dry previews can inspect uncommitted work.
All contents are prepared before writing; a failed write or commit restores the tool's changes.
After a commit succeeds, a tag/push failure keeps that commit and reports how to finish the release.
`--skip-commit` requires `--no-tag` and cannot be combined with `--push`.

With `--push`, the upstream remote and branch are used, falling back to `origin` and the current branch.
Override them with `--remote NAME --branch NAME`. Only the release tag is pushed, together with the release commit.
Pushes are atomic by default. If a server lacks atomic support, finish the existing release manually;
use `--no-atomic` for future releases only if partial remote updates are acceptable.

If you reject the default next version, then you can choose which version you want or customize one.

if you just want to see what the changelog will be created and nothing will be changed:

```bash
npm run release -- --dry

# In PowerShell, use npm.cmd to preserve the argument separator:
npm.cmd run release -- --dry
```

## Convention

### Git Commit Message

- Use the present tense ("add feature" not "added feature")
- Use the imperative mood ("move cursor to..." not "moves cursor to...")
- Do not repeat the word in type ("Fix: xxx bugs when..." not "Fix: fix xxx bugs when...")
- Limit the first line to 72 characters or less
- Start the commit message with an applicable `emoji` & `type`:

  - :sparkles: Feature `:sparkles: Feature` when adding new features
  - :bug: Fix `:bug: Fix` when fixing bugs
  - :construction: WIP `:construction: WIP` when working in progress
  - :hammer: Refactor `:hammer: Refactor` when changing the code without adding features or fixing bugs
  - :package: Chore `:package: Chore` when changing the build process or auxiliary tools and libraries such as documentation generation
  - :art: Style `:art: Style` when improving the format/structure of the code
  - :arrow_up: Upgrade `:arrow_up: Upgrade` when upgrading dependencies
  - :zap: Perf `:zap: Perf` when improving performance
  - :pencil: Docs `:pencil: Docs` when wrting docs
  - :white_check_mark: Test `:white_check_mark: Test` when adding or updating tests
  - :back: Revert `:back: Revert` when reverting some commits
  - :pushpin: Init `:pushpin: Init` when initializing a project
  - :tada: Release `:tada: Release` when releasing (**will be automatically committed by `bump-version`**)

#### Commit Message Format

A commit message consists of a **header**, **body**(optional) and **footer**(optional). The header has a **emoji**, **type**, **scope**(optional) and **subject**:

```txt
<emoji> <type>([scope]): <subject>
<BLANK LINE>
[body]
<BLANK LINE>
[footer]
```

#### Examples

##### 1. Normal

:sparkles: Feature(core): add error notification

:bug: Fix(core): xxx error should be thrown

```txt
:sparkles: Feature(core): add error notification

:bug: Fix(core): xxx error should be thrown
```

and they will be rendered into the following changelog:

```markdown
# x.x.0 (20xx-xx-xx)

## :sparkles: Features

- add error notification

## :bug: Bug Fixes

- xxx error should be thrown
```

##### 2. BREAKING CHANGE

**Note: BREAKING CHANGE can only be in the type of `Feature` or `Fix`.**

:sparkles: Feature(core): add error notification

BREAKING CHANGE: change api for error notification

```md
:sparkles: Feature(core): add error notification

BREAKING CHANGE: change api for error notification
```

and they will be rendered into the following changelog:

```markdown
# x.x.0 (20xx-xx-xx)

## :sparkles: Features

- add error notification

## BREAKING CHANGES

- change api for error notification
```

### Git Branch Management

**Important**: Always use `rebase` or `squash` or `cherry-pick` instead of `merge`

Available branches:

- `master` for the release
- `dev` for the development
- `docs` or `gh-pages` for the documentation **[optional]**
- `pr` for the pull request **[optional]**
- `hot-fix` for fixing the bug in master **[optional]**
- `feat-*` for developing a new feature
- `fix-*` for fixing a bug in dev branch

## Development

```bash
yarn install --frozen-lockfile
yarn build
yarn lint:check
yarn typecheck
yarn test
```

This repository uses Yarn 1. Installing dependencies activates the Husky 9 hooks. Run `yarn build` before your first commit because the local commitlint configuration loads from `dist/`. The pre-commit hook runs `yarn run lint`, and the commit-msg hook validates the message with commitlint.

`yarn test` builds the package and tests the CLI, commitlint configuration, Git hooks, changelog generation, dry runs, release commits, and tags in temporary Git repositories. Git must be installed.

TypeScript is kept at 6.0.3, the latest stable version supported by the current `typescript-eslint` peer range (`>=4.8.4 <6.1.0`).

## License

[MIT](http://opensource.org/licenses/MIT)

Copyright (c) 2023 Kuingsmile
