// The e2e tests use their own schema ("test") in the same database, so they never touch the dev data.
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://tasks:tasks@localhost:5433/tasks?schema=test';
process.env.DATABASE_URL = TEST_DATABASE_URL;
