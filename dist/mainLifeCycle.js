import bumpVersion from './bumpVersion.js';
import changelog from './changelog.js';
import commit from './commit.js';
import spinner from './ora.js';
import tag from './tag.js';
const mainLifeCycle = async (argv, _currentVersion, newVersion) => {
    spinner.start();
    try {
        await new Promise((resolve) => {
            spinner.text = 'Bumping version...';
            return resolve(bumpVersion(argv, newVersion));
        });
        spinner.text = 'Generating changelog...';
        await changelog(argv, newVersion);
        spinner.text = 'Commiting changes...';
        await commit(argv, newVersion);
        spinner.text = 'Creating tag...';
        await tag(argv, newVersion);
        spinner.succeed('Done!');
    }
    catch (e) {
        spinner.fail('Failed!');
        throw e;
    }
};
export default mainLifeCycle;
//# sourceMappingURL=mainLifeCycle.js.map