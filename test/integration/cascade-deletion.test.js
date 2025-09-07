import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, ObjectId } from 'mongodb';
import express from 'express';
import { cascadeDeletionController } from '../../api/admin/cascade-deletion.controller.js';
import { complexStudentScenario, testHelpers, MOCK_STUDENT_ID } from '../fixtures/cascade-test-data.js';

// Create Express app for testing
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  
  // Mock authentication middleware
  app.use((req, res, next) => {
    req.loggedinUser = {
      _id: new ObjectId('507f1f77bcf86cd799439100'),
      fullName: 'Test Admin',
      email: 'admin@test.com',
      roles: ['מנהל']
    };
    req.ip = '127.0.0.1';
    next();
  });

  // Define routes
  app.post('/api/admin/student/:studentId/deletion-preview', cascadeDeletionController.previewCascadeDeletion);
  app.delete('/api/admin/student/:studentId/cascade', cascadeDeletionController.executeCascadeDeletion);
  app.post('/api/admin/cleanup/orphaned-references', cascadeDeletionController.cleanupOrphanedReferences);
  app.post('/api/admin/deletion/rollback/:snapshotId', cascadeDeletionController.rollbackDeletion);
  app.get('/api/admin/deletion/audit-log', cascadeDeletionController.getAuditLog);
  app.get('/api/admin/deletion/snapshots', cascadeDeletionController.getAvailableSnapshots);
  app.get('/api/admin/deletion/operations', cascadeDeletionController.getRunningOperations);
  app.post('/api/admin/deletion/operations/:operationId/cancel', cascadeDeletionController.cancelOperation);

  return app;
};

