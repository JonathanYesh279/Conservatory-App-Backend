import express from 'express'
import { studentController } from './student.controller.js'
import { attendanceController } from '../schedule/attendance.controller.js'
import { requireAuth } from '../../middleware/auth.middleware.js'
import { validateTeacherAssignmentsMiddleware } from './student-assignments.validation.js'

const router = express.Router()

router.get('/', requireAuth(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל']), studentController.getStudents)
router.get('/:id', requireAuth(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל']), studentController.getStudentById)
router.get('/:studentId/private-lesson-attendance', requireAuth(['מורה', 'מנהל']), attendanceController.getStudentPrivateLessonStats)
router.get('/:studentId/attendance-history', requireAuth(['מורה', 'מנהל']), attendanceController.getStudentAttendanceHistory)

router.post('/', requireAuth(['מנהל', 'מורה']), validateTeacherAssignmentsMiddleware, studentController.addStudent);
router.put('/:id', requireAuth(['מורה', 'מנהל']), validateTeacherAssignmentsMiddleware, studentController.updateStudent)
router.put('/:id/test', requireAuth(['מורה', 'מנהל']), studentController.updateStudentTest)
router.patch('/:id/stage-level', requireAuth(['מורה', 'מנהל']), studentController.updateStudentStageLevel)
router.delete('/:id', requireAuth(['מנהל', 'מורה']), studentController.removeStudent)

export default router