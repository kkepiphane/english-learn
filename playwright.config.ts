import { defineConfig, devices } from '@playwright/test'

// E2E tests run against the production build served under the GitHub Pages sub-path,
// so the service worker, the base path and offline mode are tested exactly as deployed.
const BASE_PATH = '/english-path/'

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: `http://localhost:4173${BASE_PATH}`,
    ...devices['Pixel 7'],
    serviceWorkers: 'allow',
    // Optional: use a locally installed Chrome instead of the Playwright download.
    launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
  },
  webServer: {
    command: `BASE_PATH=${BASE_PATH} npx vite build && npx vite preview --port 4173 --strictPort --base ${BASE_PATH}`,
    url: `http://localhost:4173${BASE_PATH}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
