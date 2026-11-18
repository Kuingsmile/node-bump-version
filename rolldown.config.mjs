import { readdirSync } from 'node:fs'
import { join } from 'node:path'

import { defineConfig } from 'rolldown'

import pkg from './package.json' with { type: 'json' }

const dependencies = Object.keys(pkg.dependencies)
const input = readdirSync('src', { recursive: true })
  .filter(file => file.endsWith('.ts') && !file.endsWith('.d.ts'))
  .map(file => join('src', file))

export default defineConfig({
  input,
  platform: 'node',
  transform: { target: 'node24' },
  external: id => dependencies.some(name => id === name || id.startsWith(`${name}/`)),
  output: {
    dir: 'dist',
    format: 'esm',
    sourcemap: true,
    preserveModules: true,
    preserveModulesRoot: 'src',
  },
})
