import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { PolicyEngine } from './engine'
import type { PolicyFile } from './schema'
import { PolicyFileSchema } from './schema'
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import YAML from 'yaml'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'threados-test-'))
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

function defaultPolicy(): PolicyFile {
  return PolicyFileSchema.parse({})
}

async function writePolicyFile(basePath: string, policy: Record<string, unknown>): Promise<void> {
  const dir = join(basePath, '.threados')
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'policy.yaml'), YAML.stringify(policy), 'utf-8')
}

// ===========================================================================
// Constructor & defaults
// ===========================================================================

describe('PolicyEngine constructor', () => {
  test('uses default policy when none provided', () => {
    const engine = new PolicyEngine('/fake/path')
    const policy = engine.getPolicy()
    expect(policy.mode).toBe('SAFE')
    expect(policy.max_fanout).toBe(10)
    expect(policy.max_concurrent).toBe(20)
  })

  test('uses provided policy', () => {
    const custom: PolicyFile = {
      ...defaultPolicy(),
      mode: 'POWER',
      max_fanout: 5,
    }
    const engine = new PolicyEngine('/fake', custom)
    expect(engine.getMode()).toBe('POWER')
    expect(engine.getPolicy().max_fanout).toBe(5)
  })
})

// ===========================================================================
// PolicyEngine.load
// ===========================================================================

describe('PolicyEngine.load', () => {
  test('loads policy from file', async () => {
    await writePolicyFile(tmpDir, { mode: 'POWER', max_fanout: 3 })

    const engine = await PolicyEngine.load(tmpDir)
    expect(engine.getMode()).toBe('POWER')
    expect(engine.getPolicy().max_fanout).toBe(3)
  })

  test('uses defaults when policy file is missing', async () => {
    const engine = await PolicyEngine.load(tmpDir)
    expect(engine.getMode()).toBe('SAFE')
    expect(engine.getPolicy().max_fanout).toBe(10)
    expect(engine.getPolicy().max_concurrent).toBe(20)
  })

  test('applies schema defaults for omitted fields in file', async () => {
    await writePolicyFile(tmpDir, { mode: 'POWER' })

    const engine = await PolicyEngine.load(tmpDir)
    expect(engine.getMode()).toBe('POWER')
    // Other fields should have their defaults
    expect(engine.getPolicy().max_fanout).toBe(10)
    expect(engine.getPolicy().max_concurrent).toBe(20)
  })
})

// ===========================================================================
// getMode / setMode
// ===========================================================================

describe('getMode / setMode', () => {
  test('getMode returns current mode', () => {
    const engine = new PolicyEngine('/fake')
    expect(engine.getMode()).toBe('SAFE')
  })

  test('setMode changes the mode', () => {
    const engine = new PolicyEngine('/fake')
    engine.setMode('POWER')
    expect(engine.getMode()).toBe('POWER')
    engine.setMode('SAFE')
    expect(engine.getMode()).toBe('SAFE')
  })
})

// ===========================================================================
// validate - command allowlist
// ===========================================================================

