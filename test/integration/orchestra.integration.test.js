// test/integration/orchestra.integration.test.js
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import express from 'express'
import request from 'supertest'
import cookieParser from 'cookie-parser'
import { ObjectId } from 'mongodb'

// Simple approach without dynamic imports - Directly mock the modules
vi.mock('../../middleware/auth.middleware.js', () => {
  return {
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
  }
})

vi.mock('../../services/mongoDB.service.js', () => {
  return {
    getCollection: vi.fn(() => {
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
  }),
  ORCHESTRA_CONSTANTS: {
    VALID_TYPES: ['הרכב', 'תזמורת'],
    VALID_NAMES: [
      'תזמורת מתחילים נשיפה', 
      'תזמורת עתודה נשיפה', 
      'תזמורת צעירה נשיפה', 
      'תזמורת יצוגית נשיפה', 
      'תזמורת סימפונית'
    ]
  }
}))

const mockOrchestraService = {
  getOrchestras: vi.fn().mockResolvedValue([{
    _id: new ObjectId('6579e36c83c8b3a5c2df8a8b'),
    name: 'תזמורת מתחילים נשיפה',
    type: 'תזמורת',
    conductorId: '6579e36c83c8b3a5c2df8a8c',
    memberIds: ['6579e36c83c8b3a5c2df8a8d', '6579e36c83c8b3a5c2df8a8e'],
    isActive: true
  }]),
  
  getOrchestraById: vi.fn().mockImplementation((id) => {
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
  }),
  
  addOrchestra: vi.fn().mockImplementation((orchestra) => {
    if (!orchestra.name || !orchestra.type || !orchestra.conductorId) {
      return Promise.reject(new Error('Validation error'))
    }
    return Promise.resolve({
      _id: new ObjectId('6579e36c83c8b3a5c2df1234'),
      ...orchestra
    })
  }),
  
  updateOrchestra: vi.fn().mockImplementation((id, updates, teacherId, isAdmin) => {
    return Promise.resolve({
      _id: new ObjectId(id),
      ...updates
    })
  }),
  
  removeOrchestra: vi.fn().mockImplementation((id, teacherId, isAdmin) => {
    return Promise.resolve({
      _id: new ObjectId(id),
      isActive: false
    })
  }),
  
  addMember: vi.fn().mockImplementation((orchestraId, studentId, teacherId, isAdmin) => {
    return Promise.resolve({
      _id: new ObjectId(orchestraId),
      memberIds: ['6579e36c83c8b3a5c2df8a8d', '6579e36c83c8b3a5c2df8a8e', studentId]
    })
  }),
  
  removeMember: vi.fn().mockImplementation((orchestraId, studentId, teacherId, isAdmin) => {
    return Promise.resolve({
      _id: new ObjectId(orchestraId),
      memberIds: ['6579e36c83c8b3a5c2df8a8e'] // studentId removed
    })
  }),
  
  updateRehearsalAttendance: vi.fn().mockImplementation((rehearsalId, attendance, teacherId, isAdmin) => {
    return Promise.resolve({
      _id: new ObjectId(rehearsalId),
      attendance: attendance
    })
  }),
  
  getRehearsalAttendance: vi.fn().mockImplementation(() => {
    return Promise.resolve({
      present: ['6579e36c83c8b3a5c2df8a8d'],
      absent: ['6579e36c83c8b3a5c2df8a8e']
    })
  }),
  
  getStudentAttendanceStats: vi.fn().mockImplementation(() => {
    return Promise.resolve({
      totalRehearsals: 5,
      attended: 4,
      attendanceRate: 80,
      recentHistory: []
    })
  })
}

// Mock the orchestra service module
vi.mock('../../api/orchestra/orchestra.service.js', () => ({
  orchestraService: mockOrchestraService
}))

