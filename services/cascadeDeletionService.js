import { getCollection } from './mongoDB.service.js';
import dayjs from 'dayjs';

/**
 * Cascade Deletion Service for Student Records
 * Handles comprehensive cleanup across all related collections with transaction safety
 */
export const cascadeDeletionService = {
  cascadeDeleteStudent,
  createDeletionSnapshot,
  executeStudentCascade,
  cleanupOrphanedReferences,
  validateDeletionImpact,
  rollbackDeletion,
  generateDeletionAuditLog
};

/**
 * Main cascade deletion function for student records
 * @param {string} studentId - MongoDB ObjectId as string
 * @param {Object} options - Deletion options
 * @param {boolean} options.hardDelete - Whether to permanently delete records
 * @param {boolean} options.preserveAcademic - Whether to preserve academic records (bagrut)
 * @param {boolean} options.createSnapshot - Whether to create rollback snapshot
 * @returns {Promise<Object>} Deletion result with operation counts
 */
async function cascadeDeleteStudent(studentId, options = {}) {
  const {
    hardDelete = false,
    preserveAcademic = true,
    createSnapshot = true
  } = options;

  const startTime = new Date();
  let session = null;
  let snapshotId = null;
  
  try {
    // Validate student exists
    const studentCollection = await getCollection('student');
    const student = await studentCollection.findOne({ _id: studentId });
    
    if (!student) {
      throw new Error(`Student with ID ${studentId} not found`);
    }

    if (!student.isActive) {
      throw new Error(`Student with ID ${studentId} is already inactive`);
    }

    // Create snapshot if requested
    if (createSnapshot) {
      snapshotId = await createDeletionSnapshot(studentId);
    }

    // Start MongoDB session for transaction
    session = studentCollection.client.startSession();
    
    let result;
    await session.withTransaction(async () => {
      result = await executeStudentCascade(studentId, session, {
        hardDelete,
        preserveAcademic
      });
    });

    // Generate audit log
    const auditLog = await generateDeletionAuditLog(studentId, result.operations, {
      startTime,
      endTime: new Date(),
      snapshotId,
      options
    });

    return {
      success: true,
      studentId,
      snapshotId,
      operationCounts: result.operationCounts,
      affectedCollections: result.affectedCollections,
      executionTime: new Date() - startTime,
      auditLog
    };

  } catch (error) {
    console.error(`Cascade deletion failed for student ${studentId}:`, error);
    
    // If we created a snapshot and deletion failed, log rollback option
    if (snapshotId) {
      console.log(`Rollback available using snapshot ID: ${snapshotId}`);
    }

    return {
      success: false,
      studentId,
      snapshotId,
      error: error.message,
      executionTime: new Date() - startTime
    };
  } finally {
    if (session) {
      await session.endSession();
    }
  }
}

/**
 * Creates a comprehensive snapshot of student data before deletion
 * @param {string} studentId - Student ID to snapshot
 * @returns {Promise<string>} Snapshot ID for rollback
 */
async function createDeletionSnapshot(studentId) {
  try {
    const snapshotId = `snapshot_${studentId}_${Date.now()}`;
    const snapshot = {
      _id: snapshotId,
      studentId,
      createdAt: new Date(),
      data: {}
    };

    // Collect data from all related collections
    const collections = ['student', 'teacher', 'orchestra', 'rehearsal', 'theory_lesson', 'bagrut', 'activity_attendance'];
    
    for (const collectionName of collections) {
      const collection = await getCollection(collectionName);
      
      switch (collectionName) {
        case 'student':
          snapshot.data.student = await collection.findOne({ _id: studentId });
          break;
          
        case 'teacher':
          snapshot.data.teachers = await collection.find({
            'teaching.studentIds': studentId
          }).toArray();
          break;
          
        case 'orchestra':
          snapshot.data.orchestras = await collection.find({
            memberIds: studentId
          }).toArray();
          break;
          
        case 'rehearsal':
          snapshot.data.rehearsals = await collection.find({
            'attendance.studentId': studentId
          }).toArray();
          break;
          
        case 'theory_lesson':
          snapshot.data.theoryLessons = await collection.find({
            studentIds: studentId
          }).toArray();
          break;
          
        case 'bagrut':
          snapshot.data.bagrut = await collection.find({
            studentId: studentId
          }).toArray();
          break;
          
        case 'activity_attendance':
          snapshot.data.activityAttendance = await collection.find({
            studentId: studentId
          }).toArray();
          break;
      }
    }

    // Store snapshot
    const snapshotCollection = await getCollection('deletion_snapshots');
    await snapshotCollection.insertOne(snapshot);
    
    return snapshotId;
    
  } catch (error) {
    console.error('Failed to create deletion snapshot:', error);
    throw new Error(`Snapshot creation failed: ${error.message}`);
  }
}

