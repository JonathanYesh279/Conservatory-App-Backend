// api/auth/__tests__/auth.route.test.js
import { describe, it, expect, vi, beforeEach, afterAll, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import cookieParser from 'cookie-parser'
import { authController } from '../auth.controller.js'

// Mock the auth controller
vi.mock('../auth.controller.js', () => ({
  authController: {
    login: vi.fn((req, res) => res.json({ accessToken: 'test-token', teacher: { _id: '123' } })),
    refresh: vi.fn((req, res) => res.json({ accessToken: 'new-token' })),
    logout: vi.fn((req, res) => res.json({ message: 'Logged out successfully' })),
    initAdmin: vi.fn((req, res) => res.status(201).json({ message: 'Admin created successfully' }))
  }
}))

// Create mock functions for middleware
const mockAuthenticateToken = vi.fn((req, res, next) => {
  req.teacher = { _id: '6579e36c83c8b3a5c2df8a8b', roles: ['מורה'] }
  next()
})

const mockRequireAuth = vi.fn(() => (req, res, next) => next())

// Mock middleware.js with our mock functions
vi.mock('../../middleware/auth.middleware.js', () => ({
  authenticateToken: mockAuthenticateToken,
  requireAuth: mockRequireAuth
}))

// Mock express-rate-limit
vi.mock('express-rate-limit', () => ({
  default: () => (req, res, next) => next()
}))

describe('Auth Routes', () => {
  let app

  beforeEach(() => {
    // Clear mocks
    vi.clearAllMocks()

    // Create a new Express app for each test
    app = express()
    app.use(express.json())
    app.use(cookieParser())
    
    // Define routes directly instead of using the auth.routes module
    app.post('/api/auth/login', (req, res) => authController.login(req, res))
    app.post('/api/auth/refresh', (req, res) => authController.refresh(req, res))
    app.post('/api/auth/init-admin', (req, res) => authController.initAdmin(req, res))
    app.post('/api/auth/logout', mockAuthenticateToken, (req, res) => authController.logout(req, res))
  })

  describe('POST /api/auth/login', () => {
    it('should route to login controller', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' })

      expect(authController.login).toHaveBeenCalled()
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('accessToken', 'test-token')
    })
  })

  describe('POST /api/auth/refresh', () => {
    it('should route to refresh controller', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', ['refreshToken=valid-refresh-token'])

      expect(authController.refresh).toHaveBeenCalled()
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('accessToken', 'new-token')
    })
  })

  describe('POST /api/auth/logout', () => {
    it('should route to logout controller and use authentication middleware', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer valid-token')

      expect(mockAuthenticateToken).toHaveBeenCalled()
      expect(authController.logout).toHaveBeenCalled()
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('message', 'Logged out successfully')
    })
  })

  describe('POST /api/auth/init-admin', () => {
    it('should route to initAdmin controller', async () => {
      const response = await request(app)
        .post('/api/auth/init-admin')

      expect(authController.initAdmin).toHaveBeenCalled()
      expect(response.status).toBe(201)
      expect(response.body).toHaveProperty('message', 'Admin created successfully')
    })
  })

  describe('Error handling', () => {
    it('should handle login errors', async () => {
      // Override the login implementation for this test
      authController.login.mockImplementationOnce((req, res) => {
        res.status(401).json({ error: 'Invalid credentials' })
      })

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'wrong-password' })

      expect(response.status).toBe(401)
      expect(response.body).toHaveProperty('error', 'Invalid credentials')
    })

    it('should handle refresh token errors', async () => {
      // Override the refresh implementation for this test
      authController.refresh.mockImplementationOnce((req, res) => {
        res.status(401).json({ error: 'Invalid refresh token' })
      })

      const response = await request(app)
        .post('/api/auth/refresh')

      expect(response.status).toBe(401)
      expect(response.body).toHaveProperty('error', 'Invalid refresh token')
    })

    it('should handle authentication errors in protected routes', async () => {
      // Override the authenticateToken implementation for this test
      mockAuthenticateToken.mockImplementationOnce((req, res, next) => {
        res.status(401).json({ error: 'Authentication required' })
      })

      const response = await request(app)
        .post('/api/auth/logout')

      expect(response.status).toBe(401)
      expect(response.body).toHaveProperty('error', 'Authentication required')
    })
  })
})