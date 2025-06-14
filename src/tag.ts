import exec from './exec.js';
import { BumpVersionArgs } from './types/index.js';

const tag = async (argv: BumpVersionArgs, newVersion: string): Promise<string | void> => {
  if (argv.dry) {
    return Promise.resolve();
  }
  
  let flow: Promise<string | void>;
  
  if (argv.tag === false) {
    flow = Promise.resolve();
  } else {
    flow = exec(argv, `git tag -a v${newVersion} -m v${newVersion}`);
  }
  
  await flow;
  if (argv.push) {
    await exec(argv, 'git push --follow-tags origin master');
  }
  return await Promise.resolve();
};

export default tag;