/**
 * Executes the actual cascade deletion operations within a transaction
 * @param {string} studentId - Student ID to delete
 * @param {Object} session - MongoDB session for transaction
 * @param {Object} options - Execution options
 * @returns {Promise<Object>} Operation results
 */
async function executeStudentCascade(studentId, session, options = {}) {
  const { hardDelete = false, preserveAcademic = true } = options;
  const operations = [];
  const operationCounts = {};
  const affectedCollections = new Set();

  try {
    // 1. Clean up teacher relationships
    const teacherCollection = await getCollection('teacher');
    const teacherUpdateResult = await teacherCollection.updateMany(
      { 'teaching.studentIds': studentId },
      { 
        $pull: { 'teaching.studentIds': studentId },
        $set: { 
          'teaching.lastModified': new Date(),
          'schedules.$[schedule].isActive': false 
        }
      },
      { 
        session,
        arrayFilters: [{ 'schedule.studentId': studentId }]
      }
    );
    
    operations.push({
      collection: 'teacher',
      operation: 'updateMany',
      filter: 'teaching.studentIds',
      modifiedCount: teacherUpdateResult.modifiedCount
    });
    operationCounts.teachersModified = teacherUpdateResult.modifiedCount;
    if (teacherUpdateResult.modifiedCount > 0) affectedCollections.add('teacher');

    // 2. Clean up orchestra memberships
    const orchestraCollection = await getCollection('orchestra');
    const orchestraUpdateResult = await orchestraCollection.updateMany(
      { memberIds: studentId },
      { 
        $pull: { memberIds: studentId },
        $set: { lastModified: new Date() }
      },
      { session }
    );
    
    operations.push({
      collection: 'orchestra',
      operation: 'updateMany',
      filter: 'memberIds',
      modifiedCount: orchestraUpdateResult.modifiedCount
    });
    operationCounts.orchestrasModified = orchestraUpdateResult.modifiedCount;
    if (orchestraUpdateResult.modifiedCount > 0) affectedCollections.add('orchestra');

    // 3. Clean up rehearsal attendance
    const rehearsalCollection = await getCollection('rehearsal');
    const rehearsalUpdateResult = await rehearsalCollection.updateMany(
      { 'attendance.studentId': studentId },
      { 
        $pull: { attendance: { studentId: studentId } },
        $set: { lastModified: new Date() }
      },
      { session }
    );
    
    operations.push({
      collection: 'rehearsal',
      operation: 'updateMany',
      filter: 'attendance.studentId',
      modifiedCount: rehearsalUpdateResult.modifiedCount
    });
    operationCounts.rehearsalsModified = rehearsalUpdateResult.modifiedCount;
    if (rehearsalUpdateResult.modifiedCount > 0) affectedCollections.add('rehearsal');

    // 4. Clean up theory lesson enrollments
    const theoryLessonCollection = await getCollection('theory_lesson');
    const theoryUpdateResult = await theoryLessonCollection.updateMany(
      { studentIds: studentId },
      { 
        $pull: { studentIds: studentId },
        $set: { lastModified: new Date() }
      },
      { session }
    );
    
    operations.push({
      collection: 'theory_lesson',
      operation: 'updateMany',
      filter: 'studentIds',
      modifiedCount: theoryUpdateResult.modifiedCount
    });
    operationCounts.theoryLessonsModified = theoryUpdateResult.modifiedCount;
    if (theoryUpdateResult.modifiedCount > 0) affectedCollections.add('theory_lesson');

    // 5. Handle bagrut records
    const bagrutCollection = await getCollection('bagrut');
    let bagrutResult;
    
    if (preserveAcademic) {
      // Soft delete bagrut records
      bagrutResult = await bagrutCollection.updateMany(
        { studentId: studentId },
        { 
          $set: { 
            isActive: false,
            deactivatedAt: new Date(),
            deactivationReason: 'Student cascade deletion'
          }
        },
        { session }
      );
      
      operations.push({
        collection: 'bagrut',
        operation: 'updateMany (soft delete)',
        filter: 'studentId',
        modifiedCount: bagrutResult.modifiedCount
      });
    } else {
      // Hard delete bagrut records if specified
      bagrutResult = await bagrutCollection.deleteMany(
        { studentId: studentId },
        { session }
      );
      
      operations.push({
        collection: 'bagrut',
        operation: 'deleteMany',
        filter: 'studentId',
        deletedCount: bagrutResult.deletedCount
      });
    }
    
    operationCounts.bagrutRecordsModified = preserveAcademic ? bagrutResult.modifiedCount : bagrutResult.deletedCount;
    if (operationCounts.bagrutRecordsModified > 0) affectedCollections.add('bagrut');

    // 6. Clean up activity attendance
    const activityAttendanceCollection = await getCollection('activity_attendance');
    const attendanceDeleteResult = await activityAttendanceCollection.deleteMany(
      { studentId: studentId },
      { session }
    );
    
    operations.push({
      collection: 'activity_attendance',
      operation: 'deleteMany',
      filter: 'studentId',
      deletedCount: attendanceDeleteResult.deletedCount
    });
    operationCounts.attendanceRecordsDeleted = attendanceDeleteResult.deletedCount;
    if (attendanceDeleteResult.deletedCount > 0) affectedCollections.add('activity_attendance');

    // 7. Handle main student record
    const studentCollection = await getCollection('student');
    let studentResult;
    
    if (hardDelete) {
      studentResult = await studentCollection.deleteOne(
        { _id: studentId },
        { session }
      );
      
      operations.push({
        collection: 'student',
        operation: 'deleteOne',
        filter: '_id',
        deletedCount: studentResult.deletedCount
      });
      operationCounts.studentDeleted = studentResult.deletedCount;
    } else {
      // Soft delete student
      studentResult = await studentCollection.updateOne(
        { _id: studentId },
        { 
          $set: { 
            isActive: false,
            deactivatedAt: new Date(),
            deactivationReason: 'Cascade deletion',
            lastModified: new Date()
          }
        },
        { session }
      );
      
      operations.push({
        collection: 'student',
        operation: 'updateOne (soft delete)',
        filter: '_id',
        modifiedCount: studentResult.modifiedCount
      });
      operationCounts.studentDeactivated = studentResult.modifiedCount;
    }
    
    affectedCollections.add('student');

    return {
      operations,
      operationCounts,
      affectedCollections: Array.from(affectedCollections)
    };

  } catch (error) {
    console.error('Cascade execution failed:', error);
    throw new Error(`Cascade execution failed: ${error.message}`);
  }
}

