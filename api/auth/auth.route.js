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
router.get('/check-teacher/:email', authController.checkTeacherByEmail); // Check teacher by email
router.delete('/remove-teacher/:email', authController.removeTeacherByEmail); // Remove teacher by email
router.post('/login', loginLimiter, authController.login)
router.post('/refresh', authController.refresh)

// Protected routes
router.post('/logout', authenticateToken, authController.logout)

export default router