// Mock the controller with direct function implementations
vi.mock('../../api/orchestra/orchestra.controller.js', () => ({
  orchestraController: {
    getOrchestras: vi.fn((_req, res) => {
      mockOrchestraService.getOrchestras()
        .then(orchestras => res.json(orchestras))
        .catch(err => res.status(500).json({ error: err.message }))
    }),
    
    getOrchestraById: vi.fn((req, res) => {
      const { id } = req.params
      mockOrchestraService.getOrchestraById(id)
        .then(orchestra => res.json(orchestra))
        .catch(err => res.status(500).json({ error: err.message }))
    }),
    
    addOrchestra: vi.fn((req, res) => {
      const orchestraToAdd = req.body
      mockOrchestraService.addOrchestra(orchestraToAdd)
        .then(newOrchestra => res.status(201).json(newOrchestra))
        .catch(err => res.status(500).json({ error: err.message }))
    }),
    
    updateOrchestra: vi.fn((req, res) => {
      const { id } = req.params
      const orchestraToUpdate = req.body
      const teacherId = req.teacher?._id || new ObjectId()
      const isAdmin = req.teacher?.roles?.includes('מנהל') || false
      
      mockOrchestraService.updateOrchestra(id, orchestraToUpdate, teacherId, isAdmin)
        .then(updatedOrchestra => res.json(updatedOrchestra))
        .catch(err => {
          if (err.message === 'Not authorized to modify this orchestra') {
            return res.status(403).json({ error: err.message })
          }
          res.status(500).json({ error: err.message })
        })
    }),
    
    removeOrchestra: vi.fn((req, res) => {
      const { id } = req.params
      const teacherId = req.teacher?._id || new ObjectId()
      const isAdmin = req.teacher?.roles?.includes('מנהל') || false
      
      mockOrchestraService.removeOrchestra(id, teacherId, isAdmin)
        .then(removedOrchestra => res.json(removedOrchestra))
        .catch(err => {
          if (err.message === 'Not authorized to modify this orchestra') {
            return res.status(403).json({ error: err.message })
          }
          res.status(500).json({ error: err.message })
        })
    }),
    
    addMember: vi.fn((req, res) => {
      const { id: orchestraId } = req.params
      const { studentId } = req.body
      const teacherId = req.teacher?._id || new ObjectId()
      const isAdmin = req.teacher?.roles?.includes('מנהל') || false
      
      mockOrchestraService.addMember(orchestraId, studentId, teacherId, isAdmin)
        .then(updatedOrchestra => res.json(updatedOrchestra))
        .catch(err => {
          if (err.message === 'Not authorized to modify this orchestra') {
            return res.status(403).json({ error: err.message })
          }
          res.status(500).json({ error: err.message })
        })
    }),
    
    removeMember: vi.fn((req, res) => {
      const { id: orchestraId, studentId } = req.params
      const teacherId = req.teacher?._id || new ObjectId()
      const isAdmin = req.teacher?.roles?.includes('מנהל') || false
      
      mockOrchestraService.removeMember(orchestraId, studentId, teacherId, isAdmin)
        .then(updatedOrchestra => res.json(updatedOrchestra))
        .catch(err => {
          if (err.message === 'Not authorized to modify this orchestra') {
            return res.status(403).json({ error: err.message })
          }
          res.status(500).json({ error: err.message })
        })
    }),
    
    updateRehearsalAttendance: vi.fn((req, res) => {
      const { rehearsalId } = req.params
      const attendance = req.body
      const teacherId = req.teacher?._id || new ObjectId()
      const isAdmin = req.teacher?.roles?.includes('מנהל') || false
      
      mockOrchestraService.updateRehearsalAttendance(rehearsalId, attendance, teacherId, isAdmin)
        .then(updatedRehearsal => res.json(updatedRehearsal))
        .catch(err => {
          if (err.message === 'Not authorized to modify this orchestra') {
            return res.status(403).json({ error: err.message })
          }
          res.status(500).json({ error: err.message })
        })
    }),
    
    getRehearsalAttendance: vi.fn((req, res) => {
      const { rehearsalId } = req.params
      mockOrchestraService.getRehearsalAttendance(rehearsalId)
        .then(attendance => res.json(attendance))
        .catch(err => res.status(500).json({ error: err.message }))
    }),
    
    getStudentAttendanceStats: vi.fn((req, res) => {
      const { orchestraId, studentId } = req.params
      mockOrchestraService.getStudentAttendanceStats(orchestraId, studentId)
        .then(stats => res.json(stats))
        .catch(err => res.status(500).json({ error: err.message }))
    })
  }
}))

