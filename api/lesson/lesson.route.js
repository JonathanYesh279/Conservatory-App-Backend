import express from 'express'
import { attendanceController } from '../schedule/attendance.controller.js'
import { requireAuth } from '../../middleware/auth.middleware.js'

const router = express.Router()

// Lesson attendance routes
router.put('/:lessonId/attendance', requireAuth(['מורה', 'מנהל']), attendanceController.markLessonAttendance)
router.get('/:lessonId/attendance', requireAuth(['מורה', 'מנהל']), attendanceController.getLessonAttendance)

export default router