describe('validate - command allowlist', () => {
  test('default policy allows known safe commands', () => {
    const engine = new PolicyEngine('/fake')
    const safe = ['claude', 'codex', 'gemini', 'bun', 'npm', 'npx', 'node', 'git', 'tsc']

    for (const cmd of safe) {
      const result = engine.validate({ type: 'run.step', command: `${cmd} --version` })
      expect(result.allowed).toBe(true)
    }
  })

  test('default policy blocks unknown commands', () => {
    const engine = new PolicyEngine('/fake')
    const result = engine.validate({ type: 'run.step', command: 'curl http://evil.com' })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('curl')
    expect(result.reason).toContain('not in the allowed commands list')
  })

  test('empty allowed_commands list allows any command (no restriction)', () => {
    const policy: PolicyFile = { ...defaultPolicy(), allowed_commands: [] }
    const engine = new PolicyEngine('/fake', policy)
    const result = engine.validate({ type: 'run.step', command: 'curl http://example.com' })
    // With an empty allowlist, the check is skipped
    expect(result.allowed).toBe(true)
  })

  test('custom allowlist restricts to listed commands only', () => {
    const policy: PolicyFile = { ...defaultPolicy(), allowed_commands: ['python', 'pip'] }
    const engine = new PolicyEngine('/fake', policy)

    expect(engine.validate({ type: 'run.step', command: 'python script.py' }).allowed).toBe(true)
    expect(engine.validate({ type: 'run.step', command: 'pip install foo' }).allowed).toBe(true)
    expect(engine.validate({ type: 'run.step', command: 'node index.js' }).allowed).toBe(false)
  })

  test('command base is extracted by splitting on whitespace', () => {
    const policy: PolicyFile = { ...defaultPolicy(), allowed_commands: ['echo'] }
    const engine = new PolicyEngine('/fake', policy)

    const result = engine.validate({ type: 'run.step', command: 'echo hello world' })
    expect(result.allowed).toBe(true)
  })

  test('full path commands match if basename matches', () => {
    const engine = new PolicyEngine('/fake')
    const result = engine.validate({ type: 'run.step', command: '/usr/local/bin/git status' })
    expect(result.allowed).toBe(true)
  })

  test('actions without command skip allowlist check', () => {
    const engine = new PolicyEngine('/fake')
    const result = engine.validate({ type: 'step.add' })
    expect(result.allowed).toBe(true)
  })
})

// ===========================================================================
// validate - forbidden patterns
// ===========================================================================

describe('validate - forbidden patterns', () => {
  test('default policy blocks rm -rf / via forbidden pattern', () => {
    // Use a policy with 'rm' allowed so we reach the forbidden pattern check
    const policy: PolicyFile = {
      ...defaultPolicy(),
      allowed_commands: ['rm'],
    }
    const engine = new PolicyEngine('/fake', policy)
    const result = engine.validate({ type: 'run.step', command: 'rm -rf /' })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('forbidden pattern')
  })

  test('default policy blocks sudo', () => {
    // Need to ensure "sudo" is in allowed commands or use empty allowlist
    const policy: PolicyFile = { ...defaultPolicy(), allowed_commands: [] }
    const eng = new PolicyEngine('/fake', policy)

    const result = eng.validate({ type: 'run.step', command: 'sudo apt install' })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('forbidden pattern')
  })

  test('custom forbidden pattern blocks matching command', () => {
    const policy: PolicyFile = {
      ...defaultPolicy(),
      allowed_commands: [],
      forbidden_patterns: ['DROP\\s+TABLE', 'DELETE\\s+FROM'],
    }
    const engine = new PolicyEngine('/fake', policy)

    const r1 = engine.validate({ type: 'run.step', command: 'psql -c "DROP TABLE users"' })
    expect(r1.allowed).toBe(false)

    const r2 = engine.validate({ type: 'run.step', command: 'psql -c "DELETE FROM users"' })
    expect(r2.allowed).toBe(false)

    const r3 = engine.validate({ type: 'run.step', command: 'psql -c "SELECT * FROM users"' })
    expect(r3.allowed).toBe(true)
  })

  test('forbidden pattern matching is case-insensitive', () => {
    const policy: PolicyFile = {
      ...defaultPolicy(),
      allowed_commands: [],
      forbidden_patterns: ['sudo'],
    }
    const engine = new PolicyEngine('/fake', policy)

    const result = engine.validate({ type: 'run.step', command: 'SUDO reboot' })
    expect(result.allowed).toBe(false)
  })

  test('no forbidden patterns means nothing blocked by pattern', () => {
    const policy: PolicyFile = { ...defaultPolicy(), allowed_commands: [], forbidden_patterns: [] }
    const engine = new PolicyEngine('/fake', policy)

    const result = engine.validate({ type: 'run.step', command: 'rm -rf / --no-preserve-root' })
    expect(result.allowed).toBe(true)
  })
})

// ===========================================================================
// validate - fanout limit
// ===========================================================================

