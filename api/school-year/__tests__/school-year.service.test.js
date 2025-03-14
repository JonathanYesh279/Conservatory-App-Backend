// api/school-year/__tests__/school-year.service.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
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

    // Setup MongoDB collection mock methods
    mockSchoolYearCollection = {
      find: vi.fn().mockReturnThis(),
      toArray: vi.fn(),
      findOne: vi.fn(),
      insertOne: vi.fn(),
      updateOne: vi.fn(),
      updateMany: vi.fn(),
      findOneAndUpdate: vi.fn()
    }

    mockStudentCollection = {
      find: vi.fn().mockReturnThis(),
      toArray: vi.fn(),
      findOne: vi.fn(),
      updateOne: vi.fn()
    }

    mockTeacherCollection = {
      find: vi.fn().mockReturnThis(),
      toArray: vi.fn(),
      updateOne: vi.fn()
    }

    mockOrchestraCollection = {
      find: vi.fn().mockReturnThis(),
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
      expect(mockSchoolYearCollection.find().sort).toHaveBeenCalledWith({ startDate: -1 })
      expect(mockSchoolYearCollection.find().sort().limit).toHaveBeenCalledWith(4)
      expect(result).toEqual(mockSchoolYears)
    })

    it('should handle database errors', async () => {
      // Setup
      mockSchoolYearCollection.toArray.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(schoolYearService.getSchoolYears()).rejects.toThrow('Error in schoolYearService.getSchoolYears: Database error')
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
        .rejects.toThrow(`School year with id ${schoolYearId} not found`)
    })

    it('should handle database errors', async () => {
      // Setup
      const schoolYearId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      mockSchoolYearCollection.findOne.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(schoolYearService.getSchoolYearById(schoolYearId.toString()))
        .rejects.toThrow('Error in schoolYearService.getSchoolYearById: Database error')
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
      mockSchoolYearCollection.findOne.mockResolvedValue(null)
      
      const defaultYear = {
        name: '2023-2024',
        startDate: new Date('2023-08-20'),
        endDate: new Date('2024-08-01'),
        isCurrent: true
      }
      
      const insertedId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      mockSchoolYearCollection.insertOne.mockResolvedValue({ insertedId })
      
      const createdYear = {
        _id: insertedId,
        ...defaultYear
      }
      
      // Mock implementation when getSchoolYearById is called
      vi.spyOn(schoolYearService, 'createSchoolYear').mockResolvedValue({ id: insertedId })
      vi.spyOn(schoolYearService, 'getSchoolYearById').mockResolvedValue(createdYear)
      
      // Mock Date constructor
      const originalDate = global.Date
      const mockDate = new Date('2023-11-01')
      global.Date = vi.fn(() => mockDate)
      global.Date.now = originalDate.now
      
      // Execute
      const result = await schoolYearService.getCurrentSchoolYear()
      
      // Restore Date
      global.Date = originalDate

      // Assert
      expect(mockSchoolYearCollection.findOne).toHaveBeenCalledWith({ isCurrent: true })
      expect(schoolYearService.createSchoolYear).toHaveBeenCalledWith(expect.objectContaining({
        name: '2023-2024',
        isCurrent: true
      }))
      expect(schoolYearService.getSchoolYearById).toHaveBeenCalledWith(insertedId.toString())
      expect(result).toEqual(createdYear)
    })

    it('should handle database errors', async () => {
      // Setup
      mockSchoolYearCollection.findOne.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(schoolYearService.getCurrentSchoolYear())
        .rejects.toThrow('Error in schoolYearService.getCurrentSchoolYear: Database error')
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
      
      const validationResult = {
        error: null,
        value: { ...schoolYearData }
      }
      
      validateSchoolYear.mockReturnValue(validationResult)
      
      const insertedId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      mockSchoolYearCollection.insertOne.mockResolvedValue({ insertedId })

      // Execute
      const result = await schoolYearService.createSchoolYear(schoolYearData)

      // Assert
      expect(validateSchoolYear).toHaveBeenCalledWith(schoolYearData)
      
      // Should not update other years since isCurrent is false
      expect(mockSchoolYearCollection.updateMany).not.toHaveBeenCalled()
      
      expect(mockSchoolYearCollection.insertOne).toHaveBeenCalledWith(expect.objectContaining({
        ...validationResult.value,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      }))
      
      expect(result).toEqual({
        _id: insertedId,
        ...validationResult.value,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      })
    })

    it('should update other years when creating a current year', async () => {
      // Setup
      const schoolYearData = {
        name: '2024-2025',
        startDate: new Date('2024-08-01'),
        endDate: new Date('2025-07-31'),
        isCurrent: true
      }
      
      const validationResult = {
        error: null,
        value: { ...schoolYearData }
      }
      
      validateSchoolYear.mockReturnValue(validationResult)
      
      const insertedId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      mockSchoolYearCollection.insertOne.mockResolvedValue({ insertedId })

      // Execute
      const result = await schoolYearService.createSchoolYear(schoolYearData)

      // Assert
      expect(validateSchoolYear).toHaveBeenCalledWith(schoolYearData)
      
      // Should update other years to not be current
      expect(mockSchoolYearCollection.updateMany).toHaveBeenCalledWith(
        { isCurrent: true },
        { $set: { isCurrent: false, updatedAt: expect.any(Date) } }
      )
      
      expect(mockSchoolYearCollection.insertOne).toHaveBeenCalledWith(expect.objectContaining({
        ...validationResult.value,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      }))
    })

    it('should throw error for invalid school year data', async () => {
      // Setup
      const schoolYearData = { invalidData: true }
      
      const validationResult = {
        error: new Error('Invalid school year data'),
        value: null
      }
      
      validateSchoolYear.mockReturnValue(validationResult)

      // Execute & Assert
      await expect(schoolYearService.createSchoolYear(schoolYearData))
        .rejects.toThrow('Error in schoolYearService.createSchoolYear: Invalid school year data')
    })

    it('should handle database errors', async () => {
      // Setup
      const schoolYearData = {
        name: '2024-2025',
        startDate: new Date('2024-08-01'),
        endDate: new Date('2025-07-31')
      }
      
      const validationResult = {
        error: null,
        value: schoolYearData
      }
      
      validateSchoolYear.mockReturnValue(validationResult)
      mockSchoolYearCollection.insertOne.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(schoolYearService.createSchoolYear(schoolYearData))
        .rejects.toThrow('Error in schoolYearService.createSchoolYear: Database error')
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
      
      const validationResult = {
        error: null,
        value: { ...schoolYearUpdates }
      }
      
      validateSchoolYear.mockReturnValue(validationResult)
      
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
      
      // Should not update other years since isCurrent is false
      expect(mockSchoolYearCollection.updateMany).not.toHaveBeenCalled()
      
      expect(mockSchoolYearCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        { $set: expect.objectContaining({
          ...validationResult.value,
          updatedAt: expect.any(Date)
        })},
        { returnDocument: 'after' }
      )
      
      expect(result).toEqual(updatedSchoolYear)
    })

    it('should update other years when setting a year as current', async () => {
      // Setup
      const schoolYearId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const schoolYearUpdates = {
        name: 'Updated Year',
        isCurrent: true
      }
      
      const validationResult = {
        error: null,
        value: { ...schoolYearUpdates }
      }
      
      validateSchoolYear.mockReturnValue(validationResult)
      
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
      
      // Should update other years to not be current
      expect(mockSchoolYearCollection.updateMany).toHaveBeenCalledWith(
        { _id: { $ne: expect.any(ObjectId) }, isCurrent: true },
        { $set: { isCurrent: false, updatedAt: expect.any(Date) } }
      )
      
      expect(mockSchoolYearCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        { $set: expect.anything() },
        { returnDocument: 'after' }
      )
    })

    it('should throw error for invalid school year data', async () => {
      // Setup
      const schoolYearId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const schoolYearUpdates = { invalidData: true }
      
      const validationResult = {
        error: new Error('Invalid school year data'),
        value: null
      }
      
      validateSchoolYear.mockReturnValue(validationResult)

      // Execute & Assert
      await expect(schoolYearService.updateSchoolYear(schoolYearId.toString(), schoolYearUpdates))
        .rejects.toThrow('Error in schoolYearService.updateSchoolYear: Invalid school year data')
    })

    it('should throw error if school year is not found', async () => {
      // Setup
      const schoolYearId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const schoolYearUpdates = {
        name: 'Updated Year'
      }
      
      const validationResult = {
        error: null,
        value: schoolYearUpdates
      }
      
      validateSchoolYear.mockReturnValue(validationResult)
      mockSchoolYearCollection.findOneAndUpdate.mockResolvedValue(null)

      // Execute & Assert
      await expect(schoolYearService.updateSchoolYear(schoolYearId.toString(), schoolYearUpdates))
        .rejects.toThrow(`Error in schoolYearService.updateSchoolYear: School year with id ${schoolYearId} not found`)
    })

    it('should handle database errors', async () => {
      // Setup
      const schoolYearId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const schoolYearUpdates = {
        name: 'Updated Year'
      }
      
      const validationResult = {
        error: null,
        value: schoolYearUpdates
      }
      
      validateSchoolYear.mockReturnValue(validationResult)
      mockSchoolYearCollection.findOneAndUpdate.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(schoolYearService.updateSchoolYear(schoolYearId.toString(), schoolYearUpdates))
        .rejects.toThrow('Error in schoolYearService.updateSchoolYear: Database error')
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

      // Execute
      const result = await schoolYearService.setCurrentSchoolYear(schoolYearId.toString())

      // Assert
      // Should update other years to not be current
      expect(mockSchoolYearCollection.updateMany).toHaveBeenCalledWith(
        { isCurrent: true },
        { $set: { isCurrent: false, updatedAt: expect.any(Date) } }
      )
      
      expect(mockSchoolYearCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        { $set: { isCurrent: true, updatedAt: expect.any(Date) } },
        { returnDocument: 'after' }
      )
      
      expect(result).toEqual(updatedSchoolYear)
    })

    it('should throw error if school year is not found', async () => {
      // Setup
      const schoolYearId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      mockSchoolYearCollection.findOneAndUpdate.mockResolvedValue(null)

      // Execute & Assert
      await expect(schoolYearService.setCurrentSchoolYear(schoolYearId.toString()))
        .rejects.toThrow(`Error in schoolYearService.setCurrentSchoolYear: School year with id ${schoolYearId} not found`)
    })

    it('should handle database errors', async () => {
      // Setup
      const schoolYearId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      mockSchoolYearCollection.updateMany.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(schoolYearService.setCurrentSchoolYear(schoolYearId.toString()))
        .rejects.toThrow('Error in schoolYearService.setCurrentSchoolYear: Database error')
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
      
      const newYear = {
        _id: new ObjectId('6579e36c83c8b3a5c2df8a8c'),
        name: '2023-2024',
        startDate: new Date('2023-08-01'),
        endDate: new Date('2024-07-31'),
        isCurrent: true
      }
      
      // Mock getting previous year
      vi.spyOn(schoolYearService, 'getSchoolYearById').mockResolvedValue(prevYear)
      
      // Mock creating new year
      vi.spyOn(schoolYearService, 'createSchoolYear').mockResolvedValue(newYear)
      
      // Mock finding active students in previous year
      mockStudentCollection.toArray.mockResolvedValue([
        {
          _id: new ObjectId('6579e36c83c8b3a5c2df8a8d'),
          enrollments: {
            schoolYears: [
              { schoolYearId: prevYearId.toString(), isActive: true }
            ]
          }
        },
        {
          _id: new ObjectId('6579e36c83c8b3a5c2df8a8e'),
          enrollments: {
            schoolYears: [
              { schoolYearId: prevYearId.toString(), isActive: true }
            ]
          }
        }
      ])
      
      // Mock finding active teachers in previous year
      mockTeacherCollection.toArray.mockResolvedValue([
        {
          _id: new ObjectId('6579e36c83c8b3a5c2df8a8f'),
          schoolYears: [
            { schoolYearId: prevYearId.toString(), isActive: true }
          ]
        }
      ])
      
      // Mock finding active orchestras in previous year
      mockOrchestraCollection.toArray.mockResolvedValue([
        {
          _id: new ObjectId('6579e36c83c8b3a5c2df8a90'),
          name: 'Test Orchestra',
          type: 'תזמורת',
          conductorId: '6579e36c83c8b3a5c2df8a8f',
          memberIds: ['6579e36c83c8b3a5c2df8a8d', '6579e36c83c8b3a5c2df8a8e'],
          schoolYearId: prevYearId.toString()
        }
      ])
      
      // Mock finding student for checking enrollment in new year
      mockStudentCollection.findOne.mockResolvedValue({
        _id: new ObjectId('6579e36c83c8b3a5c2df8a8d'),
        enrollments: {
          schoolYears: [
            { schoolYearId: prevYearId.toString(), isActive: true }
          ]
        }
      })

      // Execute
      const result = await schoolYearService.rolloverToNewYear(prevYearId.toString())

      // Assert
      expect(schoolYearService.getSchoolYearById).toHaveBeenCalledWith(prevYearId.toString())
      
      // Should create new year based on previous year dates
      expect(schoolYearService.createSchoolYear).toHaveBeenCalledWith(expect.objectContaining({
        name: '2023-2024',
        isCurrent: true
      }))
      
      // Should update active students with enrollment in new year
      expect(mockStudentCollection.updateOne).toHaveBeenCalledTimes(2)
      
      // Should update active teachers with enrollment in new year
      expect(mockTeacherCollection.updateOne).toHaveBeenCalledTimes(1)
      
      // Should create new orchestras for the new year
      expect(mockOrchestraCollection.insertOne).toHaveBeenCalledTimes(1)
      
      expect(result).toEqual(newYear)
    })

    it('should handle database errors', async () => {
      // Setup
      const prevYearId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      vi.spyOn(schoolYearService, 'getSchoolYearById').mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(schoolYearService.rolloverToNewYear(prevYearId.toString()))
        .rejects.toThrow('Error in schoolYearService.rolloverToNewYear: Database error')
    })
  })
})