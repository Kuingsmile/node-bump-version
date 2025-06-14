import * as fs from 'node:fs';
import * as path from 'node:path';
import { ConventionalChangelog } from 'conventional-changelog';
import { exec } from 'node:child_process';
import chalk from 'chalk';
import ora from 'ora';

const checkFileAndGetPath = (argv, files) => {
    return files.map((item) => {
        if (path.isAbsolute(item)) {
            return item;
        }
        return path.join(argv.path || './', item);
    }).filter((item) => {
        return fs.existsSync(item);
    });
};
const helperMsg = `
BumpVersion -- By Kuingsmile

Usage
  bump-version

Example
  bump-version -t major

Options
  -a, --preid-alpha             Prerelease id: alpha. Exp. 1.0.0.alpha-0

  -b, --preid-beta              Prerelease id: beta.  Exp. 1.0.0.beta-0

  -d, --dry                     Run bump version without change anything & output the log in console

  -f, --file                    Read and write the CHANGELOG file, relative to package.json's path
                                Default: CHANGELOG.md

  -p, --path                    A filepath of where your package.json is located
                                Default: ./

  -h, --help                    Display help message

  -t, --type                    Release type. [major, minor, patch, premajor, preminor, prepatch, prerelease]
                                Default: patch

  --push                        Auto push commits to origin master
                                Default: false

  --no-tag                      Tag won't be created
                                Default: tag will be created

  --no-changelog                Changelog won't be created
                                Default: changelog will be created
`;

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

const parserOpts = {
    headerPattern: /^(:.*: \w*)(?:\((.*)\))?: (.*)$/,
    headerCorrespondence: [
        'type',
        'scope',
        'subject'
    ],
    noteKeywords: ['BREAKING CHANGE']
};

