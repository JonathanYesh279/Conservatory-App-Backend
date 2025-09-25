import express from 'express'
import { cleanupController } from './cleanup.controller.js'
import { requireAuth } from '../../middleware/auth.middleware.js'

const router = express.Router()

// All cleanup operations require admin privileges
router.get('/detect-inconsistencies', requireAuth(['מנהל']), cleanupController.detectInconsistencies)
router.get('/report', requireAuth(['מנהל']), cleanupController.generateReport)
router.post('/fix-all', requireAuth(['מנהל']), cleanupController.fixAllInconsistencies)
router.post('/fix-relationship/:teacherId/:studentId', requireAuth(['מנהל']), cleanupController.fixRelationship)
router.post('/fix-assignments/:studentId', requireAuth(['מנהל']), cleanupController.fixOrphanedAssignments)
router.post('/fix-schedule/:studentId', requireAuth(['מנהל']), cleanupController.fixOrphanedSchedule)

// Student deletion preview endpoint
router.post('/student/:studentId/deletion-preview', requireAuth(['מנהל']), cleanupController.getStudentDeletionPreview)

export default router