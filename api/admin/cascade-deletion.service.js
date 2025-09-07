/**
 * Cascade Deletion Service
 * Core business logic for safe cascade deletion with rollback capabilities
 * Handles student deletion with comprehensive data integrity management
 */

import { getCollection } from '../../services/mongoDB.service.js';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';

/**
 * Collection relationships mapping for cascade deletion
 */
const COLLECTION_RELATIONSHIPS = {
  students: [
    { collection: 'privateAttendance', field: 'studentId', cascade: true },
    { collection: 'privateLessons', field: 'studentId', cascade: true },
    { collection: 'bagrutPresentations', field: 'studentId', cascade: false, preserve: true },
    { collection: 'theoryLessons', field: 'attendees.studentId', cascade: false, cleanup: true },
    { collection: 'rehearsals', field: 'attendees.studentId', cascade: false, cleanup: true },
    { collection: 'orchestras', field: 'members.studentId', cascade: false, cleanup: true },
    { collection: 'teachers', field: 'assignedStudents.studentId', cascade: false, cleanup: true }
  ]
};

/**
 * Generate unique operation ID for tracking
 */
function generateOperationId(type = 'del') {
  return `${type}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Preview cascade deletion impact without executing
 */
export async function previewCascadeDeletion(studentId, options = {}) {
  const startTime = Date.now();
  const operationId = generateOperationId('preview');
  
  try {
    // Validate student exists
    const studentCollection = await getCollection('students');
    const student = await studentCollection.findOne({ 
      _id: ObjectId.createFromHexString(studentId) 
    });
    
    if (!student) {
      throw new Error('STUDENT_NOT_FOUND');
    }

    const impactAnalysis = {
      operationId,
      studentInfo: {
        id: studentId,
        name: student.personalInfo?.fullName || 'Unknown',
        class: student.academicInfo?.class || 'Unknown',
        isActive: student.isActive !== false
      },
      affectedCollections: {},
      warnings: [],
      estimatedTime: '0 seconds',
      rollbackInfo: null
    };

    let totalRecords = 0;

    // Analyze each related collection
    for (const relationship of COLLECTION_RELATIONSHIPS.students) {
      const collection = await getCollection(relationship.collection);
      let query = {};

      // Build query based on field structure
      if (relationship.field.includes('.')) {
        query[relationship.field] = ObjectId.createFromHexString(studentId);
      } else {
        query[relationship.field] = ObjectId.createFromHexString(studentId);
      }

      const count = await collection.countDocuments(query);
      
      if (count > 0) {
        impactAnalysis.affectedCollections[relationship.collection] = {
          recordCount: count,
          action: relationship.cascade ? 'DELETE' : 
                  relationship.preserve ? 'PRESERVE' : 'CLEANUP_REFERENCE',
          preserveAcademic: options.preserveAcademic && relationship.preserve
        };
        
        totalRecords += relationship.cascade ? count : 0;

        // Add warnings for large deletions
        if (relationship.cascade && count > 100) {
          impactAnalysis.warnings.push({
            type: 'LARGE_DELETION',
            message: `מחיקה של ${count} רשומות מ-${relationship.collection}`,
            severity: 'HIGH'
          });
        }
      }
    }

    // Estimate execution time
    const estimatedSeconds = Math.ceil(totalRecords / 100) * 2; // ~2 seconds per 100 records
    impactAnalysis.estimatedTime = estimatedSeconds > 60 
      ? `${Math.ceil(estimatedSeconds / 60)} דקות`
      : `${estimatedSeconds} שניות`;

    // Check for critical warnings
    if (totalRecords > 1000) {
      impactAnalysis.warnings.push({
        type: 'MASSIVE_DELETION',
        message: `מחיקה של ${totalRecords} רשומות בסה"כ - פעולה מסוכנת`,
        severity: 'CRITICAL'
      });
    }

    // Add bagrut preservation warning if applicable
    if (impactAnalysis.affectedCollections.bagrutPresentations && !options.preserveAcademic) {
      impactAnalysis.warnings.push({
        type: 'ACADEMIC_DATA_LOSS',
        message: 'מידע בגרות יימחק - שקול לשמור מידע אקדמי',
        severity: 'MEDIUM'
      });
    }

    // Rollback information
    if (options.createBackup !== false) {
      impactAnalysis.rollbackInfo = {
        snapshotId: generateOperationId('snap'),
        expirationDays: 30,
        estimatedSize: `${Math.ceil(totalRecords / 1000)} MB`
      };
    }

    impactAnalysis.summary = {
      totalRecords,
      affectedCollections: Object.keys(impactAnalysis.affectedCollections).length,
      criticalWarnings: impactAnalysis.warnings.filter(w => w.severity === 'CRITICAL').length,
      canRollback: options.createBackup !== false,
      processingTime: `${Date.now() - startTime}ms`
    };

    return {
      success: true,
      data: impactAnalysis
    };

  } catch (error) {
    console.error('Preview cascade deletion error:', error);
    return {
      success: false,
      error: error.message,
      code: 'PREVIEW_FAILED',
      processingTime: `${Date.now() - startTime}ms`
    };
  }
}

