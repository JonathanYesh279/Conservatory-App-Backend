import express from 'express'
import { bagrutController } from './bagrut.controller.js'
import { requireAuth } from '../../middleware/auth.middleware.js'
import { authorizeBagrutAccess } from '../../middleware/bagrut.middleware.js'
import { uploadSingleFile } from '../../middleware/file.middleware.js'

const router = express.Router()

// Bagrut routes
router.get('/', requireAuth(['מנהל']), bagrutController.getBagruts)
router.get('/:id', requireAuth(['מנהל', 'מורה']), authorizeBagrutAccess, bagrutController.getBagrutById)
router.get('/student/:studentId', requireAuth(['מנהל', 'מורה']), bagrutController.getBagrutByStudentId)

// Add new bagrut
router.post('/', requireAuth(['מנהל', 'מורה']), bagrutController.addBagrut)
// Update bagrut
router.put('/:id', requireAuth(['מנהל', 'מורה']), authorizeBagrutAccess, bagrutController.updateBagrut)
// Delete bagrut
router.delete('/:id', requireAuth(['מנהל']), authorizeBagrutAccess, bagrutController.removeBagrut)

// Update speficic presentation
router.put('/:id/presentation/:presentationIndex', requireAuth(['מנהל', 'מורה']), authorizeBagrutAccess, bagrutController.updatePresentation)

// Magen Bagrut routes
router.put('/:id/magenBagrut', requireAuth(['מנהל', 'מורה']), authorizeBagrutAccess, bagrutController.updateMagenBagrut)

// New grading system routes
router.put('/:id/gradingDetails', requireAuth(['מנהל', 'מורה']), authorizeBagrutAccess, bagrutController.updateGradingDetails)
router.put('/:id/calculateFinalGrade', requireAuth(['מנהל', 'מורה']), authorizeBagrutAccess, bagrutController.calculateFinalGrade)
router.put('/:id/complete', requireAuth(['מנהל', 'מורה']), authorizeBagrutAccess, bagrutController.completeBagrut)

// Director evaluation and recital configuration routes
router.put('/:id/directorEvaluation', requireAuth(['מנהל', 'מורה']), authorizeBagrutAccess, bagrutController.updateDirectorEvaluation)
router.put('/:id/recitalConfiguration', requireAuth(['מנהל', 'מורה']), authorizeBagrutAccess, bagrutController.setRecitalConfiguration)

// Document routes
router.post('/:id/document', requireAuth(['מנהל', 'מורה']), authorizeBagrutAccess, uploadSingleFile('document'), bagrutController.addDocument)
router.delete('/:id/document/:documentId', requireAuth(['מנהל', 'מורה']), authorizeBagrutAccess, bagrutController.removeDocument)

// Program routes
router.post('/:id/program', requireAuth(['מנהל', 'מורה']), authorizeBagrutAccess, bagrutController.addProgramPiece)
router.put('/:id/program', requireAuth(['מנהל', 'מורה']), authorizeBagrutAccess, bagrutController.updateProgram)
router.delete('/:id/program/:pieceId', requireAuth(['מנהל', 'מורה']), authorizeBagrutAccess, bagrutController.removeProgramPiece)

// Accompanist routes
router.post('/:id/accompanist', requireAuth(['מנהל', 'מורה']), authorizeBagrutAccess, bagrutController.addAccompanist)
router.delete('/:id/accompanist/:accompanistId', requireAuth(['מנהל', 'מורה']), authorizeBagrutAccess, bagrutController.removeAccompanist)

export default router