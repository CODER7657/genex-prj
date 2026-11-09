import { defineConfig, devices } from '@playwright/test';

// End-to-end UI checks against the production build (vite preview on a fixed port).
// Every /api call is mocked in the tests, so no backend is needed.
const PORT = 4319;

export default defineConfig({
    testDir: './e2e',
    timeout: 30_000,
    expect: { timeout: 5_000 },
    fullyParallel: true,
    workers: 2,
    retries: 0,
    reporter: [['list']],
    use: {
        baseURL: `http://localhost:${PORT}`,
        ...devices['Desktop Chrome'],
        reducedMotion: 'reduce',
    },
    webServer: {
        command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: false,
        timeout: 120_000,
    },
});
