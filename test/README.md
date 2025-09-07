# Cascade Deletion System Test Suite

Comprehensive test suite for the cascade deletion system using Jest, Supertest, and MongoDB Memory Server.

## Test Structure

```
test/
├── fixtures/
│   └── cascade-test-data.js          # Test data fixtures and scenarios
├── integration/
│   ├── cascade-deletion.test.js      # API endpoint integration tests
│   └── data-integrity.test.js        # Data integrity and orphan cleanup tests
├── performance/
│   └── cascade-operations.test.js    # Performance benchmarking tests
├── setup/
│   └── mongodb-memory-server.js      # MongoDB Memory Server configuration
├── unit/
│   └── cascadeDeletionService.test.js # Unit tests with mocking
└── README.md                         # This file
```

## Test Categories

### 1. Unit Tests
- **Location**: `test/unit/`
- **Purpose**: Test individual functions in isolation with mocked dependencies
- **Features**:
  - Mock MongoDB collections
  - Test transaction handling
  - Verify rollback scenarios
  - Validate error handling
  
**Run with**: `npm run test:unit`

### 2. Integration Tests
- **Location**: `test/integration/`
- **Purpose**: Test API endpoints end-to-end with real database operations
- **Features**:
  - Test complete cascade deletion flow
  - Verify authentication and authorization
  - Test dry-run mode
  - Validate response formats
  - Test concurrent deletion handling
  
**Run with**: `npm run test:integration`

### 3. Performance Tests  
- **Location**: `test/performance/`
- **Purpose**: Benchmark cascade deletion performance and resource usage
- **Features**:
  - Test with 100+ references
  - Measure execution time and memory usage
  - Test concurrent operations
  - Transaction timeout handling
  
**Run with**: `npm run test:performance`

### 4. Data Integrity Tests
- **Location**: `test/integration/data-integrity.test.js`
- **Purpose**: Test orphaned reference detection and cleanup
- **Features**:
  - Detect orphaned references across collections
  - Test bidirectional reference sync
  - Validate cleanup operations
  - Test repair functionality

## Test Scenarios

### Student with Multiple Relationships
Tests cascade deletion for a student with:
- Multiple teacher assignments
- Multiple orchestra memberships
- Bagrut records
- Activity attendance records
- Theory lesson enrollments

### Partial Failure Recovery
Tests system behavior when:
- Network timeouts occur during transactions
- Partial operations complete before failure
- Rollback mechanisms activate

### Performance Benchmarking
Tests performance with:
- Small datasets (< 50 references)
- Medium datasets (50-200 references)  
- Large datasets (> 200 references)
- Concurrent operations

### Concurrent Operations
Tests behavior with:
- Multiple simultaneous deletions
- Mixed deletion and validation requests
- Resource contention scenarios

## Database Setup

### MongoDB Memory Server
- **Purpose**: Provides isolated, in-memory MongoDB instances for testing
- **Configuration**: `test/setup/mongodb-memory-server.js`
- **Features**:
  - Automatic setup/teardown
  - Performance-optimized indexes
  - Transaction support
  - Configurable memory limits

### Test Data Fixtures
- **Location**: `test/fixtures/cascade-test-data.js`
- **Purpose**: Consistent test data across all test suites
- **Features**:
  - Realistic Hebrew student data
  - Complex relationship scenarios
  - Performance test data generators
  - Helper functions for test setup

## Running Tests

### Individual Test Suites
```bash
# Run only unit tests
npm run test:unit

# Run only integration tests  
npm run test:integration

# Run only performance tests
npm run test:performance
```

### Cascade-Specific Tests
```bash
# Run all cascade deletion tests
npm run test:cascade

# Run specific cascade test types
npm run test:cascade:unit
npm run test:cascade:integration
npm run test:cascade:performance
```

### With Coverage
```bash
# Generate coverage report for cascade tests
npm run test:coverage:cascade

# Full coverage report
npm run test:coverage
```

### Watch Mode
```bash
# Watch unit tests during development
npm run test:unit:watch

# Watch integration tests
npm run test:integration:watch
```

## Configuration

### Environment Variables
- `USE_MEMORY_DB`: Enable MongoDB Memory Server (default: true)
- `TEST_TYPE`: Test type (unit/integration/performance)
- `RESET_DB_AFTER_EACH`: Reset database between tests (default: false)
- `LOG_LEVEL`: Logging level during tests (default: warn)

### Performance Thresholds
- **Small Dataset**: < 2 seconds, < 50MB memory
- **Medium Dataset**: < 5 seconds, < 100MB memory  
- **Large Dataset**: < 15 seconds, < 200MB memory
- **Concurrent Operations**: < 10 seconds, > 5 ops/sec

## Test Development Guidelines

### Writing New Tests
1. Use appropriate test fixtures from `cascade-test-data.js`
2. Follow existing naming conventions
3. Include performance expectations where relevant
4. Test both success and failure scenarios
5. Verify cleanup and resource management

### Mocking Guidelines
- Unit tests should mock all external dependencies
- Integration tests should use MongoDB Memory Server
- Performance tests should minimize mocking for realistic benchmarks

### Error Testing
- Test graceful failure handling
- Verify rollback mechanisms
- Check error message clarity
- Test resource cleanup on failures

## Debugging Tests

### Enable Debug Logging
```bash
LOG_LEVEL=debug npm run test:integration
```

### Run Single Test File
```bash
npx vitest run test/unit/cascadeDeletionService.test.js
```

### Enable Test UI
```bash
npm run test:ui
```

### Memory Analysis
```bash
node --expose-gc --max-old-space-size=4096 ./node_modules/.bin/vitest run test/performance/
```

## CI/CD Integration

### GitHub Actions
```yaml
- name: Run Cascade Deletion Tests
  run: |
    npm run test:cascade
    npm run test:coverage:cascade
```

### Pre-commit Hooks
```bash
# Run affected tests before commit
npm run test:unit
```

## Troubleshooting

### Common Issues

#### MongoDB Memory Server Fails to Start
- Ensure sufficient memory is available
- Check MongoDB binary download permissions
- Try clearing the binary cache

#### Tests Timeout
- Increase timeout in vitest config
- Check for resource leaks
- Monitor system memory usage

#### Flaky Tests
- Ensure proper test isolation
- Reset database state between tests
- Check for race conditions in async operations

### Getting Help
- Check test logs for detailed error messages
- Use `npm run test:ui` for interactive debugging
- Review MongoDB Memory Server documentation
- Check Vitest configuration options

## Performance Monitoring

The test suite includes built-in performance monitoring:
- Execution time tracking
- Memory usage measurement
- Resource utilization reports
- Performance regression detection

Results are logged during test execution and can be used to monitor system performance over time.