/**
 * Cleans up orphaned references across collections
 * @param {boolean} dryRun - Whether to only report findings without making changes
 * @returns {Promise<Object>} Cleanup results
 */
async function cleanupOrphanedReferences(dryRun = true) {
  try {
    const findings = {
      orphanedTeacherReferences: [],
      orphanedOrchestraReferences: [],
      orphanedRehearsalReferences: [],
      orphanedTheoryReferences: [],
      orphanedBagrutRecords: [],
      orphanedAttendanceRecords: []
    };

    // Get all active student IDs
    const studentCollection = await getCollection('student');
    const activeStudents = await studentCollection.find(
      { isActive: true },
      { projection: { _id: 1 } }
    ).toArray();
    const activeStudentIds = new Set(activeStudents.map(s => s._id.toString()));

    // Check teacher references
    const teacherCollection = await getCollection('teacher');
    const teachersWithStudents = await teacherCollection.find({
      'teaching.studentIds': { $exists: true, $ne: [] }
    }).toArray();

    for (const teacher of teachersWithStudents) {
      const orphanedIds = teacher.teaching.studentIds.filter(
        id => !activeStudentIds.has(id.toString())
      );
      if (orphanedIds.length > 0) {
        findings.orphanedTeacherReferences.push({
          teacherId: teacher._id,
          orphanedStudentIds: orphanedIds
        });
      }
    }

    // Check orchestra references
    const orchestraCollection = await getCollection('orchestra');
    const orchestrasWithMembers = await orchestraCollection.find({
      memberIds: { $exists: true, $ne: [] }
    }).toArray();

    for (const orchestra of orchestrasWithMembers) {
      const orphanedIds = orchestra.memberIds.filter(
        id => !activeStudentIds.has(id.toString())
      );
      if (orphanedIds.length > 0) {
        findings.orphanedOrchestraReferences.push({
          orchestraId: orchestra._id,
          orphanedStudentIds: orphanedIds
        });
      }
    }

    // Check other collections...
    // (Similar pattern for rehearsal, theory_lesson, bagrut, activity_attendance)

    if (!dryRun && (findings.orphanedTeacherReferences.length > 0 || findings.orphanedOrchestraReferences.length > 0)) {
      // Execute cleanup operations
      const session = await studentCollection.client.startSession();
      
      try {
        await session.withTransaction(async () => {
          // Clean teacher references
          for (const item of findings.orphanedTeacherReferences) {
            await teacherCollection.updateOne(
              { _id: item.teacherId },
              { $pullAll: { 'teaching.studentIds': item.orphanedStudentIds } },
              { session }
            );
          }

          // Clean orchestra references
          for (const item of findings.orphanedOrchestraReferences) {
            await orchestraCollection.updateOne(
              { _id: item.orchestraId },
              { $pullAll: { memberIds: item.orphanedStudentIds } },
              { session }
            );
          }
        });
      } finally {
        await session.endSession();
      }
    }

    return {
      success: true,
      dryRun,
      findings,
      totalOrphanedReferences: Object.values(findings).reduce((sum, arr) => sum + arr.length, 0)
    };

  } catch (error) {
    console.error('Orphaned reference cleanup failed:', error);
    throw new Error(`Cleanup failed: ${error.message}`);
  }
}

