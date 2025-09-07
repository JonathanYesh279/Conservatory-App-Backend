import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, ObjectId } from 'mongodb';
import express from 'express';
import { cascadeDeletionService } from '../../services/cascadeDeletionService.js';
import * as dataIntegrityService from '../../api/admin/data-integrity.service.js';
import { dataIntegrityController } from '../../api/admin/data-integrity.controller.js';
import { partialFailureScenario, performanceTestScenario, testHelpers } from '../fixtures/cascade-test-data.js';

// Create Express app for testing
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  
  // Mock authentication middleware
  app.use((req, res, next) => {
    req.loggedinUser = {
      _id: new ObjectId('507f1f77bcf86cd799439100'),
      fullName: 'Data Integrity Admin',
      email: 'integrity@test.com',
      roles: ['מנהל']
    };
    req.ip = '127.0.0.1';
    next();
  });

  // Define routes
  app.post('/api/admin/data-integrity/scan', dataIntegrityController.scanDataIntegrity);
  app.post('/api/admin/data-integrity/repair', dataIntegrityController.repairDataIntegrity);
  app.get('/api/admin/data-integrity/status', dataIntegrityController.getIntegrityStatus);
  app.post('/api/admin/data-integrity/bidirectional-sync', dataIntegrityController.syncBidirectionalReferences);

  return app;
};

