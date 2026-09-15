import { defineConfig, devices } from "@playwright/test";

/**
 * Records a ~60–90s walkthrough to test-results/demo-video/
 * Usage: pnpm demo:record
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "demo-record.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  use: {
    // Prefer workers.dev — roomy.page custom domain can 522 on bare /workbench?query
    baseURL:
      process.env.DEMO_BASE_URL &&
      !process.env.DEMO_BASE_URL.includes("roomy.page")
        ? process.env.DEMO_BASE_URL
        : "https://roomy-page-workbench.hommy.workers.dev",
    trace: "off",
    video: { mode: "on", size: { width: 1280, height: 720 } },
    viewport: { width: 1280, height: 720 },
  },
  outputDir: "test-results/demo-video",
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
