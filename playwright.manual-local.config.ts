import { defineConfig, devices } from '@playwright/test'

const port = process.env.PLAYWRIGHT_PORT ?? '4302'
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`
const artifactsDir = process.env.PLAYWRIGHT_ARTIFACTS_DIR ?? 'test-results/verify/manual-direct'
const storageStatePath = process.env.PLAYWRIGHT_STORAGE_STATE_PATH ?? `${artifactsDir}/auth-storage-state.json`
const reportPath = process.env.PLAYWRIGHT_JSON_REPORT_PATH ?? `${artifactsDir}/playwright-report.json`

export default defineConfig({
  testDir: './test/ui',
  testMatch: '**/workbench-envelope.verify.e2e.ts',
  timeout: 120_000,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  outputDir: `${artifactsDir}/playwright-output`,
  reporter: [
    ['list'],
    ['json', { outputFile: reportPath }],
  ],
  globalSetup: './test/ui/global-verify-setup.ts',
  use: {
    baseURL: baseUrl,
    storageState: storageStatePath,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
