import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: 'media-durability-regressions.spec.ts',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  use: { baseURL: 'http://127.0.0.1:4674', headless: true, launchOptions: { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 4674 --strictPort', url: 'http://127.0.0.1:4674', reuseExistingServer: false, timeout: 120_000 },
})
