import { describe, expect, test } from 'bun:test'
import { PackActionRetrySchema, PackActionSchema } from './pack-schema'

describe('pack action schema', () => {
  test('validates conditional branch actions recursively', () => {
    const result = PackActionSchema.safeParse({
      id: 'choose',
      type: 'conditional',
      config: {
        condition: 'first_run == true',
        if_true: [{ id: 'bad', type: 'not_a_real_action', config: {} }],
        if_false: [],
      },
    })
    expect(result.success).toBe(false)
  })

  test('keeps retry_on absent when no retry classes are declared', () => {
    expect(PackActionRetrySchema.parse({ max_attempts: 2 })).toEqual({ max_attempts: 2 })
  })

  test('requires type-specific action configuration', () => {
    expect(PackActionSchema.safeParse({ id: 'cli', type: 'cli', config: {} }).success).toBe(false)
    expect(PackActionSchema.safeParse({ id: 'tool', type: 'composio_tool', config: {} }).success).toBe(false)
    expect(PackActionSchema.safeParse({ id: 'choose', type: 'conditional', config: { if_true: [], if_false: [] } }).success).toBe(false)
    expect(PackActionSchema.safeParse({ id: 'cli-structured', type: 'cli', config: { executable: 'python', arguments: ['script.py'] } }).success).toBe(true)
  })
})
