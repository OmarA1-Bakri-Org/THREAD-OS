import { appendFile, readFile } from 'fs/promises'
import { join } from 'path'
import { mkdir } from 'fs/promises'

const AUDIT_LOG_PATH = '.threados/audit.log'

export interface AuditEntry {
  timestamp: string
  actor: 'user' | 'orchestrator' | 'system'
  action: string
  target: string
  payload: Record<string, unknown>
  policy_mode: 'SAFE' | 'POWER'
  result: 'success' | 'denied' | 'error'
  error?: string
}

// Regex patterns for secrets to redact
const SECRET_PATTERNS = [
  /(password|secret|token|key|api_key|apikey|auth|credential)[\s]*[=:]\s*\S+/gi,
  /Bearer\s+\S+/gi,
  /sk-[a-zA-Z0-9]{20,}/g,
  /ghp_[a-zA-Z0-9]{36}/g,
]

function redactSecrets(text: string): string {
  let result = text
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, (match) => {
      const eqIndex = match.search(/[=:]\s*/)
      if (eqIndex !== -1) {
        return match.substring(0, eqIndex + 1) + ' [REDACTED]'
      }
      return '[REDACTED]'
    })
  }
  return result
}

function redactPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === 'string') {
      redacted[key] = redactSecrets(value)
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactPayload(value as Record<string, unknown>)
    } else {
      redacted[key] = value
    }
  }
  return redacted
}

export class AuditLogger {
  private basePath: string

  constructor(basePath: string) {
    this.basePath = basePath
  }

  async log(entry: Omit<AuditEntry, 'timestamp'>): Promise<void> {
    const fullEntry: AuditEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
      payload: redactPayload(entry.payload),
    }

    const logPath = join(this.basePath, AUDIT_LOG_PATH)
    const dir = join(this.basePath, '.threados')
    await mkdir(dir, { recursive: true })

    const line = JSON.stringify(fullEntry) + '\n'
    await appendFile(logPath, line, 'utf-8')
  }

  async read(options?: { limit?: number; offset?: number }): Promise<AuditEntry[]> {
    const logPath = join(this.basePath, AUDIT_LOG_PATH)

    try {
      const content = await readFile(logPath, 'utf-8')
      const lines = content.trim().split('\n').filter(l => l.length > 0)

      let entries = lines.map(line => JSON.parse(line) as AuditEntry)

      const offset = options?.offset ?? 0
      const limit = options?.limit ?? entries.length

      return entries.slice(offset, offset + limit)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return []
      }
      throw error
    }
  }

  async tail(n: number): Promise<AuditEntry[]> {
    const entries = await this.read()
    return entries.slice(-n)
  }
}
