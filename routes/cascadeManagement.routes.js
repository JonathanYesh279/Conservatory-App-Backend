/**
 * Cascade Management Routes
 * API routes for cascade deletion operations, job management, and monitoring
 */

import { Router } from 'express';
import { cascadeManagementController } from '../controllers/cascadeManagementController.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { adminMiddleware } from '../middleware/admin.middleware.js';
import Joi from 'joi';

const router = Router();

// Validation schemas
const cascadeDeletionSchema = Joi.object({
  reason: Joi.string().min(10).max(200),
  priority: Joi.string().valid('low', 'medium', 'high').default('high')
});

const batchDeletionSchema = Joi.object({
  studentIds: Joi.array()
    .items(Joi.string().regex(/^[0-9a-fA-F]{24}$/))
    .min(1)
    .max(50)
    .required(),
  reason: Joi.string().min(10).max(200),
  priority: Joi.string().valid('low', 'medium', 'high').default('medium')
});

const restoreStudentSchema = Joi.object({
  auditId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required(),
  reason: Joi.string().min(5).max(200).default('Administrative restoration')
});

const jobPrioritySchema = Joi.object({
  priority: Joi.string().valid('low', 'medium', 'high').default('high')
});

// Validation middleware
const validateBody = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(d => d.message)
      });
    }
    req.body = value;
    next();
  };
};

const validateStudentId = (req, res, next) => {
  const { studentId } = req.params;
  if (!/^[0-9a-fA-F]{24}$/.test(studentId)) {
    return res.status(400).json({
      error: 'Invalid student ID format'
    });
  }
  next();
};

const validateJobId = (req, res, next) => {
  const { jobId } = req.params;
  if (!jobId || jobId.length < 10) {
    return res.status(400).json({
      error: 'Invalid job ID format'
    });
  }
  next();
};

// Apply authentication to all routes
router.use(authMiddleware);

/**
 * @route   POST /api/cascade/delete/:studentId
 * @desc    Queue cascade deletion for a single student
 * @access  Private (Teacher+)
 * @params  studentId - MongoDB ObjectId of student to delete
 * @body    { reason?: string, priority?: 'low'|'medium'|'high' }
 */
router.post('/delete/:studentId', 
  validateStudentId,
  validateBody(cascadeDeletionSchema),
  cascadeManagementController.queueCascadeDeletion
);

/**
 * @route   POST /api/cascade/delete/batch
 * @desc    Queue batch cascade deletion for multiple students
 * @access  Private (Admin only)
 * @body    { studentIds: string[], reason?: string, priority?: 'low'|'medium'|'high' }
 */
router.post('/delete/batch',
  adminMiddleware,
  validateBody(batchDeletionSchema),
  cascadeManagementController.queueBatchCascadeDeletion
);

/**
 * @route   GET /api/cascade/job/:jobId
 * @desc    Get status of a specific job
 * @access  Private
 * @params  jobId - Job identifier
 */
router.get('/job/:jobId',
  validateJobId,
  cascadeManagementController.getJobStatus
);

/**
 * @route   GET /api/cascade/queue/status
 * @desc    Get current queue status and system health
 * @access  Admin only
 */
router.get('/queue/status',
  adminMiddleware,
  cascadeManagementController.getQueueStatus
);

/**
 * @route   POST /api/cascade/cleanup/orphans
 * @desc    Trigger manual orphaned reference cleanup
 * @access  Admin only
 * @body    { priority?: 'low'|'medium'|'high' }
 */
router.post('/cleanup/orphans',
  adminMiddleware,
  validateBody(jobPrioritySchema),
  cascadeManagementController.triggerOrphanCleanup
);

/**
 * @route   POST /api/cascade/integrity/validate
 * @desc    Trigger manual integrity validation
 * @access  Admin only
 * @body    { priority?: 'low'|'medium'|'high' }
 */
router.post('/integrity/validate',
  adminMiddleware,
  validateBody(jobPrioritySchema),
  cascadeManagementController.triggerIntegrityValidation
);

/**
 * @route   GET /api/cascade/audit/:studentId
 * @desc    Get deletion audit history for a student
 * @access  Private (own students) / Admin (all)
 * @params  studentId - MongoDB ObjectId of student
 * @query   limit?: number, offset?: number
 */
router.get('/audit/:studentId',
  validateStudentId,
  cascadeManagementController.getDeletionAudit
);

/**
 * @route   POST /api/cascade/restore/:studentId
 * @desc    Restore a deleted student from audit record
 * @access  Admin only
 * @params  studentId - MongoDB ObjectId of student to restore
 * @body    { auditId: string, reason?: string }
 */
router.post('/restore/:studentId',
  adminMiddleware,
  validateStudentId,
  validateBody(restoreStudentSchema),
  cascadeManagementController.restoreStudent
);

/**
 * @route   GET /api/cascade/metrics
 * @desc    Get system metrics and performance data
 * @access  Admin only
 */
router.get('/metrics',
  adminMiddleware,
  cascadeManagementController.getSystemMetrics
);

// Error handling middleware for this router
router.use((error, req, res, next) => {
  console.error('Cascade management route error:', error);
  
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation error',
      details: error.message
    });
  }

  if (error.name === 'CastError') {
    return res.status(400).json({
      error: 'Invalid ID format',
      details: error.message
    });
  }

  if (error.code === 11000) {
    return res.status(409).json({
      error: 'Resource conflict',
      details: 'Operation already in progress'
    });
  }

  res.status(500).json({
    error: 'Internal server error',
    message: 'Cascade management operation failed'
  });
});

export default router;