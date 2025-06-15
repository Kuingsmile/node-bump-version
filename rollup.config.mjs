import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import copy from 'rollup-plugin-copy'
import dts from 'rollup-plugin-dts'

const external = [
  'fs',
  'path',
  'child_process',
  'util',
  'os',
  'url',
  'chalk',
  'inquirer',
  'lodash',
  'minimist',
  'ora',
  'semver',
  'conventional-changelog',
  '@commitlint/cli'
]

export default [
  // Main library build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.js',
      format: 'es',
      sourcemap: true
    },
    external,
    plugins: [
      nodeResolve({
        preferBuiltins: true
      }),
      commonjs(),
      json(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false
      })
    ]
  },
  // CLI binary build
  {
    input: 'src/bin/bump-version.ts',
    output: {
      file: 'dist/bin/bump-version.js',
      format: 'es',
      sourcemap: true,
      banner: '#!/usr/bin/env node'
    },
    external,
    plugins: [
      nodeResolve({
        preferBuiltins: true
      }),
      commonjs(),
      json(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false
      })
    ]
  },
  // Commitlint config build
  {
    input: 'src/commitlint-node/index.ts',
    output: {
      file: 'dist/commitlint-node/index.js',
      format: 'es',
      sourcemap: true
    },
    external,
    plugins: [
      nodeResolve({
        preferBuiltins: true
      }),
      commonjs(),
      json(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false
      })
    ]
  }, // Conventional changelog config build
  {
    input: 'src/conventional-changelog-node/index.ts',
    output: {
      file: 'dist/conventional-changelog-node/index.js',
      format: 'es',
      sourcemap: true
    },
    external,
    plugins: [
      nodeResolve({
        preferBuiltins: true
      }),
      commonjs(),
      json(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false
      }),
      copy({
        targets: [
          { src: 'src/conventional-changelog-node/templates/*', dest: 'dist/conventional-changelog-node/templates' }
        ]
      })
    ]
  },
  // Parser opts build
  {
    input: 'src/conventional-changelog-node/parser-opts.ts',
    output: {
      file: 'dist/conventional-changelog-node/parser-opts.js',
      format: 'es',
      sourcemap: true
    },
    external,
    plugins: [
      nodeResolve({
        preferBuiltins: true
      }),
      commonjs(),
      json(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false
      })
    ]
  },
  // Conventional recommended bump build
  {
    input: 'src/conventional-changelog-node/conventional-recommended-bump.ts',
    output: {
      file: 'dist/conventional-changelog-node/conventional-recommended-bump.js',
      format: 'es',
      sourcemap: true
    },
    external,
    plugins: [
      nodeResolve({
        preferBuiltins: true
      }),
      commonjs(),
      json(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false
      })
    ]
  },
  // Writer opts build
  {
    input: 'src/conventional-changelog-node/writer-opts.ts',
    output: {
      file: 'dist/conventional-changelog-node/writer-opts.js',
      format: 'es',
      sourcemap: true
    },
    external,
    plugins: [
      nodeResolve({
        preferBuiltins: true
      }),
      commonjs(),
      json(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false
      })
    ]
  },
  // Conventional changelog build
  {
    input: 'src/conventional-changelog-node/conventional-changelog.ts',
    output: {
      file: 'dist/conventional-changelog-node/conventional-changelog.js',
      format: 'es',
      sourcemap: true
    },
    external,
    plugins: [
      nodeResolve({
        preferBuiltins: true
      }),
      commonjs(),
      json(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false
      })
    ]
  },
  // Type definitions
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.d.ts',
      format: 'es'
    },
    plugins: [dts()]
  }
]
