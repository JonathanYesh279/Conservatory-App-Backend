import { defineConfig } from 'vitest/config'
import baseConfig from './vitest.config.js'

/**
 * Vitest configuration for unit tests
 * Uses mocked MongoDB service for fast, isolated testing
 */
export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ['test/unit/**/*.test.js'],
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache', 'test/integration', 'test/performance'],
    testTimeout: 5000, // Shorter timeout for unit tests
    hookTimeout: 3000,
    teardownTimeout: 2000,
    maxConcurrency: 10, // Can run more unit tests in parallel
    env: {
      ...baseConfig.test.env,
      NODE_ENV: 'test',
      TEST_TYPE: 'unit',
      USE_MEMORY_DB: 'false', // Use mocked DB for unit tests
      LOG_LEVEL: 'error' // Minimal logging for unit tests
    }
  }
});