/**
 * Data Integrity Routes
 * Admin endpoints for validating, repairing, and monitoring data integrity
 * Comprehensive data health management for the conservatory system
 */

import express from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { dataIntegrityController } from './data-integrity.controller.js';
import {
  integrityValidationSchema,
  integrityRepairSchema,
  integrityReportSchema,
  orphanedStudentsQuerySchema,
  validateDataIntegrity,
  validateIntegrityQueryParams,
  validateRepairContext
} from './data-integrity.validation.js';

const router = express.Router();

// Admin-only access for all data integrity operations
const adminAuth = requireAuth(['מנהל']);

/**
 * GET /api/admin/integrity/validate
 * Run comprehensive data integrity validation across collections
 * 
 * Query Parameters:
 * - collections?: string[]         // Collections to validate (default: all)
 * - checkTypes?: string[]         // Types of checks to run
 * - deepScan?: boolean            // Enable deep scanning
 * - includeWarnings?: boolean     // Include warnings in results
 * - batchSize?: number           // Batch processing size
 * - maxIssues?: number           // Max issues to report
 * - timeout?: number             // Max execution time (seconds)
 * - parallelChecks?: boolean     // Run checks in parallel
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     validationId: "val_64f...",
 *     summary: {
 *       totalRecords: 15420,
 *       recordsChecked: 15420,
 *       issuesFound: 23,
 *       criticalIssues: 2,
 *       warnings: 8
 *     },
 *     issuesByType: {
 *       MISSING_REFERENCES: 15,
 *       ORPHANED_RECORDS: 5,
 *       DUPLICATE_RECORDS: 3
 *     },
 *     affectedCollections: ["students", "privateAttendance"],
 *     executionTime: "2.5 minutes",
 *     recommendations: [...]
 *   }
 * }
 */
router.get(
  '/validate',
  adminAuth,
  validateIntegrityQueryParams(integrityValidationSchema),
  dataIntegrityController.validateIntegrity
);

/**
 * POST /api/admin/integrity/repair
 * Repair data integrity issues with configurable strategies
 * 
 * Body: {
 *   targetCollections: string[],     // Collections to repair (required)
 *   repairStrategies?: string[],     // Repair strategies to use
 *   autoFix?: boolean,              // Auto-fix without confirmation
 *   maxRepairs?: number,            // Max number of repairs
 *   dryRun?: boolean,              // Simulation mode
 *   createBackup?: boolean,         // Create backup before repair
 *   repairPriority?: string,        // Priority level for repairs
 *   excludeIssueTypes?: string[],   // Issue types to exclude
 *   confirmationRequired?: boolean, // Require confirmation
 *   notifyOnCompletion?: boolean,   // Send notification when done
 *   adminPassword?: string,         // Required for auto-fix
 *   reason?: string                 // Reason for repair
 * }
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     repairId: "repair_64f...",
 *     summary: {
 *       issuesFound: 23,
 *       issuesRepaired: 20,
 *       issuesSkipped: 2,
 *       issuesFailed: 1
 *     },
 *     repairDetails: {
 *       MISSING_REFERENCES: { repaired: 15, failed: 0 },
 *       ORPHANED_RECORDS: { repaired: 5, failed: 0 }
 *     },
 *     backupLocation: "backup_integrity_20250828...",
 *     executionTime: "3.2 minutes",
 *     failureReasons: [...]
 *   }
 * }
 */
router.post(
  '/repair',
  adminAuth,
  validateDataIntegrity(integrityRepairSchema),
  validateRepairContext,
  dataIntegrityController.repairIntegrity
);

/**
 * GET /api/admin/integrity/report
 * Generate comprehensive integrity report with trends and insights
 * 
 * Query Parameters:
 * - reportType?: string           // Type of report to generate
 * - format?: string              // Output format (JSON, HTML, CSV, PDF)
 * - includeCharts?: boolean      // Include charts and graphs
 * - timeRange?: object           // Time range for trend analysis
 * - groupBy?: string            // Group results by field
 * - includeResolved?: boolean    // Include resolved issues
 * - minSeverity?: string        // Minimum severity level
 * - emailReport?: boolean       // Email the report
 * - emailAddresses?: string[]   // Email recipients
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     reportId: "rpt_64f...",
 *     reportType: "DETAILED",
 *     generatedAt: "2024-08-28T10:00:00.000Z",
 *     summary: {
 *       totalIssues: 156,
 *       resolvedIssues: 123,
 *       activeIssues: 33,
 *       trendDirection: "IMPROVING"
 *     },
 *     integrityScore: 92.5,
 *     collectionsHealth: { ... },
 *     trends: { ... },
 *     reportUrl: "/reports/integrity_20240828.html"
 *   }
 * }
 */
router.get(
  '/report',
  adminAuth,
  validateIntegrityQueryParams(integrityReportSchema),
  dataIntegrityController.generateIntegrityReport
);

