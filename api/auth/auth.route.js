import express from 'express'
import rateLimit from 'express-rate-limit'
import { authController } from './auth.controller.js'
import { authenticateToken } from '../../middleware/auth.middleware.js'

const router = express.Router()

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later' }
})

// Public routes
router.post('/init-admin', authController.initAdmin);
router.post('/login', loginLimiter, authController.login)
router.post('/refresh', authController.refresh)

// Protected routes
router.post('/logout', authenticateToken, authController.logout)

export default router