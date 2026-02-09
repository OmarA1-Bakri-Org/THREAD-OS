import { describe, it, expect } from 'bun:test'
import { redactSecrets } from '../lib/audit/logger'

describe('audit/logger redactSecrets', () => {
  it('should redact actual secret keys', () => {
    expect(redactSecrets('key=abc123')).toBe('key=[REDACTED]')
    expect(redactSecrets('password=secret')).toBe('password=[REDACTED]')
    expect(redactSecrets('token=xyz789')).toBe('token=[REDACTED]')
    expect(redactSecrets('api_key=myapikey')).toBe('api_key=[REDACTED]')
    expect(redactSecrets('api-key=myapikey')).toBe('api-key=[REDACTED]')
    expect(redactSecrets('auth=myauth')).toBe('auth=[REDACTED]')
    expect(redactSecrets('credentials=mycreds')).toBe('credentials=[REDACTED]')
    expect(redactSecrets('private_key=myprivkey')).toBe('private_key=[REDACTED]')
    expect(redactSecrets('private-key=myprivkey')).toBe('private-key=[REDACTED]')
    expect(redactSecrets('access_token=mytoken')).toBe('access_token=[REDACTED]')
    expect(redactSecrets('access-token=mytoken')).toBe('access-token=[REDACTED]')
    expect(redactSecrets('bearer=mybearer')).toBe('bearer=[REDACTED]')
  })

  it('should NOT redact words containing "key" that are not secrets', () => {
    // These should NOT be redacted because "key" should only match at word boundaries
    expect(redactSecrets('monkey=123')).toBe('monkey=123')
    expect(redactSecrets('hotkey=456')).toBe('hotkey=456')
    expect(redactSecrets('turkey=789')).toBe('turkey=789')
    expect(redactSecrets('donkey=abc')).toBe('donkey=abc')
  })

  it('should handle mixed content correctly', () => {
    const input = 'user=john monkey=123 password=secret123 hotkey=ctrl'
    const expected = 'user=john monkey=123 password=[REDACTED] hotkey=ctrl'
    expect(redactSecrets(input)).toBe(expected)
  })

  it('should work with colon separator', () => {
    expect(redactSecrets('key:abc123')).toBe('key:[REDACTED]')
    expect(redactSecrets('password:secret')).toBe('password:[REDACTED]')
  })
})
