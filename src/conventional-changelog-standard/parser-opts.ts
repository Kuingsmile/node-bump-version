import type { ParserOptions } from 'conventional-commits-parser'

const parserOpts: ParserOptions = {
  headerPattern: /^(\w+)(?:\((.*)\))?!?: (.*)$/,
  breakingHeaderPattern: /^(\w+)(?:\((.*)\))?!: (.*)$/,
  headerCorrespondence: ['type', 'scope', 'subject'],
  noteKeywords: ['BREAKING CHANGE', 'BREAKING-CHANGE'],
}

export default parserOpts
