import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  testMatch: ['voice-permission-race.spec.ts', 'voice.spec.ts', 'evening-ritual.spec.ts'],
  timeout: 30_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL: 'http://127.0.0.1:4683',
    actionTimeout: 7_000,
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {},
  },
  webServer: [{ command: 'npm run dev -- --host 127.0.0.1 --port 4683 --strictPort', url: 'http://127.0.0.1:4683', reuseExistingServer: false, timeout: 120_000 }],
})
