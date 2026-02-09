import express from 'express'
import rateLimit from 'express-rate-limit'
import { authController } from './auth.controller.js'
import { authenticateToken, requireAuth } from '../../middleware/auth.middleware.js'

const router = express.Router()

const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes (shorter window)
  max: 20, // More attempts allowed
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again in 5 minutes' }
})

// Self-protecting: checks internally if admin already exists, rejects if so
router.post('/init-admin', authController.initAdmin);

// Admin-only routes
router.post('/migrate-users', authenticateToken, requireAuth(['מנהל']), authController.migrateExistingUsers);
router.post('/migrate-invitations', authenticateToken, requireAuth(['מנהל']), authController.migratePendingInvitations);
router.get('/invitation-stats', authenticateToken, requireAuth(['מנהל']), authController.getInvitationModeStats);
router.get('/check-teacher/:email', authenticateToken, requireAuth(['מנהל']), authController.checkTeacherByEmail);
router.delete('/remove-teacher/:email', authenticateToken, requireAuth(['מנהל']), authController.removeTeacherByEmail);

// Public routes
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