describe('Cascade Deletion API Integration Tests', () => {
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
    db = mongoClient.db('test-conservatory');

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

    // Insert test data
    const testData = testHelpers.getCleanMockData();
    await db.collection('students').insertOne(testData.student);
    await db.collection('teacher').insertMany(testData.teachers);
    await db.collection('orchestra').insertMany(testData.orchestras);
    await db.collection('rehearsal').insertMany(testData.rehearsals);
    await db.collection('theory_lesson').insertMany(testData.theoryLessons);
    await db.collection('bagrut').insertMany(testData.bagrut);
    await db.collection('activity_attendance').insertMany(testData.activityAttendance);
  });

  describe('POST /api/admin/student/:studentId/deletion-preview', () => {
    it('should return deletion preview with impact analysis', async () => {
      const response = await request(app)
        .post(`/api/admin/student/${MOCK_STUDENT_ID}/deletion-preview`)
        .send({
          preserveAcademic: true,
          createBackup: true
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('operationId');
      expect(response.body.data).toHaveProperty('studentInfo');
      expect(response.body.data).toHaveProperty('affectedCollections');
      expect(response.body.data).toHaveProperty('warnings');
      expect(response.body.data).toHaveProperty('rollbackInfo');
      expect(response.body.data.studentInfo.name).toBe('ישראל כהן');
      expect(response.body.meta).toHaveProperty('requestedBy', 'Test Admin');
    });

    it('should return 404 for non-existent student', async () => {
      const nonExistentId = new ObjectId().toString();
      
      const response = await request(app)
        .post(`/api/admin/student/${nonExistentId}/deletion-preview`)
        .send({})
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('STUDENT_NOT_FOUND');
      expect(response.body.code).toBe('STUDENT_NOT_EXISTS');
    });

    it('should handle invalid student ID format', async () => {
      const response = await request(app)
        .post('/api/admin/student/invalid-id/deletion-preview')
        .send({})
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/admin/student/:studentId/cascade', () => {
    it('should successfully execute soft cascade deletion', async () => {
      const response = await request(app)
        .delete(`/api/admin/student/${MOCK_STUDENT_ID}/cascade`)
        .send({
          hardDelete: false,
          preserveAcademic: true,
          createBackup: true
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('operationId');
      expect(response.body.data).toHaveProperty('deletedRecords');
      expect(response.body.data).toHaveProperty('rollbackToken');
      expect(response.body.meta.canRollback).toBe(true);

      // Verify student is soft deleted
      const student = await db.collection('students').findOne({ _id: new ObjectId(MOCK_STUDENT_ID) });
      expect(student.isActive).toBe(false);
      expect(student.deactivatedAt).toBeDefined();

      // Verify teacher relationships are cleaned
      const teachers = await db.collection('teacher').find({
        'teaching.studentIds': new ObjectId(MOCK_STUDENT_ID)
      }).toArray();
      expect(teachers).toHaveLength(0);

      // Verify bagrut records are preserved (soft deleted)
      const bagrutRecords = await db.collection('bagrut').find({
        studentId: new ObjectId(MOCK_STUDENT_ID)
      }).toArray();
      expect(bagrutRecords).toHaveLength(1);
      expect(bagrutRecords[0].isActive).toBe(false);
    });

    it('should execute hard cascade deletion when requested', async () => {
      const response = await request(app)
        .delete(`/api/admin/student/${MOCK_STUDENT_ID}/cascade`)
        .send({
          hardDelete: true,
          preserveAcademic: false,
          adminPassword: 'admin123'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('מחיקה קשה');

      // Verify student is completely deleted
      const student = await db.collection('students').findOne({ _id: new ObjectId(MOCK_STUDENT_ID) });
      expect(student).toBeNull();

      // Verify bagrut records are completely deleted
      const bagrutRecords = await db.collection('bagrut').find({
        studentId: new ObjectId(MOCK_STUDENT_ID)
      }).toArray();
      expect(bagrutRecords).toHaveLength(0);
    });

    it('should require admin password for hard delete', async () => {
      const response = await request(app)
        .delete(`/api/admin/student/${MOCK_STUDENT_ID}/cascade`)
        .send({
          hardDelete: true,
          preserveAcademic: false
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('ADMIN_PASSWORD_REQUIRED');
      expect(response.body.code).toBe('HARD_DELETE_UNAUTHORIZED');
    });

    it('should handle concurrent deletion attempts', async () => {
      // Execute first deletion
      const firstResponse = await request(app)
        .delete(`/api/admin/student/${MOCK_STUDENT_ID}/cascade`)
        .send({ hardDelete: false });

      expect(firstResponse.status).toBe(200);

      // Attempt second deletion on same student
      const secondResponse = await request(app)
        .delete(`/api/admin/student/${MOCK_STUDENT_ID}/cascade`)
        .send({ hardDelete: false });

      expect(secondResponse.status).toBe(404);
      expect(secondResponse.body.error).toBe('STUDENT_NOT_FOUND');
    });
  });

  describe('POST /api/admin/cleanup/orphaned-references', () => {
    beforeEach(async () => {
      // Create orphaned references
      await db.collection('teacher').insertOne({
        _id: new ObjectId(),
        teaching: {
          studentIds: [new ObjectId('507f1f77bcf86cd799439999')] // Non-existent student
        }
      });

      await db.collection('orchestra').insertOne({
        _id: new ObjectId(),
        memberIds: [new ObjectId('507f1f77bcf86cd799439998')] // Another non-existent student
      });
    });

    it('should detect orphaned references in dry run mode', async () => {
      const response = await request(app)
        .post('/api/admin/cleanup/orphaned-references')
        .send({
          dryRun: true,
          collections: ['teachers', 'orchestras']
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('orphanedReferences');
      expect(response.body.message).toContain('הדמיית ניקוי');
      expect(response.body.meta.dryRun).toBe(true);
    });

    it('should clean up orphaned references when not in dry run', async () => {
      const response = await request(app)
        .post('/api/admin/cleanup/orphaned-references')
        .send({
          dryRun: false
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('cleanupSummary');
      expect(response.body.message).toContain('ניקוי ההפניות היתומות הושלם');
      expect(response.body.meta.dryRun).toBe(false);
    });
  });

  describe('POST /api/admin/deletion/rollback/:snapshotId', () => {
    let snapshotId;

    beforeEach(async () => {
      // Create a test snapshot
      const snapshot = testHelpers.createSnapshotData(
        MOCK_STUDENT_ID,
        {
          students: [complexStudentScenario.student],
          teachers: complexStudentScenario.teachers.slice(0, 1)
        }
      );
      
      const result = await db.collection('deletionSnapshots').insertOne(snapshot);
      snapshotId = result.insertedId.toString();

      // Delete student to simulate deletion
      await db.collection('students').deleteOne({ _id: new ObjectId(MOCK_STUDENT_ID) });
    });

    it('should successfully rollback deletion using snapshot', async () => {
      const response = await request(app)
        .post(`/api/admin/deletion/rollback/${snapshotId}`)
        .send({
          preserveNewData: false
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('rollbackId');
      expect(response.body.data).toHaveProperty('restoredRecords');
      expect(response.body.message).toContain('השחזור הושלם בהצלחה');

      // Verify student is restored
      const restoredStudent = await db.collection('students').findOne({ _id: new ObjectId(MOCK_STUDENT_ID) });
      expect(restoredStudent).toBeTruthy();
      expect(restoredStudent.personalInfo.fullName).toBe('ישראל כהן');

      // Verify snapshot is marked as used
      const usedSnapshot = await db.collection('deletionSnapshots').findOne({ _id: new ObjectId(snapshotId) });
      expect(usedSnapshot.used).toBe(true);
      expect(usedSnapshot.usedAt).toBeDefined();
    });

    it('should return 404 for non-existent snapshot', async () => {
      const nonExistentId = new ObjectId().toString();
      
      const response = await request(app)
        .post(`/api/admin/deletion/rollback/${nonExistentId}`)
        .send({})
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('SNAPSHOT_NOT_FOUND');
    });

    it('should handle expired snapshots', async () => {
      // Update snapshot to be expired
      await db.collection('deletionSnapshots').updateOne(
        { _id: new ObjectId(snapshotId) },
        { $set: { expiresAt: new Date(Date.now() - 1000) } }
      );

      const response = await request(app)
        .post(`/api/admin/deletion/rollback/${snapshotId}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('SNAPSHOT_EXPIRED');
      expect(response.body.code).toBe('SNAPSHOT_EXPIRED');
    });

    it('should handle already used snapshots', async () => {
      // Mark snapshot as used
      await db.collection('deletionSnapshots').updateOne(
        { _id: new ObjectId(snapshotId) },
        { $set: { used: true, usedAt: new Date() } }
      );

      const response = await request(app)
        .post(`/api/admin/deletion/rollback/${snapshotId}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('SNAPSHOT_ALREADY_USED');
      expect(response.body.code).toBe('SNAPSHOT_USED');
    });
  });

  describe('GET /api/admin/deletion/audit-log', () => {
    beforeEach(async () => {
      // Insert test audit log entries
      const auditEntries = [
        {
          operationId: 'del_20230915_001',
          action: 'CASCADE_DELETE',
          timestamp: new Date('2023-09-15T10:00:00Z'),
          adminId: new ObjectId(),
          adminName: 'Test Admin 1',
          entityType: 'student',
          status: 'SUCCESS'
        },
        {
          operationId: 'cleanup_20230915_002',
          action: 'CLEANUP',
          timestamp: new Date('2023-09-15T11:00:00Z'),
          adminId: new ObjectId(),
          adminName: 'Test Admin 2',
          entityType: 'orphaned_references',
          status: 'FAILED'
        }
      ];

      await db.collection('deletionAuditLog').insertMany(auditEntries);
    });

    it('should return paginated audit log entries', async () => {
      const response = await request(app)
        .get('/api/admin/deletion/audit-log')
        .query({
          page: 1,
          limit: 10,
          sortBy: 'timestamp',
          sortOrder: 'desc'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('auditEntries');
      expect(response.body.data).toHaveProperty('pagination');
      expect(response.body.data).toHaveProperty('summary');
      expect(response.body.data.auditEntries).toHaveLength(2);
      expect(response.body.data.pagination.total).toBe(2);
      expect(response.body.data.summary.totalOperations).toBe(2);
    });

    it('should filter audit log by action type', async () => {
      const response = await request(app)
        .get('/api/admin/deletion/audit-log')
        .query({
          action: 'CASCADE_DELETE'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.auditEntries).toHaveLength(1);
      expect(response.body.data.auditEntries[0].action).toBe('CASCADE_DELETE');
    });

    it('should filter audit log by date range', async () => {
      const response = await request(app)
        .get('/api/admin/deletion/audit-log')
        .query({
          startDate: '2023-09-15T00:00:00Z',
          endDate: '2023-09-15T10:30:00Z'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.auditEntries).toHaveLength(1);
    });
  });

  describe('GET /api/admin/deletion/snapshots', () => {
    beforeEach(async () => {
      // Insert test snapshots
      const snapshots = [
        testHelpers.createSnapshotData('507f1f77bcf86cd799439001', {}),
        testHelpers.createSnapshotData('507f1f77bcf86cd799439002', {}),
        {
          ...testHelpers.createSnapshotData('507f1f77bcf86cd799439003', {}),
          expiresAt: new Date(Date.now() - 1000), // Expired
        }
      ];

      await db.collection('deletionSnapshots').insertMany(snapshots);
    });

    it('should return available snapshots excluding expired', async () => {
      const response = await request(app)
        .get('/api/admin/deletion/snapshots')
        .query({
          limit: 10,
          includeExpired: false
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('snapshots');
      expect(response.body.data.snapshots).toHaveLength(2);
      expect(response.body.data.availableForRollback).toBe(2);
    });

    it('should include expired snapshots when requested', async () => {
      const response = await request(app)
        .get('/api/admin/deletion/snapshots')
        .query({
          includeExpired: true
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.snapshots).toHaveLength(3);
      expect(response.body.data.availableForRollback).toBe(2); // Only non-expired can rollback
    });
  });

  describe('GET /api/admin/deletion/operations', () => {
    it('should return currently running operations', async () => {
      const response = await request(app)
        .get('/api/admin/deletion/operations')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('runningOperations');
      expect(response.body.data).toHaveProperty('totalOperations');
      expect(response.body.data).toHaveProperty('systemLoad');
      expect(Array.isArray(response.body.data.runningOperations)).toBe(true);
    });
  });

  describe('POST /api/admin/deletion/operations/:operationId/cancel', () => {
    it('should return not implemented for operation cancellation', async () => {
      const operationId = 'del_20230915_001';
      
      const response = await request(app)
        .post(`/api/admin/deletion/operations/${operationId}/cancel`)
        .send({})
        .expect(501);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('NOT_IMPLEMENTED');
      expect(response.body.code).toBe('CANCELLATION_NOT_IMPLEMENTED');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database connection errors gracefully', async () => {
      // Close database connection to simulate error
      await mongoClient.close();

      const response = await request(app)
        .post(`/api/admin/student/${MOCK_STUDENT_ID}/deletion-preview`)
        .send({})
        .expect(500);

      expect(response.body.success).toBe(false);

      // Reconnect for cleanup
      mongoClient = new MongoClient(mongoServer.getUri());
      await mongoClient.connect();
      db = mongoClient.db('test-conservatory');
    });

    it('should validate request body parameters', async () => {
      const response = await request(app)
        .delete(`/api/admin/student/${MOCK_STUDENT_ID}/cascade`)
        .send({
          hardDelete: 'invalid-boolean', // Invalid type
          preserveAcademic: 'not-a-boolean'
        });

      // Should still process with default values or handle gracefully
      expect(response.status).toBeLessThan(500);
    });

    it('should handle large student ID values', async () => {
      const veryLongId = 'a'.repeat(100);
      
      const response = await request(app)
        .post(`/api/admin/student/${veryLongId}/deletion-preview`)
        .send({})
        .expect(500);

      expect(response.body.success).toBe(false);
    });

    it('should track admin actions in audit log', async () => {
      await request(app)
        .delete(`/api/admin/student/${MOCK_STUDENT_ID}/cascade`)
        .send({ hardDelete: false })
        .expect(200);

      // Check if audit log was created
      const auditEntries = await db.collection('deletionAuditLog').find({
        adminName: 'Test Admin'
      }).toArray();

      expect(auditEntries.length).toBeGreaterThan(0);
      expect(auditEntries[0]).toHaveProperty('timestamp');
      expect(auditEntries[0]).toHaveProperty('operationId');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent API requests', async () => {
      // Create multiple students for concurrent testing
      const students = [];
      for (let i = 0; i < 5; i++) {
        const studentId = new ObjectId();
        students.push({
          _id: studentId,
          personalInfo: { fullName: `Test Student ${i}` },
          isActive: true
        });
      }
      await db.collection('students').insertMany(students);

      // Execute concurrent preview requests
      const promises = students.map(student =>
        request(app)
          .post(`/api/admin/student/${student._id}/deletion-preview`)
          .send({})
      );

      const responses = await Promise.all(promises);

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    it('should handle requests with large data payloads', async () => {
      const largePayload = {
        collections: new Array(1000).fill('testCollection'),
        notes: 'x'.repeat(10000)
      };

      const response = await request(app)
        .post('/api/admin/cleanup/orphaned-references')
        .send(largePayload);

      expect(response.status).toBeLessThan(500);
    });
  });
});