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

export { conventionalChangelog as default };
//# sourceMappingURL=conventional-changelog.js.map
