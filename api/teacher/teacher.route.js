import express from 'express'
import { teacherController } from './teacher.controller.js'
import { invitationController } from './invitation.controller.js'
import { requireAuth } from '../../middleware/auth.middleware.js'

const router = express.Router()

router.get('/', requireAuth(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל']), teacherController.getTeachers)
router.get('/profile/me', requireAuth(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל']), teacherController.getMyProfile)
router.put('/profile/me', requireAuth(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל']), teacherController.updateMyProfile)
router.get('/debug/ids', requireAuth(['מנהל']), teacherController.getTeacherIds)
router.get('/:id', requireAuth(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל']), teacherController.getTeacherById)
router.get('/role/:role', requireAuth(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל']), teacherController.getTeacherByRole)

router.post('/', requireAuth(['מנהל']), teacherController.addTeacher)
router.post('/:id/schedule', requireAuth(['מנהל, מורה']), teacherController.updateTeacherSchedule)
router.put('/:id', requireAuth(['מנהל']), teacherController.updateTeacher)
router.delete('/:id', requireAuth(['מנהל']), teacherController.removeTeacher)

// Invitation routes
router.get('/invitation/validate/:token', invitationController.validateInvitation)
router.post('/invitation/accept/:token', invitationController.acceptInvitation)
router.post('/invitation/resend/:teacherId', requireAuth(['מנהל']), invitationController.resendInvitation)

export default router
