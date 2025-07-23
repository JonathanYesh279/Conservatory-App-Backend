import express from 'express'
import rateLimit from 'express-rate-limit'
import { authController } from './auth.controller.js'
import { authenticateToken } from '../../middleware/auth.middleware.js'

const router = express.Router()

const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes (shorter window)
  max: 20, // More attempts allowed
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again in 5 minutes' }
})

// Public routes
router.post('/init-admin', authController.initAdmin);
router.post('/migrate-users', authController.migrateExistingUsers); // Migration endpoint
router.post('/migrate-invitations', authController.migratePendingInvitations); // Invitation migration
router.get('/invitation-stats', authController.getInvitationModeStats); // Invitation mode stats
router.get('/check-teacher/:email', authController.checkTeacherByEmail); // Check teacher by email
router.delete('/remove-teacher/:email', authController.removeTeacherByEmail); // Remove teacher by email
router.post('/login', loginLimiter, authController.login)
router.post('/refresh', authController.refresh)
router.post('/forgot-password', authController.forgotPassword)
router.post('/reset-password', authController.resetPassword)
router.post('/accept-invitation', authController.acceptInvitation)

// Protected routes
router.get('/validate', authenticateToken, authController.validateToken)
router.post('/logout', authenticateToken, authController.logout)
router.post('/change-password', authenticateToken, authController.changePassword)
router.post('/force-password-change', authenticateToken, authController.forcePasswordChange)

export default router