// Inline templates to avoid path resolution issues
const TEMPLATES = {
    main: `{{> header}}

{{#each commitGroups}}

{{#if title}}
### {{title}}

{{/if}}
{{#each commits}}
{{> commit root=@root}}
{{/each}}

{{/each}}
{{> footer}}



`,
    header: `{{#if isPatch~}}
  ##
{{~else~}}
  #
{{~/if}} {{#if @root.linkCompare~}}
:tada: {{version}}
{{~else}}
:tada: {{version}}
{{~/if}}
{{~#if title}} "{{title}}"
{{~/if}}
{{~#if date}} ({{date}})
{{/if}}

`,
    commit: `*{{#if scope}} **{{scope}}:**
{{~/if}} {{#if subject}}
  {{~subject}}
{{~else}}
  {{~header}}
{{~/if}}

{{~!-- commit link --}} {{#if @root.linkReferences~}}
  ([{{hash}}](
  {{~#if @root.repository}}
    {{~#if @root.host}}
      {{~@root.host}}/
    {{~/if}}
    {{~#if @root.owner}}
      {{~@root.owner}}/
    {{~/if}}
    {{~@root.repository}}
  {{~else}}
    {{~@root.repoUrl}}
  {{~/if}}/
  {{~@root.commit}}/{{hash}}))
{{~else}}
  {{~hash}}
{{~/if}}

{{~!-- commit references --}}
{{~#if references~}}
  , closes
  {{~#each references}} {{#if @root.linkReferences~}}
    [
    {{~#if this.owner}}
      {{~this.owner}}/
    {{~/if}}
    {{~this.repository}}#{{this.issue}}](
    {{~#if @root.repository}}
      {{~#if @root.host}}
        {{~@root.host}}/
      {{~/if}}
      {{~#if this.repository}}
        {{~#if this.owner}}
          {{~this.owner}}/
        {{~/if}}
        {{~this.repository}}
      {{~else}}
        {{~#if @root.owner}}
          {{~@root.owner}}/
        {{~/if}}
          {{~@root.repository}}
        {{~/if}}
    {{~else}}
      {{~@root.repoUrl}}
    {{~/if}}/
    {{~@root.issue}}/{{this.issue}})
  {{~else}}
    {{~#if this.owner}}
      {{~this.owner}}/
    {{~/if}}
    {{~this.repository}}#{{this.issue}}
  {{~/if}}{{/each}}
{{~/if}}


`,
    footer: `{{#if noteGroups}}
{{#each noteGroups}}

### {{title}}

{{#each notes}}
* {{#if commit.scope}}**{{commit.scope}}:** {{/if}}{{text}}
{{/each}}
{{/each}}

{{/if}}

`
};
const compareFunc = (a, b) => {
    if (a.title < b.title)
        return -1;
    if (a.title > b.title)
        return 1;
    return 0;
};
const headerPattern = /^(:.*: (.*))$/;
const compareTitleFunc = (a, b) => {
    const sortMap = {
        Features: 10,
        'Bug Fixes': 9,
        'BREAKING CHANGES': 8
    };
    const typeA = a.title.match(headerPattern)?.[2];
    const typeB = b.title.match(headerPattern)?.[2];
    return (sortMap[typeB] || 0) - (sortMap[typeA] || 0);
};
async function getWriterOpts() {
    const writerOpts = {
        transform: (commit, context) => {
            let discard = true;
            const issues = [];
            commit.notes.forEach(note => {
                note.title = 'BREAKING CHANGES';
                discard = false;
            });
            if (commit.type === ':sparkles: Feature') {
                commit.type = ':sparkles: Features';
            }
            else if (commit.type === ':bug: Fix') {
                commit.type = ':bug: Bug Fixes';
            }
            else if (commit.type === ':zap: Perf') {
                commit.type = ':zap: Performance Improvements';
            }
            else if (commit.type === ':back: Revert') {
                commit.type = ':back: Revert';
            }
            else if (commit.type === ':pencil: Docs') {
                commit.type = ':pencil: Documentation';
            }
            else if (commit.type === ':package: Chore') {
                commit.type = ':package: Chore';
            }
            else if (commit.type === ':pushpin: Init') {
                commit.type = ':pushpin: Init';
            }
            else if (discard) {
                return;
            }
            else if (commit.type === ':arrow_up: Upgrade') {
                commit.type = ':arrow_up: Dependencies Upgrade';
            }
            else if (commit.type === ':art: Style') {
                commit.type = ':art: Styles';
            }
            else if (commit.type === ':hammer: Refactor') {
                commit.type = ':hammer: Code Refactoring';
            }
            else if (commit.type === ':white_check_mark: Test') {
                commit.type = ':white_check_mark: Tests';
            }
            else if (commit.type === ':construction: WIP' || commit.type === ':tada: Release') {
                return;
            }
            if (commit.scope === '*') {
                commit.scope = '';
            }
            if (typeof commit.hash === 'string') {
                commit.hash = commit.hash.substring(0, 7);
            }
            if (typeof commit.subject === 'string') {
                let url = context.repository
                    ? `${context.host}/${context.owner}/${context.repository}`
                    : context.repoUrl;
                if (url) {
                    url = `${url}/issues/`;
                    // Issue URLs.
                    commit.subject = commit.subject.replace(/#([0-9]+)/g, (_, issue) => {
                        issues.push(issue);
                        return `[#${issue}](${url}${issue})`;
                    });
                }
                if (context.host) {
                    // User URLs.
                    commit.subject = commit.subject.replace(/\B@([a-z0-9](?:-?[a-z0-9/]){0,38})/g, (_, username) => {
                        if (username.includes('/')) {
                            return `@${username}`;
                        }
                        return `[@${username}](${context.host}/${username})`;
                    });
                }
            }
            // remove references that already appear in the subject
            commit.references = commit.references.filter(reference => {
                if (issues.indexOf(reference.issue) === -1) {
                    return true;
                }
                return false;
            });
            return commit;
        },
        groupBy: 'type',
        commitGroupsSort: compareTitleFunc,
        commitsSort: ['scope', 'subject'],
        noteGroupsSort: 'title',
        notesSort: compareFunc
    };
    writerOpts.mainTemplate = TEMPLATES.main;
    writerOpts.headerPartial = TEMPLATES.header;
    writerOpts.commitPartial = TEMPLATES.commit;
    writerOpts.footerPartial = TEMPLATES.footer;
    return writerOpts;
}
var writerOpts = getWriterOpts();

