import express from 'express'
import { schoolYearController } from './school-year-controller.js'
import { requireAuth } from '../../middleware/auth.middleware.js'

const router = express.Router()

// Get routes
router.get('/', requireAuth(['מנהל', 'מורה', 'מנצח', 'מדריך הרכב']), schoolYearController.getSchoolYears)
router.get('/current', requireAuth(['מנהל', 'מורה', 'מנצח', 'מדריך הרכב']), schoolYearController.getCurrentSchoolYear)
router.get('/:id', requireAuth(['מנהל', 'מורה', 'מנצח', 'מדריך הרכב']), schoolYearController.getSchoolYearById)

// Post routes
router.post('/', requireAuth(['מנהל']), schoolYearController.createSchoolYear)

// Put routes
router.put('/:id', requireAuth(['מנהל']), schoolYearController.updateSchoolYear)
router.put('/:id/set-current', requireAuth(['מנהל']), schoolYearController.setCurrentSchoolYear)
router.put('/:id/rollover', requireAuth(['מנהל']), schoolYearController.rolloverToNewYear)

export default router