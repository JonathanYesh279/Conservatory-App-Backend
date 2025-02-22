import express from 'express'
import { authController } from './auth.controller.js'
import { authenticateToken } from '../../middleware/auth.middleware.js'

const router = express.Router()

// Public routes
router.post('/init-admin', authController.initAdmin);
router.post('/login', authController.login)
router.post('/refresh', authController.refresh)

// Protected routes
router.post('/logout', authenticateToken, authController.logout)

export default router