import { describe, test, expect } from 'bun:test'
import {
  ThreadOSError,
  MprocsConnectionError,
  SequenceValidationError,
  StepNotFoundError,
  CircularDependencyError,
  GateNotFoundError,
  GroupNotFoundError,
  DependencyNotFoundError,
  InvalidTemplateError,
  ProcessTimeoutError,
} from './errors'
import { z } from 'zod'

describe('Error classes', () => {
  test('ThreadOSError has code and message', () => {
    const e = new ThreadOSError('test', 'TEST_CODE')
    expect(e.message).toBe('test')
    expect(e.code).toBe('TEST_CODE')
    expect(e).toBeInstanceOf(Error)
  })

  test('MprocsConnectionError', () => {
    const e = new MprocsConnectionError('localhost:8080')
    expect(e.code).toBe('MPROCS_CONNECTION_FAILED')
    expect(e.message).toContain('localhost:8080')
  })

  test('SequenceValidationError', () => {
    const schema = z.object({ name: z.string() })
    const result = schema.safeParse({})
    expect(result.success).toBe(false)
    if (!result.success) {
      const e = new SequenceValidationError(result.error)
      expect(e.code).toBe('SEQUENCE_VALIDATION_FAILED')
      expect(e.zodErrors).toBeDefined()
    }
  })

  test('StepNotFoundError', () => {
    const e = new StepNotFoundError('abc')
    expect(e.code).toBe('STEP_NOT_FOUND')
    expect(e.message).toContain('abc')
  })

  test('CircularDependencyError', () => {
    const e = new CircularDependencyError(['a', 'b', 'a'])
    expect(e.code).toBe('CIRCULAR_DEPENDENCY')
    expect(e.message).toContain('a -> b -> a')
  })

  test('GateNotFoundError', () => {
    const e = new GateNotFoundError('g1')
    expect(e.code).toBe('GATE_NOT_FOUND')
    expect(e.message).toContain('g1')
  })

  test('GroupNotFoundError', () => {
    const e = new GroupNotFoundError('grp')
    expect(e.code).toBe('GROUP_NOT_FOUND')
  })

  test('DependencyNotFoundError', () => {
    const e = new DependencyNotFoundError('s1', 'd1')
    expect(e.code).toBe('DEPENDENCY_NOT_FOUND')
    expect(e.message).toContain('d1')
  })

  test('InvalidTemplateError', () => {
    const e = new InvalidTemplateError('bad')
    expect(e.code).toBe('INVALID_TEMPLATE')
  })

  test('ProcessTimeoutError', () => {
    const e = new ProcessTimeoutError('s1', 5000)
    expect(e.code).toBe('PROCESS_TIMEOUT')
    expect(e.message).toContain('5000')
  })
})
