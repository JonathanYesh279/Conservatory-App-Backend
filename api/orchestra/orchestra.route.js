import express from 'express'
import { orchestraController } from './orchestra.controller.js'
import { requireAuth } from '../../middleware/auth.middleware.js';

const router = express.Router()

router.get('/', requireAuth(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל']), orchestraController.getOrchestras)
router.get('/:id', requireAuth(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל']), orchestraController.getOrchestraById)

router.post('/', requireAuth(['מנהל']), orchestraController.addOrchestra)
router.put('/:id', requireAuth(['מנהל', 'מנצח']), orchestraController.updateOrchestra)
router.delete('/:id', requireAuth(['מנהל']), orchestraController.removeOrchestra)

router.post('/:id/members', requireAuth(['מנהל', 'מנצח', 'מדריך הרכב']), orchestraController.addMember)
router.delete('/:id/members/:studentId', requireAuth(['מנהל', 'מנצח', 'מדריך הרכב']), orchestraController.removeMember)

router.get('/:id/rehearsals/:rehearsalId/attendance', requireAuth(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל']), orchestraController.getRehearsalAttendance)
router.put('/:id/rehearsals/:rehearsalId/attendance', requireAuth(['מנצח', 'מנהל']), orchestraController.updateRehearsalAttendance)

router.get('/:orchestraId/student/:studentId/attendance', requireAuth(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל']), orchestraController.getStudentAttendanceStats)

export default router