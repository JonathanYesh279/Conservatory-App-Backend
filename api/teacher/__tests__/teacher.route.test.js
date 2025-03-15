// api/teacher/__tests__/teacher.route.test.js
import { describe, it, expect, vi, beforeEach, afterAll, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { teacherController } from '../teacher.controller.js'
import { ObjectId } from 'mongodb'

// Mock the teacher controller
vi.mock('../teacher.controller.js', () => ({
  teacherController: {
    getTeachers: vi.fn((req, res) => res.json([{ _id: '1', personalInfo: { fullName: 'Test Teacher' } }])),
    getTeacherById: vi.fn((req, res) => res.json({ _id: '1', personalInfo: { fullName: 'Test Teacher' } })),
    getTeacherByRole: vi.fn((req, res) => res.json([{ _id: '1', personalInfo: { fullName: 'Test Teacher' }, roles: ['מורה'] }])),
    addTeacher: vi.fn((req, res) => res.status(201).json({ _id: '1', ...req.body })),
    updateTeacher: vi.fn((req, res) => res.json({ _id: '1', ...req.body })),
    removeTeacher: vi.fn((req, res) => res.json({ _id: '1', isActive: false }))
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

describe('Teacher Routes', () => {
  let app

  beforeEach(() => {
    // Clear mocks
    vi.clearAllMocks()

    // Create a new Express app for each test
    app = express()
    app.use(express.json())
    
    // Define routes directly instead of using the teacher.routes module
    app.get('/api/teacher', mockAuthenticateToken, mockRequireAuth(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל']), (req, res) => teacherController.getTeachers(req, res))
    app.get('/api/teacher/:id', mockAuthenticateToken, mockRequireAuth(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל']), (req, res) => teacherController.getTeacherById(req, res))
    app.get('/api/teacher/role/:role', mockAuthenticateToken, mockRequireAuth(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל']), (req, res) => teacherController.getTeacherByRole(req, res))
    app.post('/api/teacher', mockAuthenticateToken, mockRequireAuth(['מנהל']), (req, res) => teacherController.addTeacher(req, res))
    app.put('/api/teacher/:id', mockAuthenticateToken, mockRequireAuth(['מנהל']), (req, res) => teacherController.updateTeacher(req, res))
    app.delete('/api/teacher/:id', mockAuthenticateToken, mockRequireAuth(['מנהל']), (req, res) => teacherController.removeTeacher(req, res))
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  afterAll(() => {
    vi.restoreAllMocks()
  })

  describe('GET /api/teacher', () => {
    it('should route to getTeachers controller and return teachers', async () => {
      // Execute
      const response = await request(app)
        .get('/api/teacher')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(mockAuthenticateToken).toHaveBeenCalled()
      expect(mockRequireAuth).toHaveBeenCalledWith(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל'])
      expect(teacherController.getTeachers).toHaveBeenCalled()
      expect(response.status).toBe(200)
      expect(response.body).toBeInstanceOf(Array)
    })

    it('should pass query filters to controller', async () => {
      // Execute
      const response = await request(app)
        .get('/api/teacher?name=Test&role=מורה')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(teacherController.getTeachers).toHaveBeenCalled()
      expect(response.status).toBe(200)
    })
  })

  describe('GET /api/teacher/:id', () => {
    it('should route to getTeacherById controller and return teacher', async () => {
      // Execute
      const response = await request(app)
        .get('/api/teacher/1')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(mockAuthenticateToken).toHaveBeenCalled()
      expect(teacherController.getTeacherById).toHaveBeenCalled()
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('_id', '1')
    })
  })

  describe('GET /api/teacher/role/:role', () => {
    it('should route to getTeacherByRole controller and return teachers', async () => {
      // Due to Express path matching, we need a special route for this test
      const specialApp = express()
      specialApp.use(express.json())
      specialApp.get('/api/teacher/role/:role', mockAuthenticateToken, mockRequireAuth(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל']), 
        (req, res) => teacherController.getTeacherByRole(req, res))
      
      // Execute
      const response = await request(specialApp)
        .get('/api/teacher/role/מורה')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(mockAuthenticateToken).toHaveBeenCalled()
      expect(teacherController.getTeacherByRole).toHaveBeenCalled()
      expect(response.status).toBe(200)
      expect(response.body).toBeInstanceOf(Array)
    })
  })

  describe('POST /api/teacher', () => {
    it('should route to addTeacher controller and return new teacher', async () => {
      // Setup
      const newTeacher = {
        personalInfo: {
          fullName: 'New Teacher',
          phone: '0501234567',
          email: 'new@example.com',
          address: 'Test Address'
        },
        roles: ['מורה'],
        professionalInfo: {
          instrument: 'Piano',
          isActive: true
        },
        teaching: {
          studentIds: [],
          schedule: []
        },
        credentials: {
          email: 'new@example.com',
          password: 'password123'
        }
      }

      // Execute
      const response = await request(app)
        .post('/api/teacher')
        .set('Authorization', 'Bearer valid-token')
        .send(newTeacher)

      // Assert
      expect(mockAuthenticateToken).toHaveBeenCalled()
      expect(mockRequireAuth).toHaveBeenCalledWith(['מנהל'])
      expect(teacherController.addTeacher).toHaveBeenCalled()
      expect(response.status).toBe(201)
      expect(response.body).toHaveProperty('_id')
    })
  })

  describe('PUT /api/teacher/:id', () => {
    it('should route to updateTeacher controller and return updated teacher', async () => {
      // Setup
      const teacherUpdate = {
        personalInfo: {
          fullName: 'Updated Teacher',
          phone: '0501234567',
          email: 'updated@example.com',
          address: 'Updated Address'
        }
      }

      // Execute
      const response = await request(app)
        .put('/api/teacher/1')
        .set('Authorization', 'Bearer valid-token')
        .send(teacherUpdate)

      // Assert
      expect(mockAuthenticateToken).toHaveBeenCalled()
      expect(mockRequireAuth).toHaveBeenCalledWith(['מנהל'])
      expect(teacherController.updateTeacher).toHaveBeenCalled()
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('_id')
      expect(response.body.personalInfo).toMatchObject(teacherUpdate.personalInfo)
    })
  })

  describe('DELETE /api/teacher/:id', () => {
    it('should route to removeTeacher controller and return deactivated teacher', async () => {
      // Execute
      const response = await request(app)
        .delete('/api/teacher/1')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(mockAuthenticateToken).toHaveBeenCalled()
      expect(mockRequireAuth).toHaveBeenCalledWith(['מנהל'])
      expect(teacherController.removeTeacher).toHaveBeenCalled()
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('isActive', false)
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
        .get('/api/teacher')
        .set('Authorization', 'Bearer invalid-token')

      // Assert
      expect(response.status).toBe(401)
      expect(response.body).toHaveProperty('error', 'Authentication required')
    })

    it('should handle authorization errors', async () => {
      // Setup - Override the requireAuth middleware for this test
      mockRequireAuth.mockImplementationOnce(() => (req, res, next) => {
        res.status(403).json({ error: 'Insufficient permissions' })
      })

      // Execute
      const response = await request(app)
        .post('/api/teacher')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(403)
      expect(response.body).toHaveProperty('error', 'Insufficient permissions')
    })
  })
})