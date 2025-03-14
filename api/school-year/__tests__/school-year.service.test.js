// api/school-year/__tests__/school-year.service.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { schoolYearService } from '../school-year.service.js'
import { validateSchoolYear } from '../school-year.validation.js'
import { getCollection } from '../../../services/mongoDB.service.js'
import { ObjectId } from 'mongodb'

// Mock dependencies
vi.mock('../school-year.validation.js', () => ({
  validateSchoolYear: vi.fn()
}))

vi.mock('../../../services/mongoDB.service.js', () => ({
  getCollection: vi.fn()
}))

describe('School Year Service', () => {
  let mockSchoolYearCollection, mockStudentCollection, mockTeacherCollection, mockOrchestraCollection

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Setup MongoDB collection mock methods with proper chaining
    mockSchoolYearCollection = {
      find: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      toArray: vi.fn(),
      findOne: vi.fn(),
      insertOne: vi.fn(),
      updateOne: vi.fn(),
      updateMany: vi.fn(),
      findOneAndUpdate: vi.fn()
    }

    mockStudentCollection = {
      find: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      toArray: vi.fn(),
      findOne: vi.fn(),
      updateOne: vi.fn()
    }

    mockTeacherCollection = {
      find: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      toArray: vi.fn(),
      updateOne: vi.fn()
    }

    mockOrchestraCollection = {
      find: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      toArray: vi.fn(),
      findOne: vi.fn(),
      insertOne: vi.fn()
    }

    // Mock getCollection to return different collections based on the name
    getCollection.mockImplementation((name) => {
      switch (name) {
        case 'school_year':
          return Promise.resolve(mockSchoolYearCollection)
        case 'student':
          return Promise.resolve(mockStudentCollection)
        case 'teacher':
          return Promise.resolve(mockTeacherCollection)
        case 'orchestra':
          return Promise.resolve(mockOrchestraCollection)
        default:
          return Promise.resolve({})
      }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getSchoolYears', () => {
    it('should get all active school years sorted by startDate', async () => {
      // Setup
      const mockSchoolYears = [
        { _id: new ObjectId('6579e36c83c8b3a5c2df8a8b'), name: '2023-2024', startDate: new Date('2023-08-01') },
        { _id: new ObjectId('6579e36c83c8b3a5c2df8a8c'), name: '2022-2023', startDate: new Date('2022-08-01') }
      ]
      mockSchoolYearCollection.toArray.mockResolvedValue(mockSchoolYears)

      // Execute
      const result = await schoolYearService.getSchoolYears()

      // Assert
      expect(mockSchoolYearCollection.find).toHaveBeenCalledWith({ isActive: true })
      expect(mockSchoolYearCollection.sort).toHaveBeenCalledWith({ startDate: -1 })
      expect(mockSchoolYearCollection.limit).toHaveBeenCalledWith(4)
      expect(result).toEqual(mockSchoolYears)
    })

    it('should handle database errors', async () => {
      // Setup
      mockSchoolYearCollection.toArray.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(schoolYearService.getSchoolYears()).rejects.toThrow('Database error')
    })
  })

  describe('getSchoolYearById', () => {
    it('should get a school year by ID', async () => {
      // Setup
      const schoolYearId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const mockSchoolYear = {
        _id: schoolYearId,
        name: '2023-2024',
        startDate: new Date('2023-08-01'),
        endDate: new Date('2024-07-31'),
        isCurrent: true
      }
      mockSchoolYearCollection.findOne.mockResolvedValue(mockSchoolYear)

      // Execute
      const result = await schoolYearService.getSchoolYearById(schoolYearId.toString())

      // Assert
      expect(mockSchoolYearCollection.findOne).toHaveBeenCalledWith({
        _id: expect.any(ObjectId)
      })
      expect(result).toEqual(mockSchoolYear)
    })

    it('should throw error if school year is not found', async () => {
      // Setup
      const schoolYearId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      mockSchoolYearCollection.findOne.mockResolvedValue(null)

      // Execute & Assert
      await expect(schoolYearService.getSchoolYearById(schoolYearId.toString()))
        .rejects.toThrow('not found')
    })

    it('should handle database errors', async () => {
      // Setup
      const schoolYearId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      mockSchoolYearCollection.findOne.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(schoolYearService.getSchoolYearById(schoolYearId.toString()))
        .rejects.toThrow('Database error')
    })
  })

  describe('getCurrentSchoolYear', () => {
    it('should get the current school year', async () => {
      // Setup
      const mockCurrentYear = {
        _id: new ObjectId('6579e36c83c8b3a5c2df8a8b'),
        name: '2023-2024',
        startDate: new Date('2023-08-01'),
        endDate: new Date('2024-07-31'),
        isCurrent: true
      }
      mockSchoolYearCollection.findOne.mockResolvedValue(mockCurrentYear)

      // Execute
      const result = await schoolYearService.getCurrentSchoolYear()

      // Assert
      expect(mockSchoolYearCollection.findOne).toHaveBeenCalledWith({ isCurrent: true })
      expect(result).toEqual(mockCurrentYear)
    })

    it('should create a default school year if none exists', async () => {
      // Setup
      // First findOne call returns null (no current year)
      mockSchoolYearCollection.findOne.mockResolvedValue(null)
      
      const mockDate = new Date('2023-11-01')
      const originalDate = global.Date
      global.Date = class extends Date {
        constructor(...args) {
          if (args.length === 0) {
            return new originalDate(mockDate)
          }
          return new originalDate(...args)
        }
      }
      global.Date.now = originalDate.now
      
      const insertedId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      mockSchoolYearCollection.insertOne.mockResolvedValue({ insertedId })
      
      // Mock validateSchoolYear to return valid data
      validateSchoolYear.mockReturnValue({
        error: null,
        value: {
          name: '2023-2024',
          startDate: new Date('2023-08-20'),
          endDate: new Date('2024-08-01'),
          isCurrent: true,
          isActive: true
        }
      })
      
      // Second findOne call (in getSchoolYearById) returns the created year
      const defaultYear = {
        _id: insertedId,
        name: '2023-2024',
        startDate: new Date('2023-08-20'),
        endDate: new Date('2024-08-01'),
        isCurrent: true,
        isActive: true,
        createdAt: mockDate,
        updatedAt: mockDate
      }
      
      // Setup findOne to return null first, then the created year on second call
      mockSchoolYearCollection.findOne.mockResolvedValueOnce(null)
        .mockResolvedValueOnce(defaultYear)

      // Execute
      const result = await schoolYearService.getCurrentSchoolYear()
      
      // Restore Date
      global.Date = originalDate

      // Assert
      expect(mockSchoolYearCollection.findOne).toHaveBeenCalledWith({ isCurrent: true })
      expect(validateSchoolYear).toHaveBeenCalled()
      expect(mockSchoolYearCollection.insertOne).toHaveBeenCalled()
      expect(result.name).toBe('2023-2024')
      expect(result.isCurrent).toBe(true)
    })

    it('should handle database errors', async () => {
      // Setup
      mockSchoolYearCollection.findOne.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(schoolYearService.getCurrentSchoolYear())
        .rejects.toThrow('Database error')
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
      
      validateSchoolYear.mockReturnValue({
        error: null,
        value: { ...schoolYearData }
      })
      
      const insertedId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      mockSchoolYearCollection.insertOne.mockResolvedValue({ insertedId })

      // Execute
      const result = await schoolYearService.createSchoolYear(schoolYearData)

      // Assert
      expect(validateSchoolYear).toHaveBeenCalledWith(schoolYearData)
      
      // Should not update other years since isCurrent is false
      expect(mockSchoolYearCollection.updateMany).not.toHaveBeenCalled()
      
      expect(mockSchoolYearCollection.insertOne).toHaveBeenCalled()
      expect(result).toHaveProperty('_id', insertedId)
      expect(result.name).toBe('2024-2025')
      expect(result.isCurrent).toBe(false)
    })

    it('should update other years when creating a current year', async () => {
      // Setup
      const schoolYearData = {
        name: '2024-2025',
        startDate: new Date('2024-08-01'),
        endDate: new Date('2025-07-31'),
        isCurrent: true
      }
      
      validateSchoolYear.mockReturnValue({
        error: null,
        value: { ...schoolYearData }
      })
      
      const insertedId = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      mockSchoolYearCollection.insertOne.mockResolvedValue({ insertedId })
      mockSchoolYearCollection.updateMany.mockResolvedValue({ modifiedCount: 1 })

      // Execute
      const result = await schoolYearService.createSchoolYear(schoolYearData)

      // Assert
      expect(validateSchoolYear).toHaveBeenCalledWith(schoolYearData)
      
      // Should update other years to not be current
      expect(mockSchoolYearCollection.updateMany).toHaveBeenCalledWith(
        { isCurrent: true },
        expect.objectContaining({ $set: { isCurrent: false, updatedAt: expect.any(Date) } })
      )
      
      expect(mockSchoolYearCollection.insertOne).toHaveBeenCalled()
      expect(result).toHaveProperty('_id', insertedId)
      expect(result.name).toBe('2024-2025')
      expect(result.isCurrent).toBe(true)
    })

    it('should throw error for invalid school year data', async () => {
      // Setup
      const schoolYearData = { invalidData: true }
      
      validateSchoolYear.mockReturnValue({
        error: new Error('Invalid school year data'),
        value: schoolYearData
      })

      // Execute & Assert
      await expect(schoolYearService.createSchoolYear(schoolYearData))
        .rejects.toThrow('Invalid school year data')
    })

    it('should handle database errors', async () => {
      // Setup
      const schoolYearData = {
        name: '2024-2025',
        startDate: new Date('2024-08-01'),
        endDate: new Date('2025-07-31')
      }
      
      validateSchoolYear.mockReturnValue({
        error: null,
        value: schoolYearData
      })
      
      mockSchoolYearCollection.insertOne.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(schoolYearService.createSchoolYear(schoolYearData))
        .rejects.toThrow('Database error')
    })
  })

  describe('updateSchoolYear', () => {
    it('should update an existing school year', async () => {
      // Setup
      const schoolYearId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const schoolYearUpdates = {
        name: 'Updated Year',
        startDate: new Date('2023-08-15'),
        endDate: new Date('2024-07-15'),
        isCurrent: false
      }
      
      validateSchoolYear.mockReturnValue({
        error: null,
        value: { ...schoolYearUpdates }
      })
      
      const updatedSchoolYear = {
        _id: schoolYearId,
        ...schoolYearUpdates,
        updatedAt: new Date()
      }
      
      mockSchoolYearCollection.findOneAndUpdate.mockResolvedValue(updatedSchoolYear)

      // Execute
      const result = await schoolYearService.updateSchoolYear(schoolYearId.toString(), schoolYearUpdates)

      // Assert
      expect(validateSchoolYear).toHaveBeenCalledWith(schoolYearUpdates)
      expect(mockSchoolYearCollection.findOneAndUpdate).toHaveBeenCalled()
      expect(result).toEqual(updatedSchoolYear)
    })

    it('should update other years when setting a year as current', async () => {
      // Setup
      const schoolYearId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const schoolYearUpdates = {
        name: 'Updated Year',
        isCurrent: true
      }
      
      validateSchoolYear.mockReturnValue({
        error: null,
        value: { ...schoolYearUpdates }
      })
      
      const updatedSchoolYear = {
        _id: schoolYearId,
        ...schoolYearUpdates,
        updatedAt: new Date()
      }
      
      mockSchoolYearCollection.findOneAndUpdate.mockResolvedValue(updatedSchoolYear)
      mockSchoolYearCollection.updateMany.mockResolvedValue({ modifiedCount: 1 })

      // Execute
      const result = await schoolYearService.updateSchoolYear(schoolYearId.toString(), schoolYearUpdates)

      // Assert
      expect(validateSchoolYear).toHaveBeenCalledWith(schoolYearUpdates)
      expect(mockSchoolYearCollection.updateMany).toHaveBeenCalled()
      expect(mockSchoolYearCollection.findOneAndUpdate).toHaveBeenCalled()
      expect(result).toEqual(updatedSchoolYear)
    })

    it('should throw error for invalid school year data', async () => {
      // Setup
      const schoolYearId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const schoolYearUpdates = { invalidData: true }
      
      validateSchoolYear.mockReturnValue({
        error: new Error('Invalid school year data'),
        value: schoolYearUpdates
      })

      // Execute & Assert
      await expect(schoolYearService.updateSchoolYear(schoolYearId.toString(), schoolYearUpdates))
        .rejects.toThrow('Invalid school year data')
    })

    it('should throw error if school year is not found', async () => {
      // Setup
      const schoolYearId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const schoolYearUpdates = {
        name: 'Updated Year'
      }
      
      validateSchoolYear.mockReturnValue({
        error: null,
        value: schoolYearUpdates
      })
      
      mockSchoolYearCollection.findOneAndUpdate.mockResolvedValue(null)

      // Execute & Assert
      await expect(schoolYearService.updateSchoolYear(schoolYearId.toString(), schoolYearUpdates))
        .rejects.toThrow('not found')
    })

    it('should handle database errors', async () => {
      // Setup
      const schoolYearId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const schoolYearUpdates = {
        name: 'Updated Year'
      }
      
      validateSchoolYear.mockReturnValue({
        error: null,
        value: schoolYearUpdates
      })
      
      mockSchoolYearCollection.findOneAndUpdate.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(schoolYearService.updateSchoolYear(schoolYearId.toString(), schoolYearUpdates))
        .rejects.toThrow('Database error')
    })
  })

  describe('setCurrentSchoolYear', () => {
    it('should set a school year as current', async () => {
      // Setup
      const schoolYearId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      
      const updatedSchoolYear = {
        _id: schoolYearId,
        name: '2023-2024',
        isCurrent: true,
        updatedAt: new Date()
      }
      
      mockSchoolYearCollection.findOneAndUpdate.mockResolvedValue(updatedSchoolYear)
      mockSchoolYearCollection.updateMany.mockResolvedValue({ modifiedCount: 1 })

      // Execute
      const result = await schoolYearService.setCurrentSchoolYear(schoolYearId.toString())

      // Assert
      expect(mockSchoolYearCollection.updateMany).toHaveBeenCalled()
      expect(mockSchoolYearCollection.findOneAndUpdate).toHaveBeenCalled()
      expect(result).toEqual(updatedSchoolYear)
    })

    it('should throw error if school year is not found', async () => {
      // Setup
      const schoolYearId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      mockSchoolYearCollection.updateMany.mockResolvedValue({ modifiedCount: 1 })
      mockSchoolYearCollection.findOneAndUpdate.mockResolvedValue(null)

      // Execute & Assert
      await expect(schoolYearService.setCurrentSchoolYear(schoolYearId.toString()))
        .rejects.toThrow('not found')
    })

    it('should handle database errors', async () => {
      // Setup
      const schoolYearId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      mockSchoolYearCollection.updateMany.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(schoolYearService.setCurrentSchoolYear(schoolYearId.toString()))
        .rejects.toThrow('Database error')
    })
  })

  describe('rolloverToNewYear', () => {
    it('should rollover to a new school year', async () => {
      // Setup
      const prevYearId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      
      const prevYear = {
        _id: prevYearId,
        name: '2022-2023',
        startDate: new Date('2022-08-01'),
        endDate: new Date('2023-07-31'),
        isCurrent: false
      }
      
      const newYearId = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      const newYear = {
        _id: newYearId,
        name: '2023-2024',
        startDate: new Date('2023-08-01'),
        endDate: new Date('2024-07-31'),
        isCurrent: true,
        isActive: true
      }
      
      // Mock at DB level instead of function level
      mockSchoolYearCollection.findOne.mockImplementation((query) => {
        if (query && query._id && query._id.toString() === prevYearId.toString()) {
          return Promise.resolve(prevYear)
        }
        return Promise.resolve(null)
      })
      
      // Mock for createSchoolYear by mocking insertOne
      validateSchoolYear.mockReturnValue({
        error: null,
        value: {
          name: '2023-2024',
          startDate: expect.any(Date),
          endDate: expect.any(Date),
          isCurrent: true,
          isActive: true
        }
      })
      
      mockSchoolYearCollection.insertOne.mockResolvedValue({ insertedId: newYearId })
      
      // Mock student, teacher and orchestra collections
      mockStudentCollection.toArray.mockResolvedValue([])
      mockTeacherCollection.toArray.mockResolvedValue([])
      mockOrchestraCollection.toArray.mockResolvedValue([])

      // Execute
      const result = await schoolYearService.rolloverToNewYear(prevYearId.toString())

      // Assert
      expect(mockSchoolYearCollection.findOne).toHaveBeenCalledWith({
        _id: expect.any(ObjectId)
      })
      expect(mockSchoolYearCollection.insertOne).toHaveBeenCalled()
      expect(result).toHaveProperty('_id')
      expect(result.name).toContain('-')  // Should include year range
      expect(result.isCurrent).toBe(true)
    })

    it('should handle database errors', async () => {
      // Setup
      const prevYearId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      
      // Mock collection to throw database error
      mockSchoolYearCollection.findOne.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(schoolYearService.rolloverToNewYear(prevYearId.toString()))
        .rejects.toThrow('Database error')
    })
  })
})