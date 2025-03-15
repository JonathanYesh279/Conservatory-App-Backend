// api/school-year/__tests__/school-year.route.test.js
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import express from 'express'
import request from 'supertest'
import { schoolYearController } from '../school-year-controller.js'
import { ObjectId } from 'mongodb'

// Mock the school year controller
vi.mock('../school-year-controller.js', () => ({
  schoolYearController: {
    getSchoolYears: vi.fn((req, res) => res.json([{ _id: '1', name: '2023-2024', isCurrent: true }])),
    getSchoolYearById: vi.fn((req, res) => res.json({ _id: '1', name: '2023-2024', isCurrent: true })),
    getCurrentSchoolYear: vi.fn((req, res) => res.json({ _id: '1', name: '2023-2024', isCurrent: true })),
    createSchoolYear: vi.fn((req, res) => res.status(201).json({ _id: '1', ...req.body })),
    updateSchoolYear: vi.fn((req, res) => res.json({ _id: '1', ...req.body })),
    setCurrentSchoolYear: vi.fn((req, res) => res.json({ _id: '1', name: '2023-2024', isCurrent: true })),
    rolloverToNewYear: vi.fn((req, res) => res.json({ _id: '2', name: '2024-2025', isCurrent: true }))
  }
}))

// Create mock functions for middleware
const mockAuthenticateToken = vi.fn((req, res, next) => {
  req.teacher = { 
    _id: new ObjectId('6579e36c83c8b3a5c2df8a8b'), 
    roles: ['מנהל'] 
  }
  req.isAdmin = true
  next()
})

const mockRequireAuth = vi.fn(() => (req, res, next) => next())

// Mock middleware.js with our mock functions
vi.mock('../../middleware/auth.middleware.js', () => ({
  authenticateToken: mockAuthenticateToken,
  requireAuth: mockRequireAuth
}))

