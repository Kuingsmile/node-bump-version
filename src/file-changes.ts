import { randomUUID } from 'node:crypto'
import { existsSync, lstatSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'

export interface FileChange {
  path: string
  before: string | null
  after: string
}

export function readOptionalFile(path: string): string | null {
  try {
    if (!lstatSync(path).isFile()) throw new Error(`Release file must be a regular file: ${path}`)
    return readFileSync(path, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

function writeAtomic(path: string, content: string): void {
  const temporary = `${path}.${randomUUID()}.tmp`
  try {
    const mode = readOptionalFile(path) === null ? undefined : lstatSync(path).mode
    writeFileSync(temporary, content, { flag: 'wx', mode })
    renameSync(temporary, path)
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary)
  }
}

export function restoreFileChanges(changes: FileChange[]): void {
  const failures: unknown[] = []
  for (const change of [...changes].reverse()) {
    try {
      if (readOptionalFile(change.path) !== change.after) {
        throw new Error(`Preserved concurrent changes to ${change.path}; restore this file manually`)
      }
      if (change.before === null) unlinkSync(change.path)
      else writeAtomic(change.path, change.before)
    } catch (error) {
      failures.push(error)
    }
  }
  if (failures.length) throw new AggregateError(failures, 'Some release files need manual recovery')
}

export function applyFileChanges(changes: FileChange[]): void {
  for (const change of changes) {
    if (readOptionalFile(change.path) !== change.before) throw new Error(`File changed after preview: ${change.path}`)
  }
  const applied: FileChange[] = []
  try {
    for (const change of changes) {
      writeAtomic(change.path, change.after)
      applied.push(change)
    }
  } catch (error) {
    restoreFileChanges(applied)
    throw error
  }
}
