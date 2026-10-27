import { defineConfig } from 'vitest/config';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://anychat:anychat-dev@127.0.0.1:15432/anychat_test?schema=public';
const TEST_REDIS_URL =
  process.env.TEST_REDIS_URL ?? 'redis://:anychat-dev@127.0.0.1:6379/1';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    fileParallelism: false,
    globalSetup: ['./test/global-setup.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DATABASE_URL,
      REDIS_URL: TEST_REDIS_URL,
      LOG_LEVEL: 'silent',
      API_PORT: '4100',
      API_BASE_URL: 'http://localhost:4100',
      TRUST_PROXY_HOPS: '0',
      APP_ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      PUBLIC_BASE_URL: 'http://localhost:3100',
    },
  },
});
