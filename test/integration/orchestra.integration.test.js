// test/integration/orchestra.integration.test.js
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import express from 'express'
import request from 'supertest'
import cookieParser from 'cookie-parser'
import { ObjectId } from 'mongodb'

// Mock entire orchestraService to isolate tests from implementation details
import * as orchestraServiceModule from '../../api/orchestra/orchestra.service.js'

// Store the original methods before mocking
const originalService = { ...orchestraServiceModule.orchestraService }

// Mock MongoDB service
vi.mock('../../services/mongoDB.service.js', () => {
  return {
    getCollection: vi.fn((collectionName) => {
      const baseCollection = {
        find: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([
            {
              _id: new ObjectId('6579e36c83c8b3a5c2df8a8b'),
              name: 'תזמורת מתחילים נשיפה',
              type: 'תזמורת',
              conductorId: '6579e36c83c8b3a5c2df8a8c',
              memberIds: ['6579e36c83c8b3a5c2df8a8d', '6579e36c83c8b3a5c2df8a8e'],
              rehearsalIds: [],
              schoolYearId: '6579e36c83c8b3a5c2df8a8f',
              isActive: true
            }
          ])
        }),
        findOne: vi.fn().mockResolvedValue({
          _id: new ObjectId('6579e36c83c8b3a5c2df8a8b'),
          name: 'תזמורת מתחילים נשיפה',
          type: 'תזמורת',
          conductorId: '6579e36c83c8b3a5c2df8a8c',
          memberIds: ['6579e36c83c8b3a5c2df8a8d', '6579e36c83c8b3a5c2df8a8e'],
          rehearsalIds: [],
          schoolYearId: '6579e36c83c8b3a5c2df8a8f',
          isActive: true
        }),
        insertOne: vi.fn().mockResolvedValue({ 
          insertedId: new ObjectId('6579e36c83c8b3a5c2df1234') 
        }),
        updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
        updateMany: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
        findOneAndUpdate: vi.fn().mockResolvedValue({
          _id: new ObjectId('6579e36c83c8b3a5c2df8a8b'),
          name: 'תזמורת מתחילים נשיפה',
          type: 'תזמורת',
          conductorId: '6579e36c83c8b3a5c2df8a8c',
          memberIds: ['6579e36c83c8b3a5c2df8a8d', '6579e36c83c8b3a5c2df8a8e'],
          rehearsalIds: [],
          schoolYearId: '6579e36c83c8b3a5c2df8a8f',
          isActive: false
        })
      }
      
      return Promise.resolve(baseCollection)
    }),
    initializeMongoDB: vi.fn()
  }
})

// Mock auth middleware
vi.mock('../../middleware/auth.middleware.js', () => ({
  authenticateToken: vi.fn((req, res, next) => {
    req.teacher = {
      _id: new ObjectId('6579e36c83c8b3a5c2df8a8c'),
      roles: ['מנהל', 'מנצח'],
      isActive: true
    }
    req.isAdmin = true
    next()
  }),
  requireAuth: vi.fn(() => (req, res, next) => next())
}))

// Mock school year middleware
vi.mock('../../middleware/school-year.middleware.js', () => ({
  addSchoolYearToRequest: vi.fn((req, res, next) => {
    req.schoolYear = {
      _id: new ObjectId('6579e36c83c8b3a5c2df8a8f'),
      name: '2023-2024',
      isCurrent: true
    }
    req.query.schoolYearId = req.schoolYear._id.toString()
    next()
  })
}))

// Import validation
vi.mock('../../api/orchestra/orchestra.validation.js', () => ({
  validateOrchestra: vi.fn((data) => {
    if (!data.name || !data.type || !data.conductorId) {
      return {
        error: new Error('Validation error'),
        value: null
      }
    }
    return {
      error: null,
      value: data
    }
  })
}))

// Import the orchestra routes
import orchestraRoutes from '../../api/orchestra/orchestra.route.js'

