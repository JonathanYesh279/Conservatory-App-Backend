// test/integration/rehearsal.integration.test.js
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { ObjectId } from 'mongodb'

// All mock implementations must be defined before any imports

// Mock the rehearsal service module with simpler mocks
vi.mock('../../api/rehearsal/rehearsal.service.js', () => {
  // Create sample rehearsal object
  const sampleRehearsal = {
    _id: '6579e36c83c8b3a5c2df8a95',
    groupId: '6579e36c83c8b3a5c2df8a90',
    type: 'תזמורת',
    date: new Date('2023-05-10'),
    dayOfWeek: 3,
    startTime: '18:00',
    endTime: '20:00',
    location: 'Main Hall',
    attendance: { present: [], absent: [] },
    notes: '',
    schoolYearId: '6579e36c83c8b3a5c2df8a8f',
    isActive: true
  }
  
  // Create mock service
  const mockService = {
    getRehearsals: vi.fn().mockResolvedValue([
      sampleRehearsal,
      {
        ...sampleRehearsal,
        _id: '6579e36c83c8b3a5c2df8a96',
        date: new Date('2023-05-17')
      }
    ]),
    
    getRehearsalById: vi.fn((id) => {
      if (id === '123456789012345678901234') {
        return Promise.reject(new Error(`Rehearsal with id ${id} not found`))
      }
      return Promise.resolve({
        ...sampleRehearsal,
        _id: id
      })
    }),
    
    getOrchestraRehearsals: vi.fn((orchestraId) => {
      return Promise.resolve([
        {
          ...sampleRehearsal,
          groupId: orchestraId,
        }
      ])
    }),
    
    addRehearsal: vi.fn((rehearsalData) => {
      if (!rehearsalData.groupId || !rehearsalData.type) {
        return Promise.reject(new Error('Invalid rehearsal data'))
      }
      return Promise.resolve({
        _id: '6579e36c83c8b3a5c2df9a01',
        ...rehearsalData
      })
    }),
    
    updateRehearsal: vi.fn((id, rehearsalData) => {
      if (id === '123456789012345678901234') {
        return Promise.reject(new Error(`Rehearsal with id ${id} not found`))
      }
      return Promise.resolve({
        _id: id,
        ...rehearsalData
      })
    }),
    
    removeRehearsal: vi.fn((id) => {
      if (id === '123456789012345678901234') {
        return Promise.reject(new Error(`Rehearsal with id ${id} not found`))
      }
      return Promise.resolve({
        _id: id,
        isActive: false
      })
    }),
    
    bulkCreateRehearsals: vi.fn((data) => {
      if (!data.orchestraId || !data.startDate || !data.endDate) {
        return Promise.reject(new Error('Invalid bulk create data'))
      }
      return Promise.resolve({
        insertedCount: 3,
        rehearsalIds: [
          '6579e36c83c8b3a5c2df9a01',
          '6579e36c83c8b3a5c2df9a02',
          '6579e36c83c8b3a5c2df9a03'
        ]
      })
    }),
    
    updateAttendance: vi.fn((rehearsalId, attendanceData) => {
      if (!attendanceData.present || !attendanceData.absent) {
        return Promise.reject(new Error('Invalid attendance data'))
      }
      return Promise.resolve({
        _id: rehearsalId,
        attendance: attendanceData
      })
    })
  }
  
  return {
    rehearsalService: mockService
  }
})

// Mock auth middleware - IMPORTANT: We need to add a mock with the correct implementation order
vi.mock('../../middleware/auth.middleware.js', () => {
  // Mock function that will be used inside the routes
  const mockAuthFn = (req, res, next) => {
    // Set teacher on request with the correct property
    req.teacher = {
      _id: '6579e36c83c8b3a5c2df8a8b', // String ID, not ObjectId
      roles: ['מנהל', 'מנצח'], // Admin and Conductor roles
      isActive: true
    }
    
    // Mark as admin based on roles
    req.isAdmin = req.teacher.roles.includes('מנהל')
    next()
  }
  
  return {
    authenticateToken: mockAuthFn,
    requireAuth: vi.fn(() => (req, res, next) => next())
  }
})

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

