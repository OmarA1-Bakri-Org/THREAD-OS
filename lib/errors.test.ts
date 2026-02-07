import { describe, expect, test } from 'bun:test'
import { z } from 'zod'
import {
  ThreadOSError,
  MprocsConnectionError,
  SequenceValidationError,
  StepNotFoundError,
  CircularDependencyError,
  ProcessTimeoutError,
  GateNotFoundError,
  PolicyViolationError,
  GroupNotFoundError,
} from './errors'

// ===========================================================================
// ThreadOSError (base class)
// ===========================================================================

describe('ThreadOSError', () => {
  test('has correct name, code, and message', () => {
    const err = new ThreadOSError('something broke', 'SOME_CODE')
    expect(err.name).toBe('ThreadOSError')
    expect(err.code).toBe('SOME_CODE')
    expect(err.message).toBe('something broke')
  })

  test('is instanceof Error', () => {
    const err = new ThreadOSError('x', 'Y')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(ThreadOSError)
  })
})

// ===========================================================================
// MprocsConnectionError
// ===========================================================================

describe('MprocsConnectionError', () => {
  test('has correct name and code', () => {
    const err = new MprocsConnectionError('localhost:3000')
    expect(err.name).toBe('MprocsConnectionError')
    expect(err.code).toBe('MPROCS_CONNECTION_FAILED')
  })

  test('message includes address', () => {
    const err = new MprocsConnectionError('ws://127.0.0.1:8080')
    expect(err.message).toContain('ws://127.0.0.1:8080')
  })

  test('is instanceof ThreadOSError and Error', () => {
    const err = new MprocsConnectionError('addr')
    expect(err).toBeInstanceOf(ThreadOSError)
    expect(err).toBeInstanceOf(Error)
  })
})

// ===========================================================================
// SequenceValidationError
// ===========================================================================

