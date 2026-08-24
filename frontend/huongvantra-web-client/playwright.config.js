import { defineConfig, devices } from '@playwright/test'

// QA-02: E2E smoke/regression chay duoc tren clean setup (npm ci && npm run test:e2e).
// Cac spec chan API o tang network (page.route) nen KHONG can docker stack backend.
const PORT = Number(process.env.E2E_PORT ?? 5173)
const BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 30_000,
  expect: { timeout: 7_000 },

  // Bang chung khi fail: HTML report + screenshot + trace + video.
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['list'], ['github']]
    : [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: BASE_URL,
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],

  // Tu bat Vite dev server. reuseExistingServer de dev chay lai nhanh.
  webServer: {
    command: `npm run dev -- --port ${PORT} --host 127.0.0.1`,
    url: BASE_URL,
    // Tro API base ve chinh origin cua dev server: page.route chan sach, khong CORS preflight,
    // va khong the vo tinh goi gateway :5000 that.
    env: { VITE_API_BASE_URL: BASE_URL },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
