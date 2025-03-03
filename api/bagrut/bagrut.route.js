import express from 'express'
import { bagrutController } from './bagrut.controller.js'
import { requireAuth } from '../../middleware/auth.middleware.js'

const router = express.Router()

// Bagrut routes
router.get('/', requireAuth(['מנהל']), bagrutController.getBagruts)
router.get('/:id', requireAuth(['מנהל', 'מורה']), bagrutController.getBagrutById)
router.get('/student/:studentId', requireAuth(['מנהל', 'מורה']), bagrutController.getBagrutByStudentId)

// Add new bagrut
router.post('/', requireAuth(['מנהל', 'מורה']), bagrutController.addBagrut)
// Update bagrut
router.put('/:id', requireAuth(['מנהל', 'מורה']), bagrutController.updateBagrut)

// Update speficic presentation
router.put('/:id/presentation/:presentationIndex', requireAuth(['מנהל', 'מורה']), bagrutController.updatePresentation)

// Magen Bagrut routes
router.put('/:id/magenBagrut', requireAuth(['מנהל', 'מורה']), bagrutController.updateMagenBagrut)

// Document routes
router.post('/:id/document', requireAuth(['מנהל', 'מורה']), bagrutController.addDocument)
router.delete('/:id/document/:documentId', requireAuth(['מנהל', 'מורה']), bagrutController.removeDocument)

// Program routes
router.post('/:id/program', requireAuth(['מנהל', 'מורה']), bagrutController.addProgramPiece)
router.delete('/:id/program/:pieceId', requireAuth(['מנהל', 'מורה']), bagrutController.removeProgramPiece)

// Accompanist routes
router.post('/:id/accompanist', requireAuth(['מנהל', 'מורה']), bagrutController.addAccompanist)
router.delete('/:id/accompanist/:accompanistId', requireAuth(['מנהל', 'מורה']), bagrutController.removeAccompanist)

export default router