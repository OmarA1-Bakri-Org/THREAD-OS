const THREADOS_DIR = '.threados'
const SUBDIRS = ['prompts', 'runs', 'state']

const DEFAULT_SEQUENCE = `version: "1.0"
name: New Sequence
steps: []
gates: []
`

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { mkdir, readFile, writeFile } = await import('fs/promises')
    const { join } = await import('path')
    const YAML = await import('yaml')

    const basePath = process.env.THREADOS_BASE_PATH || process.cwd()
    const threadosPath = join(basePath, THREADOS_DIR)

    try {
      await mkdir(threadosPath, { recursive: true })
      for (const subdir of SUBDIRS) {
        await mkdir(join(threadosPath, subdir), { recursive: true })
      }

      const seqPath = join(threadosPath, 'sequence.yaml')
      let needsWrite = false

      try {
        const content = await readFile(seqPath, 'utf-8')
        const parsed = YAML.parse(content)
        // Validate minimum required fields
        if (!parsed || !parsed.name || typeof parsed.name !== 'string' || parsed.name.trim() === '') {
          needsWrite = true
        }
      } catch {
        needsWrite = true
      }

      if (needsWrite) {
        await writeFile(seqPath, DEFAULT_SEQUENCE, 'utf-8')
      }
    } catch (err) {
      console.error('[threados] Failed to initialize .threados directory:', err)
    }
  }
}
