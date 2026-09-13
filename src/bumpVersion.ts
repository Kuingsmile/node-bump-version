import * as fs from 'node:fs'
import { basename } from 'node:path'

import * as semver from 'semver'

import { BumpVersionArgs, PackageJson } from './types/index'
import { checkFileAndGetPath } from './utils'

const bumpVersion = (argv: BumpVersionArgs, version: string): Promise<void> => {
  const normalizedVersion = semver.valid(version)
  if (!normalizedVersion) return Promise.reject(new Error('Invalid release version'))
  version = normalizedVersion
  let versionFiles = ['package.json', 'package-lock.json']
  versionFiles = checkFileAndGetPath(argv, versionFiles)

  for (const file of versionFiles) {
    const content = fs.readFileSync(file, 'utf8')
    try {
      const parsedContent: PackageJson = JSON.parse(content)
      parsedContent.version = version
      const rootPackage = parsedContent.packages?.['']
      if (basename(file) === 'package-lock.json' && rootPackage && typeof rootPackage === 'object') {
        rootPackage.version = version
      }
      const updatedContent = JSON.stringify(parsedContent, null, 2) + '\n'

      if (argv.dry) {
        console.log('bump version to:', version)
      } else {
        fs.writeFileSync(file, updatedContent, 'utf8')
      }
    } catch (e) {
      return Promise.reject(e)
    }
  }
  return Promise.resolve()
}

export default bumpVersion
