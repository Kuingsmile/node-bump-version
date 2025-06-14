import * as fs from 'node:fs';
import { checkFileAndGetPath } from './utils.js';
const bumpVersion = (argv, version) => {
    if (argv.dry === false) {
        return Promise.resolve();
    }
    let versionFiles = ['package.json', 'package-lock.json'];
    versionFiles = checkFileAndGetPath(argv, versionFiles);
    for (const file of versionFiles) {
        const content = fs.readFileSync(file, 'utf8');
        try {
            const parsedContent = JSON.parse(content);
            parsedContent.version = version;
            const updatedContent = JSON.stringify(parsedContent, null, 2) + '\n';
            if (argv.dry) {
                console.log('bump version to:', version);
            }
            else {
                fs.writeFileSync(file, updatedContent, 'utf8');
            }
        }
        catch (e) {
            return Promise.reject(e);
        }
    }
    return Promise.resolve();
};
export default bumpVersion;
//# sourceMappingURL=bumpVersion.js.map