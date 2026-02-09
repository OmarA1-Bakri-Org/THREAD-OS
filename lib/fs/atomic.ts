import { writeFile, rename, unlink, mkdir } from 'fs/promises'
import { dirname, join } from 'path'
import { randomUUID } from 'crypto'

/**
 * Atomically writes a file by writing to a temp file first, then renaming.
 * This prevents partial writes from corrupting the file.
 *
 * @param filePath - The target file path
 * @param content - The content to write
 */
export async function writeFileAtomic(
  filePath: string,
  content: string
): Promise<void> {
  const dir = dirname(filePath)
  await mkdir(dir, { recursive: true })

  const tempPath = join(dir, `.${randomUUID()}.tmp`)

  try {
    await writeFile(tempPath, content, 'utf-8')
    await rename(tempPath, filePath)
  } catch (error) {
    // Clean up temp file on failure
    try {
      await unlink(tempPath)
    } catch {
      // Ignore cleanup errors - temp file may not exist
    }
    throw error
  }
}
