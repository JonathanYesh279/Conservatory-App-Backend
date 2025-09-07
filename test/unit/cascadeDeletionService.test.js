import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ObjectId } from 'mongodb';
import { cascadeDeletionService } from '../../services/cascadeDeletionService.js';
import { complexStudentScenario, testHelpers, MOCK_STUDENT_ID } from '../fixtures/cascade-test-data.js';

// Mock MongoDB service
const mockCollection = {
  findOne: vi.fn(),
  find: vi.fn(() => ({
    toArray: vi.fn()
  })),
  insertOne: vi.fn(),
  updateOne: vi.fn(),
  updateMany: vi.fn(),
  deleteOne: vi.fn(),
  deleteMany: vi.fn(),
  countDocuments: vi.fn(),
  replaceOne: vi.fn(),
  client: {
    startSession: vi.fn()
  }
};

const mockSession = {
  withTransaction: vi.fn(),
  endSession: vi.fn()
};

vi.mock('../../services/mongoDB.service.js', () => ({
  getCollection: vi.fn(() => mockCollection)
}));

describe('Cascade Deletion Service - Unit Tests', () => {
  let mockData;

  beforeEach(() => {
    vi.clearAllMocks();
    mockData = testHelpers.getCleanMockData();
    
    // Setup default mocks
    mockCollection.client.startSession.mockResolvedValue(mockSession);
    mockSession.withTransaction.mockImplementation(async (callback) => {
      return await callback();
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('cascadeDeleteStudent', () => {
    it('should successfully delete student with all relationships', async () => {
      // Arrange
      mockCollection.findOne.mockResolvedValueOnce(mockData.student);
      
      // Mock successful operations
      mockCollection.updateMany
        .mockResolvedValueOnce({ modifiedCount: 2 }) // teachers
        .mockResolvedValueOnce({ modifiedCount: 2 }) // orchestras
        .mockResolvedValueOnce({ modifiedCount: 2 }) // rehearsals
        .mockResolvedValueOnce({ modifiedCount: 1 }) // theory lessons
        .mockResolvedValueOnce({ modifiedCount: 1 }); // bagrut (soft delete)

      mockCollection.deleteMany.mockResolvedValueOnce({ deletedCount: 2 }); // activity attendance
      mockCollection.updateOne.mockResolvedValueOnce({ modifiedCount: 1 }); // student soft delete
      mockCollection.insertOne.mockResolvedValueOnce({ insertedId: 'snapshot123' }); // snapshot
      mockCollection.insertOne.mockResolvedValueOnce({ insertedId: 'audit123' }); // audit log

      // Act
      const result = await cascadeDeletionService.cascadeDeleteStudent(MOCK_STUDENT_ID, {
        hardDelete: false,
        preserveAcademic: true,
        createSnapshot: true
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.studentId).toBe(MOCK_STUDENT_ID);
      expect(result.operationCounts.teachersModified).toBe(2);
      expect(result.operationCounts.orchestrasModified).toBe(2);
      expect(result.operationCounts.rehearsalsModified).toBe(2);
      expect(result.operationCounts.theoryLessonsModified).toBe(1);
      expect(result.operationCounts.bagrutRecordsModified).toBe(1);
      expect(result.operationCounts.attendanceRecordsDeleted).toBe(2);
      expect(result.operationCounts.studentDeactivated).toBe(1);
      expect(result.snapshotId).toBeTruthy();
      expect(result.auditLog).toBeTruthy();
    });

    it('should handle hard delete with academic data removal', async () => {
      // Arrange
      mockCollection.findOne.mockResolvedValueOnce(mockData.student);
      
      mockCollection.updateMany.mockResolvedValue({ modifiedCount: 1 });
      mockCollection.deleteMany
        .mockResolvedValueOnce({ deletedCount: 1 }) // bagrut hard delete
        .mockResolvedValueOnce({ deletedCount: 2 }); // activity attendance
      mockCollection.deleteOne.mockResolvedValueOnce({ deletedCount: 1 }); // student hard delete
      mockCollection.insertOne.mockResolvedValueOnce({ insertedId: 'audit123' }); // audit log

      // Act
      const result = await cascadeDeletionService.cascadeDeleteStudent(MOCK_STUDENT_ID, {
        hardDelete: true,
        preserveAcademic: false,
        createSnapshot: false
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.operationCounts.studentDeleted).toBe(1);
      expect(result.snapshotId).toBeNull();
      expect(mockCollection.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ studentId: MOCK_STUDENT_ID }),
        expect.objectContaining({ session: mockSession })
      );
    });

    it('should fail when student does not exist', async () => {
      // Arrange
      mockCollection.findOne.mockResolvedValueOnce(null);

      // Act
      const result = await cascadeDeletionService.cascadeDeleteStudent(MOCK_STUDENT_ID);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
      expect(mockSession.withTransaction).not.toHaveBeenCalled();
    });

    it('should fail when student is already inactive', async () => {
      // Arrange
      const inactiveStudent = { ...mockData.student, isActive: false };
      mockCollection.findOne.mockResolvedValueOnce(inactiveStudent);

      // Act
      const result = await cascadeDeletionService.cascadeDeleteStudent(MOCK_STUDENT_ID);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('already inactive');
    });

    it('should handle transaction failure with rollback information', async () => {
      // Arrange
      mockCollection.findOne.mockResolvedValueOnce(mockData.student);
      mockCollection.insertOne.mockResolvedValueOnce({ insertedId: 'snapshot123' }); // snapshot creation succeeds
      
      const transactionError = new Error('Transaction failed');
      mockSession.withTransaction.mockRejectedValueOnce(transactionError);

      // Act
      const result = await cascadeDeletionService.cascadeDeleteStudent(MOCK_STUDENT_ID, {
        createSnapshot: true
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Transaction failed');
      expect(result.snapshotId).toBe('snapshot123');
      expect(mockSession.endSession).toHaveBeenCalled();
    });
  });

  describe('createDeletionSnapshot', () => {
    it('should create comprehensive snapshot of student data', async () => {
      // Arrange
      mockCollection.findOne.mockResolvedValueOnce(mockData.student);
      mockCollection.find.mockImplementation(() => ({
        toArray: vi.fn()
          .mockResolvedValueOnce(mockData.teachers) // teachers
          .mockResolvedValueOnce(mockData.orchestras) // orchestras
          .mockResolvedValueOnce(mockData.rehearsals) // rehearsals
          .mockResolvedValueOnce(mockData.theoryLessons) // theory lessons
          .mockResolvedValueOnce(mockData.bagrut) // bagrut
          .mockResolvedValueOnce(mockData.activityAttendance) // activity attendance
      }));
      mockCollection.insertOne.mockResolvedValueOnce({ insertedId: 'snapshot123' });

      // Act
      const snapshotId = await cascadeDeletionService.createDeletionSnapshot(MOCK_STUDENT_ID);

      // Assert
      expect(snapshotId).toBeTruthy();
      expect(mockCollection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: expect.any(String),
          studentId: MOCK_STUDENT_ID,
          createdAt: expect.any(Date),
          data: expect.objectContaining({
            student: mockData.student,
            teachers: mockData.teachers,
            orchestras: mockData.orchestras
          })
        })
      );
    });

    it('should handle snapshot creation failure', async () => {
      // Arrange
      const snapshotError = new Error('Snapshot creation failed');
      mockCollection.insertOne.mockRejectedValueOnce(snapshotError);

      // Act & Assert
      await expect(cascadeDeletionService.createDeletionSnapshot(MOCK_STUDENT_ID))
        .rejects.toThrow('Snapshot creation failed: Snapshot creation failed');
    });
  });

  describe('executeStudentCascade', () => {
    it('should execute all cascade operations within transaction', async () => {
      // Arrange
      const mockUpdateResults = { modifiedCount: 1 };
      const mockDeleteResults = { deletedCount: 1 };

      mockCollection.updateMany.mockResolvedValue(mockUpdateResults);
      mockCollection.deleteMany.mockResolvedValue(mockDeleteResults);
      mockCollection.updateOne.mockResolvedValue(mockUpdateResults);

      // Act
      const result = await cascadeDeletionService.executeStudentCascade(
        MOCK_STUDENT_ID,
        mockSession,
        { hardDelete: false, preserveAcademic: true }
      );

      // Assert
      expect(result.operations).toHaveLength(7); // All collections operations
      expect(result.operationCounts).toHaveProperty('teachersModified', 1);
      expect(result.operationCounts).toHaveProperty('orchestrasModified', 1);
      expect(result.operationCounts).toHaveProperty('rehearsalsModified', 1);
      expect(result.operationCounts).toHaveProperty('theoryLessonsModified', 1);
      expect(result.operationCounts).toHaveProperty('bagrutRecordsModified', 1);
      expect(result.operationCounts).toHaveProperty('attendanceRecordsDeleted', 1);
      expect(result.operationCounts).toHaveProperty('studentDeactivated', 1);
      expect(result.affectedCollections).toContain('teacher');
      expect(result.affectedCollections).toContain('orchestra');
      expect(result.affectedCollections).toContain('student');
    });

    it('should handle array filters for teacher schedules', async () => {
      // Arrange
      mockCollection.updateMany.mockResolvedValue({ modifiedCount: 1 });
      mockCollection.deleteMany.mockResolvedValue({ deletedCount: 0 });
      mockCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });

      // Act
      await cascadeDeletionService.executeStudentCascade(MOCK_STUDENT_ID, mockSession);

      // Assert - Check that teacher update uses array filters
      expect(mockCollection.updateMany).toHaveBeenCalledWith(
        { 'teaching.studentIds': MOCK_STUDENT_ID },
        expect.objectContaining({
          $pull: { 'teaching.studentIds': MOCK_STUDENT_ID },
          $set: expect.objectContaining({
            'schedules.$[schedule].isActive': false
          })
        }),
        expect.objectContaining({
          session: mockSession,
          arrayFilters: [{ 'schedule.studentId': MOCK_STUDENT_ID }]
        })
      );
    });

    it('should handle execution errors properly', async () => {
      // Arrange
      const executionError = new Error('Database operation failed');
      mockCollection.updateMany.mockRejectedValueOnce(executionError);

      // Act & Assert
      await expect(cascadeDeletionService.executeStudentCascade(MOCK_STUDENT_ID, mockSession))
        .rejects.toThrow('Cascade execution failed: Database operation failed');
    });
  });

  describe('cleanupOrphanedReferences', () => {
    it('should detect and report orphaned references in dry run mode', async () => {
      // Arrange
      const activeStudents = [{ _id: new ObjectId('507f1f77bcf86cd799439001') }];
      const teachersWithOrphans = [{
        _id: new ObjectId('teacher1'),
        teaching: {
          studentIds: [
            new ObjectId('507f1f77bcf86cd799439001'), // valid
            new ObjectId(MOCK_STUDENT_ID) // orphaned
          ]
        }
      }];

      mockCollection.find.mockImplementation(() => ({
        toArray: vi.fn()
          .mockResolvedValueOnce(activeStudents)
          .mockResolvedValueOnce(teachersWithOrphans)
          .mockResolvedValueOnce([]) // orchestras
      }));

      // Act
      const result = await cascadeDeletionService.cleanupOrphanedReferences(true);

      // Assert
      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(result.findings.orphanedTeacherReferences).toHaveLength(1);
      expect(result.findings.orphanedTeacherReferences[0]).toEqual({
        teacherId: new ObjectId('teacher1'),
        orphanedStudentIds: [new ObjectId(MOCK_STUDENT_ID)]
      });
      expect(result.totalOrphanedReferences).toBe(1);
    });

    it('should clean up orphaned references when not in dry run mode', async () => {
      // Arrange
      const activeStudents = [{ _id: new ObjectId('507f1f77bcf86cd799439001') }];
      const teachersWithOrphans = [{
        _id: new ObjectId('teacher1'),
        teaching: { studentIds: [new ObjectId(MOCK_STUDENT_ID)] }
      }];

      mockCollection.find.mockImplementation(() => ({
        toArray: vi.fn()
          .mockResolvedValueOnce(activeStudents)
          .mockResolvedValueOnce(teachersWithOrphans)
          .mockResolvedValueOnce([]) // orchestras
      }));

      mockCollection.updateOne.mockResolvedValueOnce({ modifiedCount: 1 });

      // Act
      const result = await cascadeDeletionService.cleanupOrphanedReferences(false);

      // Assert
      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(false);
      expect(mockSession.withTransaction).toHaveBeenCalled();
      expect(mockCollection.updateOne).toHaveBeenCalledWith(
        { _id: new ObjectId('teacher1') },
        { $pullAll: { 'teaching.studentIds': [new ObjectId(MOCK_STUDENT_ID)] } },
        { session: mockSession }
      );
    });

    it('should handle cleanup errors gracefully', async () => {
      // Arrange
      const cleanupError = new Error('Cleanup operation failed');
      mockCollection.find.mockRejectedValueOnce(cleanupError);

      // Act
      const result = await cascadeDeletionService.cleanupOrphanedReferences();

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Cleanup failed: Cleanup operation failed');
    });
  });

  describe('validateDeletionImpact', () => {
    it('should analyze student deletion impact correctly', async () => {
      // Arrange
      mockCollection.findOne.mockResolvedValueOnce(mockData.student);
      mockCollection.countDocuments
        .mockResolvedValueOnce(2) // teachers
        .mockResolvedValueOnce(2) // orchestras
        .mockResolvedValueOnce(3) // rehearsals
        .mockResolvedValueOnce(1) // theory lessons
        .mockResolvedValueOnce(1) // bagrut
        .mockResolvedValueOnce(5); // activity attendance

      // Act
      const result = await cascadeDeletionService.validateDeletionImpact(MOCK_STUDENT_ID);

      // Assert
      expect(result.success).toBe(true);
      expect(result.impact.studentExists).toBe(true);
      expect(result.impact.studentActive).toBe(true);
      expect(result.impact.totalReferences).toBe(14);
      expect(result.impact.relatedRecords.teacher).toBe(2);
      expect(result.impact.relatedRecords.bagrut).toBe(1);
      expect(result.impact.criticalDependencies).toContain('Academic bagrut records exist - consider preserveAcademic option');
      expect(result.impact.warnings).toContain(
        expect.objectContaining({
          type: 'Academic records exist - deletion will affect academic history'
        })
      );
    });

    it('should handle student not found', async () => {
      // Arrange
      mockCollection.findOne.mockResolvedValueOnce(null);

      // Act
      const result = await cascadeDeletionService.validateDeletionImpact(MOCK_STUDENT_ID);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should warn about students with no relationships', async () => {
      // Arrange
      mockCollection.findOne.mockResolvedValueOnce(mockData.student);
      mockCollection.countDocuments.mockResolvedValue(0); // No related records

      // Act
      const result = await cascadeDeletionService.validateDeletionImpact(MOCK_STUDENT_ID);

      // Assert
      expect(result.success).toBe(true);
      expect(result.impact.totalReferences).toBe(0);
      expect(result.impact.warnings).toContain(
        expect.objectContaining({
          type: 'No related records found - student may already be cleaned up'
        })
      );
    });
  });

  describe('rollbackDeletion', () => {
    it('should successfully rollback deletion from snapshot', async () => {
      // Arrange
      const snapshotData = testHelpers.createSnapshotData(MOCK_STUDENT_ID, {
        student: mockData.student,
        teachers: mockData.teachers.slice(0, 1),
        orchestras: mockData.orchestras.slice(0, 1)
      });

      mockCollection.findOne.mockResolvedValueOnce(snapshotData);
      mockCollection.replaceOne.mockResolvedValue({ modifiedCount: 1 });
      mockCollection.updateOne.mockResolvedValueOnce({ modifiedCount: 1 }); // Mark snapshot as used

      // Act
      const result = await cascadeDeletionService.rollbackDeletion(snapshotData._id.toString());

      // Assert
      expect(result.success).toBe(true);
      expect(result.studentId).toBe(MOCK_STUDENT_ID);
      expect(result.rollbackResults).toEqual({
        student: 'restored',
        teachers: 1,
        orchestras: 1
      });
      expect(mockSession.withTransaction).toHaveBeenCalled();
    });

    it('should handle snapshot not found', async () => {
      // Arrange
      mockCollection.findOne.mockResolvedValueOnce(null);

      // Act
      const result = await cascadeDeletionService.rollbackDeletion('nonexistent');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should handle rollback transaction failure', async () => {
      // Arrange
      const snapshotData = testHelpers.createSnapshotData(MOCK_STUDENT_ID, {});
      mockCollection.findOne.mockResolvedValueOnce(snapshotData);

      const rollbackError = new Error('Rollback transaction failed');
      mockSession.withTransaction.mockRejectedValueOnce(rollbackError);

      // Act
      const result = await cascadeDeletionService.rollbackDeletion(snapshotData._id.toString());

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Rollback transaction failed');
      expect(mockSession.endSession).toHaveBeenCalled();
    });
  });

  describe('generateDeletionAuditLog', () => {
    it('should create comprehensive audit log entry', async () => {
      // Arrange
      const operations = [
        { collection: 'teacher', operation: 'updateMany', modifiedCount: 2 },
        { collection: 'student', operation: 'updateOne', modifiedCount: 1 }
      ];
      const metadata = {
        startTime: new Date('2023-09-15T10:00:00Z'),
        endTime: new Date('2023-09-15T10:01:00Z'),
        snapshotId: 'snapshot123',
        options: { hardDelete: false }
      };

      mockCollection.insertOne.mockResolvedValueOnce({ insertedId: 'audit123' });

      // Act
      const auditLog = await cascadeDeletionService.generateDeletionAuditLog(
        MOCK_STUDENT_ID,
        operations,
        metadata
      );

      // Assert
      expect(auditLog._id).toBeTruthy();
      expect(auditLog.type).toBe('student_cascade_deletion');
      expect(auditLog.studentId).toBe(MOCK_STUDENT_ID);
      expect(auditLog.operations).toEqual(operations);
      expect(auditLog.metadata).toEqual(metadata);
      expect(auditLog.summary).toEqual({
        totalOperations: 2,
        collectionsAffected: ['teacher', 'student'],
        executionTime: metadata.executionTime || null,
        snapshotCreated: true
      });

      expect(mockCollection.insertOne).toHaveBeenCalledWith(auditLog);
    });

    it('should handle audit log creation failure gracefully', async () => {
      // Arrange
      const auditError = new Error('Audit log creation failed');
      mockCollection.insertOne.mockRejectedValueOnce(auditError);

      // Act
      const result = await cascadeDeletionService.generateDeletionAuditLog(
        MOCK_STUDENT_ID,
        [],
        {}
      );

      // Assert
      expect(result.error).toBe('Audit log generation failed');
      expect(result.message).toBe('Audit log creation failed');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle MongoDB session creation failure', async () => {
      // Arrange
      mockCollection.findOne.mockResolvedValueOnce(mockData.student);
      mockCollection.insertOne.mockResolvedValueOnce({ insertedId: 'snapshot123' });
      
      const sessionError = new Error('Session creation failed');
      mockCollection.client.startSession.mockRejectedValueOnce(sessionError);

      // Act
      const result = await cascadeDeletionService.cascadeDeleteStudent(MOCK_STUDENT_ID);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Session creation failed');
    });

    it('should handle partial operation failures during cascade execution', async () => {
      // Arrange
      mockCollection.updateMany
        .mockResolvedValueOnce({ modifiedCount: 2 }) // teachers succeed
        .mockRejectedValueOnce(new Error('Orchestra update failed')); // orchestras fail

      // Act & Assert
      await expect(cascadeDeletionService.executeStudentCascade(MOCK_STUDENT_ID, mockSession))
        .rejects.toThrow('Cascade execution failed: Orchestra update failed');
    });

    it('should ensure session cleanup on all execution paths', async () => {
      // Arrange
      mockCollection.findOne.mockResolvedValueOnce(mockData.student);
      mockSession.withTransaction.mockRejectedValueOnce(new Error('Transaction failed'));

      // Act
      await cascadeDeletionService.cascadeDeleteStudent(MOCK_STUDENT_ID);

      // Assert
      expect(mockSession.endSession).toHaveBeenCalled();
    });
  });
});