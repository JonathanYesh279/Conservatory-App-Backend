// test/integration/school-year.integration.test.js
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import express from 'express'
import request from 'supertest'
import cookieParser from 'cookie-parser'
import { ObjectId } from 'mongodb'

// Setup mocks before importing the routes
vi.mock('../../services/mongoDB.service.js', () => {
  // Create mock collection data
  const mockSchoolYears = [
    {
      _id: new ObjectId('6579e36c83c8b3a5c2df8a8b'),
      name: '2022-2023',
      startDate: new Date('2022-08-01'),
      endDate: new Date('2023-07-31'),
      isCurrent: false,
      isActive: true,
      createdAt: new Date('2022-07-01'),
      updatedAt: new Date('2022-07-01')
    },
    {
      _id: new ObjectId('6579e36c83c8b3a5c2df8a8c'),
      name: '2023-2024',
      startDate: new Date('2023-08-01'),
      endDate: new Date('2024-07-31'),
      isCurrent: true,
      isActive: true,
      createdAt: new Date('2023-07-01'),
      updatedAt: new Date('2023-07-01')
    }
  ]

  // Mock MongoDB collection functions
  const mockCollection = {
    find: vi.fn((query = {}) => {
      let filtered = [...mockSchoolYears]
      
      // Basic filtering
      if (query.isActive !== undefined) {
        filtered = filtered.filter(year => year.isActive === query.isActive)
      }
      if (query.isCurrent !== undefined) {
        filtered = filtered.filter(year => year.isCurrent === query.isCurrent)
      }
      
      return {
        sort: vi.fn(() => ({
          limit: vi.fn(() => ({
            toArray: vi.fn(() => Promise.resolve(filtered))
          }))
        }))
      }
    }),
    findOne: vi.fn((query = {}) => {
      if (query._id) {
        const found = mockSchoolYears.find(y => 
          y._id.toString() === query._id.toString())
        return Promise.resolve(found || null)
      }
      if (query.isCurrent === true) {
        const found = mockSchoolYears.find(y => y.isCurrent === true)
        return Promise.resolve(found || null)
      }
      return Promise.resolve(null)
    }),
    insertOne: vi.fn((doc) => {
      const newId = new ObjectId()
      const newSchoolYear = { 
        ...doc, 
        _id: newId,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      mockSchoolYears.push(newSchoolYear)
      return Promise.resolve({ insertedId: newId })
    }),
    findOneAndUpdate: vi.fn((query, update, options) => {
      const index = mockSchoolYears.findIndex(y => 
        y._id.toString() === query._id.toString())
      
      if (index === -1) return Promise.resolve(null)
      
      if (update.$set) {
        mockSchoolYears[index] = { 
          ...mockSchoolYears[index], 
          ...update.$set,
          updatedAt: new Date()
        }
      }
      
      return Promise.resolve(mockSchoolYears[index])
    }),
    updateMany: vi.fn((query, update) => {
      let count = 0
      mockSchoolYears.forEach((year, index) => {
        let match = true
        
        // Check if year matches query
        Object.entries(query).forEach(([key, value]) => {
          if (key === '_id' && value.$ne) {
            if (year._id.toString() === value.$ne.toString()) {
              match = false
            }
          } else if (year[key] !== value) {
            match = false
          }
        })
        
        if (match) {
          if (update.$set) {
            mockSchoolYears[index] = {
              ...mockSchoolYears[index],
              ...update.$set,
              updatedAt: new Date()
            }
            count++
          }
        }
      })
      
      return Promise.resolve({ modifiedCount: count })
    })
  }

  return {
    getCollection: vi.fn(() => Promise.resolve(mockCollection)),
    initializeMongoDB: vi.fn()
  }
})

// Mock auth middleware
vi.mock('../../middleware/auth.middleware.js', () => {
  const mockTeacher = {
    _id: new ObjectId('6579e36c83c8b3a5c2df8a8b'),
    personalInfo: { 
      fullName: 'Admin User', 
      email: 'admin@example.com',
      phone: '0501234567',
      address: 'Test Address'
    },
    roles: ['מנהל'],
    isActive: true
  }

  return {
    authenticateToken: vi.fn((req, res, next) => {
      req.teacher = mockTeacher
      req.isAdmin = true
      next()
    }),
    requireAuth: vi.fn(() => (req, res, next) => next())
  }
})

// Import validation module mock
vi.mock('../../api/school-year/school-year.validation.js', () => ({
  validateSchoolYear: vi.fn((data) => {
    // Simple validation
    if (!data || !data.name || !data.startDate || !data.endDate) {
      return {
        error: new Error('Invalid school year data: missing required fields'),
        value: null
      }
    }
    return {
      error: null,
      value: data
    }
  })
}))

// Import routes after mocking
import schoolYearRoutes from '../../api/school-year/school-year.route.js'

describe('School Year API Integration Tests', () => {
  let app

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Setup Express app for each test
    app = express()
    app.use(express.json())
    app.use(cookieParser())
    app.use('/api/school-year', schoolYearRoutes)
  })

  afterAll(() => {
    vi.resetAllMocks()
  })

  describe('GET /api/school-year', () => {
    it('should return all school years', async () => {
      // Execute
      const response = await request(app)
        .get('/api/school-year')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toBeInstanceOf(Array)
      expect(response.body.length).toBeGreaterThan(0)
      expect(response.body[0]).toHaveProperty('name')
    })
  })

  describe('GET /api/school-year/current', () => {
    it('should return the current school year', async () => {
      // Execute
      const response = await request(app)
        .get('/api/school-year/current')
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('isCurrent', true)
      expect(response.body).toHaveProperty('name', '2023-2024')
    })
  })

  describe('GET /api/school-year/:id', () => {
    it('should return a specific school year by ID', async () => {
      // Set up
      const schoolYearId = '6579e36c83c8b3a5c2df8a8c'

      // Execute
      const response = await request(app)
        .get(`/api/school-year/${schoolYearId}`)
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('_id', schoolYearId)
      expect(response.body).toHaveProperty('name', '2023-2024')
    })
  })

  describe('POST /api/school-year', () => {
    it('should create a new school year', async () => {
      // Set up
      const newSchoolYear = {
        name: '2024-2025',
        startDate: new Date('2024-08-01'),
        endDate: new Date('2025-07-31'),
        isCurrent: false
      }

      // Execute
      const response = await request(app)
        .post('/api/school-year')
        .set('Authorization', 'Bearer valid-token')
        .send(newSchoolYear)

      // Assert
      expect(response.status).toBe(201)
      expect(response.body).toHaveProperty('_id')
      expect(response.body).toHaveProperty('name', '2024-2025')
      expect(response.body).toHaveProperty('isCurrent', false)
    })

    it('should reject invalid school year data', async () => {
      // Set up
      const invalidData = {
        name: '2024-2025'
        // Missing required fields
      }

      // Execute
      const response = await request(app)
        .post('/api/school-year')
        .set('Authorization', 'Bearer valid-token')
        .send(invalidData)

      // Assert
      expect(response.status).toBe(400)
      expect(response.body).toHaveProperty('error')
    })
  })

  describe('PUT /api/school-year/:id', () => {
    it('should update an existing school year', async () => {
      // Set up
      const schoolYearId = '6579e36c83c8b3a5c2df8a8b'
      const updateData = {
        name: 'Updated 2022-2023',
        startDate: new Date('2022-08-01'),
        endDate: new Date('2023-07-31'),
        isCurrent: false
      }

      // Execute
      const response = await request(app)
        .put(`/api/school-year/${schoolYearId}`)
        .set('Authorization', 'Bearer valid-token')
        .send(updateData)

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('_id', schoolYearId)
      expect(response.body).toHaveProperty('name', 'Updated 2022-2023')
    })
  })

  describe('PUT /api/school-year/:id/set-current', () => {
    it('should set a school year as the current one', async () => {
      // Set up
      const schoolYearId = '6579e36c83c8b3a5c2df8a8b'

      // Execute
      const response = await request(app)
        .put(`/api/school-year/${schoolYearId}/set-current`)
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('_id', schoolYearId)
      expect(response.body).toHaveProperty('isCurrent', true)
    })
  })

  describe('PUT /api/school-year/:id/rollover', () => {
    it('should create a new school year based on a previous one', async () => {
      // Set up
      const prevYearId = '6579e36c83c8b3a5c2df8a8c'

      // Execute
      const response = await request(app)
        .put(`/api/school-year/${prevYearId}/rollover`)
        .set('Authorization', 'Bearer valid-token')

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('_id')
      expect(response.body).toHaveProperty('name')
      expect(response.body).toHaveProperty('isCurrent', true)
      expect(response.body._id).not.toBe(prevYearId)
    })
  })
})