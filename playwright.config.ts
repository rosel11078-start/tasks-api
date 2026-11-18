import { defineConfig } from '@playwright/test';

// Black-box tests: the built API runs as a real process (as in production) on its own port and
// database schema, and the tests only talk to it over HTTP.
const PORT = 3100;
const DATABASE_URL =
  process.env.PW_DATABASE_URL ?? 'postgresql://tasks:tasks@localhost:5433/tasks?schema=playwright';

export default defineConfig({
  testDir: './playwright',
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: 'npm run build && npx prisma migrate deploy && node dist/main.js',
    url: `http://localhost:${PORT}/tasks`,
    env: { PORT: String(PORT), DATABASE_URL },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