describe('validate - fanout limit', () => {
  test('fanout within limit is allowed', () => {
    const engine = new PolicyEngine('/fake')
    const result = engine.validate({ type: 'step.add', fanout: 10 })
    expect(result.allowed).toBe(true)
  })

  test('fanout exceeding limit is blocked', () => {
    const engine = new PolicyEngine('/fake')
    const result = engine.validate({ type: 'step.add', fanout: 11 })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('Fanout')
    expect(result.reason).toContain('exceeds maximum')
  })

  test('custom max_fanout is enforced', () => {
    const policy: PolicyFile = { ...defaultPolicy(), max_fanout: 3 }
    const engine = new PolicyEngine('/fake', policy)

    expect(engine.validate({ type: 'step.add', fanout: 3 }).allowed).toBe(true)
    expect(engine.validate({ type: 'step.add', fanout: 4 }).allowed).toBe(false)
  })

  test('action without fanout field skips fanout check', () => {
    const engine = new PolicyEngine('/fake')
    const result = engine.validate({ type: 'step.add' })
    expect(result.allowed).toBe(true)
  })
})

// ===========================================================================
// validate - concurrent limit
// ===========================================================================

describe('validate - concurrent limit', () => {
  test('concurrent below limit is allowed', () => {
    const engine = new PolicyEngine('/fake')
    const result = engine.validate({ type: 'run.step', concurrent: 19 })
    expect(result.allowed).toBe(true)
  })

  test('concurrent at limit is blocked', () => {
    const engine = new PolicyEngine('/fake')
    // Default max_concurrent is 20; at 20 it should be blocked (>= check)
    const result = engine.validate({ type: 'run.step', concurrent: 20 })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('Concurrent')
    expect(result.reason).toContain('exceed maximum')
  })

  test('concurrent above limit is blocked', () => {
    const engine = new PolicyEngine('/fake')
    const result = engine.validate({ type: 'run.step', concurrent: 100 })
    expect(result.allowed).toBe(false)
  })

  test('custom max_concurrent is enforced', () => {
    const policy: PolicyFile = { ...defaultPolicy(), max_concurrent: 5 }
    const engine = new PolicyEngine('/fake', policy)

    expect(engine.validate({ type: 'run.step', concurrent: 4 }).allowed).toBe(true)
    expect(engine.validate({ type: 'run.step', concurrent: 5 }).allowed).toBe(false)
  })
})

// ===========================================================================
// validate - SAFE mode confirmation
// ===========================================================================

describe('validate - SAFE mode confirmation', () => {
  test('SAFE mode requires confirmation on run.* actions', () => {
    const engine = new PolicyEngine('/fake')
    expect(engine.getMode()).toBe('SAFE')

    const r1 = engine.validate({ type: 'run.step' })
    expect(r1.allowed).toBe(true)
    expect(r1.confirmation_required).toBe(true)

    const r2 = engine.validate({ type: 'run.all' })
    expect(r2.allowed).toBe(true)
    expect(r2.confirmation_required).toBe(true)
  })

  test('SAFE mode does not require confirmation on non-run actions', () => {
    const engine = new PolicyEngine('/fake')
    const result = engine.validate({ type: 'step.add' })
    expect(result.allowed).toBe(true)
    expect(result.confirmation_required).toBe(false)
  })

  test('default confirmation_required list includes step.rm, gate.block, run.all', () => {
    const engine = new PolicyEngine('/fake')

    // step.rm and gate.block are always in confirmation_required
    const r1 = engine.validate({ type: 'step.rm' })
    expect(r1.confirmation_required).toBe(true)

    const r2 = engine.validate({ type: 'gate.block' })
    expect(r2.confirmation_required).toBe(true)

    // run.all is both in the list AND matches run.*
    const r3 = engine.validate({ type: 'run.all' })
    expect(r3.confirmation_required).toBe(true)
  })
})

// ===========================================================================
// validate - POWER mode confirmation
// ===========================================================================

