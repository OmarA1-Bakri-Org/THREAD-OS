import { describe, expect, test } from 'bun:test'
import { resolveBatchRootRunStatus } from './run-status'

describe('resolveBatchRootRunStatus', () => {
  test('successful work is successful', () => {
    expect(resolveBatchRootRunStatus({ success: true, executed: [{ success: true, status: 'DONE' }], waiting: [] })).toBe('successful')
  })

  test('waiting work keeps the root run pending', () => {
    expect(resolveBatchRootRunStatus({ success: false, executed: [], waiting: ['blocked'] })).toBe('pending')
  })

  test('an executed BLOCKED step keeps the root run pending even without downstream waiters', () => {
    expect(resolveBatchRootRunStatus({ success: false, executed: [{ success: false, status: 'BLOCKED' }], waiting: [] })).toBe('pending')
  })

  test('hard failure dominates unrelated waiting work', () => {
    expect(resolveBatchRootRunStatus({ success: false, executed: [{ success: false, status: 'FAILED' }], waiting: ['blocked'] })).toBe('failed')
    expect(resolveBatchRootRunStatus({ success: false, executed: [{ success: false, status: 'NEEDS_REVIEW' }], waiting: ['blocked'] })).toBe('failed')
  })
})
