import bumpVersion from './bumpVersion'
import changelog from './changelog'
import commit from './commit'
import spinner from './ora'
import tag from './tag'
import { BumpVersionArgs } from './types/index'

const mainLifeCycle = async (argv: BumpVersionArgs, currentVersion: string, newVersion: string): Promise<void> => {
  const normalizedVersion = semver.valid(newVersion)
  if (!semver.valid(currentVersion) || !normalizedVersion || !semver.gt(normalizedVersion, currentVersion)) {
    throw new Error('Release version must be valid and greater than the current version')
  }
  newVersion = normalizedVersion
  spinner.start()

  try {
    await new Promise<void>(resolve => {
      spinner.text = 'Bumping version...'
      return resolve(bumpVersion(argv, newVersion))
    })
    spinner.text = 'Generating changelog...'
    await changelog(argv, newVersion)
    spinner.text = 'Commiting changes...'
    await commit(argv, newVersion)
    spinner.text = 'Creating tag...'
    await tag(argv, newVersion)
    spinner.succeed('Done!')
  } catch (e) {
    spinner.fail('Failed!')
    throw e
  }
}

export default mainLifeCycle
import * as semver from 'semver'
