import { isBuiltin } from 'node:module'

import json from '@rollup/plugin-json'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import dts from 'rollup-plugin-dts'

import pkg from './package.json' with { type: 'json' }

const entries = [
  'index',
  'bin/bump-version',
  'commitlint-node/index',
  'commitlint-standard/index',
  'conventional-changelog-node/index',
  'conventional-changelog-node/parser-opts',
  'conventional-changelog-node/conventional-recommended-bump',
  'conventional-changelog-node/writer-opts',
  'conventional-changelog-node/conventional-changelog',
  'conventional-changelog-standard/index',
  'conventional-changelog-standard/parser-opts',
]
const input = Object.fromEntries(entries.map(name => [name, `src/${name}.ts`]))
const dependencies = Object.keys(pkg.dependencies)
const external = id => isBuiltin(id) || dependencies.some(name => id === name || id.startsWith(`${name}/`))

export default [
  {
    input,
    external,
    output: {
      dir: 'dist',
      format: 'es',
      sourcemap: true,
      entryFileNames: '[name].js',
      chunkFileNames: 'shared/[name]-[hash].js',
      banner: chunk =>
        chunk.facadeModuleId?.replaceAll('\\', '/').endsWith('/src/bin/bump-version.ts') ? '#!/usr/bin/env node' : '',
    },
    plugins: [
      nodeResolve({ preferBuiltins: true }),
      json(),
      typescript({ tsconfig: './tsconfig.json', declaration: false }),
    ],
  },
  {
    input: Object.fromEntries(Object.entries(input).filter(([name]) => name !== 'bin/bump-version')),
    external,
    output: { dir: 'dist', format: 'es', entryFileNames: '[name].d.ts', chunkFileNames: 'shared/[name]-[hash].d.ts' },
    plugins: [dts({ respectExternal: true })],
  },
]
