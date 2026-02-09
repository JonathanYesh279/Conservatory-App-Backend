import { defineConfig } from 'vitest/config'
import path from 'path'

/**
 * Vitest configuration for Phase 2 integration tests.
 * These tests mock the DB layer directly and don't need
 * MongoDB Memory Server or the global test setup.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: [
      'test/integration/auth.integration.test.js',
      'test/integration/idor-prevention.integration.test.js',
      'test/integration/enrollment.integration.test.js',
      'test/integration/attendance.integration.test.js',
      'test/integration/student-lifecycle.integration.test.js',
    ],
    // No setupFiles — these tests handle their own mocking
    testTimeout: 30000,
    hookTimeout: 20000,
    pool: 'forks',
    maxConcurrency: 3,
    env: {
      NODE_ENV: 'test',
      ACCESS_TOKEN_SECRET: 'test-access-secret',
      REFRESH_TOKEN_SECRET: 'test-refresh-secret',
      LOG_LEVEL: 'silent',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './'),
    },
  },
})
