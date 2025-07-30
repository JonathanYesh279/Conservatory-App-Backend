/**
 * Admin Consistency Validation Routes
 * 
 * Routes for admin endpoints to validate and maintain teacher-student
 * lesson data consistency.
 */

import express from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { consistencyValidationController } from './consistency-validation.controller.js';

const router = express.Router();

// All routes require admin authentication
const adminAuth = requireAuth(['מנהל']);

// ===== VALIDATION ENDPOINTS =====

/**
 * Validate teacher-student synchronization across the system
 * POST /api/admin/validate-teacher-student-sync
 */
router.post('/validate-teacher-student-sync', 
  adminAuth, 
  consistencyValidationController.validateTeacherStudentSync
);

/**
 * Get comprehensive system consistency report
 * GET /api/admin/system-consistency-report
 */
router.get('/system-consistency-report', 
  adminAuth, 
  consistencyValidationController.getSystemConsistencyReport
);

/**
 * Validate lesson data for all teachers
 * POST /api/admin/validate-all-teacher-lessons?limit=50
 */
router.post('/validate-all-teacher-lessons', 
  adminAuth, 
  consistencyValidationController.validateAllTeacherLessons
);

/**
 * Get data integrity statistics
 * GET /api/admin/data-integrity-stats
 */
router.get('/data-integrity-stats', 
  adminAuth, 
  consistencyValidationController.getDataIntegrityStats
);

// ===== REPAIR ENDPOINTS =====

/**
 * Repair data inconsistencies
 * POST /api/admin/repair-data-inconsistencies
 * Body: { dryRun: boolean, repairTypes: string[] }
 */
router.post('/repair-data-inconsistencies', 
  adminAuth, 
  consistencyValidationController.repairDataInconsistencies
);

// ===== HEALTH CHECK ENDPOINTS =====

/**
 * Perform comprehensive health check
 * GET /api/admin/health-check
 */
router.get('/health-check', 
  adminAuth, 
  consistencyValidationController.performHealthCheck
);

export default router;