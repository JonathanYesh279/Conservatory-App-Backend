/**
 * Cascade Deletion Routes
 * Admin endpoints for managing cascade deletions with data integrity
 * Includes preview, execution, cleanup, rollback, and audit capabilities
 */

import express from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { cascadeDeletionController } from './cascade-deletion.controller.js';
import {
  cascadeDeletionPreviewSchema,
  cascadeDeletionExecuteSchema,
  orphanedCleanupSchema,
  rollbackDeletionSchema,
  auditLogQuerySchema,
  validateCascadeDeletion,
  validateQueryParams,
  validatePathParams
} from './cascade-deletion.validation.js';

const router = express.Router();

// Admin-only access for all cascade deletion operations
const adminAuth = requireAuth(['מנהל']);

/**
 * POST /api/admin/student/:studentId/deletion-preview
 * Preview the impact of cascading deletion before execution
 * 
 * Body: {
 *   preserveAcademic?: boolean,    // Keep academic records
 *   hardDelete?: boolean,          // Permanent deletion
 *   createBackup?: boolean,        // Create backup before deletion
 *   dryRun?: boolean,             // Simulation mode
 *   includeAnalytics?: boolean    // Include analytics data
 * }
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     summary: { totalRecords: 156, affectedCollections: 8 },
 *     impactAnalysis: { ... },
 *     estimatedTime: "2.5 minutes",
 *     warnings: [...],
 *     rollbackInfo: { ... }
 *   }
 * }
 */
router.post(
  '/student/:studentId/deletion-preview',
  adminAuth,
  validatePathParams,
  validateCascadeDeletion(cascadeDeletionPreviewSchema),
  cascadeDeletionController.previewCascadeDeletion
);

/**
 * DELETE /api/admin/student/:studentId/cascade
 * Execute cascade deletion of student and all related records
 * 
 * Body: {
 *   preserveAcademic?: boolean,    // Keep academic records
 *   hardDelete?: boolean,          // Permanent deletion (requires admin password)
 *   createBackup?: boolean,        // Create backup before deletion
 *   confirmationCode: string,      // Required confirmation code
 *   reason?: string,               // Reason for deletion
 *   adminPassword?: string         // Required for hard delete
 * }
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     operationId: "del_64f...",
 *     deletedRecords: { students: 1, privateAttendance: 45, ... },
 *     backupLocation: "backup_20250828_...",
 *     rollbackToken: "rollback_64f...",
 *     completionTime: "2024-08-28T10:15:30.000Z"
 *   }
 * }
 */
router.delete(
  '/student/:studentId/cascade',
  adminAuth,
  validatePathParams,
  validateCascadeDeletion(cascadeDeletionExecuteSchema),
  cascadeDeletionController.executeCascadeDeletion
);

/**
 * POST /api/admin/cleanup/orphaned-references
 * Clean up orphaned references across collections
 * 
 * Body: {
 *   collections?: string[],          // Collections to clean (default: all)
 *   dryRun?: boolean,               // Simulation mode
 *   batchSize?: number,             // Batch processing size
 *   maxOrphansToProcess?: number,   // Max orphans to process
 *   includeBackup?: boolean,        // Create backup during cleanup
 *   autoConfirm?: boolean          // Auto-confirm cleanup
 * }
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     operationId: "cleanup_64f...",
 *     orphanedReferences: {
 *       privateAttendance: { studentId: 15, teacherId: 3 },
 *       rehearsals: { orchestraId: 2 }
 *     },
 *     cleanupSummary: { removed: 20, preserved: 5 },
 *     processingTime: "45 seconds"
 *   }
 * }
 */
router.post(
  '/cleanup/orphaned-references',
  adminAuth,
  validateCascadeDeletion(orphanedCleanupSchema),
  cascadeDeletionController.cleanupOrphanedReferences
);

/**
 * POST /api/admin/deletion/rollback/:snapshotId
 * Rollback a previous cascade deletion using snapshot
 * 
 * Body: {
 *   snapshotId: string,            // Snapshot ID for rollback
 *   confirmRollback: true,         // Must be true to confirm
 *   preserveNewData?: boolean,     // Keep data created after deletion
 *   rollbackReason?: string,       // Reason for rollback
 *   adminPassword: string          // Admin password required
 * }
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     rollbackId: "rollback_64f...",
 *     restoredRecords: { students: 1, privateAttendance: 45 },
 *     conflictResolution: { ... },
 *     completionTime: "2024-08-28T10:30:45.000Z"
 *   }
 * }
 */
router.post(
  '/deletion/rollback/:snapshotId',
  adminAuth,
  validatePathParams,
  validateCascadeDeletion(rollbackDeletionSchema),
  cascadeDeletionController.rollbackDeletion
);

/**
 * GET /api/admin/deletion/audit-log
 * Get deletion history and audit log
 * 
 * Query Parameters:
 * - startDate?: ISO date string     // Start date filter
 * - endDate?: ISO date string       // End date filter
 * - action?: string                 // Action type filter
 * - adminId?: ObjectId             // Admin ID filter
 * - entityType?: string            // Entity type filter
 * - status?: string                // Operation status filter
 * - limit?: number                 // Results limit (default: 100)
 * - page?: number                  // Page number (default: 1)
 * - sortBy?: string               // Sort field (default: timestamp)
 * - sortOrder?: 'asc'|'desc'      // Sort order (default: desc)
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     auditEntries: [...],
 *     pagination: { page: 1, limit: 100, total: 156, pages: 2 },
 *     summary: { totalOperations: 156, successfulOperations: 148 }
 *   }
 * }
 */
router.get(
  '/deletion/audit-log',
  adminAuth,
  validateQueryParams(auditLogQuerySchema),
  cascadeDeletionController.getAuditLog
);

/**
 * GET /api/admin/deletion/snapshots
 * Get available snapshots for rollback
 * 
 * Query Parameters:
 * - entityType?: string            // Filter by entity type
 * - limit?: number                 // Results limit
 * - includeExpired?: boolean       // Include expired snapshots
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     snapshots: [{
 *       id: "snap_64f...",
 *       entityType: "student",
 *       entityId: "64f...",
 *       createdAt: "2024-08-28T10:00:00.000Z",
 *       expiresAt: "2024-09-28T10:00:00.000Z",
 *       size: "2.3 MB",
 *       canRollback: true
 *     }]
 *   }
 * }
 */
router.get(
  '/deletion/snapshots',
  adminAuth,
  cascadeDeletionController.getAvailableSnapshots
);

/**
 * GET /api/admin/deletion/operations
 * Get currently running deletion operations
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     runningOperations: [{
 *       operationId: "del_64f...",
 *       type: "CASCADE_DELETE",
 *       entityType: "student",
 *       entityId: "64f...",
 *       startedAt: "2024-08-28T10:00:00.000Z",
 *       progress: 45,
 *       estimatedCompletion: "2024-08-28T10:05:00.000Z",
 *       status: "PROCESSING"
 *     }]
 *   }
 * }
 */
router.get(
  '/deletion/operations',
  adminAuth,
  cascadeDeletionController.getRunningOperations
);

/**
 * POST /api/admin/deletion/operations/:operationId/cancel
 * Cancel a running deletion operation
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     operationId: "del_64f...",
 *     cancelledAt: "2024-08-28T10:02:30.000Z",
 *     partialResults: { ... }
 *   }
 * }
 */
router.post(
  '/deletion/operations/:operationId/cancel',
  adminAuth,
  cascadeDeletionController.cancelOperation
);

export default router;