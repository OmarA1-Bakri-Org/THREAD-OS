import { describe, test, expect } from 'bun:test'
import YAML from 'yaml'
import { generateMprocsConfig, generateMprocsConfigObject } from './config'
import { makeSequence, makeStep } from '../../test/helpers/setup'

describe('generateMprocsConfig', () => {
  test('generates valid YAML for a sequence', () => {
    const seq = makeSequence({
      steps: [
        makeStep({ id: 'step-1', name: 'Step One', model: 'claude-code' }),
        makeStep({ id: 'step-2', name: 'Step Two', model: 'codex' }),
      ],
    })
    const yaml = generateMprocsConfig(seq)
    const parsed = YAML.parse(yaml)
    expect(parsed.server.host).toBe('127.0.0.1')
    expect(parsed.server.port).toBe(4050)
    expect(parsed.procs['step-1'].name).toBe('Step One')
    expect(parsed.procs['step-1'].cmd).toEqual(['claude', '--prompt-file', '.threados/prompts/test.md'])
    expect(parsed.procs['step-2'].cmd[0]).toBe('codex')
  })

  test('custom server options', () => {
    const seq = makeSequence({ steps: [makeStep()] })
    const yaml = generateMprocsConfig(seq, { serverHost: '0.0.0.0', serverPort: 9999 })
    const parsed = YAML.parse(yaml)
    expect(parsed.server.host).toBe('0.0.0.0')
    expect(parsed.server.port).toBe(9999)
  })

  test('autostart option', () => {
    const seq = makeSequence({ steps: [makeStep()] })
    const parsed = YAML.parse(generateMprocsConfig(seq, { autostart: true }))
    expect(parsed.procs['test-step'].autostart).toBe(true)
  })

  test('step with cwd', () => {
    const seq = makeSequence({ steps: [makeStep({ cwd: '/tmp/work' })] })
    const obj = generateMprocsConfigObject(seq)
    expect(obj.procs['test-step'].cwd).toBe('/tmp/work')
  })

  test('gemini model command', () => {
    const seq = makeSequence({ steps: [makeStep({ model: 'gemini' })] })
    const obj = generateMprocsConfigObject(seq)
    expect(obj.procs['test-step'].cmd[0]).toBe('gemini')
  })
})
