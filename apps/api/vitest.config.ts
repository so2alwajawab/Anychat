import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://anychat:anychat-dev@127.0.0.1:15432/anychat?schema=public',
      REDIS_URL: 'redis://:anychat-dev@127.0.0.1:6379/2',
      LOG_LEVEL: 'silent',
      API_PORT: '4100',
      API_BASE_URL: 'http://localhost:4100',
    },
  },
});
