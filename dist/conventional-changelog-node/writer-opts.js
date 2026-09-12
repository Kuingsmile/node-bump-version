const repositoryUrl = (context) => context.repository
    ? [context.host, context.owner, context.repository].filter(Boolean).join('/')
    : context.repoUrl || '';
const templates = {
    template: context => {
        const groups = (context.commitGroups || []).map(group => [group.title && `### ${group.title}`, group.commits.map(commit => `* ${context.commitPartial(context, commit)}`).join('\n')]
            .filter(Boolean)
            .join('\n\n'));
        return [context.headerPartial(context), ...groups, context.footerPartial(context)].filter(Boolean).join('\n\n') + '\n\n';
    },
    headerPartial: ({ isPatch, version, title, date }) => [`${isPatch ? '##' : '#'} :tada: ${version || ''}`, title && `"${title}"`, date && `(${date})`].filter(Boolean).join(' '),
    commitPartial: (context, commit) => {
        const subject = `${commit.scope ? `**${commit.scope}:** ` : ''}${commit.subject || commit.header || ''}`;
        const hash = commit.hash
            ? context.linkReferences
                ? `([${commit.hash}](${repositoryUrl(context)}/${context.commit}/${commit.hash}))`
                : commit.hash
            : '';
        const references = (commit.references || []).map(reference => {
            const label = `${reference.owner ? `${reference.owner}/` : ''}${reference.repository || ''}#${reference.issue}`;
            const repo = context.repository && reference.repository
                ? [context.host, reference.owner, reference.repository].filter(Boolean).join('/')
                : repositoryUrl(context);
            return context.linkReferences ? `[${label}](${repo}/${context.issue}/${reference.issue})` : label;
        });
        return [subject, hash].filter(Boolean).join(' ') + (references.length ? `, closes ${references.join(' ')}` : '');
    },
    footerPartial: context => (context.noteGroups || []).map(group => {
        const notes = group.notes.map(note => {
            const { commit } = note;
            return `* ${commit?.scope ? `**${commit.scope}:** ` : ''}${note.text}`;
        });
        return `### ${group.title}\n\n${notes.join('\n')}`;
    }).join('\n\n')
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
        ...templates,
        transform: (original, context) => {
            // The writer passes immutable commits; return changes on a copy.
            const commit = { ...original, notes: original.notes.map(note => ({ ...note })) };
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
                return null;
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
                return null;
            }
            if (commit.scope === '*') {
                commit.scope = '';
            }
            if (typeof commit.hash === 'string') {
                commit.hash = commit.hash.substring(0, 7);
            }
            if (typeof commit.subject === 'string') {
                let url = context.repository ? `${context.host}/${context.owner}/${context.repository}` : context.repoUrl;
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
            commit.references = (commit.references || []).filter(reference => {
                if (issues.indexOf(reference.issue) === -1) {
                    return true;
                }
                return false;
            });
            return commit;
        },
        groupBy: 'type',
        commitGroupsSort: compareTitleFunc,
        commitsSort: (a, b) => (a.scope || '').localeCompare(b.scope || '') || (a.subject || '').localeCompare(b.subject || ''),
        noteGroupsSort: 'title',
        notesSort: compareFunc
    };
    return writerOpts;
}
var writerOpts = getWriterOpts();

export { writerOpts as default };
//# sourceMappingURL=writer-opts.js.map
