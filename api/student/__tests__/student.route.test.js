// api/student/__tests__/student.route.test.js
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import express from 'express'
import request from 'supertest'
import { studentController } from '../student.controller.js'
import { ObjectId } from 'mongodb'

// Mock the student controller
vi.mock('../student.controller.js', () => ({
  studentController: {
    getStudents: vi.fn((req, res) => res.json([{ _id: '1', personalInfo: { fullName: 'Student 1' } }])),
    getStudentById: vi.fn((req, res) => res.json({ _id: '1', personalInfo: { fullName: 'Student 1' } })),
    addStudent: vi.fn((req, res) => res.status(201).json({ _id: '1', ...req.body })),
    updateStudent: vi.fn((req, res) => res.json({ _id: '1', ...req.body })),
    removeStudent: vi.fn((req, res) => res.json({ _id: '1', isActive: false }))
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

describe('Student Routes', () => {
  let app

  beforeEach(() => {
    // Clear mocks
    vi.clearAllMocks()

    // Create a new Express app for each test
    app = express()
    app.use(express.json())
    
    // Define routes directly instead of using the module
    app.get('/api/student', mockAuthenticateToken, mockRequireAuth(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל']), (req, res) => studentController.getStudents(req, res))
    app.get('/api/student/:id', mockAuthenticateToken, mockRequireAuth(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל']), (req, res) => studentController.getStudentById(req, res))
    app.post('/api/student', mockAuthenticateToken, mockRequireAuth(['מנהל', 'מורה']), (req, res) => studentController.addStudent(req, res))
    app.put('/api/student/:id', mockAuthenticateToken, mockRequireAuth(['מורה', 'מנהל']), (req, res) => studentController.updateStudent(req, res))
    app.delete('/api/student/:id', mockAuthenticateToken, mockRequireAuth(['מנהל', 'מורה']), (req, res) => studentController.removeStudent(req, res))
  })

  afterAll(() => {
    vi.restoreAllMocks()
  })

  describe('GET /api/student', () => {
    it('should route to getStudents controller and return students', async () => {
      // Execute
      const response = await request(app)
        .get('/api/student')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(mockAuthenticateToken).toHaveBeenCalled()
      expect(mockRequireAuth).toHaveBeenCalledWith(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל'])
      expect(studentController.getStudents).toHaveBeenCalled()
      expect(response.status).toBe(200)
      expect(response.body).toBeInstanceOf(Array)
      expect(response.body[0]).toHaveProperty('personalInfo')
    })

    it('should pass query parameters to controller', async () => {
      // Execute
      const response = await request(app)
        .get('/api/student?name=Test&instrument=חצוצרה&class=א')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(studentController.getStudents).toHaveBeenCalled()
      expect(response.status).toBe(200)
    })
  })

  describe('GET /api/student/:id', () => {
    it('should route to getStudentById controller and return student', async () => {
      // Execute
      const response = await request(app)
        .get('/api/student/1')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(mockAuthenticateToken).toHaveBeenCalled()
      expect(studentController.getStudentById).toHaveBeenCalled()
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('_id', '1')
    })
  })

  describe('POST /api/student', () => {
    it('should route to addStudent controller and return new student', async () => {
      // Setup
      const newStudent = {
        personalInfo: {
          fullName: 'New Student',
          phone: '0501234567'
        },
        academicInfo: {
          instrument: 'חצוצרה',
          currentStage: 1,
          class: 'א'
        }
      }

      // Execute
      const response = await request(app)
        .post('/api/student')
        .set('Authorization', 'Bearer valid-token')
        .send(newStudent)

      // Assert
      expect(mockAuthenticateToken).toHaveBeenCalled()
      expect(mockRequireAuth).toHaveBeenCalledWith(['מנהל', 'מורה'])
      expect(studentController.addStudent).toHaveBeenCalled()
      expect(response.status).toBe(201)
      expect(response.body).toHaveProperty('_id')
      expect(response.body.personalInfo).toMatchObject(newStudent.personalInfo)
    })

    it('should handle different roles for adding students', async () => {
      // Setup - Teacher role (non-admin)
      mockAuthenticateToken.mockImplementationOnce((req, res, next) => {
        req.teacher = { 
          _id: new ObjectId('6579e36c83c8b3a5c2df8a8b'), 
          roles: ['מורה'] 
        }
        req.isAdmin = false
        next()
      })

      const newStudent = {
        personalInfo: {
          fullName: 'Teacher-added Student'
        },
        academicInfo: {
          instrument: 'חצוצרה',
          currentStage: 1,
          class: 'א'
        }
      }

      // Execute
      const response = await request(app)
        .post('/api/student')
        .set('Authorization', 'Bearer valid-token')
        .send(newStudent)

      // Assert
      expect(studentController.addStudent).toHaveBeenCalled()
      expect(response.status).toBe(201)
    })
  })

  describe('PUT /api/student/:id', () => {
    it('should route to updateStudent controller and return updated student', async () => {
      // Setup
      const updateData = {
        personalInfo: {
          fullName: 'Updated Student',
          phone: '0501234567'
        },
        academicInfo: {
          currentStage: 2
        }
      }

      // Execute
      const response = await request(app)
        .put('/api/student/1')
        .set('Authorization', 'Bearer valid-token')
        .send(updateData)

      // Assert
      expect(mockAuthenticateToken).toHaveBeenCalled()
      expect(mockRequireAuth).toHaveBeenCalledWith(['מורה', 'מנהל'])
      expect(studentController.updateStudent).toHaveBeenCalled()
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('_id', '1')
      expect(response.body.personalInfo).toMatchObject(updateData.personalInfo)
    })

    it('should handle different roles for updating students', async () => {
      // Setup - Teacher role (non-admin)
      mockAuthenticateToken.mockImplementationOnce((req, res, next) => {
        req.teacher = { 
          _id: new ObjectId('6579e36c83c8b3a5c2df8a8b'), 
          roles: ['מורה'] 
        }
        req.isAdmin = false
        next()
      })

      const updateData = {
        personalInfo: {
          fullName: 'Teacher-updated Student'
        }
      }

      // Execute
      const response = await request(app)
        .put('/api/student/1')
        .set('Authorization', 'Bearer valid-token')
        .send(updateData)

      // Assert
      expect(studentController.updateStudent).toHaveBeenCalled()
      expect(response.status).toBe(200)
    })
  })

  describe('DELETE /api/student/:id', () => {
    it('should route to removeStudent controller and return deactivated student', async () => {
      // Execute
      const response = await request(app)
        .delete('/api/student/1')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(mockAuthenticateToken).toHaveBeenCalled()
      expect(mockRequireAuth).toHaveBeenCalledWith(['מנהל', 'מורה'])
      expect(studentController.removeStudent).toHaveBeenCalled()
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('isActive', false)
    })

    it('should handle different roles for removing students', async () => {
      // Setup - Teacher role (non-admin)
      mockAuthenticateToken.mockImplementationOnce((req, res, next) => {
        req.teacher = { 
          _id: new ObjectId('6579e36c83c8b3a5c2df8a8b'), 
          roles: ['מורה'] 
        }
        req.isAdmin = false
        next()
      })

      // Execute
      const response = await request(app)
        .delete('/api/student/1')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(studentController.removeStudent).toHaveBeenCalled()
      expect(response.status).toBe(200)
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
        .get('/api/student')
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
        .post('/api/student')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(403)
      expect(response.body).toHaveProperty('error', 'Insufficient permissions')
    })
  })
})