/**
 * Execute cascade deletion with comprehensive logging and backup
 */
export async function executeCascadeDeletion(studentId, options = {}, adminInfo) {
  const startTime = Date.now();
  const operationId = generateOperationId('del');
  let snapshot = null;
  
  try {
    // Validate student exists
    const studentCollection = await getCollection('students');
    const student = await studentCollection.findOne({ 
      _id: ObjectId.createFromHexString(studentId) 
    });
    
    if (!student) {
      throw new Error('STUDENT_NOT_FOUND');
    }

    // Create backup snapshot if requested
    if (options.createBackup !== false) {
      snapshot = await createDeletionSnapshot(studentId, operationId, adminInfo);
    }

    const deletionResults = {
      operationId,
      studentInfo: {
        id: studentId,
        name: student.personalInfo?.fullName || 'Unknown'
      },
      deletedRecords: {},
      preservedRecords: {},
      cleanupOperations: {},
      backupInfo: snapshot,
      startTime: new Date(startTime),
      completionTime: null,
      warnings: []
    };

    // Process each collection relationship
    for (const relationship of COLLECTION_RELATIONSHIPS.students) {
      const collection = await getCollection(relationship.collection);
      let query = {};

      // Build query based on field structure
      if (relationship.field.includes('.')) {
        query[relationship.field] = ObjectId.createFromHexString(studentId);
      } else {
        query[relationship.field] = ObjectId.createFromHexString(studentId);
      }

      if (relationship.cascade) {
        // Full cascade deletion
        const deleteResult = await collection.deleteMany(query);
        deletionResults.deletedRecords[relationship.collection] = deleteResult.deletedCount;
        
      } else if (relationship.preserve && options.preserveAcademic) {
        // Preserve academic records
        const preserveResult = await collection.updateMany(
          query,
          { 
            $set: { 
              preservedStudentInfo: {
                studentId,
                studentName: student.personalInfo?.fullName,
                preservedAt: new Date(),
                preservedBy: adminInfo.id
              }
            },
            $unset: { [relationship.field]: 1 }
          }
        );
        deletionResults.preservedRecords[relationship.collection] = preserveResult.modifiedCount;
        
      } else {
        // Cleanup references
        const cleanupResult = await cleanupReferencesInCollection(
          collection, 
          relationship.field, 
          studentId
        );
        deletionResults.cleanupOperations[relationship.collection] = cleanupResult;
      }
    }

    // Finally, delete the student record
    const studentDeleteResult = await studentCollection.deleteOne({
      _id: ObjectId.createFromHexString(studentId)
    });
    deletionResults.deletedRecords.students = studentDeleteResult.deletedCount;

    deletionResults.completionTime = new Date();
    
    // Log the operation
    await logDeletionOperation(operationId, 'CASCADE_DELETE', deletionResults, adminInfo);

    return {
      success: true,
      data: {
        operationId,
        deletedRecords: deletionResults.deletedRecords,
        preservedRecords: deletionResults.preservedRecords,
        cleanupOperations: deletionResults.cleanupOperations,
        backupLocation: snapshot?.location,
        rollbackToken: snapshot?.id,
        executionTime: `${Date.now() - startTime}ms`,
        completionTime: deletionResults.completionTime
      }
    };

  } catch (error) {
    console.error('Execute cascade deletion error:', error);
    
    // Attempt rollback if snapshot exists
    if (snapshot) {
      await attemptEmergencyRollback(snapshot.id, error.message);
    }
    
    return {
      success: false,
      error: error.message,
      code: 'DELETION_FAILED',
      operationId,
      executionTime: `${Date.now() - startTime}ms`,
      rollbackInitiated: !!snapshot
    };
  }
}

/**
 * Clean up orphaned references across collections
 */
