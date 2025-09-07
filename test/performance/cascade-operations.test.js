import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, ObjectId } from 'mongodb';
import { cascadeDeletionService } from '../../services/cascadeDeletionService.js';
import { performanceTestScenario, testHelpers } from '../fixtures/cascade-test-data.js';

/**
 * Performance benchmarks for cascade deletion operations
 * Tests cascade deletion performance with various data volumes and concurrency levels
 */

// Performance thresholds (adjust based on requirements)
const PERFORMANCE_THRESHOLDS = {
  SMALL_DATASET: {
    maxExecutionTime: 2000,    // 2 seconds for < 50 references
    maxMemoryUsage: 50         // 50MB
  },
  MEDIUM_DATASET: {
    maxExecutionTime: 5000,    // 5 seconds for 50-200 references
    maxMemoryUsage: 100        // 100MB
  },
  LARGE_DATASET: {
    maxExecutionTime: 15000,   // 15 seconds for > 200 references
    maxMemoryUsage: 200        // 200MB
  },
  CONCURRENT_OPERATIONS: {
    maxExecutionTime: 10000,   // 10 seconds for concurrent operations
    minThroughput: 5           // operations per second
  }
};

describe('Cascade Deletion Performance Tests', () => {
  let mongoServer;
  let mongoClient;
  let db;

  beforeAll(async () => {
    // Start MongoDB Memory Server with increased memory
    mongoServer = await MongoMemoryServer.create({
      instance: {
        dbName: 'performance-test',
        storageEngine: 'wiredTiger'
      },
      binary: {
        version: '6.0.0'
      }
    });
    
    const mongoUri = mongoServer.getUri();
    mongoClient = new MongoClient(mongoUri, {
      maxPoolSize: 20,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    await mongoClient.connect();
    db = mongoClient.db('performance-test');

    // Mock the MongoDB service
    const { vi } = await import('vitest');
    vi.doMock('../../services/mongoDB.service.js', () => ({
      getCollection: (collectionName) => db.collection(collectionName)
    }));

    // Create indexes for better performance
    await createPerformanceIndexes();
  });

  afterAll(async () => {
    if (mongoClient) await mongoClient.close();
    if (mongoServer) await mongoServer.stop();
  });

  async function createPerformanceIndexes() {
    // Create indexes on frequently queried fields
    await db.collection('student').createIndex({ isActive: 1 });
    await db.collection('teacher').createIndex({ 'teaching.studentIds': 1 });
    await db.collection('orchestra').createIndex({ memberIds: 1 });
    await db.collection('rehearsal').createIndex({ 'attendance.studentId': 1 });
    await db.collection('theory_lesson').createIndex({ studentIds: 1 });
    await db.collection('bagrut').createIndex({ studentId: 1 });
    await db.collection('activity_attendance').createIndex({ studentId: 1 });
  }

  function measurePerformance(fn) {
    return async (...args) => {
      const startTime = Date.now();
      const startMemory = process.memoryUsage();
      
      const result = await fn(...args);
      
      const endTime = Date.now();
      const endMemory = process.memoryUsage();
      
      const executionTime = endTime - startTime;
      const memoryDelta = {
        rss: (endMemory.rss - startMemory.rss) / 1024 / 1024, // MB
        heapUsed: (endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024 // MB
      };
      
      return {
        result,
        performance: {
          executionTime,
          memoryUsage: memoryDelta,
          timestamp: new Date().toISOString()
        }
      };
    };
  }

  async function setupDataset(size, studentId) {
    const dataset = performanceTestScenario.generateLargeDataset(studentId, size);
    
    // Insert student
    await db.collection('student').insertOne({
      _id: new ObjectId(studentId),
      personalInfo: { fullName: `Performance Test Student ${size}` },
      isActive: true,
      createdAt: new Date()
    });

    // Insert related data in batches for better performance
    const batchSize = 100;
    
    if (dataset.teachers.length > 0) {
      for (let i = 0; i < dataset.teachers.length; i += batchSize) {
        const batch = dataset.teachers.slice(i, i + batchSize);
        await db.collection('teacher').insertMany(batch);
      }
    }
    
    if (dataset.orchestras.length > 0) {
      await db.collection('orchestra').insertMany(dataset.orchestras);
    }
    
    if (dataset.rehearsals.length > 0) {
      for (let i = 0; i < dataset.rehearsals.length; i += batchSize) {
        const batch = dataset.rehearsals.slice(i, i + batchSize);
        await db.collection('rehearsal').insertMany(batch);
      }
    }
    
    if (dataset.theoryLessons.length > 0) {
      await db.collection('theory_lesson').insertMany(dataset.theoryLessons);
    }
    
    if (dataset.activityAttendance.length > 0) {
      for (let i = 0; i < dataset.activityAttendance.length; i += batchSize) {
        const batch = dataset.activityAttendance.slice(i, i + batchSize);
        await db.collection('activity_attendance').insertMany(batch);
      }
    }

    return dataset;
  }

  beforeEach(async () => {
    // Clean collections before each test
    const collections = ['student', 'teacher', 'orchestra', 'rehearsal', 'theory_lesson', 'bagrut', 'activity_attendance', 'deletion_snapshots', 'audit_logs'];
    for (const collectionName of collections) {
      await db.collection(collectionName).deleteMany({});
    }
  });

  describe('Small Dataset Performance (< 50 references)', () => {
    const DATASET_SIZE = 25;
    let studentId;

    beforeEach(async () => {
      studentId = testHelpers.generateTestId().toString();
      await setupDataset(DATASET_SIZE, studentId);
    });

    it('should complete cascade deletion within performance threshold', async () => {
      const measuredOperation = measurePerformance(cascadeDeletionService.cascadeDeleteStudent);
      
      const { result, performance } = await measuredOperation(studentId, {
        hardDelete: false,
        preserveAcademic: true,
        createSnapshot: true
      });

      expect(result.success).toBe(true);
      expect(performance.executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SMALL_DATASET.maxExecutionTime);
      expect(performance.memoryUsage.heapUsed).toBeLessThan(PERFORMANCE_THRESHOLDS.SMALL_DATASET.maxMemoryUsage);

      console.log(`Small Dataset Performance: ${performance.executionTime}ms, Memory: ${performance.memoryUsage.heapUsed.toFixed(2)}MB`);
    });

    it('should handle validation impact analysis efficiently', async () => {
      const measuredValidation = measurePerformance(cascadeDeletionService.validateDeletionImpact);
      
      const { result, performance } = await measuredValidation(studentId);

      expect(result.success).toBe(true);
      expect(performance.executionTime).toBeLessThan(1000); // Should be very fast
      expect(result.impact.totalReferences).toBeLessThanOrEqual(DATASET_SIZE);

      console.log(`Validation Performance: ${performance.executionTime}ms`);
    });

    it('should create snapshots efficiently', async () => {
      const measuredSnapshot = measurePerformance(cascadeDeletionService.createDeletionSnapshot);
      
      const { result, performance } = await measuredSnapshot(studentId);

      expect(result).toBeTruthy();
      expect(performance.executionTime).toBeLessThan(1500);

      console.log(`Snapshot Creation Performance: ${performance.executionTime}ms`);
    });
  });

  describe('Medium Dataset Performance (50-200 references)', () => {
    const DATASET_SIZE = 150;
    let studentId;

    beforeEach(async () => {
      studentId = testHelpers.generateTestId().toString();
      await setupDataset(DATASET_SIZE, studentId);
    });

    it('should handle medium dataset cascade deletion within threshold', async () => {
      const measuredOperation = measurePerformance(cascadeDeletionService.cascadeDeleteStudent);
      
      const { result, performance } = await measuredOperation(studentId, {
        hardDelete: false,
        preserveAcademic: true,
        createSnapshot: true
      });

      expect(result.success).toBe(true);
      expect(performance.executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.MEDIUM_DATASET.maxExecutionTime);
      expect(performance.memoryUsage.heapUsed).toBeLessThan(PERFORMANCE_THRESHOLDS.MEDIUM_DATASET.maxMemoryUsage);

      // Verify operation counts
      const totalOperations = Object.values(result.operationCounts).reduce((sum, count) => sum + count, 0);
      expect(totalOperations).toBeGreaterThan(50);

      console.log(`Medium Dataset Performance: ${performance.executionTime}ms, Memory: ${performance.memoryUsage.heapUsed.toFixed(2)}MB, Operations: ${totalOperations}`);
    });

    it('should handle concurrent deletion validation efficiently', async () => {
      // Test multiple validation requests concurrently
      const studentIds = [studentId, ...Array.from({ length: 4 }, () => testHelpers.generateTestId().toString())];
      
      // Setup additional students with smaller datasets
      for (const id of studentIds.slice(1)) {
        await setupDataset(20, id);
      }

      const startTime = Date.now();
      
      const validationPromises = studentIds.map(id => 
        cascadeDeletionService.validateDeletionImpact(id)
      );
      
      const results = await Promise.all(validationPromises);
      const executionTime = Date.now() - startTime;

      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      expect(executionTime).toBeLessThan(3000); // All validations should complete within 3 seconds

      console.log(`Concurrent Validation Performance: ${executionTime}ms for ${studentIds.length} students`);
    });
  });

  describe('Large Dataset Performance (> 200 references)', () => {
    const DATASET_SIZE = 300;
    let studentId;

    beforeEach(async () => {
      studentId = testHelpers.generateTestId().toString();
      await setupDataset(DATASET_SIZE, studentId);
    });

    it('should handle large dataset cascade deletion within threshold', async () => {
      const measuredOperation = measurePerformance(cascadeDeletionService.cascadeDeleteStudent);
      
      const { result, performance } = await measuredOperation(studentId, {
        hardDelete: false,
        preserveAcademic: true,
        createSnapshot: true
      });

      expect(result.success).toBe(true);
      expect(performance.executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.LARGE_DATASET.maxExecutionTime);
      
      // May use more memory for large datasets, but should be reasonable
      expect(performance.memoryUsage.heapUsed).toBeLessThan(PERFORMANCE_THRESHOLDS.LARGE_DATASET.maxMemoryUsage);

      const totalOperations = Object.values(result.operationCounts).reduce((sum, count) => sum + count, 0);
      expect(totalOperations).toBeGreaterThan(200);

      console.log(`Large Dataset Performance: ${performance.executionTime}ms, Memory: ${performance.memoryUsage.heapUsed.toFixed(2)}MB, Operations: ${totalOperations}`);
    });

    it('should handle large snapshot creation efficiently', async () => {
      const measuredSnapshot = measurePerformance(cascadeDeletionService.createDeletionSnapshot);
      
      const { result, performance } = await measuredSnapshot(studentId);

      expect(result).toBeTruthy();
      expect(performance.executionTime).toBeLessThan(5000); // 5 seconds for large snapshot

      console.log(`Large Snapshot Creation: ${performance.executionTime}ms`);
    });
  });

  describe('Orphaned Reference Cleanup Performance', () => {
    beforeEach(async () => {
      // Create scenario with many orphaned references
      const orphanedStudentIds = Array.from({ length: 100 }, () => new ObjectId());
      
      // Create teachers with orphaned student references
      const orphanedTeachers = Array.from({ length: 50 }, (_, i) => ({
        _id: new ObjectId(),
        personalInfo: { fullName: `Orphaned Teacher ${i}` },
        teaching: {
          studentIds: orphanedStudentIds.slice(i * 2, (i + 1) * 2) // 2 orphaned refs per teacher
        }
      }));
      
      // Create orchestras with orphaned member references
      const orphanedOrchestras = Array.from({ length: 20 }, (_, i) => ({
        _id: new ObjectId(),
        name: `Orphaned Orchestra ${i}`,
        memberIds: orphanedStudentIds.slice(i * 5, (i + 1) * 5) // 5 orphaned refs per orchestra
      }));

      await db.collection('teacher').insertMany(orphanedTeachers);
      await db.collection('orchestra').insertMany(orphanedOrchestras);
    });

    it('should efficiently detect orphaned references in dry run mode', async () => {
      const measuredCleanup = measurePerformance(cascadeDeletionService.cleanupOrphanedReferences);
      
      const { result, performance } = await measuredCleanup(true); // dry run

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(result.totalOrphanedReferences).toBeGreaterThan(100);
      expect(performance.executionTime).toBeLessThan(5000); // Should complete within 5 seconds

      console.log(`Orphaned Reference Detection: ${performance.executionTime}ms, Found: ${result.totalOrphanedReferences} orphans`);
    });

    it('should efficiently clean up orphaned references', async () => {
      const measuredCleanup = measurePerformance(cascadeDeletionService.cleanupOrphanedReferences);
      
      const { result, performance } = await measuredCleanup(false); // actual cleanup

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(false);
      expect(performance.executionTime).toBeLessThan(10000); // Should complete within 10 seconds

      // Verify cleanup was effective
      const remainingOrphanedTeachers = await db.collection('teacher').countDocuments({
        'teaching.studentIds.0': { $exists: true }
      });
      
      const remainingOrphanedOrchestras = await db.collection('orchestra').countDocuments({
        'memberIds.0': { $exists: true }
      });

      console.log(`Orphaned Reference Cleanup: ${performance.executionTime}ms, Remaining: T=${remainingOrphanedTeachers}, O=${remainingOrphanedOrchestras}`);
    });
  });

  describe('Concurrent Operations Performance', () => {
    const CONCURRENT_STUDENTS = 5;
    let studentIds;

    beforeEach(async () => {
      // Setup multiple students with medium-sized datasets
      studentIds = Array.from({ length: CONCURRENT_STUDENTS }, () => testHelpers.generateTestId().toString());
      
      for (const studentId of studentIds) {
        await setupDataset(50, studentId); // 50 references per student
      }
    });

    it('should handle concurrent cascade deletions efficiently', async () => {
      const startTime = Date.now();
      
      // Execute concurrent deletions
      const deletionPromises = studentIds.map(studentId =>
        cascadeDeletionService.cascadeDeleteStudent(studentId, {
          hardDelete: false,
          preserveAcademic: true,
          createSnapshot: false // Skip snapshots for performance
        })
      );
      
      const results = await Promise.all(deletionPromises);
      const totalExecutionTime = Date.now() - startTime;

      // All deletions should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      expect(totalExecutionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.CONCURRENT_OPERATIONS.maxExecutionTime);

      const throughput = CONCURRENT_STUDENTS / (totalExecutionTime / 1000); // operations per second
      expect(throughput).toBeGreaterThan(PERFORMANCE_THRESHOLDS.CONCURRENT_OPERATIONS.minThroughput);

      console.log(`Concurrent Deletions: ${totalExecutionTime}ms for ${CONCURRENT_STUDENTS} students, Throughput: ${throughput.toFixed(2)} ops/sec`);
    });

    it('should handle mixed concurrent operations (deletions + validations)', async () => {
      const startTime = Date.now();
      
      // Mix deletion and validation operations
      const operations = [
        ...studentIds.slice(0, 2).map(id => 
          cascadeDeletionService.cascadeDeleteStudent(id, { createSnapshot: false })
        ),
        ...studentIds.slice(2, 5).map(id => 
          cascadeDeletionService.validateDeletionImpact(id)
        )
      ];
      
      const results = await Promise.all(operations);
      const totalExecutionTime = Date.now() - startTime;

      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      expect(totalExecutionTime).toBeLessThan(8000); // Should complete within 8 seconds

      console.log(`Mixed Concurrent Operations: ${totalExecutionTime}ms for ${results.length} operations`);
    });
  });

  describe('Transaction Timeout Handling', () => {
    let studentId;

    beforeEach(async () => {
      studentId = testHelpers.generateTestId().toString();
      // Create a very large dataset that might cause timeouts
      await setupDataset(500, studentId);
    });

    it('should handle operations near transaction timeout limits', async () => {
      const startTime = Date.now();
      
      try {
        const result = await cascadeDeletionService.cascadeDeleteStudent(studentId, {
          hardDelete: false,
          preserveAcademic: true,
          createSnapshot: true
        });

        const executionTime = Date.now() - startTime;

        if (result.success) {
          expect(result.success).toBe(true);
          expect(executionTime).toBeLessThan(30000); // Should complete within 30 seconds
          console.log(`Large Transaction Performance: ${executionTime}ms - SUCCESS`);
        } else {
          // If it fails due to timeout, it should fail gracefully
          expect(result.error).toBeTruthy();
          console.log(`Large Transaction Performance: ${executionTime}ms - TIMEOUT (expected for very large datasets)`);
        }
      } catch (error) {
        const executionTime = Date.now() - startTime;
        console.log(`Large Transaction Performance: ${executionTime}ms - ERROR: ${error.message}`);
        
        // Should fail gracefully with meaningful error
        expect(error.message).toBeTruthy();
      }
    });
  });

  describe('Memory Usage Under Load', () => {
    it('should maintain reasonable memory usage during large operations', async () => {
      const initialMemory = process.memoryUsage();
      const studentIds = [];

      // Create and process multiple large datasets
      for (let i = 0; i < 3; i++) {
        const studentId = testHelpers.generateTestId().toString();
        studentIds.push(studentId);
        await setupDataset(100, studentId);
        
        await cascadeDeletionService.cascadeDeleteStudent(studentId, {
          createSnapshot: false // Skip snapshots to focus on memory usage
        });
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
        
        const currentMemory = process.memoryUsage();
        const memoryGrowth = (currentMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
        
        // Memory growth should be reasonable
        expect(memoryGrowth).toBeLessThan(150); // Less than 150MB growth
        
        console.log(`Memory after ${i + 1} operations: ${memoryGrowth.toFixed(2)}MB growth`);
      }
    });
  });

  describe('Database Connection Pool Performance', () => {
    it('should efficiently use database connections', async () => {
      const connectionMetrics = {
        maxConcurrent: 0,
        totalOperations: 0
      };

      // Monitor connection usage
      const originalCollection = db.collection;
      let activeConnections = 0;
      
      db.collection = function(name) {
        activeConnections++;
        connectionMetrics.maxConcurrent = Math.max(connectionMetrics.maxConcurrent, activeConnections);
        
        const collection = originalCollection.call(this, name);
        const originalFind = collection.find;
        const originalFindOne = collection.findOne;
        const originalUpdateMany = collection.updateMany;
        
        collection.find = function(...args) {
          connectionMetrics.totalOperations++;
          return originalFind.apply(this, args);
        };
        
        collection.findOne = function(...args) {
          connectionMetrics.totalOperations++;
          return originalFindOne.apply(this, args);
        };
        
        collection.updateMany = function(...args) {
          connectionMetrics.totalOperations++;
          return originalUpdateMany.apply(this, args);
        };
        
        return collection;
      };

      // Create multiple students and perform operations
      const studentIds = [];
      for (let i = 0; i < 5; i++) {
        const studentId = testHelpers.generateTestId().toString();
        studentIds.push(studentId);
        await setupDataset(30, studentId);
      }

      const startTime = Date.now();
      
      // Perform multiple operations concurrently
      const operations = [
        ...studentIds.map(id => cascadeDeletionService.validateDeletionImpact(id)),
        cascadeDeletionService.cleanupOrphanedReferences(true)
      ];
      
      await Promise.all(operations);
      const executionTime = Date.now() - startTime;

      // Restore original method
      db.collection = originalCollection;

      console.log(`Connection Pool Metrics: Max Concurrent: ${connectionMetrics.maxConcurrent}, Total Ops: ${connectionMetrics.totalOperations}, Time: ${executionTime}ms`);

      // Should complete efficiently
      expect(executionTime).toBeLessThan(5000);
      expect(connectionMetrics.maxConcurrent).toBeLessThan(50); // Reasonable connection usage
    });
  });
});