import { mkdir } from 'fs/promises'
import { dirname } from 'path'
import { lock } from 'proper-lockfile'

export interface FileLockOptions {
  label?: string
  staleMs?: number
  retries?: number
}

export async function withFileLock<T>(
  targetPath: string,
  work: () => Promise<T>,
  options: FileLockOptions = {},
): Promise<T> {
  await mkdir(dirname(targetPath), { recursive: true })
  const label = options.label ?? 'file lock'
  let release: (() => Promise<void>) | null = null

  try {
    release = await lock(targetPath, {
      realpath: false,
      stale: options.staleMs ?? 30_000,
      update: 10_000,
      retries: {
        retries: options.retries ?? 30,
        factor: 1.15,
        minTimeout: 10,
        maxTimeout: 50,
        randomize: true,
      },
    })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ELOCKED') {
      throw new Error(`Timed out acquiring ${label}`, { cause: error })
    }
    throw error
  }

  try {
    return await work()
  } finally {
    await release()
  }
}
