import { describe, it, expect, vi, beforeEach } from 'vitest'
import { schoolYearController } from '../school-year-controller.js'
import { schoolYearService } from '../school-year.service.js'
import { ObjectId } from 'mongodb'

// Mock dependencies
vi.mock('../school-year.service.js', () => ({
  schoolYearService: {
    getSchoolYears: vi.fn(),
    getSchoolYearById: vi.fn(),
    getCurrentSchoolYear: vi.fn(),
    createSchoolYear: vi.fn(),
    updateSchoolYear: vi.fn(),
    setCurrentSchoolYear: vi.fn(),
    rolloverToNewYear: vi.fn()
  }
}))

describe('School Year Controller', () => {
  let req, res, next

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Setup request object
    req = {
      params: {},
      query: {},
      body: {}
    }

    // Setup response object with chainable methods
    res = {
      status: vi.fn(() => res),
      json: vi.fn(() => res)
    }

    // Setup next function
    next = vi.fn()
  })

  describe('getSchoolYears', () => {
    it('should get all school years', async () => {
      // Setup
      const mockSchoolYears = [
        { _id: '1', name: '2023-2024', isCurrent: true },
        { _id: '2', name: '2022-2023', isCurrent: false }
      ]
      schoolYearService.getSchoolYears.mockResolvedValue(mockSchoolYears)

      // Execute
      await schoolYearController.getSchoolYears(req, res, next)

      // Assert
      expect(schoolYearService.getSchoolYears).toHaveBeenCalled()
      expect(res.json).toHaveBeenCalledWith(mockSchoolYears)
    })

    it('should handle errors and pass them to next middleware', async () => {
      // Setup
      const error = new Error('Failed to get school years')
      schoolYearService.getSchoolYears.mockRejectedValue(error)

      // Execute
      await schoolYearController.getSchoolYears(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })

  describe('getSchoolYearById', () => {
    it('should get a school year by ID', async () => {
      // Setup
      const schoolYearId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      req.params = { id: schoolYearId.toString() }

      const mockSchoolYear = {
        _id: schoolYearId,
        name: '2023-2024',
        startDate: new Date('2023-08-01'),
        endDate: new Date('2024-07-31'),
        isCurrent: true
      }
      schoolYearService.getSchoolYearById.mockResolvedValue(mockSchoolYear)

      // Execute
      await schoolYearController.getSchoolYearById(req, res, next)

      // Assert
      expect(schoolYearService.getSchoolYearById).toHaveBeenCalledWith(schoolYearId.toString())
      expect(res.json).toHaveBeenCalledWith(mockSchoolYear)
    })

    it('should handle errors and pass them to next middleware', async () => {
      // Setup
      req.params = { id: 'invalid-id' }
      const error = new Error('School year not found')
      schoolYearService.getSchoolYearById.mockRejectedValue(error)

      // Execute
      await schoolYearController.getSchoolYearById(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })

  describe('getCurrentSchoolYear', () => {
    it('should get the current school year', async () => {
      // Setup
      const mockCurrentYear = {
        _id: '1',
        name: '2023-2024',
        startDate: new Date('2023-08-01'),
        endDate: new Date('2024-07-31'),
        isCurrent: true
      }
      schoolYearService.getCurrentSchoolYear.mockResolvedValue(mockCurrentYear)

      // Execute
      await schoolYearController.getCurrentSchoolYear(req, res, next)

      // Assert
      expect(schoolYearService.getCurrentSchoolYear).toHaveBeenCalled()
      expect(res.json).toHaveBeenCalledWith(mockCurrentYear)
    })

    it('should handle errors and pass them to next middleware', async () => {
      // Setup
      const error = new Error('Failed to get current school year')
      schoolYearService.getCurrentSchoolYear.mockRejectedValue(error)

      // Execute
      await schoolYearController.getCurrentSchoolYear(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })

  describe('createSchoolYear', () => {
    it('should create a new school year', async () => {
      // Setup
      const schoolYearData = {
        name: '2024-2025',
        startDate: new Date('2024-08-01'),
        endDate: new Date('2025-07-31'),
        isCurrent: false
      }
      req.body = schoolYearData

      const createdSchoolYear = { 
        _id: new ObjectId(),
        ...schoolYearData
      }
      schoolYearService.createSchoolYear.mockResolvedValue(createdSchoolYear)

      // Execute
      await schoolYearController.createSchoolYear(req, res, next)

      // Assert
      expect(schoolYearService.createSchoolYear).toHaveBeenCalledWith(schoolYearData)
      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith(createdSchoolYear)
    })

    it('should handle errors and pass them to next middleware', async () => {
      // Setup
      req.body = { invalidData: true }
      const error = new Error('Invalid school year data')
      schoolYearService.createSchoolYear.mockRejectedValue(error)

      // Execute
      await schoolYearController.createSchoolYear(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })

  describe('updateSchoolYear', () => {
    it('should update an existing school year', async () => {
      // Setup
      const schoolYearId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      req.params = { id: schoolYearId.toString() }
      
      const schoolYearUpdates = {
        name: 'Updated Year',
        isCurrent: true
      }
      req.body = schoolYearUpdates

      const updatedSchoolYear = { 
        _id: schoolYearId,
        name: 'Updated Year',
        startDate: new Date('2023-08-01'),
        endDate: new Date('2024-07-31'),
        isCurrent: true
      }
      schoolYearService.updateSchoolYear.mockResolvedValue(updatedSchoolYear)

      // Execute
      await schoolYearController.updateSchoolYear(req, res, next)

      // Assert
      expect(schoolYearService.updateSchoolYear).toHaveBeenCalledWith(
        schoolYearId.toString(), 
        schoolYearUpdates
      )
      expect(res.json).toHaveBeenCalledWith(updatedSchoolYear)
    })

    it('should handle errors and pass them to next middleware', async () => {
      // Setup
      req.params = { id: 'invalid-id' }
      req.body = { invalidData: true }
      const error = new Error('Failed to update school year')
      schoolYearService.updateSchoolYear.mockRejectedValue(error)

      // Execute
      await schoolYearController.updateSchoolYear(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })

  describe('setCurrentSchoolYear', () => {
    it('should set a school year as current', async () => {
      // Setup
      const schoolYearId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      req.params = { id: schoolYearId.toString() }

      const updatedSchoolYear = { 
        _id: schoolYearId,
        name: '2023-2024',
        isCurrent: true
      }
      schoolYearService.setCurrentSchoolYear.mockResolvedValue(updatedSchoolYear)

      // Execute
      await schoolYearController.setCurrentSchoolYear(req, res, next)

      // Assert
      expect(schoolYearService.setCurrentSchoolYear).toHaveBeenCalledWith(schoolYearId.toString())
      expect(res.json).toHaveBeenCalledWith(updatedSchoolYear)
    })

    it('should handle errors and pass them to next middleware', async () => {
      // Setup
      req.params = { id: 'invalid-id' }
      const error = new Error('Failed to set current school year')
      schoolYearService.setCurrentSchoolYear.mockRejectedValue(error)

      // Execute
      await schoolYearController.setCurrentSchoolYear(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })

  describe('rolloverToNewYear', () => {
    it('should rollover to a new school year', async () => {
      // Setup
      const prevYearId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      req.params = { id: prevYearId.toString() }

      const newSchoolYear = { 
        _id: new ObjectId('6579e36c83c8b3a5c2df8a8c'),
        name: '2024-2025',
        isCurrent: true
      }
      schoolYearService.rolloverToNewYear.mockResolvedValue(newSchoolYear)

      // Execute
      await schoolYearController.rolloverToNewYear(req, res, next)

      // Assert
      expect(schoolYearService.rolloverToNewYear).toHaveBeenCalledWith(prevYearId.toString())
      expect(res.json).toHaveBeenCalledWith(newSchoolYear)
    })

    it('should handle errors and pass them to next middleware', async () => {
      // Setup
      req.params = { id: 'invalid-id' }
      const error = new Error('Failed to rollover to new year')
      schoolYearService.rolloverToNewYear.mockRejectedValue(error)

      // Execute
      await schoolYearController.rolloverToNewYear(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })
})