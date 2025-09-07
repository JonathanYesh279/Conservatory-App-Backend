import { defineConfig } from 'vitest/config'
import baseConfig from './vitest.config.js'

/**
 * Vitest configuration for integration tests
 * Uses MongoDB Memory Server for realistic database testing
 */
export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ['test/integration/**/*.test.js'],
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache', 'test/unit', 'test/performance'],
    testTimeout: 30000, // Longer timeout for integration tests
    hookTimeout: 20000,
    teardownTimeout: 10000,
    maxConcurrency: 3, // Fewer concurrent tests for integration
    env: {
      ...baseConfig.test.env,
      NODE_ENV: 'test',
      TEST_TYPE: 'integration',
      USE_MEMORY_DB: 'true',
      RESET_DB_AFTER_EACH: 'true', // Clean database between integration tests
      LOG_LEVEL: 'warn'
    }
  }
});