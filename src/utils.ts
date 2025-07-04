import * as fs from 'node:fs'
import * as path from 'node:path'

import { BumpVersionArgs } from './types/index'

export const checkFileAndGetPath = (argv: BumpVersionArgs, files: string[]): string[] => {
  return files
    .map((item: string) => {
      if (path.isAbsolute(item)) {
        return item
      }
      return path.join(argv.path || './', item)
    })
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

  -d, --dry                     Run bump version without change anything & output the log in console

  -f, --file                    Read and write the CHANGELOG file, relative to package.json's path
                                Default: CHANGELOG.md

  -p, --path                    A filepath of where your package.json is located
                                Default: ./

  -h, --help                    Display help message

  -t, --type                    Release type. [major, minor, patch, premajor, preminor, prepatch, prerelease]
                                Default: patch

  --push                        Auto push commits to origin master
                                Default: false

  --no-tag                      Tag won't be created
                                Default: tag will be created

  --no-changelog                Changelog won't be created
                                Default: changelog will be created
`
