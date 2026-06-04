import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/playwright",
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  webServer: [
    {
      command: "pnpm serve:gateway",
      url: "http://127.0.0.1:3001/health",
      reuseExistingServer: true,
      timeout: 10_000
    },
    {
      command: "pnpm serve:web",
      url: "http://127.0.0.1:5180",
      reuseExistingServer: true,
      timeout: 10_000
    }
  ],
  use: {
    baseURL: "http://127.0.0.1:5180",
    channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
    trace: "on-first-retry"
  },
  projects: [
    {
      name: "chrome",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
