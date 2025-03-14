import { describe, it, expect, vi, beforeEach } from 'vitest'
import { addSchoolYearToRequest } from '../school-year.middleware.js'
import { getCollection } from '../../services/mongoDB.service.js'
import { ObjectId } from 'mongodb'

// Mock dependencies
vi.mock('../../services/mongoDB.service.js')

describe('School Year Middleware', () => {
  let req, res, next, mockCollection, mockFindOne, mockInsertOne

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Setup request, response, and next function
    req = {
      path: '/some/path',
      query: {},
      schoolYear: null
    }

    res = {
      status: vi.fn(() => res),
      json: vi.fn(() => res)
    }

    next = vi.fn()

    // Setup MongoDB collection mock
    mockFindOne = vi.fn()
    mockInsertOne = vi.fn()
    mockCollection = {
      findOne: mockFindOne,
      insertOne: mockInsertOne
    }
    getCollection.mockResolvedValue(mockCollection)
  })

  describe('addSchoolYearToRequest', () => {
    it('should skip middleware for /current and /list paths', async () => {
      // Setup
      req.path = '/current'

      // Execute
      await addSchoolYearToRequest(req, res, next)

      // Assert
      expect(next).toHaveBeenCalled()
      expect(getCollection).not.toHaveBeenCalled()
      expect(req.schoolYear).toBeNull()
    })

    it('should use schoolYearId from query if provided', async () => {
      // Setup
      const schoolYearId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      req.query = { schoolYearId: schoolYearId.toString() }

      const mockSchoolYear = {
        _id: schoolYearId,
        name: '2023-2024',
        isCurrent: true
      }
      mockFindOne.mockResolvedValue(mockSchoolYear)

      // Execute
      await addSchoolYearToRequest(req, res, next)

      // Assert
      expect(getCollection).toHaveBeenCalledWith('school_year')
      expect(mockFindOne).toHaveBeenCalledWith({
        _id: expect.any(ObjectId)
      })
      expect(req.schoolYear).toEqual(mockSchoolYear)
      expect(req.query.schoolYearId).toBe(schoolYearId.toString())
      expect(next).toHaveBeenCalled()
    })

    it('should return 500 if schoolYearId from query is invalid', async () => {
      // Setup
      req.query = { schoolYearId: 'invalid-id' }
      mockFindOne.mockResolvedValue(null)

      // Execute
      await addSchoolYearToRequest(req, res, next)

      // Assert
      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Error processing school year information' 
      })
      expect(next).not.toHaveBeenCalled()
    })

    it('should find current school year if no schoolYearId provided', async () => {
      // Setup
      const currentSchoolYear = {
        _id: new ObjectId('6579e36c83c8b3a5c2df8a8b'),
        name: '2023-2024',
        isCurrent: true
      }
      mockFindOne.mockResolvedValue(currentSchoolYear)

      // Execute
      await addSchoolYearToRequest(req, res, next)

      // Assert
      expect(getCollection).toHaveBeenCalledWith('school_year')
      expect(mockFindOne).toHaveBeenCalledWith({ isCurrent: true })
      expect(req.schoolYear).toEqual(currentSchoolYear)
      expect(req.query.schoolYearId).toBe(currentSchoolYear._id.toString())
      expect(next).toHaveBeenCalled()
    })

    it('should create default school year if none exists', async () => {
      // Setup
      mockFindOne.mockResolvedValue(null)
      
      const insertedId = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      mockInsertOne.mockResolvedValue({ insertedId })
      
      // Spy on Date to ensure consistent date creation for test
      const originalDate = global.Date
      const mockDate = new Date('2023-11-01')
      global.Date = vi.fn(() => mockDate)
      global.Date.now = originalDate.now
      
      // Execute
      await addSchoolYearToRequest(req, res, next)
      
      // Restore Date
      global.Date = originalDate

      // Assert
      expect(mockFindOne).toHaveBeenCalledWith({ isCurrent: true })
      
      // Should create default year based on current year
      expect(mockInsertOne).toHaveBeenCalledWith(expect.objectContaining({
        name: '2023-2024',
        startDate: expect.any(Date),
        endDate: expect.any(Date),
        isCurrent: true,
        isActive: true,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      }))
      
      expect(req.schoolYear).toEqual({
        _id: insertedId,
        name: '2023-2024',
        startDate: expect.any(Date),
        endDate: expect.any(Date),
        isCurrent: true,
        isActive: true,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      })
      
      expect(req.query.schoolYearId).toBe(insertedId.toString())
      expect(next).toHaveBeenCalled()
    })

    it('should handle database errors', async () => {
      // Setup
      mockFindOne.mockRejectedValue(new Error('Database error'))

      // Execute
      await addSchoolYearToRequest(req, res, next)

      // Assert
      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Error processing school year information' 
      })
      expect(next).not.toHaveBeenCalled()
    })

    it('should log errors to console', async () => {
      // Setup
      const consoleSpy = vi.spyOn(console, 'error')
      mockFindOne.mockRejectedValue(new Error('Database error'))

      // Execute
      await addSchoolYearToRequest(req, res, next)

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error in schoolYearMiddleware.addSchoolYearToRequest:')
      )
    })
  })
})