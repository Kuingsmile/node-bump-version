import exec from './exec.js';
import { checkFileAndGetPath } from './utils.js';
const commit = async (argv, newVersion) => {
    const changedFiles = [
        'package.json',
        'package-lock.json'
    ];
    if (argv.changelog !== false) {
        changedFiles.push(argv.file || 'CHANGELOG.md');
    }
    const releaseMsg = `:tada: Release: v${newVersion}`;
    if (argv.skipCommit)
        return Promise.resolve();
    const changedFilesStr = checkFileAndGetPath(argv, changedFiles).join(' ');
    if (changedFilesStr === '' || argv.dry) {
        return Promise.resolve();
    }
    await exec(argv, `git add ${changedFilesStr}`);
    return await exec(argv, `git commit ${changedFilesStr} -m "${releaseMsg}"`);
};
export default commit;
//# sourceMappingURL=commit.js.map