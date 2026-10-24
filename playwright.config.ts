import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: {
    channel: 'chrome',
    headless: true,
    baseURL: 'http://localhost:5173',
    viewport: { width: 360, height: 740 },
    hasTouch: true,
    isMobile: true,
  },
  webServer: { command: 'npm run dev', url: 'http://localhost:5173', reuseExistingServer: true },
});
