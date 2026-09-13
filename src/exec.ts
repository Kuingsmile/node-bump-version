import { exec, execFile } from 'node:child_process'

import logger from './logger'
import { BumpVersionArgs } from './types/index'

const execCommand = (argv: BumpVersionArgs, cmd: string, args?: string[]): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Exec given cmd and handle possible errors
    const callback = (err: Error | null, stdout: string, stderr: string): void => {
      // If exec returns content in stderr, but no error, print it as a warning
      // If exec returns an error, print it and exit with return code 1
      if (err) {
        if (!argv.json) logger(stderr || err.message, 'error')
        return reject(new Error(stderr.trim() || err.message, { cause: err }))
      } else if (stderr) {
        if (!argv.json) logger(stderr, 'warn')
      }
      return resolve(stdout)
    }
    const options = { cwd: argv.path || './' }
    if (args) execFile(cmd, args, options, callback)
    else exec(cmd, options, callback)
  })
}

export default execCommand
