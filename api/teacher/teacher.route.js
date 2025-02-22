import express from 'express'
import { teacherController } from './teacher.controller.js'
import { requireAuth } from '../../middleware/auth.middleware.js'

const router = express.Router()

router.get('/', requireAuth(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל']), teacherController.getTeachers)
router.get('/:id', requireAuth(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל']), teacherController.getTeacherById)
router.get('/role/:role', requireAuth(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל']), teacherController.getTeacherByRole)

router.post('/', requireAuth(['מנהל']), teacherController.addTeacher)
router.put('/:id', requireAuth(['מנהל']), teacherController.updateTeacher)
router.delete('/:id', requireAuth(['מנהל']), teacherController.removeTeacher)

export default router