describe('SequenceValidationError', () => {
  test('wraps ZodError and has correct name and code', () => {
    const schema = z.object({ name: z.string().min(1) })
    const result = schema.safeParse({ name: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const err = new SequenceValidationError(result.error)
      expect(err.name).toBe('SequenceValidationError')
      expect(err.code).toBe('SEQUENCE_VALIDATION_FAILED')
      expect(err.zodErrors).toBe(result.error)
    }
  })

  test('message includes Zod issue messages', () => {
    const schema = z.object({ name: z.string(), age: z.number() })
    const result = schema.safeParse({ name: 123, age: 'old' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const err = new SequenceValidationError(result.error)
      expect(err.message).toContain('Sequence validation failed')
      // Should contain at least one issue message
      expect(err.message.length).toBeGreaterThan('Sequence validation failed: '.length)
    }
  })

  test('is instanceof ThreadOSError', () => {
    const schema = z.string()
    const result = schema.safeParse(123)
    if (!result.success) {
      const err = new SequenceValidationError(result.error)
      expect(err).toBeInstanceOf(SequenceValidationError)
      expect(err).toBeInstanceOf(ThreadOSError)
      expect(err).toBeInstanceOf(Error)
    }
  })

  test('zodErrors property provides access to all issues', () => {
    const schema = z.object({
      a: z.string(),
      b: z.number(),
    })
    const result = schema.safeParse({ a: 42, b: 'x' })
    if (!result.success) {
      const err = new SequenceValidationError(result.error)
      expect(err.zodErrors.issues.length).toBeGreaterThanOrEqual(2)
    }
  })
})

// ===========================================================================
// StepNotFoundError
// ===========================================================================

describe('StepNotFoundError', () => {
  test('has correct name, code, and message', () => {
    const err = new StepNotFoundError('step-42')
    expect(err.name).toBe('StepNotFoundError')
    expect(err.code).toBe('STEP_NOT_FOUND')
    expect(err.message).toContain('step-42')
  })

  test('is instanceof ThreadOSError', () => {
    const err = new StepNotFoundError('x')
    expect(err).toBeInstanceOf(StepNotFoundError)
    expect(err).toBeInstanceOf(ThreadOSError)
    expect(err).toBeInstanceOf(Error)
  })
})

// ===========================================================================
// CircularDependencyError
// ===========================================================================

describe('CircularDependencyError', () => {
  test('has correct name and code', () => {
    const err = new CircularDependencyError(['a', 'b', 'a'])
    expect(err.name).toBe('CircularDependencyError')
    expect(err.code).toBe('CIRCULAR_DEPENDENCY')
  })

  test('message contains cycle path with arrows', () => {
    const err = new CircularDependencyError(['a', 'b', 'c', 'a'])
    expect(err.message).toContain('a -> b -> c -> a')
  })

  test('is instanceof ThreadOSError', () => {
    const err = new CircularDependencyError(['x', 'y'])
    expect(err).toBeInstanceOf(CircularDependencyError)
    expect(err).toBeInstanceOf(ThreadOSError)
    expect(err).toBeInstanceOf(Error)
  })
})

// ===========================================================================
// ProcessTimeoutError
// ===========================================================================

describe('ProcessTimeoutError', () => {
  test('has correct name, code, and message', () => {
    const err = new ProcessTimeoutError('step-slow', 30000)
    expect(err.name).toBe('ProcessTimeoutError')
    expect(err.code).toBe('PROCESS_TIMEOUT')
    expect(err.message).toContain('step-slow')
    expect(err.message).toContain('30000')
  })

  test('is instanceof ThreadOSError', () => {
    const err = new ProcessTimeoutError('s', 1000)
    expect(err).toBeInstanceOf(ProcessTimeoutError)
    expect(err).toBeInstanceOf(ThreadOSError)
    expect(err).toBeInstanceOf(Error)
  })
})

// ===========================================================================
// GateNotFoundError
// ===========================================================================

describe('GateNotFoundError', () => {
  test('has correct name, code, and message', () => {
    const err = new GateNotFoundError('gate-99')
    expect(err.name).toBe('GateNotFoundError')
    expect(err.code).toBe('GATE_NOT_FOUND')
    expect(err.message).toContain('gate-99')
  })

  test('is instanceof ThreadOSError', () => {
    const err = new GateNotFoundError('g')
    expect(err).toBeInstanceOf(GateNotFoundError)
    expect(err).toBeInstanceOf(ThreadOSError)
    expect(err).toBeInstanceOf(Error)
  })
})

// ===========================================================================
// PolicyViolationError
// ===========================================================================

describe('PolicyViolationError', () => {
  test('has correct name, code, and message', () => {
    const err = new PolicyViolationError('rm -rf /', 'too dangerous')
    expect(err.name).toBe('PolicyViolationError')
    expect(err.code).toBe('POLICY_VIOLATION')
    expect(err.message).toContain('rm -rf /')
    expect(err.message).toContain('too dangerous')
  })

  test('is instanceof ThreadOSError', () => {
    const err = new PolicyViolationError('x', 'y')
    expect(err).toBeInstanceOf(PolicyViolationError)
    expect(err).toBeInstanceOf(ThreadOSError)
    expect(err).toBeInstanceOf(Error)
  })
})

// ===========================================================================
// GroupNotFoundError
// ===========================================================================

describe('GroupNotFoundError', () => {
  test('has correct name, code, and message', () => {
    const err = new GroupNotFoundError('group-abc')
    expect(err.name).toBe('GroupNotFoundError')
    expect(err.code).toBe('GROUP_NOT_FOUND')
    expect(err.message).toContain('group-abc')
  })

  test('is instanceof ThreadOSError', () => {
    const err = new GroupNotFoundError('g')
    expect(err).toBeInstanceOf(GroupNotFoundError)
    expect(err).toBeInstanceOf(ThreadOSError)
    expect(err).toBeInstanceOf(Error)
  })
})

// ===========================================================================
// Cross-class instanceof checks
// ===========================================================================

describe('cross-class instanceof', () => {
  test('different error types are not instanceof each other', () => {
    const step = new StepNotFoundError('x')
    const gate = new GateNotFoundError('x')
    const circular = new CircularDependencyError(['a', 'b'])

    // Each is its own type but not the others
    expect(step).not.toBeInstanceOf(GateNotFoundError)
    expect(step).not.toBeInstanceOf(CircularDependencyError)
    expect(gate).not.toBeInstanceOf(StepNotFoundError)
    expect(circular).not.toBeInstanceOf(StepNotFoundError)
  })

  test('all errors are instanceof ThreadOSError', () => {
    const errors = [
      new ThreadOSError('x', 'X'),
      new MprocsConnectionError('addr'),
      new StepNotFoundError('s'),
      new CircularDependencyError(['a']),
      new ProcessTimeoutError('s', 1000),
      new GateNotFoundError('g'),
      new PolicyViolationError('a', 'r'),
      new GroupNotFoundError('g'),
    ]
    for (const err of errors) {
      expect(err).toBeInstanceOf(ThreadOSError)
      expect(err).toBeInstanceOf(Error)
    }
  })
})