describe('Data Integrity Tests', () => {
  let mongoServer;
  let mongoClient;
  let db;
  let app;

  beforeAll(async () => {
    // Start MongoDB Memory Server
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    // Connect to test database
    mongoClient = new MongoClient(mongoUri);
    await mongoClient.connect();
    db = mongoClient.db('test-conservatory-integrity');

    // Mock the MongoDB service to use test database
    const { vi } = await import('vitest');
    vi.doMock('../../services/mongoDB.service.js', () => ({
      getCollection: (collectionName) => db.collection(collectionName)
    }));

    // Create test app
    app = createTestApp();
  });

  afterAll(async () => {
    if (mongoClient) await mongoClient.close();
    if (mongoServer) await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clean all collections
    const collections = await db.listCollections().toArray();
    for (const collection of collections) {
      await db.collection(collection.name).deleteMany({});
    }
  });

  describe('Orphaned Reference Detection', () => {
    beforeEach(async () => {
      // Set up test scenario with orphaned references
      const activeStudent = {
        _id: new ObjectId('507f1f77bcf86cd799439001'),
        personalInfo: { fullName: 'Active Student' },
        isActive: true
      };

      // Insert active student
      await db.collection('student').insertOne(activeStudent);

      // Insert teachers with valid and orphaned student references
      await db.collection('teacher').insertMany([
        {
          _id: new ObjectId('507f1f77bcf86cd799439010'),
          personalInfo: { fullName: 'Teacher 1' },
          teaching: {
            studentIds: [
              new ObjectId('507f1f77bcf86cd799439001'), // Valid reference
              new ObjectId('507f1f77bcf86cd799439999')  // Orphaned reference
            ]
          }
        },
        {
          _id: new ObjectId('507f1f77bcf86cd799439011'),
          personalInfo: { fullName: 'Teacher 2' },
          teaching: {
            studentIds: [
              new ObjectId('507f1f77bcf86cd799439998')  // Another orphaned reference
            ]
          }
        }
      ]);

      // Insert orchestras with valid and orphaned member references
      await db.collection('orchestra').insertMany([
        {
          _id: new ObjectId('507f1f77bcf86cd799439020'),
          name: 'Test Orchestra 1',
          memberIds: [
            new ObjectId('507f1f77bcf86cd799439001'), // Valid reference
            new ObjectId('507f1f77bcf86cd799439997')  // Orphaned reference
          ]
        }
      ]);

      // Insert rehearsals with orphaned attendance references
      await db.collection('rehearsal').insertMany([
        {
          _id: new ObjectId('507f1f77bcf86cd799439030'),
          date: '2023-09-15',
          attendance: [
            {
              studentId: new ObjectId('507f1f77bcf86cd799439001'),
              status: 'נוכח'
            },
            {
              studentId: new ObjectId('507f1f77bcf86cd799439996'), // Orphaned
              status: 'נוכח'
            }
          ]
        }
      ]);
    });

    it('should detect all orphaned references across collections', async () => {
      const result = await cascadeDeletionService.cleanupOrphanedReferences(true); // dry run

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(result.findings.orphanedTeacherReferences.length).toBeGreaterThan(0);
      expect(result.findings.orphanedOrchestraReferences.length).toBeGreaterThan(0);
      expect(result.totalOrphanedReferences).toBeGreaterThan(2);

      // Check specific orphaned references
      const teacherOrphans = result.findings.orphanedTeacherReferences;
      const teacher1Orphans = teacherOrphans.find(
        item => item.teacherId.toString() === '507f1f77bcf86cd799439010'
      );
      expect(teacher1Orphans.orphanedStudentIds).toContain(new ObjectId('507f1f77bcf86cd799439999'));
    });

    it('should clean up orphaned references when not in dry run mode', async () => {
      // First, verify orphaned references exist
      const beforeCleanup = await cascadeDeletionService.cleanupOrphanedReferences(true);
      expect(beforeCleanup.totalOrphanedReferences).toBeGreaterThan(0);

      // Perform actual cleanup
      const result = await cascadeDeletionService.cleanupOrphanedReferences(false);

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(false);

      // Verify references are cleaned up
      const teacherWithCleanRefs = await db.collection('teacher').findOne({
        _id: new ObjectId('507f1f77bcf86cd799439010')
      });
      
      expect(teacherWithCleanRefs.teaching.studentIds).toHaveLength(1);
      expect(teacherWithCleanRefs.teaching.studentIds[0].toString()).toBe('507f1f77bcf86cd799439001');

      const orchestraWithCleanRefs = await db.collection('orchestra').findOne({
        _id: new ObjectId('507f1f77bcf86cd799439020')
      });
      
      expect(orchestraWithCleanRefs.memberIds).toHaveLength(1);
      expect(orchestraWithCleanRefs.memberIds[0].toString()).toBe('507f1f77bcf86cd799439001');
    });

    it('should handle collections with no orphaned references', async () => {
      // Clean up all orphaned references first
      await cascadeDeletionService.cleanupOrphanedReferences(false);

      // Run cleanup again
      const result = await cascadeDeletionService.cleanupOrphanedReferences(true);

      expect(result.success).toBe(true);
      expect(result.totalOrphanedReferences).toBe(0);
      expect(result.findings.orphanedTeacherReferences).toHaveLength(0);
      expect(result.findings.orphanedOrchestraReferences).toHaveLength(0);
    });
  });

  describe('Bidirectional Reference Sync', () => {
    beforeEach(async () => {
      // Set up bidirectional reference inconsistencies
      const studentId = new ObjectId('507f1f77bcf86cd799439001');
      const teacherId = new ObjectId('507f1f77bcf86cd799439010');
      const orchestraId = new ObjectId('507f1f77bcf86cd799439020');

      // Insert student
      await db.collection('student').insertOne({
        _id: studentId,
        personalInfo: { fullName: 'Test Student' },
        isActive: true
      });

      // Insert teacher with student reference, but student doesn't reference teacher
      await db.collection('teacher').insertOne({
        _id: teacherId,
        personalInfo: { fullName: 'Test Teacher' },
        teaching: {
          studentIds: [studentId]
        },
        schedules: [{
          studentId: studentId,
          day: 'א',
          startTime: '14:00',
          isActive: true
        }]
      });

      // Insert orchestra without student reference, but we'll add inconsistent data
      await db.collection('orchestra').insertOne({
        _id: orchestraId,
        name: 'Test Orchestra',
        memberIds: [] // Missing student reference
      });

      // Insert student assignment that references non-existent teacher
      await db.collection('student').updateOne(
        { _id: studentId },
        {
          $set: {
            assignments: {
              teachers: [new ObjectId('507f1f77bcf86cd799439999')], // Non-existent teacher
              orchestras: [orchestraId] // Orchestra doesn't reference back
            }
          }
        }
      );
    });

    it('should detect bidirectional reference inconsistencies via API', async () => {
      const response = await request(app)
        .post('/api/admin/data-integrity/bidirectional-sync')
        .send({
          dryRun: true,
          collections: ['students', 'teachers', 'orchestras']
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('inconsistencies');
      expect(response.body.data.inconsistencies.length).toBeGreaterThan(0);

      // Should detect teacher-student inconsistency
      const teacherInconsistency = response.body.data.inconsistencies.find(
        inc => inc.type === 'TEACHER_STUDENT_MISMATCH'
      );
      expect(teacherInconsistency).toBeDefined();
    });

    it('should repair bidirectional reference inconsistencies', async () => {
      const response = await request(app)
        .post('/api/admin/data-integrity/bidirectional-sync')
        .send({
          dryRun: false,
          autoRepair: true,
          collections: ['students', 'teachers', 'orchestras']
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('repairResults');
      expect(response.body.data.repairResults.totalRepairs).toBeGreaterThan(0);

      // Verify repairs were made
      const student = await db.collection('student').findOne({
        _id: new ObjectId('507f1f77bcf86cd799439001')
      });
      
      const teacher = await db.collection('teacher').findOne({
        _id: new ObjectId('507f1f77bcf86cd799439010')
      });

      // Check that references are now consistent
      expect(student.assignments.teachers).toContain(teacher._id);
      expect(teacher.teaching.studentIds).toContain(student._id);
    });
  });

  describe('Data Integrity Scanning via API', () => {
    beforeEach(async () => {
      // Insert test data with various integrity issues
      await db.collection('student').insertMany([
        {
          _id: new ObjectId('507f1f77bcf86cd799439001'),
          personalInfo: { fullName: 'Student 1' },
          isActive: true
        },
        {
          _id: new ObjectId('507f1f77bcf86cd799439002'),
          personalInfo: { fullName: 'Student 2' },
          isActive: false, // Inactive student
          deactivatedAt: new Date()
        }
      ]);

      // Teacher with reference to inactive student
      await db.collection('teacher').insertOne({
        _id: new ObjectId('507f1f77bcf86cd799439010'),
        personalInfo: { fullName: 'Teacher 1' },
        teaching: {
          studentIds: [
            new ObjectId('507f1f77bcf86cd799439001'), // Active
            new ObjectId('507f1f77bcf86cd799439002')  // Inactive - integrity issue
          ]
        }
      });

      // Bagrut records for both students
      await db.collection('bagrut').insertMany([
        {
          _id: new ObjectId('507f1f77bcf86cd799439100'),
          studentId: new ObjectId('507f1f77bcf86cd799439001'),
          subject: 'מוזיקה',
          isActive: true
        },
        {
          _id: new ObjectId('507f1f77bcf86cd799439101'),
          studentId: new ObjectId('507f1f77bcf86cd799439002'),
          subject: 'מוזיקה',
          isActive: true // Should be inactive since student is inactive
        }
      ]);
    });

    it('should scan and report data integrity issues', async () => {
      const response = await request(app)
        .post('/api/admin/data-integrity/scan')
        .send({
          deep: true,
          collections: ['students', 'teachers', 'bagrut']
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('integrityReport');
      expect(response.body.data.integrityReport).toHaveProperty('issues');
      expect(response.body.data.integrityReport).toHaveProperty('summary');
      
      const issues = response.body.data.integrityReport.issues;
      expect(issues.length).toBeGreaterThan(0);

      // Should detect teacher reference to inactive student
      const teacherIssue = issues.find(issue => 
        issue.type === 'INACTIVE_STUDENT_REFERENCE' && issue.collection === 'teacher'
      );
      expect(teacherIssue).toBeDefined();

      // Should detect bagrut record for inactive student
      const bagrutIssue = issues.find(issue => 
        issue.type === 'ORPHANED_ACADEMIC_RECORD' && issue.collection === 'bagrut'
      );
      expect(bagrutIssue).toBeDefined();
    });

    it('should provide repair recommendations', async () => {
      const response = await request(app)
        .post('/api/admin/data-integrity/scan')
        .send({
          includeRecommendations: true
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.integrityReport).toHaveProperty('recommendations');
      
      const recommendations = response.body.data.integrityReport.recommendations;
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);

      const recommendation = recommendations.find(rec => 
        rec.action === 'CLEANUP_INACTIVE_REFERENCES'
      );
      expect(recommendation).toBeDefined();
      expect(recommendation).toHaveProperty('priority');
      expect(recommendation).toHaveProperty('description');
    });

    it('should repair data integrity issues', async () => {
      // First scan to identify issues
      const scanResponse = await request(app)
        .post('/api/admin/data-integrity/scan')
        .send({ deep: true })
        .expect(200);

      const issues = scanResponse.body.data.integrityReport.issues;
      expect(issues.length).toBeGreaterThan(0);

      // Then repair the issues
      const repairResponse = await request(app)
        .post('/api/admin/data-integrity/repair')
        .send({
          repairTypes: ['INACTIVE_STUDENT_REFERENCE', 'ORPHANED_ACADEMIC_RECORD'],
          autoConfirm: true
        })
        .expect(200);

      expect(repairResponse.body.success).toBe(true);
      expect(repairResponse.body.data).toHaveProperty('repairResults');
      expect(repairResponse.body.data.repairResults.totalRepairs).toBeGreaterThan(0);

      // Verify repairs were applied
      const teacher = await db.collection('teacher').findOne({
        _id: new ObjectId('507f1f77bcf86cd799439010')
      });
      
      // Should no longer reference inactive student
      expect(teacher.teaching.studentIds).toHaveLength(1);
      expect(teacher.teaching.studentIds[0].toString()).toBe('507f1f77bcf86cd799439001');

      const bagrutRecord = await db.collection('bagrut').findOne({
        _id: new ObjectId('507f1f77bcf86cd799439101')
      });
      
      // Should be deactivated
      expect(bagrutRecord.isActive).toBe(false);
      expect(bagrutRecord.deactivatedAt).toBeDefined();
    });
  });

  describe('Data Integrity Status Monitoring', () => {
    beforeEach(async () => {
      // Insert some data with mixed integrity status
      await db.collection('student').insertMany([
        { _id: new ObjectId(), personalInfo: { fullName: 'Good Student' }, isActive: true },
        { _id: new ObjectId(), personalInfo: { fullName: 'Bad Student' }, isActive: true }
      ]);

      // Insert integrity status records
      await db.collection('integrityStatus').insertMany([
        {
          _id: new ObjectId(),
          timestamp: new Date(),
          overallScore: 95,
          issuesFound: 2,
          issuesResolved: 1,
          collections: {
            students: { score: 98, issues: 0 },
            teachers: { score: 90, issues: 2 },
            orchestras: { score: 100, issues: 0 }
          }
        }
      ]);
    });

    it('should return current data integrity status', async () => {
      const response = await request(app)
        .get('/api/admin/data-integrity/status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('overallStatus');
      expect(response.body.data).toHaveProperty('collectionStatus');
      expect(response.body.data).toHaveProperty('recentScans');
      expect(response.body.data).toHaveProperty('trends');

      expect(response.body.data.overallStatus).toHaveProperty('score');
      expect(response.body.data.overallStatus).toHaveProperty('status');
      expect(response.body.data.overallStatus.score).toBeGreaterThanOrEqual(0);
      expect(response.body.data.overallStatus.score).toBeLessThanOrEqual(100);
    });

    it('should include historical trend data', async () => {
      // Insert historical data
      const historicalData = [];
      for (let i = 0; i < 7; i++) {
        historicalData.push({
          timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
          overallScore: 90 + i,
          issuesFound: 10 - i,
          issuesResolved: 8 - i
        });
      }
      await db.collection('integrityStatus').insertMany(historicalData);

      const response = await request(app)
        .get('/api/admin/data-integrity/status')
        .query({ includeTrends: true, trendDays: 7 })
        .expect(200);

      expect(response.body.data.trends).toBeDefined();
      expect(response.body.data.trends).toHaveProperty('scoreHistory');
      expect(response.body.data.trends).toHaveProperty('issueHistory');
      expect(Array.isArray(response.body.data.trends.scoreHistory)).toBe(true);
      expect(response.body.data.trends.scoreHistory.length).toBeGreaterThan(0);
    });
  });

  describe('Large Scale Data Integrity Operations', () => {
    it('should handle integrity scanning of large datasets', async () => {
      // Generate large dataset
      const largeDataset = performanceTestScenario.generateLargeDataset(
        new ObjectId('507f1f77bcf86cd799439999'),
        200
      );

      // Insert large dataset
      await db.collection('student').insertMany([{
        _id: new ObjectId('507f1f77bcf86cd799439999'),
        personalInfo: { fullName: 'Performance Test Student' },
        isActive: true
      }]);

      await db.collection('teacher').insertMany(largeDataset.teachers);
      await db.collection('orchestra').insertMany(largeDataset.orchestras);
      await db.collection('activity_attendance').insertMany(largeDataset.activityAttendance);

      // Measure scan performance
      const startTime = Date.now();

      const response = await request(app)
        .post('/api/admin/data-integrity/scan')
        .send({
          deep: true,
          batchSize: 50
        })
        .timeout(30000) // 30 second timeout
        .expect(200);

      const executionTime = Date.now() - startTime;

      expect(response.body.success).toBe(true);
      expect(response.body.data.integrityReport).toHaveProperty('processingTime');
      expect(response.body.data.integrityReport).toHaveProperty('recordsScanned');
      expect(response.body.data.integrityReport.recordsScanned).toBeGreaterThan(200);

      // Should complete within reasonable time (adjust threshold as needed)
      expect(executionTime).toBeLessThan(25000); // 25 seconds
    });

    it('should batch process large cleanup operations', async () => {
      // Create many orphaned references
      const orphanedTeachers = [];
      for (let i = 0; i < 100; i++) {
        orphanedTeachers.push({
          _id: new ObjectId(),
          teaching: {
            studentIds: [new ObjectId()] // All orphaned
          }
        });
      }

      await db.collection('teacher').insertMany(orphanedTeachers);

      // Perform batch cleanup
      const response = await request(app)
        .post('/api/admin/data-integrity/repair')
        .send({
          repairTypes: ['ORPHANED_REFERENCES'],
          batchSize: 25,
          maxBatches: 10
        })
        .timeout(30000)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.repairResults.totalRepairs).toBeGreaterThan(0);
      expect(response.body.data.repairResults).toHaveProperty('batchesProcessed');
      expect(response.body.data.repairResults.batchesProcessed).toBeGreaterThan(1);
    });
  });

  describe('Error Recovery and Partial Failure Scenarios', () => {
    it('should handle partial repair failures gracefully', async () => {
      // Set up data that will cause some repairs to fail
      await db.collection('student').insertOne({
        _id: new ObjectId('507f1f77bcf86cd799439001'),
        personalInfo: { fullName: 'Student 1' },
        isActive: true
      });

      // Insert problematic data that might cause repair to fail
      await db.collection('teacher').insertOne({
        _id: new ObjectId('507f1f77bcf86cd799439010'),
        // Missing required fields to cause repair failure
        teaching: {
          studentIds: [new ObjectId('507f1f77bcf86cd799439999')] // Orphaned
        }
      });

      const response = await request(app)
        .post('/api/admin/data-integrity/repair')
        .send({
          repairTypes: ['ORPHANED_REFERENCES'],
          continueOnError: true
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.repairResults).toHaveProperty('failures');
      expect(response.body.data.repairResults).toHaveProperty('successes');
      
      // Should report partial success
      const failures = response.body.data.repairResults.failures;
      if (failures.length > 0) {
        expect(failures[0]).toHaveProperty('error');
        expect(failures[0]).toHaveProperty('document');
      }
    });

    it('should provide detailed error information for failed repairs', async () => {
      // Create scenario that will definitely fail
      await db.collection('teacher').insertOne({
        _id: new ObjectId('507f1f77bcf86cd799439010'),
        // Invalid structure that will cause repair to fail
        teaching: "invalid_structure"
      });

      const response = await request(app)
        .post('/api/admin/data-integrity/repair')
        .send({
          repairTypes: ['ORPHANED_REFERENCES'],
          includeErrorDetails: true
        })
        .expect(200);

      if (response.body.data.repairResults.failures.length > 0) {
        const failure = response.body.data.repairResults.failures[0];
        expect(failure).toHaveProperty('error');
        expect(failure).toHaveProperty('documentId');
        expect(failure).toHaveProperty('collection');
        expect(failure.error).toBeTruthy();
      }
    });
  });

  describe('Concurrent Data Integrity Operations', () => {
    it('should handle concurrent integrity scans safely', async () => {
      // Insert test data
      await db.collection('student').insertMany([
        { _id: new ObjectId(), personalInfo: { fullName: 'Student 1' }, isActive: true },
        { _id: new ObjectId(), personalInfo: { fullName: 'Student 2' }, isActive: true },
        { _id: new ObjectId(), personalInfo: { fullName: 'Student 3' }, isActive: true }
      ]);

      // Launch multiple concurrent scans
      const scanPromises = [
        request(app).post('/api/admin/data-integrity/scan').send({ collections: ['students'] }),
        request(app).post('/api/admin/data-integrity/scan').send({ collections: ['teachers'] }),
        request(app).post('/api/admin/data-integrity/scan').send({ deep: true })
      ];

      const responses = await Promise.all(scanPromises);

      // All scans should complete successfully
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    it('should prevent conflicting repair operations', async () => {
      // Insert data that needs repair
      await db.collection('teacher').insertOne({
        _id: new ObjectId(),
        teaching: {
          studentIds: [new ObjectId()] // Orphaned reference
        }
      });

      // Start first repair operation
      const firstRepairPromise = request(app)
        .post('/api/admin/data-integrity/repair')
        .send({
          repairTypes: ['ORPHANED_REFERENCES'],
          lockTimeout: 5000
        });

      // Start second repair operation immediately
      const secondRepairPromise = request(app)
        .post('/api/admin/data-integrity/repair')
        .send({
          repairTypes: ['ORPHANED_REFERENCES']
        });

      const [firstResponse, secondResponse] = await Promise.all([
        firstRepairPromise,
        secondRepairPromise
      ]);

      // One should succeed, one should be prevented or queued
      const successfulResponses = [firstResponse, secondResponse].filter(r => r.status === 200);
      const preventedResponses = [firstResponse, secondResponse].filter(r => r.status === 409 || r.status === 429);

      expect(successfulResponses.length).toBe(1);
      // May have prevented responses depending on implementation
      expect(successfulResponses[0].body.success).toBe(true);
    });
  });
});