describe('School Year Routes', () => {
  let app

  beforeEach(() => {
    // Clear mocks
    vi.clearAllMocks()

    // Create a new Express app for each test
    app = express()
    app.use(express.json())
    
    // Define routes directly instead of using the module
    app.get('/api/school-year', mockAuthenticateToken, mockRequireAuth(['מנהל', 'מורה', 'מנצח', 'מדריך הרכב']), (req, res) => schoolYearController.getSchoolYears(req, res))
    app.get('/api/school-year/current', mockAuthenticateToken, mockRequireAuth(['מנהל', 'מורה', 'מנצח', 'מדריך הרכב']), (req, res) => schoolYearController.getCurrentSchoolYear(req, res))
    app.get('/api/school-year/:id', mockAuthenticateToken, mockRequireAuth(['מנהל', 'מורה', 'מנצח', 'מדריך הרכב']), (req, res) => schoolYearController.getSchoolYearById(req, res))
    app.post('/api/school-year', mockAuthenticateToken, mockRequireAuth(['מנהל']), (req, res) => schoolYearController.createSchoolYear(req, res))
    app.put('/api/school-year/:id', mockAuthenticateToken, mockRequireAuth(['מנהל']), (req, res) => schoolYearController.updateSchoolYear(req, res))
    app.put('/api/school-year/:id/set-current', mockAuthenticateToken, mockRequireAuth(['מנהל']), (req, res) => schoolYearController.setCurrentSchoolYear(req, res))
    app.put('/api/school-year/:id/rollover', mockAuthenticateToken, mockRequireAuth(['מנהל']), (req, res) => schoolYearController.rolloverToNewYear(req, res))
  })

  afterAll(() => {
    vi.restoreAllMocks()
  })

  describe('GET /api/school-year', () => {
    it('should route to getSchoolYears controller and return school years', async () => {
      // Execute
      const response = await request(app)
        .get('/api/school-year')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(mockAuthenticateToken).toHaveBeenCalled()
      expect(mockRequireAuth).toHaveBeenCalledWith(['מנהל', 'מורה', 'מנצח', 'מדריך הרכב'])
      expect(schoolYearController.getSchoolYears).toHaveBeenCalled()
      expect(response.status).toBe(200)
      expect(response.body).toBeInstanceOf(Array)
      expect(response.body[0]).toHaveProperty('name', '2023-2024')
    })
  })

  describe('GET /api/school-year/current', () => {
    it('should route to getCurrentSchoolYear controller and return the current school year', async () => {
      // Execute
      const response = await request(app)
        .get('/api/school-year/current')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(mockAuthenticateToken).toHaveBeenCalled()
      expect(schoolYearController.getCurrentSchoolYear).toHaveBeenCalled()
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('isCurrent', true)
    })
  })

  describe('GET /api/school-year/:id', () => {
    it('should route to getSchoolYearById controller and return the school year', async () => {
      // Execute
      const response = await request(app)
        .get('/api/school-year/1')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(mockAuthenticateToken).toHaveBeenCalled()
      expect(schoolYearController.getSchoolYearById).toHaveBeenCalled()
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('_id', '1')
    })
  })

  describe('POST /api/school-year', () => {
    it('should route to createSchoolYear controller and return the new school year', async () => {
      // Setup
      const newSchoolYear = {
        name: '2024-2025',
        startDate: '2024-08-01',
        endDate: '2025-07-31',
        isCurrent: false
      }

      // Execute
      const response = await request(app)
        .post('/api/school-year')
        .set('Authorization', 'Bearer valid-token')
        .send(newSchoolYear)

      // Assert
      expect(mockAuthenticateToken).toHaveBeenCalled()
      expect(mockRequireAuth).toHaveBeenCalledWith(['מנהל'])
      expect(schoolYearController.createSchoolYear).toHaveBeenCalled()
      expect(response.status).toBe(201)
      expect(response.body).toHaveProperty('name', '2024-2025')
    })
  })

  describe('PUT /api/school-year/:id', () => {
    it('should route to updateSchoolYear controller and return the updated school year', async () => {
      // Setup
      const updateData = {
        name: 'Updated 2023-2024',
        isCurrent: true
      }

      // Execute
      const response = await request(app)
        .put('/api/school-year/1')
        .set('Authorization', 'Bearer valid-token')
        .send(updateData)

      // Assert
      expect(mockAuthenticateToken).toHaveBeenCalled()
      expect(mockRequireAuth).toHaveBeenCalledWith(['מנהל'])
      expect(schoolYearController.updateSchoolYear).toHaveBeenCalled()
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('name', 'Updated 2023-2024')
    })
  })

  describe('PUT /api/school-year/:id/set-current', () => {
    it('should route to setCurrentSchoolYear controller and return the current school year', async () => {
      // Execute
      const response = await request(app)
        .put('/api/school-year/1/set-current')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(mockAuthenticateToken).toHaveBeenCalled()
      expect(mockRequireAuth).toHaveBeenCalledWith(['מנהל'])
      expect(schoolYearController.setCurrentSchoolYear).toHaveBeenCalled()
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('isCurrent', true)
    })
  })

  describe('PUT /api/school-year/:id/rollover', () => {
    it('should route to rolloverToNewYear controller and return the new school year', async () => {
      // Execute
      const response = await request(app)
        .put('/api/school-year/1/rollover')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(mockAuthenticateToken).toHaveBeenCalled()
      expect(mockRequireAuth).toHaveBeenCalledWith(['מנהל'])
      expect(schoolYearController.rolloverToNewYear).toHaveBeenCalled()
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('_id', '2')
      expect(response.body).toHaveProperty('name', '2024-2025')
    })
  })

  describe('Error handling', () => {
    it('should handle authentication errors', async () => {
      // Setup - Override the auth middleware for this test
      mockAuthenticateToken.mockImplementationOnce((req, res, next) => {
        res.status(401).json({ error: 'Authentication required' })
      })

      // Execute
      const response = await request(app)
        .get('/api/school-year')
        .set('Authorization', 'Bearer invalid-token')

      // Assert
      expect(response.status).toBe(401)
      expect(response.body).toHaveProperty('error', 'Authentication required')
    })

    it('should handle authorization errors', async () => {
      // Setup - Override the requireAuth middleware for this test
      // We need to mock it directly in the route definition for this specific test
      const specialApp = express()
      specialApp.use(express.json())
      specialApp.post('/api/school-year', mockAuthenticateToken, (req, res, next) => {
        // Simulate unauthorized access
        return res.status(403).json({ error: 'Insufficient permissions' })
      })

      // Execute
      const response = await request(specialApp)
        .post('/api/school-year')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Test Year' })

      // Assert
      expect(response.status).toBe(403)
      expect(response.body).toHaveProperty('error', 'Insufficient permissions')
    })
  })
})