// Mock MongoDB service
vi.mock('../../services/mongoDB.service.js', () => {
  return {
    getCollection: vi.fn(() => {
      return Promise.resolve({
        find: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([
          {
            _id: new ObjectId('6579e36c83c8b3a5c2df8a95'),
            groupId: '6579e36c83c8b3a5c2df8a90',
            type: 'תזמורת',
            date: new Date('2023-05-10')
          },
          {
            _id: new ObjectId('6579e36c83c8b3a5c2df8a96'),
            groupId: '6579e36c83c8b3a5c2df8a90',
            type: 'תזמורת',
            date: new Date('2023-05-17')
          }
        ]),
        findOne: vi.fn().mockImplementation((query) => {
          if (query?._id && query._id.toString() === '123456789012345678901234') {
            return Promise.resolve(null)
          }
          return Promise.resolve({
            _id: new ObjectId('6579e36c83c8b3a5c2df8a95'),
            groupId: '6579e36c83c8b3a5c2df8a90',
            type: 'תזמורת',
            date: new Date('2023-05-10')
          })
        }),
        insertOne: vi.fn().mockResolvedValue({ 
          insertedId: new ObjectId('6579e36c83c8b3a5c2df9a01')
        }),
        findOneAndUpdate: vi.fn().mockImplementation((query, update) => {
          return Promise.resolve({
            _id: query?._id || new ObjectId('6579e36c83c8b3a5c2df8a95'),
            ...update.$set
          })
        }),
        insertMany: vi.fn().mockResolvedValue({
          insertedCount: 3,
          insertedIds: {
            0: new ObjectId('6579e36c83c8b3a5c2df9a01'),
            1: new ObjectId('6579e36c83c8b3a5c2df9a02'),
            2: new ObjectId('6579e36c83c8b3a5c2df9a03')
          }
        }),
        deleteMany: vi.fn().mockResolvedValue({ deletedCount: 1 })
      })
    }),
    initializeMongoDB: vi.fn()
  }
})

// Mock validation module
vi.mock('../../api/rehearsal/rehearsal.validation.js', () => ({
  validateRehearsal: vi.fn((data) => {
    if (!data.groupId || !data.type || !data.date) {
      return {
        error: new Error('Invalid rehearsal data'),
        value: null
      }
    }
    return {
      error: null,
      value: data
    }
  }),
  validateBulkCreate: vi.fn((data) => {
    if (!data.orchestraId || !data.startDate || !data.endDate) {
      return {
        error: new Error('Invalid bulk create data'),
        value: null
      }
    }
    return {
      error: null,
      value: data
    }
  }),
  validateAttendance: vi.fn((data) => {
    if (!data.present || !data.absent) {
      return {
        error: new Error('Invalid attendance data'),
        value: null
      }
    }
    return {
      error: null,
      value: data
    }
  }),
  VALID_DAYS_OF_WEEK: {
    0: 'ראשון', // Sunday
    1: 'שני', // Monday
    2: 'שלישי', // Tuesday
    3: 'רביעי', // Wednesday
    4: 'חמישי', // Thursday
    5: 'שישי', // Friday
    6: 'שבת', // Saturday
  },
  VALID_REHEARSAL_TYPES: ['תזמורת', 'הרכב']
}))

// Now we can import the modules that depend on the mocks
import express from 'express'
import request from 'supertest'
import cookieParser from 'cookie-parser'
import rehearsalRoutes from '../../api/rehearsal/rehearsal.route.js'

