import { describe, expect, test } from 'bun:test'
import { validateDAG, topologicalSort } from './dag'
import { CircularDependencyError } from '../errors'
import type { Sequence, Step, Gate } from './schema'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStep(id: string, depends_on: string[] = []): Step {
  return {
    id,
    name: `Step ${id}`,
    type: 'base',
    model: 'claude-code',
    prompt_file: `prompts/${id}.md`,
    depends_on,
    status: 'READY',
  }
}

function makeGate(id: string, depends_on: string[]): Gate {
  return {
    id,
    name: `Gate ${id}`,
    depends_on,
    status: 'PENDING',
  }
}

function makeSequence(steps: Step[], gates: Gate[] = []): Sequence {
  return {
    version: '1.0',
    name: 'test-sequence',
    steps,
    gates,
  }
}

// ===========================================================================
// validateDAG
// ===========================================================================

describe('validateDAG', () => {
  test('empty sequence (no steps, no gates) does not throw', () => {
    const seq = makeSequence([], [])
    expect(() => validateDAG(seq)).not.toThrow()
  })

  test('single step with no deps does not throw', () => {
    const seq = makeSequence([makeStep('a')])
    expect(() => validateDAG(seq)).not.toThrow()
  })

  test('linear chain A -> B -> C does not throw', () => {
    const seq = makeSequence([
      makeStep('a'),
      makeStep('b', ['a']),
      makeStep('c', ['b']),
    ])
    expect(() => validateDAG(seq)).not.toThrow()
  })

  test('diamond dependency A->B, A->C, B->D, C->D does not throw', () => {
    const seq = makeSequence([
      makeStep('a'),
      makeStep('b', ['a']),
      makeStep('c', ['a']),
      makeStep('d', ['b', 'c']),
    ])
    expect(() => validateDAG(seq)).not.toThrow()
  })

  test('multiple isolated nodes do not throw', () => {
    const seq = makeSequence([
      makeStep('a'),
      makeStep('b'),
      makeStep('c'),
    ])
    expect(() => validateDAG(seq)).not.toThrow()
  })

  test('circular dependency A -> B -> A throws CircularDependencyError', () => {
    const seq = makeSequence([
      makeStep('a', ['b']),
      makeStep('b', ['a']),
    ])
    expect(() => validateDAG(seq)).toThrow(CircularDependencyError)
  })

  test('multi-node cycle A -> B -> C -> A throws CircularDependencyError', () => {
    const seq = makeSequence([
      makeStep('a', ['c']),
      makeStep('b', ['a']),
      makeStep('c', ['b']),
    ])
    expect(() => validateDAG(seq)).toThrow(CircularDependencyError)
  })

  test('self-loop (A -> A) throws CircularDependencyError', () => {
    const seq = makeSequence([makeStep('a', ['a'])])
    expect(() => validateDAG(seq)).toThrow(CircularDependencyError)
  })

  test('cycle error message contains cycle path', () => {
    const seq = makeSequence([
      makeStep('a', ['b']),
      makeStep('b', ['a']),
    ])
    try {
      validateDAG(seq)
      expect(true).toBe(false) // should not reach
    } catch (err) {
      expect(err).toBeInstanceOf(CircularDependencyError)
      const msg = (err as CircularDependencyError).message
      expect(msg).toContain('Circular dependency detected')
      expect(msg).toContain('a')
      expect(msg).toContain('b')
    }
  })

  test('mixed steps and gates with valid DAG does not throw', () => {
    const seq = makeSequence(
      [makeStep('build'), makeStep('test', ['build']), makeStep('deploy', ['review-gate'])],
      [makeGate('review-gate', ['test'])]
    )
    expect(() => validateDAG(seq)).not.toThrow()
  })

  test('mixed steps and gates with cycle through gate throws', () => {
    const seq = makeSequence(
      [makeStep('a', ['g']), makeStep('b', ['a'])],
      [makeGate('g', ['b'])]
    )
    expect(() => validateDAG(seq)).toThrow(CircularDependencyError)
  })

  test('dependency on non-existent node does not throw (graceful)', () => {
    // A step depends on an ID that doesn't exist in the graph.
    // validateDAG should still succeed because there's no cycle.
    const seq = makeSequence([makeStep('a', ['phantom'])])
    expect(() => validateDAG(seq)).not.toThrow()
  })

  test('large linear chain does not throw', () => {
    const steps: Step[] = []
    for (let i = 0; i < 100; i++) {
      steps.push(makeStep(`step-${i}`, i > 0 ? [`step-${i - 1}`] : []))
    }
    const seq = makeSequence(steps)
    expect(() => validateDAG(seq)).not.toThrow()
  })
})