/**
 * Validates the impact of deleting a student
 * @param {string} studentId - Student ID to analyze
 * @returns {Promise<Object>} Impact analysis
 */
async function validateDeletionImpact(studentId) {
  try {
    const impact = {
      studentExists: false,
      relatedRecords: {},
      totalReferences: 0,
      criticalDependencies: [],
      warnings: []
    };

    // Check if student exists and is active
    const studentCollection = await getCollection('student');
    const student = await studentCollection.findOne({ _id: studentId });
    
    if (!student) {
      throw new Error(`Student with ID ${studentId} not found`);
    }
    
    impact.studentExists = true;
    impact.studentActive = student.isActive;

    // Count related records
    const collections = ['teacher', 'orchestra', 'rehearsal', 'theory_lesson', 'bagrut', 'activity_attendance'];
    
    for (const collectionName of collections) {
      const collection = await getCollection(collectionName);
      let count = 0;
      
      switch (collectionName) {
        case 'teacher':
          count = await collection.countDocuments({ 'teaching.studentIds': studentId });
          break;
        case 'orchestra':
          count = await collection.countDocuments({ memberIds: studentId });
          break;
        case 'rehearsal':
          count = await collection.countDocuments({ 'attendance.studentId': studentId });
          break;
        case 'theory_lesson':
          count = await collection.countDocuments({ studentIds: studentId });
          break;
        case 'bagrut':
          count = await collection.countDocuments({ studentId: studentId });
          if (count > 0) {
            impact.criticalDependencies.push('Academic bagrut records exist - consider preserveAcademic option');
          }
          break;
        case 'activity_attendance':
          count = await collection.countDocuments({ studentId: studentId });
          break;
      }
      
      impact.relatedRecords[collectionName] = count;
      impact.totalReferences += count;
    }

    // Add warnings
    if (impact.totalReferences === 0) {
      impact.warnings.push('No related records found - student may already be cleaned up');
    }
    
    if (impact.relatedRecords.bagrut > 0) {
      impact.warnings.push('Academic records exist - deletion will affect academic history');
    }

    return {
      success: true,
      studentId,
      impact
    };

  } catch (error) {
    console.error('Deletion impact validation failed:', error);
    return {
      success: false,
      studentId,
      error: error.message
    };
  }
}

