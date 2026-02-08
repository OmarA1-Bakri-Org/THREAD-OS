import { describe, test, expect } from 'bun:test'
import { validateDAG, topologicalSort } from './dag'
import { CircularDependencyError } from '../errors'
import { makeSequence, makeStep } from '../../test/helpers/setup'

describe('validateDAG', () => {
  test('accepts valid DAG (no cycle)', () => {
    const seq = makeSequence({
      steps: [
        makeStep({ id: 'a' }),
        makeStep({ id: 'b', depends_on: ['a'] }),
        makeStep({ id: 'c', depends_on: ['b'] }),
      ],
    })
    expect(() => validateDAG(seq)).not.toThrow()
  })

  test('detects single cycle (a→b→a)', () => {
    const seq = makeSequence({
      steps: [
        makeStep({ id: 'a', depends_on: ['b'] }),
        makeStep({ id: 'b', depends_on: ['a'] }),
      ],
    })
    expect(() => validateDAG(seq)).toThrow(CircularDependencyError)
  })

  test('accepts diamond pattern (no cycle)', () => {
    const seq = makeSequence({
      steps: [
        makeStep({ id: 'a' }),
        makeStep({ id: 'b', depends_on: ['a'] }),
        makeStep({ id: 'c', depends_on: ['a'] }),
        makeStep({ id: 'd', depends_on: ['b', 'c'] }),
      ],
    })
    expect(() => validateDAG(seq)).not.toThrow()
  })

  test('detects multi-node cycle', () => {
    const seq = makeSequence({
      steps: [
        makeStep({ id: 'a', depends_on: ['c'] }),
        makeStep({ id: 'b', depends_on: ['a'] }),
        makeStep({ id: 'c', depends_on: ['b'] }),
      ],
    })
    expect(() => validateDAG(seq)).toThrow(CircularDependencyError)
  })

  test('accepts isolated nodes', () => {
    const seq = makeSequence({
      steps: [
        makeStep({ id: 'a' }),
        makeStep({ id: 'b' }),
      ],
    })
    expect(() => validateDAG(seq)).not.toThrow()
  })

  test('accepts empty graph', () => {
    const seq = makeSequence({ steps: [] })
    expect(() => validateDAG(seq)).not.toThrow()
  })
})

describe('topologicalSort', () => {
  test('returns correct order for linear chain', () => {
    const seq = makeSequence({
      steps: [
        makeStep({ id: 'c', depends_on: ['b'] }),
        makeStep({ id: 'b', depends_on: ['a'] }),
        makeStep({ id: 'a' }),
      ],
    })
    const order = topologicalSort(seq)
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'))
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('c'))
  })

  test('returns all nodes for empty deps', () => {
    const seq = makeSequence({
      steps: [makeStep({ id: 'a' }), makeStep({ id: 'b' })],
    })
    const order = topologicalSort(seq)
    expect(order).toHaveLength(2)
  })
})
