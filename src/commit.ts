import exec from './exec';
import { BumpVersionArgs } from './types/index';
import { checkFileAndGetPath } from './utils';

const commit = async (argv: BumpVersionArgs, newVersion: string): Promise<string | void> => {
  const changedFiles = [
    'package.json',
    'package-lock.json'
  ];
  
  if (argv.changelog !== false) {
    changedFiles.push(argv.file || 'CHANGELOG.md');
  }
  
  const releaseMsg = `:tada: Release: v${newVersion}`;
  
  if ((argv as any).skipCommit) return Promise.resolve();
  
  const changedFilesStr = checkFileAndGetPath(argv, changedFiles).join(' ');
  
  if (changedFilesStr === '' || argv.dry) {
    return Promise.resolve();
  }
  
  await exec(argv, `git add ${changedFilesStr}`);
  return await exec(argv, `git commit ${changedFilesStr} -m "${releaseMsg}"`);
};

export default commit;
