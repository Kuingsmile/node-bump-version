import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import { ConventionalChangelog } from 'conventional-changelog';
const require = createRequire(import.meta.url);
const config = require('../conventional-changelog-node/index.cjs');
const changelog = async (argv, newVersion) => {
    if (argv.changelog === false) {
        return Promise.resolve();
    }
    let oldContent = '';
    try {
        oldContent = fs.readFileSync(argv.file || 'CHANGELOG.md', 'utf8');
    }
    catch (e) {
        oldContent = '';
    }
    const cc = new ConventionalChangelog(argv.path || './');
    cc.loadPreset(config);
    if (argv.dry) {
        cc.context({ version: newVersion });
    }
    let content = '';
    const stream = cc.writeStream();
    for await (const chunk of stream) {
        content += chunk.toString();
    }
    if (argv.dry) {
        console.log('Changelog is:');
        console.log(content + oldContent);
    }
    else {
        fs.writeFileSync(argv.file || 'CHANGELOG.md', content + oldContent);
    }
};
export default changelog;
//# sourceMappingURL=changelog.js.map