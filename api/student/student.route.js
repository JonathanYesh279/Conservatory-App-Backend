import express from 'express'
import { studentController } from './student.controller.js'
import { requireAuth } from '../../middleware/auth.middleware.js'
import { validateTeacherAssignmentsMiddleware } from './student-assignments.validation.js'

const router = express.Router()

router.get('/', requireAuth(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל']), studentController.getStudents)
router.get('/:id', requireAuth(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל']), studentController.getStudentById)

router.post('/', requireAuth(['מנהל', 'מורה']), validateTeacherAssignmentsMiddleware, studentController.addStudent);
router.put('/:id', requireAuth(['מורה', 'מנהל']), validateTeacherAssignmentsMiddleware, studentController.updateStudent)
router.put('/:id/test', requireAuth(['מורה', 'מנהל']), studentController.updateStudentTest)
router.delete('/:id', requireAuth(['מנהל', 'מורה']), studentController.removeStudent)

export default router