import { afterEach, describe, expect, test } from 'bun:test'
import { delimiter, dirname } from 'path'
import { createVerifyConfig } from './playwright.verify.shared'

const originalBunBin = process.env.BUN_BIN
const originalPath = process.env.PATH

afterEach(() => {
  if (originalBunBin === undefined) delete process.env.BUN_BIN
  else process.env.BUN_BIN = originalBunBin
  process.env.PATH = originalPath
})

describe('verification Playwright config', () => {
  test('prepends the explicit Bun directory using the host PATH delimiter', () => {
    process.env.BUN_BIN = 'C:\\Users\\tester\\.bun\\bin\\bun.exe'
    process.env.PATH = ['C:\\Windows\\System32', 'C:\\Program Files\\nodejs'].join(delimiter)

    const config = createVerifyConfig({
      mode: 'local',
      testMatch: '**/*.verify.e2e.ts',
      webServerCommand: 'node scripts/verify/web-server.mjs local',
    })
    const webServer = config.webServer as { env?: Record<string, string> }
    const configuredPath = webServer.env?.PATH ?? ''

    expect(configuredPath.split(delimiter)[0]).toBe(dirname(process.env.BUN_BIN))
    expect(configuredPath).toContain(process.env.PATH)
  })
})