export interface ComposioExecuteInput {
  toolSlug: string
  arguments: Record<string, unknown>
  timeoutMs?: number
}

export function buildComposioExecuteCommand(command: string, input: ComposioExecuteInput): string[] {
  return [command, 'execute', input.toolSlug, '--params', JSON.stringify(input.arguments ?? {})]
}

export async function executeComposioCli(
  command: string,
  input: ComposioExecuteInput,
  defaultTimeoutMs: number,
): Promise<unknown> {
  const proc = Bun.spawn({
    cmd: buildComposioExecuteCommand(command, input),
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const timeoutMs = input.timeoutMs ?? defaultTimeoutMs
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      proc.kill()
      reject(new Error(`Composio tool '${input.toolSlug}' timed out after ${timeoutMs}ms`))
    }, timeoutMs)
  })

  try {
    const [stdout, stderr, exitCode] = await Promise.race([
      Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]),
      timeout,
    ])
    if (exitCode !== 0) {
      throw new Error(stderr.trim() || stdout.trim() || `Composio tool '${input.toolSlug}' failed with exit code ${exitCode}`)
    }
    const trimmed = stdout.trim()
    if (!trimmed) return null
    try { return JSON.parse(trimmed) } catch { return trimmed }
  } finally {
    if (timer) clearTimeout(timer)
  }
}