/**
 * Rolls back a deletion using a snapshot
 * @param {string} snapshotId - Snapshot ID to restore from
 * @returns {Promise<Object>} Rollback result
 */
async function rollbackDeletion(snapshotId) {
  let session = null;
  
  try {
    // Get snapshot data
    const snapshotCollection = await getCollection('deletion_snapshots');
    const snapshot = await snapshotCollection.findOne({ _id: snapshotId });
    
    if (!snapshot) {
      throw new Error(`Snapshot with ID ${snapshotId} not found`);
    }

    const studentCollection = await getCollection('student');
    session = studentCollection.client.startSession();
    
    const rollbackResults = {};
    
    await session.withTransaction(async () => {
      // Restore student record
      if (snapshot.data.student) {
        const studentCollection = await getCollection('student');
        await studentCollection.replaceOne(
          { _id: snapshot.data.student._id },
          snapshot.data.student,
          { session, upsert: true }
        );
        rollbackResults.student = 'restored';
      }

      // Restore teacher relationships
      if (snapshot.data.teachers) {
        const teacherCollection = await getCollection('teacher');
        for (const teacher of snapshot.data.teachers) {
          await teacherCollection.replaceOne(
            { _id: teacher._id },
            teacher,
            { session }
          );
        }
        rollbackResults.teachers = snapshot.data.teachers.length;
      }

      // Restore other collections similarly...
      // Orchestra, rehearsal, theory_lesson, bagrut, activity_attendance
      
      const collections = ['orchestras', 'rehearsals', 'theoryLessons', 'bagrut', 'activityAttendance'];
      for (const collectionKey of collections) {
        if (snapshot.data[collectionKey]) {
          const collectionName = collectionKey.replace(/s$/, '').replace('theoryLessons', 'theory_lesson').replace('activityAttendance', 'activity_attendance');
          const collection = await getCollection(collectionName);
          
          for (const doc of snapshot.data[collectionKey]) {
            await collection.replaceOne(
              { _id: doc._id },
              doc,
              { session, upsert: true }
            );
          }
          rollbackResults[collectionKey] = snapshot.data[collectionKey].length;
        }
      }
    });

    // Mark snapshot as used
    await snapshotCollection.updateOne(
      { _id: snapshotId },
      { 
        $set: { 
          usedAt: new Date(),
          status: 'used_for_rollback'
        }
      }
    );

    return {
      success: true,
      snapshotId,
      studentId: snapshot.studentId,
      rollbackResults,
      restoredAt: new Date()
    };

  } catch (error) {
    console.error(`Rollback failed for snapshot ${snapshotId}:`, error);
    return {
      success: false,
      snapshotId,
      error: error.message
    };
  } finally {
    if (session) {
      await session.endSession();
    }
  }
}

/**
 * Generates comprehensive audit log for deletion operations
 * @param {string} studentId - Student ID that was deleted
 * @param {Array} operations - Array of operations performed
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} Audit log entry
 */
async function generateDeletionAuditLog(studentId, operations, metadata = {}) {
  try {
    const auditLog = {
      _id: `audit_${studentId}_${Date.now()}`,
      type: 'student_cascade_deletion',
      studentId,
      timestamp: new Date(),
      operations,
      metadata,
      summary: {
        totalOperations: operations.length,
        collectionsAffected: [...new Set(operations.map(op => op.collection))],
        executionTime: metadata.executionTime || null,
        snapshotCreated: !!metadata.snapshotId
      }
    };

    // Store audit log
    const auditCollection = await getCollection('audit_logs');
    await auditCollection.insertOne(auditLog);

    return auditLog;

  } catch (error) {
    console.error('Failed to generate audit log:', error);
    // Don't throw - audit logging failure shouldn't break the main operation
    return {
      error: 'Audit log generation failed',
      message: error.message
    };
  }
}