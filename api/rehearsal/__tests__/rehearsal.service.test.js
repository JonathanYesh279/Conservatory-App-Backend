// api/rehearsal/__tests__/rehearsal.service.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { rehearsalService } from '../rehearsal.service.js'
import { validateRehearsal, validateBulkCreate, validateAttendance } from '../rehearsal.validation.js'
import { getCollection } from '../../../services/mongoDB.service.js'
import { ObjectId } from 'mongodb'

// Mock dependencies
vi.mock('../rehearsal.validation.js', () => ({
  validateRehearsal: vi.fn(),
  validateBulkCreate: vi.fn(),
  validateAttendance: vi.fn()
}))

vi.mock('../../../services/mongoDB.service.js', () => ({
  getCollection: vi.fn()
}))

// Mock require function for the school year service
vi.mock('../school-year/school-year.service.js', () => ({
  schoolYearService: {
    getCurrentSchoolYear: vi.fn().mockResolvedValue({
      _id: new ObjectId('6579e36c83c8b3a5c2df8a8c'),
      name: '2023-2024'
    })
  }
}))

describe('Rehearsal Service', () => {
  let mockRehearsalCollection, mockOrchestraCollection, mockActivityCollection

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Setup mock collections
    mockRehearsalCollection = {
      find: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      toArray: vi.fn(),
      findOne: vi.fn(),
      insertOne: vi.fn(),
      insertMany: vi.fn(),
      deleteMany: vi.fn(),
      updateOne: vi.fn(),
      findOneAndUpdate: vi.fn()
    }

    mockOrchestraCollection = {
      findOne: vi.fn(),
      updateOne: vi.fn()
    }

    mockActivityCollection = {
      updateOne: vi.fn(),
      insertOne: vi.fn(),
      deleteMany: vi.fn()
    }

    // Mock getCollection to return different collections based on the name
    getCollection.mockImplementation((name) => {
      switch (name) {
        case 'rehearsal':
          return Promise.resolve(mockRehearsalCollection)
        case 'orchestra':
          return Promise.resolve(mockOrchestraCollection)
        case 'activity_attendance':
          return Promise.resolve(mockActivityCollection)
        default:
          return Promise.resolve({})
      }
    })
  })

  describe('getRehearsals', () => {
    it('should get all rehearsals with default filter sorted by date', async () => {
      // Setup
      const mockRehearsals = [
        { _id: new ObjectId('6579e36c83c8b3a5c2df8a8b'), groupId: 'orchestra1', date: new Date('2023-01-15') },
        { _id: new ObjectId('6579e36c83c8b3a5c2df8a8c'), groupId: 'orchestra1', date: new Date('2023-02-15') }
      ]
      mockRehearsalCollection.toArray.mockResolvedValue(mockRehearsals)

      // Execute
      const result = await rehearsalService.getRehearsals()

      // Assert
      expect(mockRehearsalCollection.find).toHaveBeenCalledWith({ isActive: true })
      expect(mockRehearsalCollection.sort).toHaveBeenCalledWith({ date: 1 })
      expect(result).toEqual(mockRehearsals)
    })

    it('should apply groupId filter correctly', async () => {
      // Setup
      const filterBy = { groupId: 'orchestra1' }
      mockRehearsalCollection.toArray.mockResolvedValue([])

      // Execute
      await rehearsalService.getRehearsals(filterBy)

      // Assert
      expect(mockRehearsalCollection.find).toHaveBeenCalledWith({
        groupId: 'orchestra1',
        isActive: true
      })
    })

    it('should apply type filter correctly', async () => {
      // Setup
      const filterBy = { type: 'תזמורת' }
      mockRehearsalCollection.toArray.mockResolvedValue([])

      // Execute
      await rehearsalService.getRehearsals(filterBy)

      // Assert
      expect(mockRehearsalCollection.find).toHaveBeenCalledWith({
        type: 'תזמורת',
        isActive: true
      })
    })

    it('should apply date range filters correctly', async () => {
      // Setup
      const filterBy = { 
        fromDate: '2023-01-01',
        toDate: '2023-12-31'
      }
      mockRehearsalCollection.toArray.mockResolvedValue([])

      // Execute
      await rehearsalService.getRehearsals(filterBy)

      // Assert
      expect(mockRehearsalCollection.find).toHaveBeenCalledWith({
        date: {
          $gte: new Date('2023-01-01'),
          $lte: new Date('2023-12-31')
        },
        isActive: true
      })
    })

    it('should include inactive rehearsals when showInactive is true', async () => {
      // Setup
      const filterBy = { showInactive: true, isActive: false }
      mockRehearsalCollection.toArray.mockResolvedValue([])

      // Execute
      await rehearsalService.getRehearsals(filterBy)

      // Assert
      expect(mockRehearsalCollection.find).toHaveBeenCalledWith({
        isActive: false
      })
    })

    it('should handle database errors', async () => {
      // Setup
      mockRehearsalCollection.toArray.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(rehearsalService.getRehearsals()).rejects.toThrow('Failed to get rehearsals: Database error')
    })
  })

  describe('getRehearsalById', () => {
    it('should get a rehearsal by ID', async () => {
      // Setup
      const rehearsalId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const mockRehearsal = {
        _id: rehearsalId,
        groupId: 'orchestra1',
        date: new Date('2023-01-15')
      }
      mockRehearsalCollection.findOne.mockResolvedValue(mockRehearsal)

      // Execute
      const result = await rehearsalService.getRehearsalById(rehearsalId.toString())

      // Assert
      expect(mockRehearsalCollection.findOne).toHaveBeenCalledWith({
        _id: expect.any(ObjectId)
      })
      expect(result).toEqual(mockRehearsal)
    })

    it('should throw error if rehearsal is not found', async () => {
      // Setup
      const rehearsalId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      mockRehearsalCollection.findOne.mockResolvedValue(null)

      // Execute & Assert
      await expect(rehearsalService.getRehearsalById(rehearsalId.toString()))
        .rejects.toThrow(`Rehearsal with id ${rehearsalId} not found`)
    })

    it('should handle database errors', async () => {
      // Setup
      const rehearsalId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      mockRehearsalCollection.findOne.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(rehearsalService.getRehearsalById(rehearsalId.toString()))
        .rejects.toThrow('Failed to get rehearsal by id: Database error')
    })
  })

  describe('getOrchestraRehearsals', () => {
    it('should get rehearsals for an orchestra', async () => {
      // Setup
      const orchestraId = new ObjectId('6579e36c83c8b3a5c2df8a8c').toString()
      const filterBy = { type: 'תזמורת' }
      
      // Mock getRehearsals to test it's called correctly
      const mockGetRehearsals = vi.spyOn(rehearsalService, 'getRehearsals')
      mockGetRehearsals.mockResolvedValue([])

      // Execute
      await rehearsalService.getOrchestraRehearsals(orchestraId, filterBy)

      // Assert
      expect(mockGetRehearsals).toHaveBeenCalledWith({
        groupId: orchestraId,
        type: 'תזמורת'
      })
    })

    it('should handle errors from getRehearsals', async () => {
      // Setup
      const orchestraId = new ObjectId('6579e36c83c8b3a5c2df8a8c').toString()
      
      // Mock getRehearsals to throw error
      const mockGetRehearsals = vi.spyOn(rehearsalService, 'getRehearsals')
      mockGetRehearsals.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(rehearsalService.getOrchestraRehearsals(orchestraId))
        .rejects.toThrow('Failed to get orchestra rehearsals: Database error')
    })
  })

  describe('addRehearsal', () => {
    it('should add a new rehearsal by admin', async () => {
      // Setup
      const rehearsalToAdd = {
        groupId: 'orchestra1',
        type: 'תזמורת',
        date: new Date('2023-03-15'),
        startTime: '18:00',
        endTime: '20:00',
        location: 'Main Hall',
        schoolYearId: '6579e36c83c8b3a5c2df8a8c'
      }
      
      const validationResult = {
        error: null,
        value: { ...rehearsalToAdd }
      }
      
      validateRehearsal.mockReturnValue(validationResult)
      
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8d')
      const isAdmin = true // Admin doesn't need to check orchestra access
      
      const insertedId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      mockRehearsalCollection.insertOne.mockResolvedValue({ insertedId })

      // Execute
      const result = await rehearsalService.addRehearsal(
        rehearsalToAdd,
        teacherId,
        isAdmin
      )

      // Assert
      expect(validateRehearsal).toHaveBeenCalledWith(rehearsalToAdd)
      
      // Admin doesn't need to check orchestra access
      expect(mockOrchestraCollection.findOne).not.toHaveBeenCalled()
      
      expect(mockRehearsalCollection.insertOne).toHaveBeenCalledWith(expect.objectContaining({
        ...validationResult.value,
        dayOfWeek: 3, // Wednesday for 2023-03-15
        attendance: { present: [], absent: [] },
        notes: "",
        isActive: true,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      }))
      
      // Should update orchestra's rehearsalIds for תזמורת type
      expect(mockOrchestraCollection.updateOne).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        { $push: { rehearsalIds: insertedId.toString() } }
      )
      
      expect(result).toEqual({
        id: insertedId,
        ...expect.objectContaining(validationResult.value),
        dayOfWeek: 3,
        attendance: { present: [], absent: [] },
        notes: "",
        isActive: true,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      })
    })

    it('should check orchestra access for non-admin conductors', async () => {
      // Setup
      const orchestraId = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      const rehearsalToAdd = {
        groupId: orchestraId.toString(),
        type: 'תזמורת',
        date: new Date('2023-03-15'),
        startTime: '18:00',
        endTime: '20:00',
        location: 'Main Hall'
      }
      
      const validationResult = {
        error: null,
        value: { ...rehearsalToAdd }
      }
      
      validateRehearsal.mockReturnValue(validationResult)
      
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8d')
      const isAdmin = false // Not admin, need to check orchestra access
      
      // Mock orchestra exists and teacher is conductor
      mockOrchestraCollection.findOne.mockResolvedValue({
        _id: orchestraId,
        conductorId: teacherId.toString()
      })
      
      const insertedId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      mockRehearsalCollection.insertOne.mockResolvedValue({ insertedId })
      
      // Mock getCurrentSchoolYear for non-admin
      const schoolYearServiceMock = require('../school-year/school-year.service.js').schoolYearService
      const mockCurrentSchoolYear = {
        _id: new ObjectId('6579e36c83c8b3a5c2df8a8e'),
        name: '2023-2024'
      }
      schoolYearServiceMock.getCurrentSchoolYear.mockResolvedValue(mockCurrentSchoolYear)

      // Execute
      const result = await rehearsalService.addRehearsal(
        rehearsalToAdd,
        teacherId,
        isAdmin
      )

      // Assert
      // Should check if teacher is conductor of this orchestra
      expect(mockOrchestraCollection.findOne).toHaveBeenCalledWith({
        _id: expect.any(ObjectId),
        conductorId: teacherId.toString()
      })
      
      // Should get current school year when not provided
      expect(schoolYearServiceMock.getCurrentSchoolYear).toHaveBeenCalled()
      
      // Should include current school year ID
      expect(mockRehearsalCollection.insertOne).toHaveBeenCalledWith(expect.objectContaining({
        schoolYearId: mockCurrentSchoolYear._id.toString()
      }))
    })

    it('should throw error when non-admin has no access to orchestra', async () => {
      // Setup
      const orchestraId = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      const rehearsalToAdd = {
        groupId: orchestraId.toString(),
        type: 'תזמורת',
        date: new Date('2023-03-15')
      }
      
      const validationResult = {
        error: null,
        value: rehearsalToAdd
      }
      
      validateRehearsal.mockReturnValue(validationResult)
      
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8d')
      const isAdmin = false // Not admin, need to check orchestra access
      
      // Mock orchestra not found or teacher is not conductor
      mockOrchestraCollection.findOne.mockResolvedValue(null)

      // Execute & Assert
      await expect(rehearsalService.addRehearsal(
        rehearsalToAdd,
        teacherId,
        isAdmin
      )).rejects.toThrow('Not authorized to add rehearsal for this orchestra')
    })

    it('should throw error for invalid rehearsal data', async () => {
      // Setup
      const rehearsalToAdd = { invalidData: true }
      
      const validationResult = {
        error: new Error('Invalid rehearsal data'),
        value: null
      }
      
      validateRehearsal.mockReturnValue(validationResult)

      // Execute & Assert
      await expect(rehearsalService.addRehearsal(rehearsalToAdd))
        .rejects.toThrow('Invalid rehearsal data')
    })

    it('should handle database errors', async () => {
      // Setup
      const rehearsalToAdd = {
        groupId: 'orchestra1',
        type: 'תזמורת',
        date: new Date('2023-03-15')
      }
      
      const validationResult = {
        error: null,
        value: rehearsalToAdd
      }
      
      validateRehearsal.mockReturnValue(validationResult)
      
      const isAdmin = true // Skip orchestra check
      
      mockRehearsalCollection.insertOne.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(rehearsalService.addRehearsal(
        rehearsalToAdd,
        null,
        isAdmin
      )).rejects.toThrow('Failed to add rehearsal: Database error')
    })
  })

  describe('updateRehearsal', () => {
    it('should update an existing rehearsal by admin', async () => {
      // Setup
      const rehearsalId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const rehearsalToUpdate = {
        groupId: 'orchestra1',
        type: 'תזמורת',
        date: new Date('2023-04-15'),
        location: 'Updated Location'
      }
      
      const validationResult = {
        error: null,
        value: { ...rehearsalToUpdate }
      }
      
      validateRehearsal.mockReturnValue(validationResult)
      
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8d')
      const isAdmin = true // Admin doesn't need to check orchestra access
      
      const updatedRehearsal = {
        _id: rehearsalId,
        ...rehearsalToUpdate,
        updatedAt: new Date()
      }
      
      mockRehearsalCollection.findOneAndUpdate.mockResolvedValue(updatedRehearsal)

      // Execute
      const result = await rehearsalService.updateRehearsal(
        rehearsalId.toString(),
        rehearsalToUpdate,
        teacherId,
        isAdmin
      )

      // Assert
      expect(validateRehearsal).toHaveBeenCalledWith(rehearsalToUpdate)
      
      // Admin doesn't need to check orchestra access
      expect(mockOrchestraCollection.findOne).not.toHaveBeenCalled()
      
      expect(mockRehearsalCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        { $set: expect.objectContaining({
          ...validationResult.value,
          updatedAt: expect.any(Date)
        })},
        { returnDocument: 'after' }
      )
      
      expect(result).toEqual(updatedRehearsal)
    })

    it('should check orchestra access for non-admin conductors', async () => {
      // Setup
      const rehearsalId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const orchestraId = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      const rehearsalToUpdate = {
        groupId: orchestraId.toString(),
        location: 'Updated Location'
      }
      
      const validationResult = {
        error: null,
        value: rehearsalToUpdate
      }
      
      validateRehearsal.mockReturnValue(validationResult)
      
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8d')
      const isAdmin = false // Not admin, need to check orchestra access
      
      // Mock orchestra exists
      mockOrchestraCollection.findOne.mockResolvedValue({
        _id: orchestraId,
        conductorId: teacherId.toString() // Teacher is conductor
      })
      
      const updatedRehearsal = {
        _id: rehearsalId,
        ...rehearsalToUpdate,
        updatedAt: new Date()
      }
      
      mockRehearsalCollection.findOneAndUpdate.mockResolvedValue(updatedRehearsal)

      // Execute
      const result = await rehearsalService.updateRehearsal(
        rehearsalId.toString(),
        rehearsalToUpdate,
        teacherId,
        isAdmin
      )

      // Assert
      // Should check if teacher is conductor of this orchestra
      expect(mockOrchestraCollection.findOne).toHaveBeenCalledWith({
        _id: expect.any(ObjectId)
      })
      
      expect(mockRehearsalCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        { $set: expect.anything() },
        { returnDocument: 'after' }
      )
    })

    it('should throw error when non-admin is not conductor of orchestra', async () => {
      // Setup
      const rehearsalId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const orchestraId = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      const rehearsalToUpdate = {
        groupId: orchestraId.toString(),
        location: 'Updated Location'
      }
      
      const validationResult = {
        error: null,
        value: rehearsalToUpdate
      }
      
      validateRehearsal.mockReturnValue(validationResult)
      
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8d')
      const isAdmin = false // Not admin, need to check orchestra access
      
      // Mock orchestra exists but teacher is not conductor
      mockOrchestraCollection.findOne.mockResolvedValue({
        _id: orchestraId,
        conductorId: 'different-teacher-id'
      })

      // Execute & Assert
      await expect(rehearsalService.updateRehearsal(
        rehearsalId.toString(),
        rehearsalToUpdate,
        teacherId,
        isAdmin
      )).rejects.toThrow(`Teacher with id ${teacherId} is not the conductor of the orchestra`)
    })

    it('should throw error for invalid rehearsal data', async () => {
      // Setup
      const rehearsalId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const rehearsalToUpdate = { invalidData: true }
      
      const validationResult = {
        error: new Error('Invalid rehearsal data'),
        value: null
      }
      
      validateRehearsal.mockReturnValue(validationResult)

      // Execute & Assert
      await expect(rehearsalService.updateRehearsal(
        rehearsalId.toString(),
        rehearsalToUpdate
      )).rejects.toThrow('Invalid rehearsal data')
    })

    it('should throw error if rehearsal is not found', async () => {
      // Setup
      const rehearsalId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const rehearsalToUpdate = {
        location: 'Updated Location'
      }
      
      const validationResult = {
        error: null,
        value: rehearsalToUpdate
      }
      
      validateRehearsal.mockReturnValue(validationResult)
      
      // Admin doesn't need access check
      const isAdmin = true
      
      // Rehearsal not found
      mockRehearsalCollection.findOneAndUpdate.mockResolvedValue(null)

      // Execute & Assert
      await expect(rehearsalService.updateRehearsal(
        rehearsalId.toString(),
        rehearsalToUpdate,
        null,
        isAdmin
      )).rejects.toThrow(`Rehearsal with id ${rehearsalId} not found`)
    })

    it('should handle database errors', async () => {
      // Setup
      const rehearsalId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const rehearsalToUpdate = {
        location: 'Updated Location'
      }
      
      const validationResult = {
        error: null,
        value: rehearsalToUpdate
      }
      
      validateRehearsal.mockReturnValue(validationResult)
      
      const isAdmin = true
      
      mockRehearsalCollection.findOneAndUpdate.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(rehearsalService.updateRehearsal(
        rehearsalId.toString(),
        rehearsalToUpdate,
        null,
        isAdmin
      )).rejects.toThrow('Failed to update rehearsal: Database error')
    })
  })

  describe('removeRehearsal', () => {
    it('should deactivate a rehearsal (soft delete) by admin', async () => {
      // Setup
      const rehearsalId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const orchestraId = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      
      const existingRehearsal = {
        _id: rehearsalId,
        groupId: orchestraId.toString(),
        type: 'תזמורת'
      }
      
      mockRehearsalCollection.findOne.mockResolvedValue(existingRehearsal)
      
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8d')
      const isAdmin = true // Admin doesn't need to check orchestra access
      
      const deactivatedRehearsal = {
        ...existingRehearsal,
        isActive: false,
        updatedAt: new Date()
      }
      
      mockRehearsalCollection.findOneAndUpdate.mockResolvedValue(deactivatedRehearsal)

      // Execute
      const result = await rehearsalService.removeRehearsal(
        rehearsalId.toString(),
        teacherId,
        isAdmin
      )

      // Assert
      // Should update orchestra's rehearsalIds for תזמורת type
      expect(mockOrchestraCollection.updateOne).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        { $pull: { rehearsalIds: rehearsalId.toString() } }
      )
      
      expect(mockRehearsalCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        {
          $set: {
            isActive: false,
            updatedAt: expect.any(Date)
          }
        },
        { returnDocument: 'after' }
      )
      
      expect(result).toEqual(deactivatedRehearsal)
    })

    it('should check orchestra access for non-admin conductors', async () => {
      // Setup
      const rehearsalId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const orchestraId = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      
      const existingRehearsal = {
        _id: rehearsalId,
        groupId: orchestraId.toString(),
        type: 'הרכב' // Not orchestra type
      }
      
      mockRehearsalCollection.findOne.mockResolvedValue(existingRehearsal)
      
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8d')
      const isAdmin = false // Not admin, need to check orchestra access
      
      // Mock orchestra exists and teacher is conductor
      mockOrchestraCollection.findOne.mockResolvedValue({
        _id: orchestraId,
        conductorId: teacherId.toString()
      })
      
      const deactivatedRehearsal = {
        ...existingRehearsal,
        isActive: false,
        updatedAt: new Date()
      }
      
      mockRehearsalCollection.findOneAndUpdate.mockResolvedValue(deactivatedRehearsal)

      // Execute
      const result = await rehearsalService.removeRehearsal(
        rehearsalId.toString(),
        teacherId,
        isAdmin
      )

      // Assert
      // Should check if teacher is conductor of this orchestra
      expect(mockOrchestraCollection.findOne).toHaveBeenCalledWith({
        _id: expect.any(ObjectId)
      })
      
      // Non-orchestra type should not update orchestra.rehearsalIds
      expect(mockOrchestraCollection.updateOne).not.toHaveBeenCalled()
      
      expect(mockRehearsalCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        {
          $set: {
            isActive: false,
            updatedAt: expect.any(Date)
          }
        },
        { returnDocument: 'after' }
      )
    })

    it('should throw error if rehearsal is not found', async () => {
      // Setup
      const rehearsalId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      mockRehearsalCollection.findOne.mockResolvedValue(null)

      // Execute & Assert
      await expect(rehearsalService.removeRehearsal(
        rehearsalId.toString()
      )).rejects.toThrow(`Rehearsal with id ${rehearsalId} not found`)
    })

    it('should throw error when non-admin is not conductor of orchestra', async () => {
      // Setup
      const rehearsalId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const orchestraId = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      
      const existingRehearsal = {
        _id: rehearsalId,
        groupId: orchestraId.toString()
      }
      
      mockRehearsalCollection.findOne.mockResolvedValue(existingRehearsal)
      
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8d')
      const isAdmin = false // Not admin, need to check orchestra access
      
      // Mock orchestra exists but teacher is not conductor
      mockOrchestraCollection.findOne.mockResolvedValue({
        _id: orchestraId,
        conductorId: 'different-teacher-id'
      })

      // Execute & Assert
      await expect(rehearsalService.removeRehearsal(
        rehearsalId.toString(),
        teacherId,
        isAdmin
      )).rejects.toThrow(`Teacher with id ${teacherId} is not the conductor of the orchestra`)
    })

    it('should handle database errors', async () => {
      // Setup
      const rehearsalId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      mockRehearsalCollection.findOne.mockRejectedValue(new Error('Database error'))

    // Execute & Assert
      await expect(rehearsalService.removeRehearsal(rehearsalId.toString()))
        .rejects.toThrow('Failed to remove rehearsal: Database error')
    })
  })

  describe('bulkCreateRehearsals', () => {
    it('should bulk create rehearsals as admin', async () => {
      // Setup
      const bulkCreateData = {
        orchestraId: new ObjectId('6579e36c83c8b3a5c2df8a8c').toString(),
        startDate: '2023-01-01',
        endDate: '2023-03-31', // 3 months of Wednesdays
        dayOfWeek: 3, // Wednesday
        startTime: '18:00',
        endTime: '20:00',
        location: 'Main Hall'
      }
      
      const validationResult = {
        error: null,
        value: { ...bulkCreateData }
      }
      
      validateBulkCreate.mockReturnValue(validationResult)
      
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8d')
      const isAdmin = true // Admin doesn't need to check orchestra access
      
      // Mock generated rehearsal IDs
      const mockInsertedIds = {
        0: new ObjectId('6579e36c83c8b3a5c2df8a8e'),
        1: new ObjectId('6579e36c83c8b3a5c2df8a8f'),
        2: new ObjectId('6579e36c83c8b3a5c2df8a90')
      }
      
      // 13 Wednesdays in Q1 2023 (1/4, 1/11, 1/18, 1/25, 2/1, 2/8, 2/15, 2/22, 3/1, 3/8, 3/15, 3/22, 3/29)
      mockRehearsalCollection.insertMany.mockResolvedValue({
        insertedCount: 13,
        insertedIds: mockInsertedIds
      })

      // Execute
      const result = await rehearsalService.bulkCreateRehearsals(
        bulkCreateData,
        teacherId,
        isAdmin
      )

      // Assert
      expect(validateBulkCreate).toHaveBeenCalledWith(bulkCreateData)
      
      // Admin doesn't need to check orchestra access
      expect(mockOrchestraCollection.findOne).not.toHaveBeenCalled()
      
      // Should have created rehearsals for Wednesdays
      expect(mockRehearsalCollection.insertMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            groupId: bulkCreateData.orchestraId,
            type: 'תזמורת',
            dayOfWeek: 3,
            startTime: '18:00',
            endTime: '20:00',
            location: 'Main Hall'
          })
        ])
      )
      
      // Should update orchestra's rehearsalIds
      expect(mockOrchestraCollection.updateOne).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        { $push: { rehearsalIds: { $each: Object.values(mockInsertedIds).map(id => id.toString()) } } }
      )
      
      expect(result).toEqual({
        insertedCount: 13,
        rehearsalIds: Object.values(mockInsertedIds).map(id => id.toString())
      })
    })

    it('should check orchestra access for non-admin conductors', async () => {
      // Setup
      const orchestraId = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      const bulkCreateData = {
        orchestraId: orchestraId.toString(),
        startDate: '2023-01-01',
        endDate: '2023-01-31',
        dayOfWeek: 3,
        startTime: '18:00',
        endTime: '20:00',
        location: 'Main Hall'
      }
      
      const validationResult = {
        error: null,
        value: bulkCreateData
      }
      
      validateBulkCreate.mockReturnValue(validationResult)
      
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8d')
      const isAdmin = false // Not admin, need to check orchestra access
      
      // Mock orchestra exists and teacher is conductor
      mockOrchestraCollection.findOne.mockResolvedValue({
        _id: orchestraId,
        conductorId: teacherId.toString()
      })
      
      // There are 4 Wednesdays in January 2023
      mockRehearsalCollection.insertMany.mockResolvedValue({
        insertedCount: 4,
        insertedIds: {
          0: new ObjectId('6579e36c83c8b3a5c2df8a8e')
        }
      })

      // Execute
      await rehearsalService.bulkCreateRehearsals(
        bulkCreateData,
        teacherId,
        isAdmin
      )

      // Assert
      // Should check if teacher is conductor of this orchestra
      expect(mockOrchestraCollection.findOne).toHaveBeenCalledWith({
        _id: expect.any(ObjectId),
        conductorId: teacherId.toString()
      })
    })

    it('should handle empty date ranges or excluded dates', async () => {
      // Setup
      const bulkCreateData = {
        orchestraId: new ObjectId('6579e36c83c8b3a5c2df8a8c').toString(),
        startDate: '2023-01-01',
        endDate: '2023-01-01', // Same day, no Wednesdays
        dayOfWeek: 3,
        startTime: '18:00',
        endTime: '20:00',
        location: 'Main Hall'
      }
      
      const validationResult = {
        error: null,
        value: bulkCreateData
      }
      
      validateBulkCreate.mockReturnValue(validationResult)
      
      const isAdmin = true

      // Execute
      const result = await rehearsalService.bulkCreateRehearsals(
        bulkCreateData,
        null,
        isAdmin
      )

      // Assert
      // No insertMany called, no dates to create
      expect(mockRehearsalCollection.insertMany).not.toHaveBeenCalled()
      expect(mockOrchestraCollection.updateOne).not.toHaveBeenCalled()
      
      expect(result).toEqual({
        insertedCount: 0,
        rehearsalIds: []
      })
    })

    it('should throw error when non-admin has no access to orchestra', async () => {
      // Setup
      const orchestraId = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      const bulkCreateData = {
        orchestraId: orchestraId.toString(),
        startDate: '2023-01-01',
        endDate: '2023-01-31',
        dayOfWeek: 3
      }
      
      const validationResult = {
        error: null,
        value: bulkCreateData
      }
      
      validateBulkCreate.mockReturnValue(validationResult)
      
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8d')
      const isAdmin = false // Not admin, need to check orchestra access
      
      // Mock orchestra not found or teacher is not conductor
      mockOrchestraCollection.findOne.mockResolvedValue(null)

      // Execute & Assert
      await expect(rehearsalService.bulkCreateRehearsals(
        bulkCreateData,
        teacherId,
        isAdmin
      )).rejects.toThrow('Not authorized to bulk create rehearsals for this orchestra')
    })

    it('should throw error for invalid bulk create data', async () => {
      // Setup
      const bulkCreateData = { invalidData: true }
      
      const validationResult = {
        error: new Error('Invalid bulk create data'),
        value: null
      }
      
      validateBulkCreate.mockReturnValue(validationResult)

      // Execute & Assert
      await expect(rehearsalService.bulkCreateRehearsals(bulkCreateData))
        .rejects.toThrow('Invalid bulk create data')
    })

    it('should handle database errors', async () => {
      // Setup
      const bulkCreateData = {
        orchestraId: 'orchestra1',
        startDate: '2023-01-01',
        endDate: '2023-01-31',
        dayOfWeek: 3
      }
      
      const validationResult = {
        error: null,
        value: bulkCreateData
      }
      
      validateBulkCreate.mockReturnValue(validationResult)
      
      const isAdmin = true // Skip orchestra check
      
      mockRehearsalCollection.insertMany.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(rehearsalService.bulkCreateRehearsals(
        bulkCreateData,
        null,
        isAdmin
      )).rejects.toThrow('Failed to bulk create rehearsals: Database error')
    })
  })

  describe('updateAttendance', () => {
    it('should update rehearsal attendance and create activity records', async () => {
      // Setup
      const rehearsalId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const orchestraId = new ObjectId('6579e36c83c8b3a5c2df8a8c').toString()
      
      const attendanceData = {
        present: ['student1', 'student2'],
        absent: ['student3', 'student4']
      }
      
      const validationResult = {
        error: null,
        value: attendanceData
      }
      
      validateAttendance.mockReturnValue(validationResult)
      
      const rehearsal = {
        _id: rehearsalId,
        groupId: orchestraId,
        date: new Date('2023-01-15'),
        attendance: { present: [], absent: [] }
      }
      
      mockRehearsalCollection.findOne.mockResolvedValue(rehearsal)
      
      const updatedRehearsal = {
        ...rehearsal,
        attendance: attendanceData,
        updatedAt: new Date()
      }
      
      mockRehearsalCollection.findOneAndUpdate.mockResolvedValue(updatedRehearsal)

      // Execute
      const result = await rehearsalService.updateAttendance(
        rehearsalId.toString(),
        attendanceData,
        null,
        true // isAdmin
      )

      // Assert
      expect(validateAttendance).toHaveBeenCalledWith(attendanceData)
      
      // Should delete previous attendance records for this rehearsal
      expect(mockActivityCollection.deleteMany).toHaveBeenCalledWith({
        sessionId: rehearsalId.toString(),
        activityType: 'תזמורת'
      })
      
      // Should create attendance records for present students
      expect(mockActivityCollection.insertOne).toHaveBeenCalledWith(expect.objectContaining({
        studentId: 'student1',
        activityType: 'תזמורת',
        groupId: orchestraId,
        sessionId: rehearsalId.toString(),
        status: 'הגיע/ה'
      }))
      
      // Should create attendance records for absent students
      expect(mockActivityCollection.insertOne).toHaveBeenCalledWith(expect.objectContaining({
        studentId: 'student3',
        activityType: 'תזמורת',
        groupId: orchestraId,
        sessionId: rehearsalId.toString(),
        status: 'לא הגיע/ה'
      }))
      
      expect(result).toEqual(updatedRehearsal)
    })

    it('should throw error for invalid attendance data', async () => {
      // Setup
      const rehearsalId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const attendanceData = { invalidData: true }
      
      const validationResult = {
        error: new Error('Invalid attendance data'),
        value: null
      }
      
      validateAttendance.mockReturnValue(validationResult)

      // Execute & Assert
      await expect(rehearsalService.updateAttendance(
        rehearsalId.toString(),
        attendanceData
      )).rejects.toThrow('Invalid attendance data')
    })

    it('should throw error if rehearsal is not found', async () => {
      // Setup
      const rehearsalId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const attendanceData = {
        present: ['student1'],
        absent: ['student2']
      }
      
      const validationResult = {
        error: null,
        value: attendanceData
      }
      
      validateAttendance.mockReturnValue(validationResult)
      
      mockRehearsalCollection.findOne.mockResolvedValue(null)

      // Execute & Assert
      await expect(rehearsalService.updateAttendance(
        rehearsalId.toString(),
        attendanceData
      )).rejects.toThrow(`Rehearsal with id ${rehearsalId} not found`)
    })

    it('should handle database errors', async () => {
      // Setup
      const rehearsalId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const attendanceData = {
        present: ['student1'],
        absent: ['student2']
      }
      
      const validationResult = {
        error: null,
        value: attendanceData
      }
      
      validateAttendance.mockReturnValue(validationResult)
      
      mockRehearsalCollection.findOne.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(rehearsalService.updateAttendance(
        rehearsalId.toString(),
        attendanceData
      )).rejects.toThrow(`Error updating attendance ${rehearsalId}: Database error`)
    })
  })

  describe('_generateDatesForDayOfWeek', () => {
    it('should generate correct dates for a specific day of week in a date range', () => {
      // Setup - All Wednesdays in January 2023
      const startDate = new Date('2023-01-01') // Sunday
      const endDate = new Date('2023-01-31')
      const dayOfWeek = 3 // Wednesday
      
      // Execute
      const result = rehearsalService._generateDatesForDayOfWeek(
        startDate,
        endDate,
        dayOfWeek
      )

      // Assert
      // Jan 2023 has 4 Wednesdays: 4th, 11th, 18th, 25th
      expect(result).toHaveLength(4)
      expect(result[0].getDate()).toBe(4)
      expect(result[1].getDate()).toBe(11)
      expect(result[2].getDate()).toBe(18)
      expect(result[3].getDate()).toBe(25)
      
      // All should be Wednesdays
      result.forEach(date => {
        expect(date.getDay()).toBe(dayOfWeek)
      })
    })

    it('should exclude specified dates', () => {
      // Setup - All Wednesdays in January 2023, except the 11th and 25th
      const startDate = new Date('2023-01-01')
      const endDate = new Date('2023-01-31')
      const dayOfWeek = 3 // Wednesday
      const excludeDates = [
        new Date('2023-01-11'),
        new Date('2023-01-25')
      ]
      
      // Execute
      const result = rehearsalService._generateDatesForDayOfWeek(
        startDate,
        endDate,
        dayOfWeek,
        excludeDates
      )

      // Assert
      // Should only include Jan 4th and 18th
      expect(result).toHaveLength(2)
      expect(result[0].getDate()).toBe(4)
      expect(result[1].getDate()).toBe(18)
    })

    it('should handle start date that is after the first occurrence of day of week', () => {
      // Setup - Start on Thursday Jan 5th, should get Wednesdays starting Jan 11th
      const startDate = new Date('2023-01-05') // Thursday
      const endDate = new Date('2023-01-31')
      const dayOfWeek = 3 // Wednesday
      
      // Execute
      const result = rehearsalService._generateDatesForDayOfWeek(
        startDate,
        endDate,
        dayOfWeek
      )

      // Assert
      // Should include Jan 11th, 18th, 25th
      expect(result).toHaveLength(3)
      expect(result[0].getDate()).toBe(11)
      expect(result[1].getDate()).toBe(18)
      expect(result[2].getDate()).toBe(25)
    })

    it('should return empty array if no matching dates', () => {
      // Setup - Start and end on same day, no matching day of week
      const startDate = new Date('2023-01-05') // Thursday
      const endDate = new Date('2023-01-05')
      const dayOfWeek = 3 // Wednesday
      
      // Execute
      const result = rehearsalService._generateDatesForDayOfWeek(
        startDate,
        endDate,
        dayOfWeek
      )

      // Assert
      expect(result).toHaveLength(0)
    })

    it('should return empty array if all dates are excluded', () => {
      // Setup - All Wednesdays are excluded
      const startDate = new Date('2023-01-01')
      const endDate = new Date('2023-01-31')
      const dayOfWeek = 3 // Wednesday
      const excludeDates = [
        new Date('2023-01-04'),
        new Date('2023-01-11'),
        new Date('2023-01-18'),
        new Date('2023-01-25')
      ]
      
      // Execute
      const result = rehearsalService._generateDatesForDayOfWeek(
        startDate,
        endDate,
        dayOfWeek,
        excludeDates
      )

      // Assert
      expect(result).toHaveLength(0)
    })
  })

  describe('_buildCriteria', () => {
    it('should build criteria with groupId filter', () => {
      // Execute
      const criteria = rehearsalService._buildCriteria({ groupId: 'orchestra1' })
      
      // Assert
      expect(criteria).toEqual({
        groupId: 'orchestra1',
        isActive: true
      })
    })

    it('should build criteria with type filter', () => {
      // Execute
      const criteria = rehearsalService._buildCriteria({ type: 'תזמורת' })
      
      // Assert
      expect(criteria).toEqual({
        type: 'תזמורת',
        isActive: true
      })
    })

    it('should build criteria with date range', () => {
      // Execute
      const criteria = rehearsalService._buildCriteria({
        fromDate: '2023-01-01',
        toDate: '2023-12-31'
      })
      
      // Assert
      expect(criteria).toEqual({
        date: {
          $gte: new Date('2023-01-01'),
          $lte: new Date('2023-12-31')
        },
        isActive: true
      })
    })

    it('should handle fromDate without toDate', () => {
      // Execute
      const criteria = rehearsalService._buildCriteria({ fromDate: '2023-01-01' })
      
      // Assert
      expect(criteria).toEqual({
        date: {
          $gte: new Date('2023-01-01')
        },
        isActive: true
      })
    })

    it('should handle toDate without fromDate', () => {
      // Execute
      const criteria = rehearsalService._buildCriteria({ toDate: '2023-12-31' })
      
      // Assert
      expect(criteria).toEqual({
        date: {
          $lte: new Date('2023-12-31')
        },
        isActive: true
      })
    })

    it('should include inactive flag when showInactive is true', () => {
      // Execute
      const criteria = rehearsalService._buildCriteria({ 
        showInactive: true,
        isActive: false
      })
      
      // Assert
      expect(criteria).toEqual({
        isActive: false
      })
    })

    it('should build empty criteria with just isActive by default', () => {
      // Execute
      const criteria = rehearsalService._buildCriteria({})
      
      // Assert
      expect(criteria).toEqual({
        isActive: true
      })
    })

    it('should combine multiple filters', () => {
      // Execute
      const criteria = rehearsalService._buildCriteria({
        groupId: 'orchestra1',
        type: 'תזמורת',
        fromDate: '2023-01-01',
        toDate: '2023-12-31'
      })
      
      // Assert
      expect(criteria).toEqual({
        groupId: 'orchestra1',
        type: 'תזמורת',
        date: {
          $gte: new Date('2023-01-01'),
          $lte: new Date('2023-12-31')
        },
        isActive: true
      })
    })
  })
})