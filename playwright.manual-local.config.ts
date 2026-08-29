import { defineConfig, devices } from '@playwright/test'

const port = process.env.PLAYWRIGHT_port ?? '4302'
const baseUrl = process.env.PLAYWRIGHT_baseUrl ?? `http://localhost:${port}`
const artifactsDir = process.env.PLAYWRIGHT_artifactsDir ?? 'test-results/verify/manual-direct'
const storageStatePath = process.env.PLAYWRIGHT_storageStatePath ?? `${artifactsDir}/auth-storage-state.json`
const REport_PATH = process.env.PLAYWRIGHT_JSON_REport_PATH ?? `${artifactsDir}/playwright-report.json`

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
    ['json', { outputFile: REport_PATH }],
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