// ===========================================================================
// topologicalSort
// ===========================================================================

describe('topologicalSort', () => {
  test('empty sequence returns empty array', () => {
    const seq = makeSequence([], [])
    expect(topologicalSort(seq)).toEqual([])
  })

  test('single node returns that node', () => {
    const seq = makeSequence([makeStep('a')])
    expect(topologicalSort(seq)).toEqual(['a'])
  })

  test('linear chain returns correct order', () => {
    const seq = makeSequence([
      makeStep('a'),
      makeStep('b', ['a']),
      makeStep('c', ['b']),
    ])
    const order = topologicalSort(seq)
    expect(order).toEqual(['a', 'b', 'c'])
  })

  test('diamond dependency respects all edges', () => {
    const seq = makeSequence([
      makeStep('a'),
      makeStep('b', ['a']),
      makeStep('c', ['a']),
      makeStep('d', ['b', 'c']),
    ])
    const order = topologicalSort(seq)

    // a must come first, d must come last
    expect(order.indexOf('a')).toBe(0)
    expect(order.indexOf('d')).toBe(3)

    // b and c must come after a
    expect(order.indexOf('b')).toBeGreaterThan(order.indexOf('a'))
    expect(order.indexOf('c')).toBeGreaterThan(order.indexOf('a'))

    // b and c must come before d
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('d'))
    expect(order.indexOf('c')).toBeLessThan(order.indexOf('d'))
  })

  test('isolated nodes are all included', () => {
    const seq = makeSequence([
      makeStep('x'),
      makeStep('y'),
      makeStep('z'),
    ])
    const order = topologicalSort(seq)
    expect(order).toHaveLength(3)
    expect(order).toContain('x')
    expect(order).toContain('y')
    expect(order).toContain('z')
  })

  test('mixed steps and gates appear in correct order', () => {
    const seq = makeSequence(
      [makeStep('build'), makeStep('test', ['build']), makeStep('deploy', ['review-gate'])],
      [makeGate('review-gate', ['test'])]
    )
    const order = topologicalSort(seq)

    expect(order.indexOf('build')).toBeLessThan(order.indexOf('test'))
    expect(order.indexOf('test')).toBeLessThan(order.indexOf('review-gate'))
    expect(order.indexOf('review-gate')).toBeLessThan(order.indexOf('deploy'))
  })

  test('returns all nodes in the sequence', () => {
    const seq = makeSequence(
      [makeStep('a'), makeStep('b', ['a'])],
      [makeGate('g', ['b'])]
    )
    const order = topologicalSort(seq)
    expect(order).toHaveLength(3)
    expect(order).toContain('a')
    expect(order).toContain('b')
    expect(order).toContain('g')
  })

  test('dependency on non-existent node is skipped gracefully', () => {
    // "a" depends on "phantom" which is not in the graph.
    // Kahn's algo should still produce a valid ordering.
    const seq = makeSequence([makeStep('a', ['phantom']), makeStep('b')])
    const order = topologicalSort(seq)
    // Both real nodes should be present
    expect(order).toContain('a')
    expect(order).toContain('b')
  })
})