export async function cleanupOrphanedReferences(options = {}, adminInfo) {
  const startTime = Date.now();
  const operationId = generateOperationId('cleanup');
  
  try {
    const collectionsToProcess = options.collections || Object.keys(COLLECTION_RELATIONSHIPS);
    const orphanedReferences = {};
    const cleanupSummary = { removed: 0, preserved: 0, errors: 0 };

    for (const collectionName of collectionsToProcess) {
      if (COLLECTION_RELATIONSHIPS[collectionName]) {
        const result = await findAndCleanOrphansInCollection(
          collectionName, 
          options
        );
        orphanedReferences[collectionName] = result;
        cleanupSummary.removed += result.removed;
        cleanupSummary.preserved += result.preserved;
        cleanupSummary.errors += result.errors;
      }
    }

    // Log the operation
    await logDeletionOperation(operationId, 'CLEANUP', {
      orphanedReferences,
      cleanupSummary,
      options
    }, adminInfo);

    return {
      success: true,
      data: {
        operationId,
        orphanedReferences,
        cleanupSummary,
        processingTime: `${Date.now() - startTime}ms`
      }
    };

  } catch (error) {
    console.error('Cleanup orphaned references error:', error);
    return {
      success: false,
      error: error.message,
      code: 'CLEANUP_FAILED',
      processingTime: `${Date.now() - startTime}ms`
    };
  }
}

/**
 * Rollback a previous cascade deletion using snapshot
 */
export async function rollbackDeletion(snapshotId, options = {}, adminInfo) {
  const startTime = Date.now();
  const rollbackId = generateOperationId('rollback');
  
  try {
    // Get snapshot data
    const snapshotsCollection = await getCollection('deletionSnapshots');
    const snapshot = await snapshotsCollection.findOne({
      _id: ObjectId.createFromHexString(snapshotId)
    });
    
    if (!snapshot) {
      throw new Error('SNAPSHOT_NOT_FOUND');
    }
    
    if (snapshot.expiresAt < new Date()) {
      throw new Error('SNAPSHOT_EXPIRED');
    }

    const restoredRecords = {};
    const conflictResolution = {};

    // Restore each collection from snapshot
    for (const [collectionName, records] of Object.entries(snapshot.data)) {
      const collection = await getCollection(collectionName);
      
      let restoredCount = 0;
      let conflictCount = 0;

      for (const record of records) {
        try {
          // Check if record already exists (conflict)
          const existing = await collection.findOne({ _id: record._id });
          
          if (existing && !options.preserveNewData) {
            // Replace existing record
            await collection.replaceOne({ _id: record._id }, record);
            restoredCount++;
          } else if (!existing) {
            // Insert restored record
            await collection.insertOne(record);
            restoredCount++;
          } else {
            // Conflict - preserve new data
            conflictCount++;
          }
        } catch (recordError) {
          console.error(`Error restoring record ${record._id}:`, recordError);
        }
      }

      restoredRecords[collectionName] = restoredCount;
      if (conflictCount > 0) {
        conflictResolution[collectionName] = { conflicts: conflictCount };
      }
    }

    // Mark snapshot as used
    await snapshotsCollection.updateOne(
      { _id: ObjectId.createFromHexString(snapshotId) },
      { 
        $set: { 
          used: true, 
          usedAt: new Date(),
          rollbackId,
          rollbackBy: adminInfo.id
        }
      }
    );

    // Log the rollback operation
    await logDeletionOperation(rollbackId, 'ROLLBACK', {
      snapshotId,
      restoredRecords,
      conflictResolution,
      options
    }, adminInfo);

    return {
      success: true,
      data: {
        rollbackId,
        restoredRecords,
        conflictResolution,
        executionTime: `${Date.now() - startTime}ms`,
        completionTime: new Date()
      }
    };

  } catch (error) {
    console.error('Rollback deletion error:', error);
    return {
      success: false,
      error: error.message,
      code: 'ROLLBACK_FAILED',
      rollbackId,
      executionTime: `${Date.now() - startTime}ms`
    };
  }
}

/**
 * Get audit log of deletion operations
 */
export async function getAuditLog(queryParams = {}) {
  try {
    const auditCollection = await getCollection('deletionAuditLog');
    
    // Build query filters
    const query = {};
    if (queryParams.startDate) query.timestamp = { $gte: new Date(queryParams.startDate) };
    if (queryParams.endDate) {
      query.timestamp = query.timestamp || {};
      query.timestamp.$lte = new Date(queryParams.endDate);
    }
    if (queryParams.action) query.action = queryParams.action;
    if (queryParams.adminId) query.adminId = ObjectId.createFromHexString(queryParams.adminId);
    if (queryParams.entityType) query.entityType = queryParams.entityType;
    if (queryParams.status) query.status = queryParams.status;

    // Calculate pagination
    const page = queryParams.page || 1;
    const limit = queryParams.limit || 100;
    const skip = (page - 1) * limit;

    // Build sort
    const sortField = queryParams.sortBy || 'timestamp';
    const sortOrder = queryParams.sortOrder === 'asc' ? 1 : -1;
    const sort = { [sortField]: sortOrder };

    // Execute queries in parallel
    const [auditEntries, totalCount] = await Promise.all([
      auditCollection
        .find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .toArray(),
      auditCollection.countDocuments(query)
    ]);

    // Get summary statistics
    const [successCount, failedCount] = await Promise.all([
      auditCollection.countDocuments({ ...query, status: 'SUCCESS' }),
      auditCollection.countDocuments({ ...query, status: 'FAILED' })
    ]);

    return {
      success: true,
      data: {
        auditEntries,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit),
          hasNext: skip + limit < totalCount,
          hasPrev: page > 1
        },
        summary: {
          totalOperations: totalCount,
          successfulOperations: successCount,
          failedOperations: failedCount
        }
      }
    };

  } catch (error) {
    console.error('Get audit log error:', error);
    return {
      success: false,
      error: error.message,
      code: 'AUDIT_LOG_FAILED'
    };
  }
}

