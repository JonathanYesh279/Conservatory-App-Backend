import express from 'express'
import { studentController } from './student.controller.js'
import { requireAuth } from '../../middleware/auth.middleware.js'

const router = express.Router()

router.get('/', requireAuth(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל']), studentController.getStudents)
router.get('/:id', requireAuth(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל']), studentController.getStudentById)

router.post('/', requireAuth(['מנהל']), studentController.addStudent);
router.put('/:id', requireAuth(['מורה', 'מנהל']), studentController.updateStudent)
router.delete('/:id', requireAuth(['מנהל']), studentController.removeStudent)

export default router