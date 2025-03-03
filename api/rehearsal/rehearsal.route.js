import express from 'express'
import { rehearsalController } from './rehearsal.controller.js'
import { requireAuth } from '../../middleware/auth.middleware.js'

const router = express.Router()

router.get('/', requireAuth(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל']), rehearsalController.getRehearsals)
router.get('/orchestra/:orchestraId', requireAuth(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל']), rehearsalController.getOrchestraRehearsals)
router.get('/:id', requireAuth(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל']), rehearsalController.getRehearsalById)

router.post('/', requireAuth(['מנצח', 'מנהל']), rehearsalController.addRehearsal)
router.put('/:id', requireAuth(['מנצח', 'מנהל']), rehearsalController.updateRehearsal)
router.delete('/:id', requireAuth(['מנצח', 'מנהל']), rehearsalController.removeRehearsal)

router.put('/:rehearsalId/attendance', requireAuth(['מנצח', 'מנהל']), rehearsalController.updateAttendance)

router.post('/bulk-create', requireAuth(['מנהל', 'מנצח']), rehearsalController.bulkCreateRehearsals)

export default router