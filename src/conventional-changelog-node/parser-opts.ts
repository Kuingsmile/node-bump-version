export interface ParserOpts {
  headerPattern: RegExp
  headerCorrespondence: string[]
  noteKeywords: string[]
}

const parserOpts: ParserOpts = {
  headerPattern: /^(:.*: \w*)(?:\((.*)\))?: (.*)$/,
  headerCorrespondence: [
    'type',
    'scope',
    'subject'
  ],
  noteKeywords: ['BREAKING CHANGE']
}

export default parserOpts
