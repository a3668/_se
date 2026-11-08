import { defineConfig } from '@playwright/test'

if (!process.env.HW5_E2E_BASE_URL) {
  throw new Error('請從 hw5 執行 bash tests/e2e/test.sh，以隔離資料庫與服務')
}

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 30_000,
  globalTimeout: 10 * 60_000,
  expect: { timeout: 5000 },
  outputDir: 'artifacts/results',
  reporter: [
    ['list'],
    ['json', { outputFile: 'artifacts/results.json' }],
    ['html', { outputFolder: 'artifacts/html', open: 'never' }],
  ],
  use: {
    baseURL: process.env.HW5_E2E_BASE_URL,
    browserName: 'chromium',
    channel: 'chromium',
    headless: true,
    viewport: { width: 1440, height: 1000 },
    locale: 'zh-TW',
    timezoneId: 'Asia/Taipei',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
})
