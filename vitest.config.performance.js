import { defineConfig } from 'vitest/config'
import baseConfig from './vitest.config.js'

/**
 * Vitest configuration for performance tests
 * Optimized for performance benchmarking with longer timeouts
 */
export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ['test/performance/**/*.test.js'],
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache', 'test/unit', 'test/integration'],
    testTimeout: 60000, // Extended timeout for performance tests
    hookTimeout: 30000,
    teardownTimeout: 15000,
    maxConcurrency: 2, // Limited concurrency for accurate performance measurement
    minWorkers: 1,
    maxWorkers: 2,
    env: {
      ...baseConfig.test.env,
      NODE_ENV: 'test',
      TEST_TYPE: 'performance',
      USE_MEMORY_DB: 'true',
      RESET_DB_AFTER_EACH: 'true',
      LOG_LEVEL: 'info', // More detailed logging for performance tests
      PERFORMANCE_TEST_ENABLED: 'true',
      MAX_TEST_EXECUTION_TIME: '60000',
      MAX_MEMORY_USAGE_MB: '500'
    }
  }
});