/**
 * GET /api/admin/integrity/orphaned-students
 * List students with orphaned references or missing relationships
 * 
 * Query Parameters:
 * - includeInactive?: boolean     // Include inactive students
 * - orphanType?: string          // Type of orphan relationship
 * - minDaysSinceActivity?: number // Days since last activity
 * - includeMetrics?: boolean     // Include detailed metrics
 * - sortBy?: string             // Sort field
 * - sortOrder?: string          // Sort order
 * - limit?: number              // Results limit
 * - page?: number               // Page number
 * - exportFormat?: string       // Export format
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     orphanedStudents: [{
 *       studentId: "64f...",
 *       fullName: "יוסי כהן",
 *       orphanType: "NO_LESSONS",
 *       lastActivity: "2024-06-15T09:00:00.000Z",
 *       daysSinceActivity: 74,
 *       orphanScore: 85,
 *       issues: [
 *         "אין שיעורים פרטיים רשומים",
 *         "לא משויך להרכב"
 *       ],
 *       suggestedActions: [...]
 *     }],
 *     pagination: { page: 1, limit: 100, total: 23, pages: 1 },
 *     metrics: {
 *       totalOrphans: 23,
 *       byType: { NO_LESSONS: 15, NO_ATTENDANCE: 5, NO_ORCHESTRA: 3 },
 *       avgDaysSinceActivity: 45.2
 *     }
 *   }
 * }
 */
router.get(
  '/orphaned-students',
  adminAuth,
  validateIntegrityQueryParams(orphanedStudentsQuerySchema),
  dataIntegrityController.getOrphanedStudents
);

/**
 * GET /api/admin/integrity/health-check
 * Quick health check of critical system components
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     overallHealth: "GOOD",
 *     healthScore: 94.2,
 *     timestamp: "2024-08-28T10:00:00.000Z",
 *     components: {
 *       database: { status: "HEALTHY", responseTime: 12 },
 *       collections: { status: "HEALTHY", totalRecords: 15420 },
 *       references: { status: "WARNING", orphanedCount: 5 },
 *       constraints: { status: "HEALTHY", violationsCount: 0 }
 *     },
 *     alerts: [
 *       { level: "WARNING", message: "5 הפניות יתומות נמצאו", component: "references" }
 *     ],
 *     recommendations: [
 *       "הרץ ניקוי הפניות יתומות",
 *       "בדוק רשומות תלמידים ישנות"
 *     ]
 *   }
 * }
 */
router.get(
  '/health-check',
  adminAuth,
  dataIntegrityController.performHealthCheck
);

/**
 * GET /api/admin/integrity/collections/stats
 * Get detailed statistics for each collection
 * 
 * Query Parameters:
 * - collections?: string[]        // Specific collections to analyze
 * - includeIndexStats?: boolean   // Include index statistics
 * - includeRelationshipStats?: boolean // Include relationship stats
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     collectionsStats: {
 *       students: {
 *         totalRecords: 1250,
 *         activeRecords: 1180,
 *         averageDocumentSize: "2.3 KB",
 *         integrityScore: 96.5,
 *         lastValidated: "2024-08-28T08:00:00.000Z",
 *         issues: { orphanedReferences: 2, duplicates: 0 },
 *         relationships: {
 *           outgoing: { privateLessons: 1250, privateAttendance: 8950 },
 *           incoming: { teacherAssignments: 245 }
 *         },
 *         indexStats: { ... }
 *       }
 *     },
 *     globalStats: {
 *       totalRecords: 15420,
 *       totalCollections: 9,
 *       averageIntegrityScore: 94.2,
 *       criticalIssues: 2
 *     }
 *   }
 * }
 */
router.get(
  '/collections/stats',
  adminAuth,
  dataIntegrityController.getCollectionStats
);

/**
 * POST /api/admin/integrity/constraints/validate
 * Validate business rule constraints across the system
 * 
 * Body: {
 *   constraintTypes?: string[],     // Types of constraints to validate
 *   collections?: string[],         // Collections to check
 *   strictMode?: boolean           // Strict validation mode
 * }
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     constraintViolations: [{
 *       type: "SCHEDULING_CONFLICT",
 *       severity: "HIGH",
 *       collection: "rehearsals",
 *       recordId: "64f...",
 *       description: "חפיפה בזמן חזרות",
 *       details: { ... },
 *       suggestedFix: "עדכן זמן חזרה"
 *     }],
 *     summary: {
 *       totalViolations: 5,
 *       bySeverity: { HIGH: 2, MEDIUM: 2, LOW: 1 },
 *       byType: { SCHEDULING_CONFLICT: 3, CAPACITY_EXCEEDED: 2 }
 *     }
 *   }
 * }
 */
router.post(
  '/constraints/validate',
  adminAuth,
  dataIntegrityController.validateBusinessConstraints
);

export default router;