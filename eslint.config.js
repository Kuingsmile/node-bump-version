import js from '@eslint/js'
import { defineConfig } from 'eslint/config'
import jsonc from 'eslint-plugin-jsonc'
import prettier from 'eslint-plugin-prettier/recommended'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import unicorn from 'eslint-plugin-unicorn'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig(
  { ignores: ['**/node_modules/**', '**/dist/**'] },
  {
    files: ['**/*.{ts,tsx,cts,mts,js,cjs,mjs}'],
    extends: [js.configs.recommended, tseslint.configs.recommended, tseslint.configs.stylistic],
    languageOptions: { globals: globals.node },
    plugins: { 'simple-import-sort': simpleImportSort, unicorn },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'unicorn/prefer-node-protocol': 'error',
      eqeqeq: 'error',
      'no-eval': 'error',
      'no-new-func': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-object-spread': 'error',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrors: 'all', caughtErrorsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
  {
    files: ['**/*.{cjs,cts}'],
    languageOptions: { sourceType: 'commonjs' },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: ['**/*.json'],
    ignores: ['**/tsconfig.json', '**/tsconfig.*.json', '**/.vscode/*.json'],
    extends: [jsonc.configs['recommended-with-json'], jsonc.configs.prettier],
    language: 'jsonc/json',
  },
  {
    files: ['**/*.jsonc', '**/tsconfig.json', '**/tsconfig.*.json', '**/.vscode/*.json'],
    extends: [jsonc.configs['recommended-with-jsonc'], jsonc.configs.prettier],
    language: 'jsonc/jsonc',
  },
  prettier,
)
