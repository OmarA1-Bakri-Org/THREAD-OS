import { describe, expect, test } from 'bun:test'

describe('manual Playwright verification config', () => {
  test('uses the established PLAYWRIGHT environment variable names', async () => {
    process.env.PLAYWRIGHT_PORT = '4999'
    process.env.PLAYWRIGHT_BASE_URL = 'http://127.0.0.1:4999'
    process.env.PLAYWRIGHT_ARTIFACTS_DIR = 'tmp/manual-artifacts'
    process.env.PLAYWRIGHT_STORAGE_STATE_PATH = 'tmp/manual-auth.json'
    process.env.PLAYWRIGHT_JSON_REPORT_PATH = 'tmp/manual-report.json'
    const config = (await import('./playwright.manual-local.config')).default
    expect(config.use?.baseURL).toBe('http://127.0.0.1:4999')
    expect(config.use?.storageState).toBe('tmp/manual-auth.json')
    expect(config.outputDir).toBe('tmp/manual-artifacts/playwright-output')
    expect(config.reporter).toContainEqual(['json', { outputFile: 'tmp/manual-report.json' }])
  })
})
