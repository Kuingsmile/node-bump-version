import { exec } from 'node:child_process';

import logger from './logger';
import { BumpVersionArgs } from './types/index';

const execCommand = (argv: BumpVersionArgs, cmd: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Exec given cmd and handle possible errors
    exec(cmd, { cwd: argv.path || './' }, function (err, stdout, stderr) {
      // If exec returns content in stderr, but no error, print it as a warning
      // If exec returns an error, print it and exit with return code 1
      if (err) {
        logger(stderr || err.message, 'error');
        return reject(err);
      } else if (stderr) {
        logger(stderr, 'warn');
      }
      return resolve(stdout);
    });
  });
};

export default execCommand;
