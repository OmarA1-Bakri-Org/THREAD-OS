import type { ZodError } from 'zod'

/**
 * Base error class for ThreadOS
 * All custom errors extend this class for consistent error handling
 */
export class ThreadOSError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message)
    this.name = 'ThreadOSError'
  }
}

/**
 * Thrown when unable to connect to mprocs server
 */
export class MprocsConnectionError extends ThreadOSError {
  constructor(address: string) {
    super(`Failed to connect to mprocs server at ${address}`, 'MPROCS_CONNECTION_FAILED')
    this.name = 'MprocsConnectionError'
  }
}

/**
 * Thrown when sequence.yaml validation fails
 */
export class SequenceValidationError extends ThreadOSError {
  constructor(public readonly zodErrors: ZodError) {
    super(
      `Sequence validation failed: ${zodErrors.issues.map(e => e.message).join(', ')}`,
      'SEQUENCE_VALIDATION_FAILED'
    )
    this.name = 'SequenceValidationError'
  }
}

/**
 * Thrown when a step cannot be found by ID
 */
export class StepNotFoundError extends ThreadOSError {
  constructor(stepId: string) {
    super(`Step not found: ${stepId}`, 'STEP_NOT_FOUND')
    this.name = 'StepNotFoundError'
  }
}

/**
 * Thrown when a circular dependency is detected in the DAG
 */
export class CircularDependencyError extends ThreadOSError {
  constructor(cycle: string[]) {
    super(`Circular dependency detected: ${cycle.join(' -> ')}`, 'CIRCULAR_DEPENDENCY')
    this.name = 'CircularDependencyError'
  }
}

/**
 * Thrown when a step execution exceeds its timeout
 */
export class ProcessTimeoutError extends ThreadOSError {
  constructor(stepId: string, timeoutMs: number) {
    super(`Step '${stepId}' timed out after ${timeoutMs}ms`, 'PROCESS_TIMEOUT')
    this.name = 'ProcessTimeoutError'
  }
}