const conventionalChangelog = Promise.all([parserOpts, writerOpts])
    .then(([parserOpts, writerOpts]) => {
    return { parserOpts, writerOpts };
});

const recommendedBumpOpts = {
    parserOpts,
    whatBump: (commits) => {
        let level = 2;
        let breakings = 0;
        let features = 0;
        commits.forEach(commit => {
            if (commit.notes.length > 0) {
                breakings += commit.notes.length;
                level = 0;
            }
            else if (commit.type === 'feat') {
                features += 1;
                if (level === 2) {
                    level = 1;
                }
            }
        });
        return {
            level,
            reason: breakings === 1
                ? `There is ${breakings} BREAKING CHANGE and ${features} features`
                : `There are ${breakings} BREAKING CHANGES and ${features} features`
        };
    }
};

const conventionalChangelogNode = Promise.all([conventionalChangelog, parserOpts, recommendedBumpOpts, writerOpts])
    .then(([conventionalChangelog, parserOpts, recommendedBumpOpts, writerOpts]) => {
    return { conventionalChangelog, parserOpts, recommendedBumpOpts, writerOpts };
});

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
    const config = await conventionalChangelogNode;
    const cc = new ConventionalChangelog(argv.path || './');
    // Use type assertion to bypass the strict type checking
    cc.config({
        parserOpts: config.parserOpts,
        writerOpts: config.writerOpts
    });
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

const spinner = ora({
    text: ''
});

/**
 * Available log levels for the logger utility
 */
const LOG_LEVELS = ['success', 'info', 'warn', 'error'];

const LOG_LEVEL_COLORS = {
    success: chalk.green,
    info: chalk.blue,
    warn: chalk.yellow,
    error: chalk.red,
};
const isValidLogLevel = (level) => {
    return LOG_LEVELS.includes(level);
};
const logger = (message, logLevel) => {
    // Validate log level using type-safe validation
    if (!isValidLogLevel(logLevel)) {
        throw new Error(`Invalid log level: ${logLevel}. Valid levels are: ${LOG_LEVELS.join(', ')}`);
    }
    const colorFunction = LOG_LEVEL_COLORS[logLevel];
    const prefix = colorFunction(`[Bump ${logLevel.toUpperCase()}]: `);
    const formattedMessage = `${prefix}${message}`;
    spinner.clear();
    spinner.frame();
    console.log(formattedMessage);
};

const execCommand = (argv, cmd) => {
    return new Promise((resolve, reject) => {
        // Exec given cmd and handle possible errors
        exec(cmd, { cwd: argv.path || './' }, function (err, stdout, stderr) {
            // If exec returns content in stderr, but no error, print it as a warning
            // If exec returns an error, print it and exit with return code 1
            if (err) {
                logger(stderr || err.message, 'error');
                return reject(err);
            }
            else if (stderr) {
                logger(stderr, 'warn');
            }
            return resolve(stdout);
        });
    });
};

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
    await execCommand(argv, `git add ${changedFilesStr}`);
    return await execCommand(argv, `git commit ${changedFilesStr} -m "${releaseMsg}"`);
};

const tag = async (argv, newVersion) => {
    if (argv.dry) {
        return Promise.resolve();
    }
    let flow;
    if (argv.tag === false) {
        flow = Promise.resolve();
    }
    else {
        flow = execCommand(argv, `git tag -a v${newVersion} -m v${newVersion}`);
    }
    await flow;
    if (argv.push) {
        await execCommand(argv, 'git push --follow-tags origin master');
    }
    return await Promise.resolve();
};

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

export { LOG_LEVELS, bumpVersion, changelog, checkFileAndGetPath, commit, execCommand as exec, helperMsg, logger, mainLifeCycle, spinner as ora, tag };
//# sourceMappingURL=index.js.map
