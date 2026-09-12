import js from '@eslint/js'
import { defineConfig } from 'eslint/config'
import jsonc from 'eslint-plugin-jsonc'
import pluginPrettier from 'eslint-plugin-prettier/recommended'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import eslintPluginUnicorn from 'eslint-plugin-unicorn'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const jsoncFiles = ['**/*.jsonc', '**/tsconfig.json', '**/tsconfig.*.json', '**/.vscode/*.json']

export default defineConfig(
  {
    ignores: ['**/node_modules/**', '**/dist/**', 'vitest.workspace.mjs', 'cases/**'],
  },
  {
    files: ['**/*.{ts,tsx,cts,mts,js,cjs,mjs}'],
    extends: [js.configs.recommended, tseslint.configs.recommended, tseslint.configs.stylistic],
    languageOptions: {
      globals: globals.node,
    },
    plugins: {
      'simple-import-sort': simpleImportSort,
      unicorn: eslintPluginUnicorn,
    },
    rules: {
      'unicorn/prefer-node-protocol': 'error',
      'unicorn/prefer-module': 'error',
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      eqeqeq: 'error',
      'no-caller': 'error',
      'no-constant-condition': ['error', { checkLoops: false }],
      'no-eval': 'error',
      'no-extra-bind': 'error',
      'no-new-func': 'error',
      'no-new-wrappers': 'error',
      'no-throw-literal': 'error',
      'no-undef-init': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-const': 'error',
      'prefer-object-spread': 'error',
      'unicode-bom': ['error', 'never'],
      'no-console': 'off',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
      'no-unused-vars': 'off',
      'no-extra-boolean-cast': 'off',
      'no-case-declarations': 'off',
      'no-cond-assign': 'off',
      'no-control-regex': 'off',
      'no-inner-declarations': 'off',
      'no-empty': 'off',
      // @typescript-eslint/eslint-plugin
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-object-type': 'off', // {} is a totally useful and valid type.
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',
      // Pending https://github.com/typescript-eslint/typescript-eslint/issues/4820
      '@typescript-eslint/prefer-optional-chain': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: ['**/*.{cjs,cts}'],
    languageOptions: {
      sourceType: 'commonjs',
    },
  },
  {
    files: ['**/*.json'],
    ignores: jsoncFiles,
    extends: [jsonc.configs['recommended-with-json'], jsonc.configs.prettier],
    language: 'jsonc/json',
  },
  {
    files: ['**/*.{ts,tsx,cts,mts,js,cjs,mjs}'],
    rules: {
      eqeqeq: 'error',
      'no-caller': 'error',
      'no-constant-condition': ['error', { checkLoops: false }],
      'no-eval': 'error',
      'no-extra-bind': 'error',
      'no-new-func': 'error',
      'no-new-wrappers': 'error',
      'no-throw-literal': 'error',
      'no-undef-init': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-const': 'error',
      'prefer-object-spread': 'error',
      'unicode-bom': ['error', 'never'],
      // Enabled in eslint:recommended, but not applicable here
      'no-extra-boolean-cast': 'off',
      'no-case-declarations': 'off',
      'no-cond-assign': 'off',
      'no-control-regex': 'off',
      'no-inner-declarations': 'off',
      'no-empty': 'off',

      // @typescript-eslint/eslint-plugin
      'no-unused-expressions': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/class-literal-property-style': 'off',
      '@typescript-eslint/consistent-indexed-object-style': 'off',
      '@typescript-eslint/consistent-generic-constructors': 'off',
      '@typescript-eslint/no-duplicate-enum-values': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-object-type': 'off', // {} is a totally useful and valid type.
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',
      // Pending https://github.com/typescript-eslint/typescript-eslint/issues/4820
      '@typescript-eslint/prefer-optional-chain': 'off',
      'unicorn/prefer-node-protocol': 'error',
    },
  },
  {
    files: ['**/*.mjs', '**/*.mts'],
    rules: {
      // These globals don't exist outside of CJS files.
      'no-restricted-globals': [
        'error',
        { name: '__filename' },
        { name: '__dirname' },
        { name: 'require' },
        { name: 'module' },
        { name: 'exports' },
      ],
    },
  },
  pluginPrettier,
)
