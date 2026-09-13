# node-bump-version

[English](README.md) | [简体中文](README.zh-CN.md)

预览并自动完成 Node.js 项目的版本升级、更新日志生成、发布提交和 Git 标签创建。支持内置的 emoji 提交规范和标准的 Conventional
Commits，可在交互式终端或 CI 中使用。

一次发布会更新包版本和更新日志，提交这些改动，并创建 `v1.2.0` 这样的附注 Git 标签。只有传入 `--push`
才会推送到远程仓库。发布到 npm 需要单独执行。

- [安装并完成第一次发布](#安装并完成第一次发布)
- [选择可选的提交工具](#选择可选的提交工具)
- [配置项目](#配置项目)
- [发布命令](#发布命令)
- [常见问题](#常见问题)

## 安装并完成第一次发布

### 1. 检查环境要求

- Node.js **22.x 中的 22.13.0 及以上版本，或 24 及以上版本**（`^22.13.0 || >=24.0.0`；不支持 Node 23）。
- 已安装 Git，并配置了提交所需的用户名和邮箱。
- 项目包含 `package.json`，且有合法的版本号，例如 `"version": "1.0.0"`。
- 项目已初始化为 Git 仓库，至少有一次提交，并且当前检出了一个分支。

请在项目目录中执行下面的命令。如果是新项目，先运行 `npm init -y` 创建 `package.json`，再运行 `git init`
初始化仓库。预览发布之前，需要先创建一次初始提交。

### 2. 安装并初始化

**执行发布只需要安装 `node-bump-version`。** 无需全局安装，也无需安装任何可选的提交工具。

使用 npm：

```bash
npm install -D node-bump-version
npx bump-version init
```

使用 Yarn：

```bash
yarn add -D node-bump-version
yarn bump-version init
```

默认情况下，`init` 会在 `package.json` 中补充以下缺失的字段：

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

如果项目使用 `feat: add a feature`、`fix: fix a bug` 这样的提交信息，请将普通的 `init` 命令替换为
`npx bump-version init --preset conventional`（Yarn：`yarn bump-version init --preset conventional`）。示例见[选择提交规范](#选择提交规范)。

`init` 会保留已有的 `release` 脚本。如果项目已经定义了该脚本，请按需将 `bump-version` 合并进去，或直接运行
`npx bump-version`。也可以跳过 `init`，直接使用 CLI 的默认配置。

### 3. 检查配置并预览

使用 npm：

```bash
npx bump-version doctor
npm run release -- --dry-run
```

使用 Yarn：

```bash
yarn bump-version doctor
yarn release --dry-run
```

`doctor` 用于检查项目配置。`--dry-run`
会预览一次补丁版本发布，包括文件、更新日志、提交和标签，不会写入任何改动。例如，`1.0.0` 会升级到
`1.0.1`。如需根据提交记录自动计算发布类型，请添加 `--type auto`。

**PowerShell 用户：** 通过 npm 转发选项时，请使用 `npm.cmd`，例如 `npm.cmd run release -- --dry-run`，以保留 `--`
参数分隔符。后续示例也适用。

### 4. 执行发布

正式发布前，请检查并提交安装和初始化产生的改动，包括锁文件。Git 已跟踪的文件以及本次发布涉及的文件必须没有未提交的改动。如果需要提交检查或交互式提交助手，请先按下文完成配置。

```bash
npm run release
```

也可以运行 `yarn release`。在交互式终端中，工具会请你确认下一个版本号。发布结果保留在本地仓库中；添加 `--push`
才会推送到远程。

## 选择可选的提交工具

这些工具用于**编写或检查提交信息**。只要手动编写的提交信息符合所选规范，版本升级、自动版本推荐、更新日志和标签功能都可以独立使用。

| 你的需求                                     | 需要安装的工具                                                          | 初始化选项                     |
| -------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------ |
| 手动编写提交信息，只使用发布功能             | 无需额外工具                                                            | 普通的 `init`                  |
| 执行 `git commit` 时拒绝不符合规范的提交信息 | `husky` 运行 Git 钩子；`@commitlint/cli` 检查提交信息                   | `init --hooks`                 |
| 通过回答提示问题来生成提交信息               | `commitizen` 提供 `git-cz` 命令；`cz-customizable` 提供可配置的交互提示 | `init --commit-helper`         |
| 同时使用交互式提交和提交检查                 | 上述四个工具                                                            | `init --hooks --commit-helper` |

这两项集成相互独立。提交助手不会强制检查通过 `git commit` 手动编写的信息；提交钩子也不依赖提交助手。这些包是可选的 peer
dependencies，需要在使用相应集成的项目中安装。`node-bump-version` 已包含预设，无需另装预设包。

### 添加提交信息检查

请在包含 `package.json` 的 **Git 仓库根目录**执行：

```bash
npx bump-version init --hooks --dry-run
npx bump-version init --hooks
npm install
npm run prepare
npx bump-version doctor
```

`init --hooks` 会将 `husky` 和 `@commitlint/cli` 加入 `devDependencies`，在缺失时创建 commitlint 配置和
`.husky/commit-msg` 钩子，并将 Husky 加入 `prepare` 脚本。**它本身不会安装依赖或启用钩子。** `npm install`
用于安装依赖，`npm run prepare` 用于启用 Husky。安装过程可能已经执行了 `prepare`，也可以显式运行一次以确保钩子已启用。

配置完成后，照常使用 `git commit`
即可。钩子会拒绝不符合 commitlint 规则的提交信息。每位协作者都需要在自己的本地仓库中安装开发依赖并启用钩子。

### 添加交互式提交助手

```bash
npx bump-version init --commit-helper --dry-run
npx bump-version init --commit-helper
npm install
```

这会将 `commitizen` 和 `cz-customizable` 加入 `devDependencies`，向 `package.json` 添加 `cz`
脚本及助手配置，并在需要时创建 `.cz-config.cjs`。先用 `git add` 暂存要提交的文件，再运行：

```bash
npm run cz
```

助手会询问提交类型、作用域和描述，然后创建提交。使用助手不需要安装 Husky。

如果要一次启用两项集成，运行 `npx bump-version init --hooks --commit-helper`，然后执行 `npm install` 和
`npm run prepare`。如果项目尚未选择预设，可以按需添加 `--preset conventional`。

使用 Yarn 时，将 `npx bump-version` 替换为 `yarn bump-version`，`npm install` 替换为 `yarn install`， `npm run prepare`
替换为 `yarn prepare`，`npm run cz` 替换为 `yarn cz`。

## 配置项目

### 选择提交规范

| 预设            | 提交示例                               | 适用情况                          |
| --------------- | -------------------------------------- | --------------------------------- |
| `emoji`（默认） | `:sparkles: Feature(core): add search` | 希望使用本项目的 emoji 提交规范   |
| `conventional`  | `feat(core): add search`               | 项目使用标准 Conventional Commits |

发布时使用的持久配置位于 `package.json` 的 `bumpVersion.preset`：

```json
{
  "bumpVersion": {
    "preset": "conventional"
  }
}
```

发布 CLI 按以下优先级选择预设：命令行 `--preset` → `package.json` 中的 `bumpVersion.preset` → 默认值
`emoji`。命令行覆盖只对本次发布生效：

```bash
npx bump-version --type auto --preset conventional --dry-run
```

**已有项目切换规范时**，需要手动修改
`bumpVersion.preset`，然后将已有的 commitlint 和提交助手配置改为下文对应的导出路径。 `init --preset conventional`
不会覆盖已存在的 `emoji` 设置，而是会报告冲突。重新运行 `init` 也会保留已有的配置文件和钩子文件。

### 设置发布默认选项

工具只从 `package.json` 的 `bumpVersion` 对象读取
`preset`。其他默认选项请写入发布脚本，或通过命令行传入。例如，每次发布都根据提交历史推荐版本：

```json
{
  "scripts": {
    "release": "bump-version --type auto"
  }
}
```

使用 `npm run release -- --dry-run`
预览该脚本的执行结果。更新日志路径、预发布版本、推送目标等选项见[发布命令](#发布命令)。

### commitlint 和 Husky 配置

安装[提交信息检查工具](#添加提交信息检查)后，emoji 预设对应的 `commitlint.config.cjs` 内容如下：

```js
module.exports = {
  extends: [require.resolve('node-bump-version/commitlint')],
}
```

使用标准 Conventional Commits 时，将导出路径改为 `node-bump-version/commitlint/conventional`。请使用
`require.resolve`，因为 commitlint 会为 `extends`
中的裸包名添加前缀。如果已经在其他文件中配置了 commitlint，请修改现有配置，不要再添加一份。

`.husky/commit-msg` 文件内容如下：

```sh
npx --no -- commitlint --edit "$1"
```

`package.json` 中的 `prepare` 脚本负责运行 `husky`。如果已有 `prepare` 脚本，`init --hooks` 会在需要时追加
`&& husky`。已有钩子文件会被保留，因此，如果当前 `commit-msg`
钩子没有执行 commitlint，需要自行加入上述命令。这项集成只检查提交信息，不会添加提交前运行 lint 或测试的 pre-commit 钩子。

### 提交助手配置

安装[提交助手](#添加交互式提交助手)后，`package.json` 中使用以下配置连接各组件。请与已有的脚本和配置合并：

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

`.cz-config.cjs` 文件用于选择助手预设：

```js
module.exports = require('node-bump-version/commitizen')
```

使用标准 Conventional Commits 时，改为
`node-bump-version/commitizen/conventional`。也可以在此文件中自定义交互提示或作用域，例如：

```js
const preset = require('node-bump-version/commitizen/conventional')

module.exports = {
  ...preset,
  scopes: ['core', 'cli', 'docs'],
  allowCustomScopes: true,
}
```

请让发布工具、commitlint 和提交助手使用相同的预设。只修改 `bumpVersion.preset`
不会改变助手生成的信息或 commitlint 接受的格式。

## 发布命令

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

| 选项                                     | 作用                                                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `-t, --type`                             | 默认 `patch`；也支持 `auto`、`major`、`minor`、`premajor`、`preminor`、`prepatch` 和 `prerelease` |
| `-d, --dry, --dry-run`                   | 仅预览，不修改文件、提交或标签                                                                    |
| `-y, --yes`                              | 接受计算出的版本，不显示交互提示                                                                  |
| `--json`                                 | 输出一个结构化结果；正式发布时需配合 `--yes`                                                      |
| `--interactive`                          | 输入通过管道传入时，显式启用交互提示                                                              |
| `--preid ID`                             | 预发布标识，例如 `alpha`、`beta` 或 `rc`                                                          |
| `-a, --preid-alpha` / `-b, --preid-beta` | 为兼容旧用法保留的预发布标识快捷选项                                                              |
| `-p, --path`                             | 包所在目录；默认为当前目录                                                                        |
| `-f, --file`                             | 相对于包目录的更新日志路径；默认为 `CHANGELOG.md`                                                 |
| `--preset`                               | 使用 `emoji` 或 `conventional` 预设                                                               |
| `--no-tag` / `--no-changelog`            | 跳过创建标签或生成更新日志的步骤                                                                  |
| `--skip-commit`                          | 保留文件改动但不提交；必须配合 `--no-tag`，且不能使用 `--push`                                    |
| `--push`                                 | 推送到上游分支；未配置上游时使用 `origin` 和当前分支                                              |
| `--remote NAME` / `--branch NAME`        | 覆盖推送目标                                                                                      |
| `--no-atomic`                            | 服务器不支持原子推送时，允许使用非原子推送                                                        |
| `-h, --help` / `-v, --version`           | 显示帮助或工具版本；无需在项目中运行                                                              |

未知选项和不支持的位置参数会在发布前报错。布尔开关不接收值：使用 `--push` 或 `--no-push`，不要使用 `--push false`。

## 版本推荐与更新日志

`--type auto` 会分析从当前提交可达的、版本号最高的合法 `v`
版本标签之后的提交。存在破坏性变更时推荐 major，新增功能时推荐 minor，其他情况推荐 patch，并说明推荐原因。如果该标签之后没有新提交，但仍需要发布，请显式指定发布类型。默认发布类型仍然是
`patch`。

默认的 emoji 提交规范示例：

```text
:sparkles: Feature(core): add automatic recommendations
:bug: Fix(cli): handle missing input
:hammer: Refactor(api): replace the configuration format

BREAKING CHANGE: use the new configuration format
```

标准预设接受以下格式：

```text
feat(core): add automatic recommendations
fix(cli): handle missing input
refactor(api)!: replace the configuration format
```

标准预设下，任何提交类型都可以通过 `!`、`BREAKING CHANGE:` 或 `BREAKING-CHANGE:`
标记破坏性变更。两种预设都会在更新日志中包含破坏性变更说明。标准预设的发布提交为
`chore(release): v1.2.0`，emoji 预设则为
`:tada: Release: v1.2.0`。提交描述应使用祈使句，作用域使用小写，完整标题（包括类型和作用域）不得超过 **100 个字符**。

## 发布检查与失败恢复

写入之前，工具会检查版本号、包清单和 npm 锁文件、当前分支、标签是否可用、文件路径及配置的推送目标。正式发布要求已跟踪文件和发布文件没有未提交的改动。无关的未跟踪文件会保留；预览可以在存在未提交改动时运行。
`package.json`、`package-lock.json` 和 `npm-shrinkwrap.json`
会同步更新，并保留缩进与换行风格。更新日志会在任何文件写入之前准备好。

如果写入或提交失败，工具会在安全的情况下恢复自己产生的改动。并发修改会保留，并提示手动恢复。如果提交成功，但创建标签或推送失败，发布提交会保留。请解决报错原因，再为该提交完成标签创建或推送，不要重新执行版本升级。推送时只包含发布分支和本次发布的标签。默认使用原子推送；服务器不支持时会报错。

`--path` 每次只针对一个包，不会自动更新工作区内的依赖版本范围，也不会协调多个包一起发布。

## CI 与 JSON 输出

```bash
npx bump-version --type auto --dry-run --json
npx bump-version --type minor --yes --json
npx bump-version doctor --json
```

除非设置 `--interactive`，否则预览不会显示交互提示。输入通过管道传入时，正式发布必须使用
`--yes`。JSON 模式向标准输出写入一个结果，不输出加载动画。成功的发布结果包含
`ok`、`dryRun`、`path`、`currentVersion`、`newVersion`、 `files`、`branch`、`commit`、`tag` 和
`push`；请求自动推荐时，还会包含推荐结果。失败时返回带有 `code` 和 `message` 的 `error`
对象，并以状态码 1 退出。中断交互提示时以状态码 130 退出。

## 常见问题

先运行 `npx bump-version doctor`（或
`yarn bump-version doctor`）。它会检查 Node、包版本、Git 和当前分支，并根据检测到的集成配置检查相应依赖和钩子设置。

| 问题                                     | 处理方式                                                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 安装或初始化后发布失败                   | 检查并提交包清单、锁文件和配置文件的改动。正式发布要求已跟踪文件和发布文件没有未提交的改动。                  |
| 找不到 `husky`、`commitlint` 或 `git-cz` | 在运行相应的 `init` 命令后执行 `npm install`，并确保安装了开发依赖。                                          |
| 提交信息没有被检查                       | 在 Git 根目录运行 `npm run prepare`，确认 `.husky/commit-msg` 会调用 commitlint，并查看 `doctor` 的检查结果。 |
| 看似合法的提交或发布提交被拒绝           | 让发布工具、commitlint 和助手配置使用相同预设。`init` 会保留已有配置。                                        |
| `init --preset` 报告冲突                 | 手动修改 `package.json` 中已有的 `bumpVersion.preset`，再同步修改可选工具的配置。                             |
| 在工作区子包中执行 `init --hooks` 失败   | 请在 Git 根目录配置钩子。发布时再用 `--path` 指定目标包。                                                     |
| `--type auto` 提示上次发布后没有新提交   | 添加新提交；如果确实需要再次发布，显式指定类型，例如 `--type patch`。                                         |
| CI 发布因交互提示而失败                  | 正式发布使用 `--yes`，预览使用 `--dry-run`；同时确保检出的是分支，而不是 detached HEAD 状态。                 |

从旧配置升级时，可以运行 `init --commit-helper`，再安装依赖，将 `commitizen` 和 `cz-customizable`
添加为直接开发依赖。从 Husky 4 迁移时，请删除旧的顶层 `husky` 配置，并将钩子迁入 `.husky/` 文件；详见
[Husky 迁移指南](https://typicode.github.io/husky/migrate-from-v4.html)。

## 公共 API 与预设

```js
import { planRelease, executeRelease } from 'node-bump-version'

const options = { _: [], path: process.cwd(), dry: true }
const plan = await planRelease(options, '1.0.0', '1.1.0')
await executeRelease(options, plan)
```

发布计划会记录输入参数、Git 提交及文件内容。如果执行时发布选项、Git 提交或文件发生变化，工具会拒绝继续执行。原有的
`mainLifeCycle`、`bumpVersion`、`changelog`、`commit` 和 `tag`
导出仍然可用。底层文件操作函数不会执行完整发布流程中的 Git 预检查。

| 导入路径                                    | 用途                  |
| ------------------------------------------- | --------------------- |
| `node-bump-version/commitlint`              | emoji commitlint 预设 |
| `node-bump-version/commitlint/conventional` | 标准 commitlint 预设  |
| `node-bump-version/changelog`               | emoji 更新日志预设    |
| `node-bump-version/changelog/conventional`  | 标准更新日志预设      |
| `node-bump-version/commitizen`              | emoji 提交助手配置    |
| `node-bump-version/commitizen/conventional` | 标准提交助手配置      |

此前文档中的 `dist/*` 和 `.cz-config.cjs` 导入路径仍然可用。

## 开发

本仓库使用 Yarn **1.22.22**，版本固定在 `packageManager` 字段中。

```bash
yarn install --frozen-lockfile
yarn build
yarn lint:check
yarn typecheck
yarn test
yarn test:regressions
yarn test:package
```

在本仓库第一次提交前先执行构建，因为本地 commitlint 配置从 `dist/` 加载。pre-commit 钩子会运行
`yarn lint`，commit-msg 钩子会运行 commitlint。可以先运行 `git add .`，再运行 `yarn cz` 编写提交信息。

构建分两轮完成：第一轮编译所有 JavaScript 入口并共享公共模块，第二轮生成类型声明。构建前会清理产物。目前仍保留
`--forceExit` 选项，确保构建完成后能正常退出。

CI 覆盖 Windows、Linux 和 macOS，以及 Node
22.13.0、当前 22.x、24.x 和 26.x。检查内容包括 lint、类型、发布测试、11 项审计回归测试，以及 npm 压缩包的隔离安装。
`test:package`
需要访问 registry，且必须先构建；它会安装运行时依赖而不安装可选集成，并在临时本地仓库中执行发布。测试不会发布包，也不会使用本项目的远程仓库。回归测试命令见
[scripts/README.md](scripts/README.md)。

## 许可证

[MIT](LICENSE)。灵感来自 [@picgo/bump-version](https://github.com/PicGo/bump-version)。
