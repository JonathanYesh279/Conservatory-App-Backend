import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['**/*.test.js', '**/*.spec.js'],
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],
    setupFiles: ['./test/setup.js'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        'scripts/',
        'migrations/',
        '**/*.config.js',
        '**/*.test.js',
        '**/*.spec.js'
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70
        }
      }
    },
    testTimeout: 30000, // 30 seconds for integration tests
    hookTimeout: 20000, // 20 seconds for setup/teardown
    teardownTimeout: 10000, // 10 seconds for cleanup
    root: '.',
    pool: 'forks', // Use forks for better isolation
    maxConcurrency: 5, // Limit concurrent tests to prevent resource exhaustion
    minWorkers: 1,
    maxWorkers: 4,
    env: {
      NODE_ENV: 'test',
      USE_MEMORY_DB: 'true',
      RESET_DB_AFTER_EACH: 'false',
      LOG_LEVEL: 'warn' // Reduce log noise during tests
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
