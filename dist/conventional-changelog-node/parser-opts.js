const parserOpts = {
    headerPattern: /^(:.*: \w*)(?:\((.*)\))?: (.*)$/,
    headerCorrespondence: [
        'type',
        'scope',
        'subject'
    ],
    noteKeywords: ['BREAKING CHANGE']
};

export { parserOpts as default };
//# sourceMappingURL=parser-opts.js.map