describe('Rehearsal API Integration Tests', () => {
  let app

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()
    
    // Setup Express app for each test
    app = express()
    app.use(express.json())
    app.use(cookieParser())
    
    // Add a custom middleware to ensure teacher is set correctly
    app.use((req, res, next) => {
      // Manually set the teacher object on every request
      if (!req.teacher) {
        req.teacher = {
          _id: '6579e36c83c8b3a5c2df8a8b',
          roles: ['מנהל', 'מנצח'],
          isActive: true
        }
        req.isAdmin = true
      }
      next()
    })
    
    // Use rehearsal routes
    app.use('/api/rehearsal', rehearsalRoutes)
    
    // Add global error handler
    app.use((err, req, res, next) => {
      console.error('Test error:', err)
      res.status(500).json({ error: err.message })
    })
  })

  afterAll(() => {
    vi.resetAllMocks()
  })

  describe('GET /api/rehearsal', () => {
    it('should return all active rehearsals', async () => {
      // Execute
      const response = await request(app)
        .get('/api/rehearsal')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toBeInstanceOf(Array)
    })

    it('should filter rehearsals by groupId', async () => {
      // Execute
      const response = await request(app)
        .get('/api/rehearsal?groupId=6579e36c83c8b3a5c2df8a90')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
    })

    it('should filter rehearsals by type', async () => {
      // Execute
      const response = await request(app)
        .get('/api/rehearsal?type=תזמורת')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
    })

    it('should filter rehearsals by date range', async () => {
      // Execute
      const response = await request(app)
        .get('/api/rehearsal?fromDate=2023-01-01&toDate=2023-12-31')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
    })
  })

  describe('GET /api/rehearsal/:id', () => {
    it('should return a specific rehearsal by ID', async () => {
      // Setup
      const rehearsalId = '6579e36c83c8b3a5c2df8a95'

      // Execute
      const response = await request(app)
        .get(`/api/rehearsal/${rehearsalId}`)
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
    })

    it('should handle rehearsal not found', async () => {
      // Setup - Using an ID known to trigger the not found error in our mock
      const rehearsalId = '123456789012345678901234'

      // Execute
      const response = await request(app)
        .get(`/api/rehearsal/${rehearsalId}`)
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(500) // Our error middleware returns 500
      expect(response.body).toHaveProperty('error')
    })
  })

  describe('GET /api/rehearsal/orchestra/:orchestraId', () => {
    it('should return all rehearsals for a specific orchestra', async () => {
      // Setup
      const orchestraId = '6579e36c83c8b3a5c2df8a90'

      // Execute
      const response = await request(app)
        .get(`/api/rehearsal/orchestra/${orchestraId}`)
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toBeInstanceOf(Array)
    })
  })

  describe('POST /api/rehearsal', () => {
    it('should create a new rehearsal', async () => {
      // Setup
      const newRehearsal = {
        groupId: '6579e36c83c8b3a5c2df8a90',
        type: 'תזמורת',
        date: '2023-06-07',
        dayOfWeek: 3,
        startTime: '18:00',
        endTime: '20:00',
        location: 'Main Hall',
        schoolYearId: '6579e36c83c8b3a5c2df8a8f'
      }

      // Execute
      const response = await request(app)
        .post('/api/rehearsal')
        .set('Authorization', 'Bearer valid-token')
        .send(newRehearsal)

      // Assert
      expect(response.status).toBe(201)
      expect(response.body).toHaveProperty('_id')
      expect(response.body).toHaveProperty('groupId', '6579e36c83c8b3a5c2df8a90')
      expect(response.body).toHaveProperty('type', 'תזמורת')
      expect(response.body).toHaveProperty('location', 'Main Hall')
    })

    it('should reject invalid rehearsal data', async () => {
      // Setup
      const invalidRehearsal = {
        // Missing required fields
        location: 'Main Hall'
      }

      // We need to explicitly mock this test case to return an error
      const { rehearsalService } = await import('../../api/rehearsal/rehearsal.service.js')
      rehearsalService.addRehearsal.mockImplementationOnce((data, teacherId, isAdmin) => {
        // This should return a rejected promise for our test
        return Promise.reject(new Error('Invalid rehearsal data'))
      })

      // Execute
      const response = await request(app)
        .post('/api/rehearsal')
        .set('Authorization', 'Bearer valid-token')
        .send(invalidRehearsal)

      // Assert - Reject with 500 as we're using the generic error handler
      expect(response.status).toBe(500)
      expect(response.body).toHaveProperty('error')
    })
  })

  describe('PUT /api/rehearsal/:id', () => {
    it('should update an existing rehearsal', async () => {
      // Setup
      const rehearsalId = '6579e36c83c8b3a5c2df8a95'
      const updateData = {
        groupId: '6579e36c83c8b3a5c2df8a90',
        type: 'תזמורת',
        date: '2023-06-14',
        dayOfWeek: 3,
        startTime: '19:00',
        endTime: '21:00',
        location: 'Concert Hall',
        notes: 'Updated rehearsal',
        schoolYearId: '6579e36c83c8b3a5c2df8a8f'
      }

      // Execute
      const response = await request(app)
        .put(`/api/rehearsal/${rehearsalId}`)
        .set('Authorization', 'Bearer valid-token')
        .send(updateData)

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('_id')
      expect(response.body).toHaveProperty('groupId', '6579e36c83c8b3a5c2df8a90')
      expect(response.body).toHaveProperty('type', 'תזמורת')
      expect(response.body).toHaveProperty('startTime', '19:00')
      expect(response.body).toHaveProperty('endTime', '21:00')
      expect(response.body).toHaveProperty('location', 'Concert Hall')
      expect(response.body).toHaveProperty('notes', 'Updated rehearsal')
    })

    it('should handle rehearsal not found', async () => {
      // Setup - Using an ID known to trigger the not found error in our mock
      const rehearsalId = '123456789012345678901234'
      const updateData = {
        location: 'Updated Location'
      }

      // Execute
      const response = await request(app)
        .put(`/api/rehearsal/${rehearsalId}`)
        .set('Authorization', 'Bearer valid-token')
        .send(updateData)

      // Assert
      expect(response.status).toBe(500)
      expect(response.body).toHaveProperty('error')
    })
  })

  describe('DELETE /api/rehearsal/:id', () => {
    it('should deactivate a rehearsal (soft delete)', async () => {
      // Setup
      const rehearsalId = '6579e36c83c8b3a5c2df8a95'

      // Execute
      const response = await request(app)
        .delete(`/api/rehearsal/${rehearsalId}`)
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('_id')
      expect(response.body).toHaveProperty('isActive', false)
    })
  })

  describe('POST /api/rehearsal/bulk-create', () => {
    it('should create multiple rehearsals based on schedule', async () => {
      // Setup
      const bulkCreateData = {
        orchestraId: '6579e36c83c8b3a5c2df8a90',
        startDate: '2023-06-01',
        endDate: '2023-07-31',
        dayOfWeek: 3, // Wednesday
        startTime: '18:00',
        endTime: '20:00',
        location: 'Main Hall'
      }

      // Execute
      const response = await request(app)
        .post('/api/rehearsal/bulk-create')
        .set('Authorization', 'Bearer valid-token')
        .send(bulkCreateData)

      // Assert
      expect(response.status).toBe(201)
      expect(response.body).toHaveProperty('insertedCount', 3)
      expect(response.body).toHaveProperty('rehearsalIds')
      expect(response.body.rehearsalIds).toBeInstanceOf(Array)
    })

    it('should reject invalid bulk create data', async () => {
      // Setup
      const invalidBulkCreateData = {
        // Missing required fields
        dayOfWeek: 3
      }

      // Execute
      const response = await request(app)
        .post('/api/rehearsal/bulk-create')
        .set('Authorization', 'Bearer valid-token')
        .send(invalidBulkCreateData)

      // Assert
      expect(response.status).toBe(500)
      expect(response.body).toHaveProperty('error')
    })
  })

  describe('PUT /api/rehearsal/:rehearsalId/attendance', () => {
    it('should update rehearsal attendance', async () => {
      // Setup
      const rehearsalId = '6579e36c83c8b3a5c2df8a95'
      const attendanceData = {
        present: ['6579e36c83c8b3a5c2df8a8d', '6579e36c83c8b3a5c2df8a8e', '6579e36c83c8b3a5c2df8a8f'],
        absent: []
      }

      // Execute
      const response = await request(app)
        .put(`/api/rehearsal/${rehearsalId}/attendance`)
        .set('Authorization', 'Bearer valid-token')
        .send(attendanceData)

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('attendance')
      expect(response.body.attendance).toHaveProperty('present')
      expect(response.body.attendance).toHaveProperty('absent')
      expect(response.body.attendance.present).toHaveLength(3)
      expect(response.body.attendance.absent).toHaveLength(0)
    })

    it('should reject invalid attendance data', async () => {
      // Setup
      const rehearsalId = '6579e36c83c8b3a5c2df8a95'
      const invalidAttendanceData = {
        // Missing required fields
        someOtherField: true
      }

      // Execute
      const response = await request(app)
        .put(`/api/rehearsal/${rehearsalId}/attendance`)
        .set('Authorization', 'Bearer valid-token')
        .send(invalidAttendanceData)

      // Assert
      expect(response.status).toBe(500)
      expect(response.body).toHaveProperty('error')
    })
  })
})