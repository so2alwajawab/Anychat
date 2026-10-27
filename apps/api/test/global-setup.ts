import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { Client } from 'pg';

const ADMIN_URL =
  process.env.TEST_ADMIN_DATABASE_URL ??
  'postgresql://anychat:anychat-dev@127.0.0.1:15432/postgres';
const TEST_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://anychat:anychat-dev@127.0.0.1:15432/anychat_test?schema=public';

const apiDir = fileURLToPath(new URL('../', import.meta.url));

async function ensureDatabase(): Promise<void> {
  const dbName = new URL(TEST_URL).pathname.replace(/^\//, '').split('?')[0] ?? 'anychat_test';
  try {
    const admin = new Client({ connectionString: ADMIN_URL });
    await admin.connect();
    try {
      const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
      if ((exists.rowCount ?? 0) === 0) {
        await admin.query(`CREATE DATABASE ${dbName}`);
      }
    } finally {
      await admin.end();
    }
    return;
  } catch (err) {
    // No admin access — fall through and verify the database itself is reachable.
    const probe = new Client({ connectionString: TEST_URL });
    try {
      await probe.connect();
      await probe.end();
      return;
    } catch {
      throw err;
    }
  }
}

export default async function globalSetup(): Promise<void> {
  await ensureDatabase();

  // Sync schema (non-destructive; per-test cleanup truncates rows).
  execFileSync(
    process.execPath,
    [
      join(apiDir, 'node_modules', 'prisma', 'build', 'index.js'),
      'db',
      'push',
    ],
    {
      cwd: apiDir,
      env: { ...process.env, DATABASE_URL: TEST_URL },
      stdio: 'inherit',
    },
  );
}