describe('validate - POWER mode confirmation', () => {
  test('POWER mode does not require confirmation for non-listed run actions', () => {
    const policy: PolicyFile = { ...defaultPolicy(), mode: 'POWER' }
    const engine = new PolicyEngine('/fake', policy)

    // run.step is NOT in the default confirmation_required list
    const result = engine.validate({ type: 'run.step' })
    expect(result.allowed).toBe(true)
    expect(result.confirmation_required).toBe(false)
  })

  test('POWER mode still requires confirmation for actions in confirmation_required list', () => {
    const policy: PolicyFile = { ...defaultPolicy(), mode: 'POWER' }
    const engine = new PolicyEngine('/fake', policy)

    // step.rm is in the default confirmation_required list
    const result = engine.validate({ type: 'step.rm' })
    expect(result.allowed).toBe(true)
    expect(result.confirmation_required).toBe(true)
  })

  test('POWER mode requires confirmation for run.all (in list)', () => {
    const policy: PolicyFile = { ...defaultPolicy(), mode: 'POWER' }
    const engine = new PolicyEngine('/fake', policy)

    // run.all is in the default confirmation_required list
    const result = engine.validate({ type: 'run.all' })
    expect(result.allowed).toBe(true)
    expect(result.confirmation_required).toBe(true)
  })
})

// ===========================================================================
// validate - CWD restriction
// ===========================================================================

describe('validate - CWD restriction', () => {
  test('default allowed_cwd (./**) allows any path', () => {
    const engine = new PolicyEngine('/fake')
    // The ./** pattern uses startsWith('.') after stripping /**, so let's test with
    // a relative path that would match
    const result2 = engine.validate({ type: 'run.step', cwd: './src/lib' })
    expect(result2.allowed).toBe(true)
  })

  test('custom allowed_cwd restricts working directory', () => {
    const policy: PolicyFile = {
      ...defaultPolicy(),
      allowed_commands: [],
      allowed_cwd: ['/home/user/project/**'],
    }
    const engine = new PolicyEngine('/fake', policy)

    const r1 = engine.validate({ type: 'run.step', cwd: '/home/user/project/src' })
    expect(r1.allowed).toBe(true)

    const r2 = engine.validate({ type: 'run.step', cwd: '/tmp/evil' })
    expect(r2.allowed).toBe(false)
    expect(r2.reason).toContain('not in allowed paths')
  })

  test('empty allowed_cwd list allows any path (no restriction)', () => {
    const policy: PolicyFile = { ...defaultPolicy(), allowed_commands: [], allowed_cwd: [] }
    const engine = new PolicyEngine('/fake', policy)

    const result = engine.validate({ type: 'run.step', cwd: '/anything' })
    expect(result.allowed).toBe(true)
  })

  test('action without cwd skips CWD check', () => {
    const policy: PolicyFile = {
      ...defaultPolicy(),
      allowed_commands: [],
      allowed_cwd: ['/only/here/**'],
    }
    const engine = new PolicyEngine('/fake', policy)

    const result = engine.validate({ type: 'run.step' })
    expect(result.allowed).toBe(true)
  })
})

// ===========================================================================
// validate - combined checks
// ===========================================================================

describe('validate - combined checks', () => {
  test('forbidden pattern takes precedence even if command is in allowlist', () => {
    // "git" is in allowed_commands, but "rm -rf /" pattern catches everything
    const policy: PolicyFile = {
      ...defaultPolicy(),
      allowed_commands: ['bash'],
      forbidden_patterns: ['--force'],
    }
    const engine = new PolicyEngine('/fake', policy)

    const result = engine.validate({ type: 'run.step', command: 'bash --force' })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('forbidden pattern')
  })

  test('allowlist check happens before forbidden pattern check', () => {
    // If command is not in allowlist, it should be blocked by allowlist, not pattern
    const engine = new PolicyEngine('/fake')
    const result = engine.validate({ type: 'run.step', command: 'wget http://evil.com' })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('not in the allowed commands list')
  })
})