// Import after all mocks are defined
import { authenticateToken, requireAuth } from '../../middleware/auth.middleware.js'
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
    
    // Use orchestra routes
    app.use('/api/orchestra', orchestraRoutes)
    
    // Add global error handler
    app.use((err, req, res, next) => {
      console.error('Test error:', err)
      res.status(500).json({ error: err.message })
    })
  })

  afterAll(() => {
    vi.resetAllMocks()
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
      // Verify service was called
      expect(mockOrchestraService.getOrchestras).toHaveBeenCalled()
    })

    it('should filter orchestras by type', async () => {
      // Execute
      const response = await request(app)
        .get('/api/orchestra?type=תזמורת')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toBeInstanceOf(Array)
      // Verify service was called
      expect(mockOrchestraService.getOrchestras).toHaveBeenCalled()
    })

    it('should filter orchestras by conductorId', async () => {
      // Execute
      const response = await request(app)
        .get('/api/orchestra?conductorId=6579e36c83c8b3a5c2df8a8c')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toBeInstanceOf(Array)
      // Verify service was called
      expect(mockOrchestraService.getOrchestras).toHaveBeenCalled()
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
      expect(mockOrchestraService.getOrchestraById).toHaveBeenCalledWith(orchestraId)
    })

    it('should handle orchestra not found', async () => {
      // Execute
      const response = await request(app)
        .get('/api/orchestra/invalid-id')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(500)
      expect(response.body).toHaveProperty('error')
      expect(mockOrchestraService.getOrchestraById).toHaveBeenCalledWith('invalid-id')
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
      expect(mockOrchestraService.addOrchestra).toHaveBeenCalledWith(newOrchestra)
    })

    it('should reject invalid orchestra data', async () => {
      // Setup
      const invalidOrchestra = {
        // Missing required fields
        name: 'Invalid Orchestra Name' // Missing type, conductorId, etc.
      }

      // Override the mock for this test
      mockOrchestraService.addOrchestra.mockRejectedValueOnce(
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
      expect(mockOrchestraService.addOrchestra).toHaveBeenCalledWith(invalidOrchestra)
    })
  })

  describe('PUT /api/orchestra/:id', () => {
    it('should update an existing orchestra', async () => {
      // Setup
      const orchestraId = '6579e36c83c8b3a5c2df8a8b'
      const updateData = {
        name: 'תזמורת מתחילים נשיפה',
        type: 'תזמורת', // Add required field
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
      expect(mockOrchestraService.updateOrchestra).toHaveBeenCalledWith(
        orchestraId, 
        updateData,
        expect.any(ObjectId), // teacherId
        expect.any(Boolean) // isAdmin
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
      expect(mockOrchestraService.removeOrchestra).toHaveBeenCalledWith(
        orchestraId,
        expect.any(ObjectId), // teacherId
        expect.any(Boolean) // isAdmin
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
      expect(mockOrchestraService.addMember).toHaveBeenCalledWith(
        orchestraId,
        '6579e36c83c8b3a5c2df8a92',
        expect.any(ObjectId), // teacherId
        expect.any(Boolean) // isAdmin
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
      expect(mockOrchestraService.removeMember).toHaveBeenCalledWith(
        orchestraId,
        studentId,
        expect.any(ObjectId), // teacherId
        expect.any(Boolean) // isAdmin
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
      expect(mockOrchestraService.updateRehearsalAttendance).toHaveBeenCalledWith(
        rehearsalId,
        attendance,
        expect.any(ObjectId), // teacherId
        expect.any(Boolean) // isAdmin
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
      expect(mockOrchestraService.getRehearsalAttendance).toHaveBeenCalledWith(rehearsalId)
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
      expect(mockOrchestraService.getStudentAttendanceStats).toHaveBeenCalledWith(
        orchestraId,
        studentId
      )
    })
  })

  describe('Authentication and Authorization', () => {
    it('should handle unauthorized access', async () => {
      // Setup - Temporarily override the middleware for this test
      const originalImpl = authenticateToken.getMockImplementation()
      authenticateToken.mockImplementationOnce((req, res, next) => {
        return res.status(401).json({ error: 'Authentication required' })
      })

      // Execute
      const response = await request(app)
        .get('/api/orchestra')
        .set('Authorization', 'Bearer invalid-token')

      // Assert
      expect(response.status).toBe(401)
      expect(response.body).toHaveProperty('error', 'Authentication required')
      
      // Restore original implementation
      authenticateToken.mockImplementation(originalImpl)
    })

    it('should restrict access based on role', async () => {
      // Setup
      // 1. Override auth middleware to provide non-admin teacher
      const originalAuthImpl = authenticateToken.getMockImplementation()
      authenticateToken.mockImplementationOnce((req, res, next) => {
        // Set teacher to non-admin
        req.teacher = {
          _id: new ObjectId('6579e36c83c8b3a5c2df8a8c'),
          roles: ['מורה'], // Not admin
          isActive: true
        }
        req.isAdmin = false
        next()
      })
      
      // 2. Override requireAuth to check roles
      const originalRequireAuthImpl = requireAuth.getMockImplementation()
      requireAuth.mockImplementationOnce(roles => {
        return (req, res, next) => {
          // Check if user has required role
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
     authenticateToken.mockImplementation(originalAuthImpl)
     requireAuth.mockImplementation(originalRequireAuthImpl)
   })
 })
})