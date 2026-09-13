import * as fs from 'node:fs'
import * as path from 'node:path'

import { BumpVersionArgs } from './types/index'

export const checkFileAndGetPath = (argv: BumpVersionArgs, files: string[]): string[] => {
  return files
    .map((item: string) => path.resolve(argv.path || './', item))
    .filter((item: string) => {
      return fs.existsSync(item)
    })
}

export const helperMsg = `
BumpVersion -- By Kuingsmile

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

  -v, --version                 Display the tool version
  -y, --yes                     Accept the calculated release without prompting
  --json                        Emit one JSON result (use --yes for a real release)
  --interactive                 Explicitly enable prompts when input is piped
  --preid ID                    Prerelease identifier, such as rc
  --preset NAME                 Commit convention: emoji (default) or conventional

  -t, --type                    Release type. [auto, major, minor, patch, premajor, preminor, prepatch, prerelease]
                                Default: patch

  --push                        Push the current release to its upstream (or origin/current branch)
                                Default: false

  --remote NAME                 Override the configured upstream remote
  --branch NAME                 Override the destination branch
  --no-atomic                   Allow a non-atomic push if the server does not support atomic pushes

  --no-tag                      Tag won't be created
                                Default: tag will be created

  --no-changelog                Changelog won't be created
                                Default: changelog will be created
`
