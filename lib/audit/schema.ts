import { z } from 'zod'

export const AuditEntrySchema = z.object({
  timestamp: z.string(),
  actor: z.string(),
  action: z.string(),
  target: z.string(),
  payload: z.record(z.string(), z.unknown()).optional(),
  result: z.string(),
})

export type AuditEntry = z.infer<typeof AuditEntrySchema>

export interface AuditReadOptions {
  limit?: number
  offset?: number
}