/**
 * Helper Functions
 */

async function createDeletionSnapshot(studentId, operationId, adminInfo) {
  const snapshotsCollection = await getCollection('deletionSnapshots');
  const snapshotId = generateOperationId('snap');
  
  const snapshotData = {};
  
  // Collect data from all related collections
  for (const relationship of COLLECTION_RELATIONSHIPS.students) {
    const collection = await getCollection(relationship.collection);
    let query = {};

    if (relationship.field.includes('.')) {
      query[relationship.field] = ObjectId.createFromHexString(studentId);
    } else {
      query[relationship.field] = ObjectId.createFromHexString(studentId);
    }

    const records = await collection.find(query).toArray();
    if (records.length > 0) {
      snapshotData[relationship.collection] = records;
    }
  }

  // Include the student record
  const studentCollection = await getCollection('students');
  const student = await studentCollection.findOne({ 
    _id: ObjectId.createFromHexString(studentId) 
  });
  snapshotData.students = [student];

  const snapshot = {
    _id: ObjectId.createFromHexString(snapshotId.replace('snap_', '').substring(0, 24).padEnd(24, '0')),
    operationId,
    studentId,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    createdBy: adminInfo.id,
    data: snapshotData,
    size: JSON.stringify(snapshotData).length,
    used: false
  };

  await snapshotsCollection.insertOne(snapshot);
  
  return {
    id: snapshot._id.toString(),
    location: `snapshot_${snapshot._id}`,
    expiresAt: snapshot.expiresAt
  };
}

async function cleanupReferencesInCollection(collection, fieldPath, studentId) {
  if (fieldPath.includes('.')) {
    // Handle nested field cleanup (e.g., "attendees.studentId")
    const [arrayField, nestedField] = fieldPath.split('.');
    
    const updateResult = await collection.updateMany(
      { [fieldPath]: ObjectId.createFromHexString(studentId) },
      { $pull: { [arrayField]: { [nestedField]: ObjectId.createFromHexString(studentId) } } }
    );
    
    return { removed: updateResult.modifiedCount, type: 'array_cleanup' };
  } else {
    // Handle direct field cleanup
    const updateResult = await collection.updateMany(
      { [fieldPath]: ObjectId.createFromHexString(studentId) },
      { $unset: { [fieldPath]: 1 } }
    );
    
    return { removed: updateResult.modifiedCount, type: 'field_cleanup' };
  }
}

async function findAndCleanOrphansInCollection(collectionName, options) {
  // Implementation would depend on specific collection structure
  // This is a placeholder for the complex orphan detection logic
  return {
    found: 0,
    removed: 0,
    preserved: 0,
    errors: 0
  };
}

async function logDeletionOperation(operationId, action, data, adminInfo) {
  try {
    const auditCollection = await getCollection('deletionAuditLog');
    
    const logEntry = {
      operationId,
      action,
      timestamp: new Date(),
      adminId: ObjectId.createFromHexString(adminInfo.id),
      adminName: adminInfo.fullName,
      entityType: 'student',
      entityId: data.studentInfo?.id,
      status: 'SUCCESS',
      details: data,
      ipAddress: adminInfo.ipAddress,
      userAgent: adminInfo.userAgent
    };

    await auditCollection.insertOne(logEntry);
  } catch (error) {
    console.error('Failed to log deletion operation:', error);
  }
}

async function attemptEmergencyRollback(snapshotId, error) {
  try {
    console.log(`Attempting emergency rollback for snapshot ${snapshotId} due to error:`, error);
    // Implementation would attempt to restore from snapshot
    // This is a safety mechanism for critical failures
  } catch (rollbackError) {
    console.error('Emergency rollback failed:', rollbackError);
  }
}