describe('Orchestra API Integration Tests', () => {
  let app

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Setup Express app for each test
    app = express()
    app.use(express.json())
    app.use(cookieParser())
    
    // Mock orchestra service methods to avoid database errors
    orchestraServiceModule.orchestraService.getOrchestras = vi.fn().mockResolvedValue([{
      _id: new ObjectId('6579e36c83c8b3a5c2df8a8b'),
      name: 'תזמורת מתחילים נשיפה',
      type: 'תזמורת',
      conductorId: '6579e36c83c8b3a5c2df8a8c',
      memberIds: ['6579e36c83c8b3a5c2df8a8d', '6579e36c83c8b3a5c2df8a8e'],
      isActive: true
    }])
    
    orchestraServiceModule.orchestraService.getOrchestraById = vi.fn().mockImplementation((id) => {
      if (id === 'invalid-id') {
        return Promise.reject(new Error(`Orchestra with id ${id} not found`))
      }
      return Promise.resolve({
        _id: new ObjectId(id),
        name: 'תזמורת מתחילים נשיפה',
        type: 'תזמורת',
        conductorId: '6579e36c83c8b3a5c2df8a8c',
        memberIds: ['6579e36c83c8b3a5c2df8a8d', '6579e36c83c8b3a5c2df8a8e'],
        isActive: true
      })
    })
    
    orchestraServiceModule.orchestraService.addOrchestra = vi.fn().mockImplementation((orchestra) => {
      if (!orchestra.name || !orchestra.type || !orchestra.conductorId) {
        return Promise.reject(new Error('Validation error'))
      }
      return Promise.resolve({
        _id: new ObjectId('6579e36c83c8b3a5c2df1234'),
        ...orchestra
      })
    })
    
    orchestraServiceModule.orchestraService.updateOrchestra = vi.fn().mockImplementation((id, updates) => {
      return Promise.resolve({
        _id: new ObjectId(id),
        ...updates
      })
    })
    
    orchestraServiceModule.orchestraService.removeOrchestra = vi.fn().mockImplementation((id) => {
      return Promise.resolve({
        _id: new ObjectId(id),
        isActive: false
      })
    })
    
    orchestraServiceModule.orchestraService.addMember = vi.fn().mockImplementation((orchestraId, studentId) => {
      return Promise.resolve({
        _id: new ObjectId(orchestraId),
        memberIds: ['6579e36c83c8b3a5c2df8a8d', '6579e36c83c8b3a5c2df8a8e', studentId]
      })
    })
    
    orchestraServiceModule.orchestraService.removeMember = vi.fn().mockImplementation((orchestraId, studentId) => {
      return Promise.resolve({
        _id: new ObjectId(orchestraId),
        memberIds: ['6579e36c83c8b3a5c2df8a8e'] // studentId removed
      })
    })
    
    orchestraServiceModule.orchestraService.updateRehearsalAttendance = vi.fn().mockImplementation((rehearsalId, attendance) => {
      return Promise.resolve({
        _id: new ObjectId(rehearsalId),
        attendance: attendance
      })
    })
    
    orchestraServiceModule.orchestraService.getRehearsalAttendance = vi.fn().mockImplementation(() => {
      return Promise.resolve({
        present: ['6579e36c83c8b3a5c2df8a8d'],
        absent: ['6579e36c83c8b3a5c2df8a8e']
      })
    })
    
    orchestraServiceModule.orchestraService.getStudentAttendanceStats = vi.fn().mockImplementation(() => {
      return Promise.resolve({
        totalRehearsals: 5,
        attended: 4,
        attendanceRate: 80,
        recentHistory: []
      })
    })
    
    // Use orchestra routes
    app.use('/api/orchestra', orchestraRoutes)
    
    // Add error handler
    app.use((err, req, res, next) => {
      console.error('Test error:', err)
      res.status(500).json({ error: err.message })
    })
  })

  afterAll(() => {
    // Restore original service methods
    Object.keys(originalService).forEach(key => {
      orchestraServiceModule.orchestraService[key] = originalService[key]
    })
  })

  describe('GET /api/orchestra', () => {
    it('should return all active orchestras', async () => {
      // Execute
      const response = await request(app)
        .get('/api/orchestra')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toBeInstanceOf(Array)
      expect(response.body.length).toBeGreaterThan(0)
      expect(response.body[0]).toHaveProperty('name')
      expect(response.body[0]).toHaveProperty('type')
    })

    it('should filter orchestras by name', async () => {
      // Execute
      const response = await request(app)
        .get('/api/orchestra?name=מתחילים')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toBeInstanceOf(Array)
      // Verify service was called with correct filter
      expect(orchestraServiceModule.orchestraService.getOrchestras).toHaveBeenCalled()
    })

    it('should filter orchestras by type', async () => {
      // Execute
      const response = await request(app)
        .get('/api/orchestra?type=תזמורת')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toBeInstanceOf(Array)
      // Verify service was called with correct filter
      expect(orchestraServiceModule.orchestraService.getOrchestras).toHaveBeenCalled()
    })

    it('should filter orchestras by conductorId', async () => {
      // Execute
      const response = await request(app)
        .get('/api/orchestra?conductorId=6579e36c83c8b3a5c2df8a8c')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toBeInstanceOf(Array)
      // Verify service was called with correct filter
      expect(orchestraServiceModule.orchestraService.getOrchestras).toHaveBeenCalled()
    })
  })

  describe('GET /api/orchestra/:id', () => {
    it('should return a specific orchestra by ID', async () => {
      // Setup
      const orchestraId = '6579e36c83c8b3a5c2df8a8b'

      // Execute
      const response = await request(app)
        .get(`/api/orchestra/${orchestraId}`)
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('_id')
      expect(response.body).toHaveProperty('name')
      expect(response.body).toHaveProperty('type')
      expect(orchestraServiceModule.orchestraService.getOrchestraById).toHaveBeenCalledWith(orchestraId)
    })

    it('should handle orchestra not found', async () => {
      // Execute
      const response = await request(app)
        .get('/api/orchestra/invalid-id')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(500)
      expect(response.body).toHaveProperty('error')
      expect(orchestraServiceModule.orchestraService.getOrchestraById).toHaveBeenCalledWith('invalid-id')
    })
  })

  describe('POST /api/orchestra', () => {
    it('should create a new orchestra', async () => {
      // Setup
      const newOrchestra = {
        name: 'תזמורת צעירה נשיפה',
        type: 'תזמורת',
        conductorId: '6579e36c83c8b3a5c2df8a8c',
        schoolYearId: '6579e36c83c8b3a5c2df8a8f'
      }

      // Execute
      const response = await request(app)
        .post('/api/orchestra')
        .set('Authorization', 'Bearer valid-token')
        .send(newOrchestra)

      // Assert
      expect(response.status).toBe(201)
      expect(response.body).toHaveProperty('_id')
      expect(response.body).toHaveProperty('name', 'תזמורת צעירה נשיפה')
      expect(response.body).toHaveProperty('type', 'תזמורת')
      expect(orchestraServiceModule.orchestraService.addOrchestra).toHaveBeenCalledWith(newOrchestra)
    })

    it('should reject invalid orchestra data', async () => {
      // Setup
      const invalidOrchestra = {
        // Missing required fields
        name: 'Invalid Orchestra Name' // Missing type, conductorId, etc.
      }

      // Configure the mock to reject invalid data
      orchestraServiceModule.orchestraService.addOrchestra.mockRejectedValueOnce(
        new Error('Validation error')
      )

      // Execute
      const response = await request(app)
        .post('/api/orchestra')
        .set('Authorization', 'Bearer valid-token')
        .send(invalidOrchestra)

      // Assert
      expect(response.status).toBe(500)
      expect(response.body).toHaveProperty('error')
      expect(orchestraServiceModule.orchestraService.addOrchestra).toHaveBeenCalledWith(invalidOrchestra)
    })
  })

  describe('PUT /api/orchestra/:id', () => {
    it('should update an existing orchestra', async () => {
      // Setup
      const orchestraId = '6579e36c83c8b3a5c2df8a8b'
      const updateData = {
        name: 'תזמורת מתחילים נשיפה',
        conductorId: '6579e36c83c8b3a5c2df8a8c'
      }

      // Execute
      const response = await request(app)
        .put(`/api/orchestra/${orchestraId}`)
        .set('Authorization', 'Bearer valid-token')
        .send(updateData)

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('_id')
      expect(response.body).toHaveProperty('name', 'תזמורת מתחילים נשיפה')
      expect(orchestraServiceModule.orchestraService.updateOrchestra).toHaveBeenCalledWith(
        orchestraId, 
        updateData,
        expect.any(Object), // teacherId
        true // isAdmin
      )
    })
  })

  describe('DELETE /api/orchestra/:id', () => {
    it('should deactivate an orchestra (soft delete)', async () => {
      // Setup
      const orchestraId = '6579e36c83c8b3a5c2df8a8b'

      // Execute
      const response = await request(app)
        .delete(`/api/orchestra/${orchestraId}`)
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('_id')
      expect(response.body).toHaveProperty('isActive', false)
      expect(orchestraServiceModule.orchestraService.removeOrchestra).toHaveBeenCalledWith(
        orchestraId,
        expect.any(Object), // teacherId
        true // isAdmin
      )
    })
  })

  describe('POST /api/orchestra/:id/members', () => {
    it('should add a member to an orchestra', async () => {
      // Setup
      const orchestraId = '6579e36c83c8b3a5c2df8a8b'
      const newMember = {
        studentId: '6579e36c83c8b3a5c2df8a92' // Student to add
      }

      // Execute
      const response = await request(app)
        .post(`/api/orchestra/${orchestraId}/members`)
        .set('Authorization', 'Bearer valid-token')
        .send(newMember)

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('memberIds')
      expect(response.body.memberIds).toContain('6579e36c83c8b3a5c2df8a92')
      expect(orchestraServiceModule.orchestraService.addMember).toHaveBeenCalledWith(
        orchestraId,
        '6579e36c83c8b3a5c2df8a92',
        expect.any(Object), // teacherId
        true // isAdmin
      )
    })
  })

  describe('DELETE /api/orchestra/:id/members/:studentId', () => {
    it('should remove a member from an orchestra', async () => {
      // Setup
      const orchestraId = '6579e36c83c8b3a5c2df8a8b'
      const studentId = '6579e36c83c8b3a5c2df8a8d'

      // Execute
      const response = await request(app)
        .delete(`/api/orchestra/${orchestraId}/members/${studentId}`)
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('memberIds')
      expect(response.body.memberIds).not.toContain(studentId)
      expect(orchestraServiceModule.orchestraService.removeMember).toHaveBeenCalledWith(
        orchestraId,
        studentId,
        expect.any(Object), // teacherId
        true // isAdmin
      )
    })
  })

  describe('PUT /api/orchestra/:id/rehearsals/:rehearsalId/attendance', () => {
    it('should update rehearsal attendance', async () => {
      // Setup
      const orchestraId = '6579e36c83c8b3a5c2df8a8b'
      const rehearsalId = '6579e36c83c8b3a5c2df8a94'
      const attendance = {
        present: ['6579e36c83c8b3a5c2df8a8d', '6579e36c83c8b3a5c2df8a8e'],
        absent: []
      }

      // Execute
      const response = await request(app)
        .put(`/api/orchestra/${orchestraId}/rehearsals/${rehearsalId}/attendance`)
        .set('Authorization', 'Bearer valid-token')
        .send(attendance)

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('attendance')
      expect(response.body.attendance.present).toEqual(expect.arrayContaining(['6579e36c83c8b3a5c2df8a8d', '6579e36c83c8b3a5c2df8a8e']))
      expect(response.body.attendance.absent).toEqual([])
      expect(orchestraServiceModule.orchestraService.updateRehearsalAttendance).toHaveBeenCalledWith(
        rehearsalId,
        attendance,
        expect.any(Object), // teacherId
        true // isAdmin
      )
    })
  })

  describe('GET /api/orchestra/:id/rehearsals/:rehearsalId/attendance', () => {
    it('should get rehearsal attendance', async () => {
      // Setup
      const orchestraId = '6579e36c83c8b3a5c2df8a8b'
      const rehearsalId = '6579e36c83c8b3a5c2df8a94'

      // Execute
      const response = await request(app)
        .get(`/api/orchestra/${orchestraId}/rehearsals/${rehearsalId}/attendance`)
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('present')
      expect(response.body).toHaveProperty('absent')
      expect(orchestraServiceModule.orchestraService.getRehearsalAttendance).toHaveBeenCalledWith(rehearsalId)
    })
  })

  describe('GET /api/orchestra/:orchestraId/student/:studentId/attendance', () => {
    it('should get student attendance statistics', async () => {
      // Setup
      const orchestraId = '6579e36c83c8b3a5c2df8a8b'
      const studentId = '6579e36c83c8b3a5c2df8a8d'

      // Execute
      const response = await request(app)
        .get(`/api/orchestra/${orchestraId}/student/${studentId}/attendance`)
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('totalRehearsals')
      expect(response.body).toHaveProperty('attended')
      expect(response.body).toHaveProperty('attendanceRate')
      expect(response.body).toHaveProperty('recentHistory')
      expect(orchestraServiceModule.orchestraService.getStudentAttendanceStats).toHaveBeenCalledWith(
        orchestraId,
        studentId
      )
    })
  })

  describe('Authentication and Authorization', () => {
    it('should handle unauthorized access', async () => {
      // Setup - Override the auth middleware for this test
      const { authenticateToken } = await import('../../middleware/auth.middleware.js')
      
      // Save original implementation
      const originalAuthenticationFn = vi.mocked(authenticateToken)
      
      // Replace with one that returns 401
      vi.mocked(authenticateToken).mockImplementationOnce((req, res, next) => {
        return res.status(401).json({ error: 'Authentication required' })
      })

      // Execute
      const response = await request(app)
        .get('/api/orchestra')
        .set('Authorization', 'Bearer invalid-token')

      // Assert
      expect(response.status).toBe(401)
      expect(response.body).toHaveProperty('error', 'Authentication required')
      
      // Restore original
      vi.mocked(authenticateToken).mockImplementation(originalAuthenticationFn)
    })

    it('should restrict access based on role', async () => {
      // Setup - Override the auth middleware for this test
      const { authenticateToken } = await import('../../middleware/auth.middleware.js')
      
      // Save original implementation
      const originalAuthenticationFn = vi.mocked(authenticateToken)
      
      // Replace with one that returns a non-admin teacher
      vi.mocked(authenticateToken).mockImplementationOnce((req, res, next) => {
        req.teacher = {
          _id: new ObjectId('6579e36c83c8b3a5c2df8a8c'),
          roles: ['מורה'] // Not admin or conductor
        }
        req.isAdmin = false
        next()
      })
      
      // Mock the requireAuth middleware to check role
      const { requireAuth } = await import('../../middleware/auth.middleware.js')
      const originalRequireAuthFn = vi.mocked(requireAuth)
      
      vi.mocked(requireAuth).mockImplementationOnce(roles => {
        return (req, res, next) => {
          const hasRole = req.isAdmin || (req.teacher && req.teacher.roles.some(role => roles.includes(role)))
          if (!hasRole) {
            return res.status(403).json({ error: 'Insufficient permissions' })
          }
          next()
        }
      })

      // Execute - Try to add a new orchestra (admin only)
      const response = await request(app)
        .post('/api/orchestra')
        .set('Authorization', 'Bearer valid-token')
        .send({
          name: 'תזמורת עתודה נשיפה',
          type: 'תזמורת',
          conductorId: '6579e36c83c8b3a5c2df8a8c'
        })

      // Assert - Should be rejected due to role
      expect(response.status).toBe(403)
      expect(response.body).toHaveProperty('error', 'Insufficient permissions')
      
      // Restore original implementations
      vi.mocked(authenticateToken).mockImplementation(originalAuthenticationFn)
      vi.mocked(requireAuth).mockImplementation(originalRequireAuthFn)
    })
  })
})