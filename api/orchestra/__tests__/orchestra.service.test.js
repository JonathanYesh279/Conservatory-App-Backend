import { describe, it, expect, vi, beforeEach } from 'vitest'
import { orchestraService } from '../orchestra.service.js'
import { validateOrchestra } from '../orchestra.validation.js'
import { getCollection } from '../../../services/mongoDB.service.js'
import { ObjectId } from 'mongodb'

// Mock dependencies
vi.mock('../orchestra.validation.js', () => ({
  validateOrchestra: vi.fn()
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

describe('Orchestra Service', () => {
  let mockOrchestraCollection, mockTeacherCollection, mockStudentCollection, mockRehearsalCollection, mockActivityCollection

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Setup mock collections
    mockOrchestraCollection = {
      find: vi.fn().mockReturnThis(),
      toArray: vi.fn(),
      findOne: vi.fn(),
      insertOne: vi.fn(),
      updateOne: vi.fn(),
      findOneAndUpdate: vi.fn()
    }

    mockTeacherCollection = {
      updateOne: vi.fn(),
      findOne: vi.fn()
    }

    mockStudentCollection = {
      updateOne: vi.fn(),
      updateMany: vi.fn()
    }

    mockRehearsalCollection = {
      findOne: vi.fn()
    }

    mockActivityCollection = {
      find: vi.fn().mockReturnThis(),
      toArray: vi.fn(),
      updateOne: vi.fn(),
      findOne: vi.fn()
    }

    // Mock getCollection to return different collections based on the name
    getCollection.mockImplementation((name) => {
      switch (name) {
        case 'orchestra':
          return Promise.resolve(mockOrchestraCollection)
        case 'teacher':
          return Promise.resolve(mockTeacherCollection)
        case 'student':
          return Promise.resolve(mockStudentCollection)
        case 'rehearsal':
          return Promise.resolve(mockRehearsalCollection)
        case 'activity_attendance':
          return Promise.resolve(mockActivityCollection)
        default:
          return Promise.resolve({})
      }
    })
  })

  describe('getOrchestras', () => {
    it('should get all orchestras with default filter', async () => {
      // Setup
      const mockOrchestras = [
        { _id: new ObjectId('6579e36c83c8b3a5c2df8a8b'), name: 'Orchestra 1' },
        { _id: new ObjectId('6579e36c83c8b3a5c2df8a8c'), name: 'Orchestra 2' }
      ]
      mockOrchestraCollection.toArray.mockResolvedValue(mockOrchestras)

      // Execute
      const result = await orchestraService.getOrchestras()

      // Assert
      expect(mockOrchestraCollection.find).toHaveBeenCalledWith({ isActive: true })
      expect(result).toEqual(mockOrchestras)
    })

    it('should apply name filter correctly', async () => {
      // Setup
      const filterBy = { name: 'Test Orchestra' }
      mockOrchestraCollection.toArray.mockResolvedValue([])

      // Execute
      await orchestraService.getOrchestras(filterBy)

      // Assert
      expect(mockOrchestraCollection.find).toHaveBeenCalledWith({
        name: { $regex: 'Test Orchestra', $options: 'i' },
        isActive: true
      })
    })

    it('should handle database errors', async () => {
      // Setup
      mockOrchestraCollection.toArray.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(orchestraService.getOrchestras()).rejects.toThrow('Error in orchestraService.getOrchestras: Database error')
    })
  })

  describe('getOrchestraById', () => {
    it('should get an orchestra by ID', async () => {
      // Setup
      const orchestraId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const mockOrchestra = {
        _id: orchestraId,
        name: 'Test Orchestra'
      }
      mockOrchestraCollection.findOne.mockResolvedValue(mockOrchestra)

      // Execute
      const result = await orchestraService.getOrchestraById(orchestraId.toString())

      // Assert
      expect(mockOrchestraCollection.findOne).toHaveBeenCalledWith({
        _id: expect.any(ObjectId)
      })
      expect(result).toEqual(mockOrchestra)
    })

    it('should throw error if orchestra is not found', async () => {
      // Setup
      const orchestraId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      mockOrchestraCollection.findOne.mockResolvedValue(null)

      // Execute & Assert
      await expect(orchestraService.getOrchestraById(orchestraId.toString()))
        .rejects.toThrow(`Orchestra with id ${orchestraId} not found`)
    })

    it('should handle database errors', async () => {
      // Setup
      const orchestraId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      mockOrchestraCollection.findOne.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(orchestraService.getOrchestraById(orchestraId.toString()))
        .rejects.toThrow('Error in orchestraService.getOrchestraById: Database error')
    })
  })

  describe('addOrchestra', () => {
    it('should add a new orchestra', async () => {
      // Setup
      const orchestraToAdd = {
        name: 'New Orchestra',
        type: 'תזמורת',
        conductorId: '6579e36c83c8b3a5c2df8a8d',
        schoolYearId: '6579e36c83c8b3a5c2df8a8c'
      }
      
      const validationResult = {
        error: null,
        value: { ...orchestraToAdd }
      }
      validateOrchestra.mockReturnValue(validationResult)
      
      const insertedId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      mockOrchestraCollection.insertOne.mockResolvedValue({ insertedId })

      // Execute
      const result = await orchestraService.addOrchestra(orchestraToAdd)

      // Assert
      expect(validateOrchestra).toHaveBeenCalledWith(orchestraToAdd)
      expect(mockOrchestraCollection.insertOne).toHaveBeenCalledWith(validationResult.value)
      expect(mockTeacherCollection.updateOne).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        { $push: { 'conducting.orchestraIds': insertedId.toString() } }
      )
      expect(result).toEqual({
        id: insertedId,
        ...validationResult.value
      })
    })

    it('should use current school year if not provided', async () => {
      // Setup
      const orchestraToAdd = {
        name: 'New Orchestra',
        type: 'תזמורת',
        conductorId: '6579e36c83c8b3a5c2df8a8d'
        // No schoolYearId
      }
      
      const currentSchoolYear = {
        _id: new ObjectId('6579e36c83c8b3a5c2df8a8c'),
        name: '2023-2024'
      }
      
      const validationResult = {
        error: null,
        value: { ...orchestraToAdd }
      }
      validateOrchestra.mockReturnValue(validationResult)
      
      // Mock the require function to get the school year service
      const schoolYearServiceMock = require('../school-year/school-year.service.js').schoolYearService
      schoolYearServiceMock.getCurrentSchoolYear.mockResolvedValue(currentSchoolYear)
      
      const insertedId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      mockOrchestraCollection.insertOne.mockResolvedValue({ insertedId })

      // Execute
      const result = await orchestraService.addOrchestra(orchestraToAdd)

      // Assert
      expect(validateOrchestra).toHaveBeenCalledWith({
        ...orchestraToAdd,
        schoolYearId: currentSchoolYear._id.toString()
      })
      expect(mockOrchestraCollection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          schoolYearId: currentSchoolYear._id.toString()
        })
      )
    })

    it('should throw error for invalid orchestra data', async () => {
      // Setup
      const orchestraToAdd = { invalidData: true }
      
      const validationResult = {
        error: new Error('Invalid orchestra data'),
        value: null
      }
      validateOrchestra.mockReturnValue(validationResult)

      // Execute & Assert
      await expect(orchestraService.addOrchestra(orchestraToAdd))
        .rejects.toThrow('Error in orchestraService.addOrchestra: Invalid orchestra data')
    })
  })

  describe('updateOrchestra', () => {
    it('should update an orchestra when user is admin', async () => {
      // Setup
      const orchestraId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8d')
      const isAdmin = true
      
      const existingOrchestra = {
        _id: orchestraId,
        name: 'Old Orchestra',
        conductorId: '6579e36c83c8b3a5c2df8a8e'
      }
      
      const orchestraToUpdate = {
        name: 'Updated Orchestra',
        conductorId: '6579e36c83c8b3a5c2df8a8d'
      }
      
      const validationResult = {
        error: null,
        value: { ...orchestraToUpdate }
      }
      validateOrchestra.mockReturnValue(validationResult)
      
      mockOrchestraCollection.findOne.mockResolvedValue(existingOrchestra)
      mockOrchestraCollection.findOneAndUpdate.mockResolvedValue({
        ...existingOrchestra,
        ...orchestraToUpdate
      })

      // Execute
      const result = await orchestraService.updateOrchestra(
        orchestraId.toString(),
        orchestraToUpdate,
        teacherId,
        isAdmin
      )

      // Assert
      expect(validateOrchestra).toHaveBeenCalledWith(orchestraToUpdate)
      
      // Should update conductor references since conductor changed
      expect(mockTeacherCollection.updateOne).toHaveBeenCalledTimes(2)
      expect(mockTeacherCollection.updateOne).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) }, // Old conductor
        { $pull: { 'conducting.orchestraIds': orchestraId.toString() } }
      )
      expect(mockTeacherCollection.updateOne).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) }, // New conductor
        { $push: { 'conducting.orchestraIds': orchestraId.toString() } }
      )
      
      expect(mockOrchestraCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        { $set: validationResult.value },
        { returnDocument: 'after' }
      )
    })

    it('should update an orchestra when user is the conductor', async () => {
      // Setup
      const orchestraId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8d')
      const isAdmin = false
      
      const existingOrchestra = {
        _id: orchestraId,
        name: 'Old Orchestra',
        conductorId: teacherId.toString() // Teacher is the conductor
      }
      
      const orchestraToUpdate = {
        name: 'Updated Orchestra',
        conductorId: teacherId.toString() // No change in conductor
      }
      
      const validationResult = {
        error: null,
        value: { ...orchestraToUpdate }
      }
      validateOrchestra.mockReturnValue(validationResult)
      
      mockOrchestraCollection.findOne.mockResolvedValue(existingOrchestra)
      mockOrchestraCollection.findOneAndUpdate.mockResolvedValue({
        ...existingOrchestra,
        name: orchestraToUpdate.name
      })

      // Execute
      const result = await orchestraService.updateOrchestra(
        orchestraId.toString(),
        orchestraToUpdate,
        teacherId,
        isAdmin
      )

      // Assert
      expect(validateOrchestra).toHaveBeenCalledWith(orchestraToUpdate)
      
      // No need to update conductor references since conductor didn't change
      expect(mockTeacherCollection.updateOne).not.toHaveBeenCalled()
      
      expect(mockOrchestraCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        { $set: validationResult.value },
        { returnDocument: 'after' }
      )
    })

    it('should throw error when non-admin tries to update others orchestra', async () => {
      // Setup
      const orchestraId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8d')
      const isAdmin = false
      
      const existingOrchestra = {
        _id: orchestraId,
        name: 'Orchestra',
        conductorId: '6579e36c83c8b3a5c2df8a8e' // Different teacher is conductor
      }
      
      mockOrchestraCollection.findOne.mockResolvedValue(existingOrchestra)

      // Execute & Assert
      await expect(orchestraService.updateOrchestra(
        orchestraId.toString(),
        { name: 'Updated' },
        teacherId,
        isAdmin
      )).rejects.toThrow('Not authorized to modify this orchestra')
    })
  })

  describe('removeOrchestra', () => {
    it('should deactivate an orchestra when user is admin', async () => {
      // Setup
      const orchestraId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8d')
      const isAdmin = true
      
      const orchestra = {
        _id: orchestraId,
        name: 'Orchestra',
        conductorId: '6579e36c83c8b3a5c2df8a8e',
        memberIds: ['123', '456']
      }
      
      mockOrchestraCollection.findOne.mockResolvedValue(orchestra)
      mockOrchestraCollection.findOneAndUpdate.mockResolvedValue({
        ...orchestra,
        isActive: false
      })

      // Execute
      const result = await orchestraService.removeOrchestra(
        orchestraId.toString(),
        teacherId,
        isAdmin
      )

      // Assert
      // Should remove orchestra reference from conductor
      expect(mockTeacherCollection.updateOne).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        { $pull: { 'conducting.orchestraIds': orchestraId.toString() } }
      )
      
      // Should remove orchestra reference from members
      expect(mockStudentCollection.updateMany).toHaveBeenCalledWith(
        { 'enrollments.orchestraIds': orchestraId.toString() },
        { $pull: { 'enrollments.orchestraIds': orchestraId.toString() } }
      )
      
      expect(mockOrchestraCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        { $set: { isActive: false } },
        { returnDocument: 'after' }
      )
      
      expect(result.isActive).toBe(false)
    })

    it('should throw error when non-admin tries to remove others orchestra', async () => {
      // Setup
      const orchestraId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8d')
      const isAdmin = false
      
      const orchestra = {
        _id: orchestraId,
        name: 'Orchestra',
        conductorId: '6579e36c83c8b3a5c2df8a8e' // Different teacher is conductor
      }
      
      mockOrchestraCollection.findOne.mockResolvedValue(orchestra)

      // Execute & Assert
      await expect(orchestraService.removeOrchestra(
        orchestraId.toString(),
        teacherId,
        isAdmin
      )).rejects.toThrow('Not authorized to modify this orchestra')
    })
  })

  describe('addMember', () => {
    it('should add member to orchestra when user is admin', async () => {
      // Setup
      const orchestraId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const studentId = '123456'
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8d')
      const isAdmin = true
      
      const orchestra = {
        _id: orchestraId,
        name: 'Orchestra',
        conductorId: '6579e36c83c8b3a5c2df8a8e',
        memberIds: ['789']
      }
      
      mockOrchestraCollection.findOne.mockResolvedValue(orchestra)
      mockOrchestraCollection.findOneAndUpdate.mockResolvedValue({
        ...orchestra,
        memberIds: ['789', studentId]
      })

      // Execute
      const result = await orchestraService.addMember(
        orchestraId.toString(),
        studentId,
        teacherId,
        isAdmin
      )

      // Assert
      // Should add orchestra reference to student
      expect(mockStudentCollection.updateOne).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        { $addToSet: { 'enrollments.orchestraIds': orchestraId.toString() } }
      )
      
      // Should add student to orchestra members
      expect(mockOrchestraCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        { $addToSet: { memberIds: studentId } },
        { returnDocument: 'after' }
      )
      
      expect(result.memberIds).toContain(studentId)
    })

    it('should throw error when orchestra is not found', async () => {
      // Setup
      const orchestraId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      mockOrchestraCollection.findOne.mockResolvedValue(null)

      // Execute & Assert
      await expect(orchestraService.addMember(
        orchestraId.toString(),
        '123456',
        new ObjectId(),
        true
      )).rejects.toThrow(`Orchestra with id ${orchestraId} not found`)
    })
  })

  describe('removeMember', () => {
    it('should remove member from orchestra when user is conductor', async () => {
      // Setup
      const orchestraId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const studentId = '123456'
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8d')
      const isAdmin = false
      
      const orchestra = {
        _id: orchestraId,
        name: 'Orchestra',
        conductorId: teacherId.toString(), // Teacher is conductor
        memberIds: ['789', studentId]
      }
      
      mockOrchestraCollection.findOne.mockResolvedValue(orchestra)
      mockOrchestraCollection.findOneAndUpdate.mockResolvedValue({
        ...orchestra,
        memberIds: ['789'] // Student removed
      })

      // Execute
      const result = await orchestraService.removeMember(
        orchestraId.toString(),
        studentId,
        teacherId,
        isAdmin
      )

      // Assert
      // Should remove orchestra reference from student
      expect(mockStudentCollection.updateOne).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        { $pull: { 'enrollments.orchestraIds': orchestraId.toString() } }
      )
      
      // Should remove student from orchestra members
      expect(mockOrchestraCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        { $pull: { memberIds: studentId } },
        { returnDocument: 'after' }
      )
      
      expect(result.memberIds).not.toContain(studentId)
    })
  })

  describe('updateRehearsalAttendance', () => {
    it('should update rehearsal attendance', async () => {
      // Setup
      const rehearsalId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8d')
      const isAdmin = true
      
      const rehearsal = {
        _id: rehearsalId,
        groupId: '6579e36c83c8b3a5c2df8a8e',
        date: new Date(),
        attendance: {
          present: ['123'],
          absent: []
        }
      }
      
      const orchestra = {
        _id: new ObjectId('6579e36c83c8b3a5c2df8a8e'),
        conductorId: '6579e36c83c8b3a5c2df8a8f'
      }
      
      const attendance = {
        present: ['123', '456'],
        absent: ['789']
      }
      
      mockRehearsalCollection.findOne.mockResolvedValue(rehearsal)
      mockOrchestraCollection.findOne.mockResolvedValue(orchestra)
      mockRehearsalCollection.findOneAndUpdate.mockResolvedValue({
        ...rehearsal,
        attendance
      })

      // Execute
      const result = await orchestraService.updateRehearsalAttendance(
        rehearsalId.toString(),
        attendance,
        teacherId,
        isAdmin
      )

      // Assert
      // Should update attendance records in activity collection
      expect(mockActivityCollection.updateOne).toHaveBeenCalledTimes(3) // For each student
      
      // For present students
      expect(mockActivityCollection.updateOne).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: '123',
          sessionId: rehearsalId.toString(),
          activityType: 'תזמורת'
        }),
        expect.objectContaining({
          $set: expect.objectContaining({
            status: 'הגיע/ה'
          })
        }),
        { upsert: true }
      )
      
      // For absent students
      expect(mockActivityCollection.updateOne).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: '789',
          sessionId: rehearsalId.toString(),
          activityType: 'תזמורת'
        }),
        expect.objectContaining({
          $set: expect.objectContaining({
            status: 'לא הגיע/ה'
          })
        }),
        { upsert: true }
      )
      
      expect(result.attendance).toEqual(attendance)
    })

    it('should throw error when rehearsal is not found', async () => {
      // Setup
      const rehearsalId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      mockRehearsalCollection.findOne.mockResolvedValue(null)

      // Execute & Assert
      await expect(orchestraService.updateRehearsalAttendance(
        rehearsalId.toString(),
        { present: [], absent: [] },
        new ObjectId(),
        true
      )).rejects.toThrow(`Rehearsal with id ${rehearsalId} not found`)
    })
  })

  describe('getStudentAttendanceStats', () => {
    it('should get attendance statistics for a student', async () => {
      // Setup
      const orchestraId = '6579e36c83c8b3a5c2df8a8b'
      const studentId = '123456'
      
      const attendanceRecords = [
        { sessionId: '1', date: new Date('2023-01-01'), status: 'הגיע/ה' },
        { sessionId: '2', date: new Date('2023-01-08'), status: 'הגיע/ה' },
        { sessionId: '3', date: new Date('2023-01-15'), status: 'לא הגיע/ה' },
        { sessionId: '4', date: new Date('2023-01-22'), status: 'הגיע/ה' }
      ]
      
      mockActivityCollection.toArray.mockResolvedValue(attendanceRecords)

      // Execute
      const result = await orchestraService.getStudentAttendanceStats(orchestraId, studentId)

      // Assert
      expect(mockActivityCollection.find).toHaveBeenCalledWith({
        groupId: orchestraId,
        studentId,
        activityType: 'תזמורת'
      })
      
      expect(result).toEqual({
        totalRehearsals: 4,
        attended: 3,
        attendanceRate: 75,
        recentHistory: expect.any(Array)
      })
    })

    it('should return message when no attendance records found', async () => {
      // Setup
      mockActivityCollection.toArray.mockResolvedValue([])

      // Execute
      const result = await orchestraService.getStudentAttendanceStats('orchestra-id', 'student-id')

      // Assert
      expect(result).toEqual({
        totalRehearsals: 0,
        attended: 0,
        attendanceRate: 0,
        recentHistory: [],
        message: 'No attendance records found for this student in this orchestra'
      })
    })
  })
})