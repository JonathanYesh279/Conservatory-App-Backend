/**
 * Cascade Deletion Controller
 * Handles HTTP requests for cascade deletion operations with comprehensive error handling
 * Implements preview, execution, cleanup, rollback, and audit functionalities
 */

import * as cascadeDeletionService from './cascade-deletion.service.js';
import { getCollection } from '../../services/mongoDB.service.js';
import { ObjectId } from 'mongodb';

/**
 * Preview cascade deletion impact
 * POST /api/admin/student/:studentId/deletion-preview
 */
async function previewCascadeDeletion(req, res, next) {
  try {
    const { studentId } = req.params;
    const options = req.validatedData || req.body;

    console.log(`Preview cascade deletion for student ${studentId}:`, options);

    // Validate student exists
    const studentCollection = await getCollection('students');
    const student = await studentCollection.findOne({ 
      _id: ObjectId.createFromHexString(studentId) 
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'STUDENT_NOT_FOUND',
        message: 'התלמיד לא נמצא במערכת',
        code: 'STUDENT_NOT_EXISTS'
      });
    }

    // Execute preview
    const result = await cascadeDeletionService.previewCascadeDeletion(studentId, options);

    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data,
        message: 'תצוגה מקדימה של המחיקה הושלמה בהצלחה',
        meta: {
          studentName: student.personalInfo?.fullName || 'Unknown',
          requestedBy: req.loggedinUser.fullName,
          timestamp: new Date().toISOString(),
          dryRun: options.dryRun !== false
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        message: 'שגיאה ביצירת תצוגה מקדימה',
        code: result.code
      });
    }

  } catch (error) {
    console.error('Preview cascade deletion error:', error);
    next({
      status: 500,
      error: 'PREVIEW_OPERATION_FAILED',
      message: 'שגיאה פנימית ביצירת תצוגה מקדימה',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

/**
 * Execute cascade deletion
 * DELETE /api/admin/student/:studentId/cascade
 */
async function executeCascadeDeletion(req, res, next) {
  try {
    const { studentId } = req.params;
    const options = req.validatedData || req.body;

    console.log(`Execute cascade deletion for student ${studentId}:`, {
      ...options,
      adminPassword: options.adminPassword ? '[REDACTED]' : undefined
    });

    // Additional security check for hard delete
    if (options.hardDelete && (!options.adminPassword || options.adminPassword.length < 6)) {
      return res.status(400).json({
        success: false,
        error: 'ADMIN_PASSWORD_REQUIRED',
        message: 'מחיקה קשה דורשת סיסמת מנהל',
        code: 'HARD_DELETE_UNAUTHORIZED'
      });
    }

    // Validate student exists
    const studentCollection = await getCollection('students');
    const student = await studentCollection.findOne({ 
      _id: ObjectId.createFromHexString(studentId) 
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'STUDENT_NOT_FOUND',
        message: 'התלמיד לא נמצא במערכת',
        code: 'STUDENT_NOT_EXISTS'
      });
    }

    // Build admin info for logging
    const adminInfo = {
      id: req.loggedinUser._id,
      fullName: req.loggedinUser.fullName,
      email: req.loggedinUser.email,
      ipAddress: req.ip || req.connection?.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown'
    };

    // Execute deletion
    const result = await cascadeDeletionService.executeCascadeDeletion(
      studentId, 
      options, 
      adminInfo
    );

    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data,
        message: options.hardDelete 
          ? 'המחיקה הקשה הושלמה בהצלחה - לא ניתן לשחזור'
          : 'המחיקה הושלמה בהצלחה',
        meta: {
          studentName: student.personalInfo?.fullName || 'Unknown',
          deletedBy: req.loggedinUser.fullName,
          timestamp: new Date().toISOString(),
          canRollback: !!result.data.rollbackToken,
          totalRecordsDeleted: Object.values(result.data.deletedRecords || {})
            .reduce((sum, count) => sum + count, 0)
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        message: 'שגיאה בביצוע המחיקה',
        code: result.code,
        operationId: result.operationId,
        rollbackInitiated: result.rollbackInitiated
      });
    }

  } catch (error) {
    console.error('Execute cascade deletion error:', error);
    next({
      status: 500,
      error: 'DELETION_OPERATION_FAILED',
      message: 'שגיאה פנימית בביצוע המחיקה',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

/**
 * Clean up orphaned references
 * POST /api/admin/cleanup/orphaned-references
 */
async function cleanupOrphanedReferences(req, res, next) {
  try {
    const options = req.validatedData || req.body;

    console.log('Cleanup orphaned references:', options);

    // Build admin info for logging
    const adminInfo = {
      id: req.loggedinUser._id,
      fullName: req.loggedinUser.fullName,
      email: req.loggedinUser.email,
      ipAddress: req.ip || req.connection?.remoteAddress || 'unknown'
    };

    // Execute cleanup
    const result = await cascadeDeletionService.cleanupOrphanedReferences(options, adminInfo);

    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data,
        message: options.dryRun 
          ? 'הדמיית ניקוי הושלמה בהצלחה'
          : 'ניקוי ההפניות היתומות הושלם בהצלחה',
        meta: {
          cleanedBy: req.loggedinUser.fullName,
          timestamp: new Date().toISOString(),
          dryRun: options.dryRun,
          collectionsProcessed: options.collections?.length || 'all'
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        message: 'שגיאה בניקוי ההפניות היתומות',
        code: result.code
      });
    }

  } catch (error) {
    console.error('Cleanup orphaned references error:', error);
    next({
      status: 500,
      error: 'CLEANUP_OPERATION_FAILED',
      message: 'שגיאה פנימית בניקוי הפניות יתומות',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

/**
 * Rollback cascade deletion
 * POST /api/admin/deletion/rollback/:snapshotId
 */
async function rollbackDeletion(req, res, next) {
  try {
    const { snapshotId } = req.params;
    const options = req.validatedData || req.body;

    console.log(`Rollback deletion for snapshot ${snapshotId}:`, {
      ...options,
      adminPassword: options.adminPassword ? '[REDACTED]' : undefined
    });

    // Validate snapshot exists
    const snapshotsCollection = await getCollection('deletionSnapshots');
    const snapshot = await snapshotsCollection.findOne({
      _id: ObjectId.createFromHexString(snapshotId)
    });

    if (!snapshot) {
      return res.status(404).json({
        success: false,
        error: 'SNAPSHOT_NOT_FOUND',
        message: 'תמונת המצב לשחזור לא נמצאה',
        code: 'SNAPSHOT_NOT_EXISTS'
      });
    }

    if (snapshot.expiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        error: 'SNAPSHOT_EXPIRED',
        message: 'תמונת המצב פגה ולא ניתן לשחזור',
        code: 'SNAPSHOT_EXPIRED',
        meta: {
          expiresAt: snapshot.expiresAt,
          currentTime: new Date()
        }
      });
    }

    if (snapshot.used) {
      return res.status(400).json({
        success: false,
        error: 'SNAPSHOT_ALREADY_USED',
        message: 'תמונת המצב כבר שומשה לשחזור',
        code: 'SNAPSHOT_USED',
        meta: {
          usedAt: snapshot.usedAt,
          rollbackId: snapshot.rollbackId
        }
      });
    }

    // Build admin info for logging
    const adminInfo = {
      id: req.loggedinUser._id,
      fullName: req.loggedinUser.fullName,
      email: req.loggedinUser.email,
      ipAddress: req.ip || req.connection?.remoteAddress || 'unknown'
    };

    // Execute rollback
    const result = await cascadeDeletionService.rollbackDeletion(
      snapshotId, 
      options, 
      adminInfo
    );

    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data,
        message: 'השחזור הושלם בהצלחה',
        meta: {
          rolledBackBy: req.loggedinUser.fullName,
          timestamp: new Date().toISOString(),
          snapshotDate: snapshot.createdAt,
          totalRecordsRestored: Object.values(result.data.restoredRecords || {})
            .reduce((sum, count) => sum + count, 0)
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        message: 'שגיאה בביצוע השחזור',
        code: result.code,
        rollbackId: result.rollbackId
      });
    }

  } catch (error) {
    console.error('Rollback deletion error:', error);
    next({
      status: 500,
      error: 'ROLLBACK_OPERATION_FAILED',
      message: 'שגיאה פנימית בביצוע השחזור',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

/**
 * Get audit log of deletion operations
 * GET /api/admin/deletion/audit-log
 */
async function getAuditLog(req, res, next) {
  try {
    const queryParams = req.validatedQuery || req.query;

    console.log('Get deletion audit log:', queryParams);

    // Execute audit log query
    const result = await cascadeDeletionService.getAuditLog(queryParams);

    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data,
        message: 'יומן הביקורת נטען בהצלחה',
        meta: {
          requestedBy: req.loggedinUser.fullName,
          timestamp: new Date().toISOString(),
          filters: queryParams,
          timezone: 'Asia/Jerusalem'
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        message: 'שגיאה בטעינת יומן הביקורת',
        code: result.code
      });
    }

  } catch (error) {
    console.error('Get audit log error:', error);
    next({
      status: 500,
      error: 'AUDIT_LOG_OPERATION_FAILED',
      message: 'שגיאה פנימית בטעינת יומן הביקורת',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

/**
 * Get available snapshots for rollback
 * GET /api/admin/deletion/snapshots
 */
async function getAvailableSnapshots(req, res, next) {
  try {
    const { entityType, limit = 50, includeExpired = false } = req.query;

    console.log('Get available snapshots:', req.query);

    const snapshotsCollection = await getCollection('deletionSnapshots');
    
    // Build query
    const query = { used: { $ne: true } };
    if (entityType) query.entityType = entityType;
    if (!includeExpired) query.expiresAt = { $gt: new Date() };

    // Get snapshots with metadata
    const snapshots = await snapshotsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .toArray();

    // Format snapshot data
    const formattedSnapshots = snapshots.map(snapshot => ({
      id: snapshot._id.toString(),
      operationId: snapshot.operationId,
      studentId: snapshot.studentId,
      entityType: 'student',
      createdAt: snapshot.createdAt.toISOString(),
      expiresAt: snapshot.expiresAt.toISOString(),
      size: `${Math.round(snapshot.size / 1024)} KB`,
      canRollback: snapshot.expiresAt > new Date() && !snapshot.used,
      recordCount: Object.values(snapshot.data || {})
        .reduce((sum, records) => sum + (Array.isArray(records) ? records.length : 0), 0)
    }));

    res.status(200).json({
      success: true,
      data: {
        snapshots: formattedSnapshots,
        totalSnapshots: formattedSnapshots.length,
        availableForRollback: formattedSnapshots.filter(s => s.canRollback).length
      },
      message: 'תמונות מצב נטענו בהצלחה',
      meta: {
        requestedBy: req.loggedinUser.fullName,
        timestamp: new Date().toISOString(),
        filters: { entityType, includeExpired }
      }
    });

  } catch (error) {
    console.error('Get available snapshots error:', error);
    next({
      status: 500,
      error: 'SNAPSHOTS_OPERATION_FAILED',
      message: 'שגיאה פנימית בטעינת תמונות המצב',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

/**
 * Get currently running deletion operations
 * GET /api/admin/deletion/operations
 */
async function getRunningOperations(req, res, next) {
  try {
    console.log('Get running deletion operations');

    // For now, return empty array - would implement operation tracking in production
    const runningOperations = [];

    res.status(200).json({
      success: true,
      data: {
        runningOperations,
        totalOperations: runningOperations.length,
        systemLoad: 'LOW' // Mock system load
      },
      message: 'פעולות פעילות נטענו בהצלחה',
      meta: {
        requestedBy: req.loggedinUser.fullName,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Get running operations error:', error);
    next({
      status: 500,
      error: 'OPERATIONS_QUERY_FAILED',
      message: 'שגיאה פנימית בטעינת פעולות פעילות',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

/**
 * Cancel running deletion operation
 * POST /api/admin/deletion/operations/:operationId/cancel
 */
async function cancelOperation(req, res, next) {
  try {
    const { operationId } = req.params;

    console.log(`Cancel operation ${operationId}`);

    // For now, return not implemented - would implement operation cancellation in production
    res.status(501).json({
      success: false,
      error: 'NOT_IMPLEMENTED',
      message: 'ביטול פעולות לא מוכן עדיין',
      code: 'CANCELLATION_NOT_IMPLEMENTED',
      meta: {
        operationId,
        requestedBy: req.loggedinUser.fullName,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Cancel operation error:', error);
    next({
      status: 500,
      error: 'CANCEL_OPERATION_FAILED',
      message: 'שגיאה פנימית בביטול הפעולה',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// Export controller functions
export const cascadeDeletionController = {
  previewCascadeDeletion,
  executeCascadeDeletion,
  cleanupOrphanedReferences,
  rollbackDeletion,
  getAuditLog,
  getAvailableSnapshots,
  getRunningOperations,
  cancelOperation
};