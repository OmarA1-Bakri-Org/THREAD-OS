import { describe, expect, test } from 'bun:test'
import { buildComposioExecuteCommand } from './composio-cli'

describe('Composio CLI command contract', () => {
  test('uses the installed execute --params contract', () => {
    expect(buildComposioExecuteCommand('composio', {
      toolSlug: 'APOLLO_TEST',
      arguments: { team: 'growth' },
    })).toEqual(['composio', 'execute', 'APOLLO_TEST', '--params', '{"team":"growth"}'])
  })
})
