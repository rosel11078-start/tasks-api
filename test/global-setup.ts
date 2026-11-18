import { execSync } from 'node:child_process';
import { TEST_DATABASE_URL } from './test-env';

export default function globalSetup() {
  execSync('npx prisma migrate deploy', { env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL }, stdio: 'ignore' });
}
