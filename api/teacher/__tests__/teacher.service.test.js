import { describe, it, expect, vi, beforeEach } from 'vitest'
import { teacherService } from '../teacher.service.js'
import { validateTeacher } from '../teacher.validation.js'
import { getCollection } from '../../../services/mongoDB.service.js'
import { ObjectId } from 'mongodb'
import { authService } from '../../auth/auth.service.js'

// Mock dependencies
vi.mock('../teacher.validation.js', () => ({
  validateTeacher: vi.fn()
}))

vi.mock('../../../services/mongoDB.service.js', () => ({
  getCollection: vi.fn()
}))

vi.mock('../../auth/auth.service.js', () => ({
  authService: {
    encryptPassword: vi.fn()
  }
}))

describe('Teacher Service', () => {
  let mockCollection, mockFind, mockFindOne, mockInsertOne, mockFindOneAndUpdate

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Setup MongoDB collection mock methods
    mockFind = vi.fn().mockReturnThis()
    mockFindOne = vi.fn()
    mockInsertOne = vi.fn()
    mockFindOneAndUpdate = vi.fn()
    
    mockCollection = {
      find: mockFind,
      toArray: vi.fn(),
      findOne: mockFindOne,
      insertOne: mockInsertOne,
      findOneAndUpdate: mockFindOneAndUpdate
    }
    
    // Properly chain the find and toArray methods
    mockFind.mockReturnValue({
      toArray: mockCollection.toArray
    })
    
    getCollection.mockResolvedValue(mockCollection)
  })

  describe('getTeachers', () => {
    it('should get all teachers with default filter', async () => {
      // Setup
      const mockTeachers = [
        { _id: '1', personalInfo: { fullName: 'Teacher 1' } },
        { _id: '2', personalInfo: { fullName: 'Teacher 2' } }
      ]
      
      mockCollection.toArray.mockResolvedValue(mockTeachers)

      // Execute
      const result = await teacherService.getTeachers({})

      // Assert
      expect(mockCollection.find).toHaveBeenCalledWith({ isActive: true })
      expect(result).toEqual(mockTeachers)
    })

    it('should apply name filter correctly', async () => {
      // Setup
      const filterBy = { name: 'Teacher 1' }
      mockCollection.toArray.mockResolvedValue([])

      // Execute
      await teacherService.getTeachers(filterBy)

      // Assert
      expect(mockCollection.find).toHaveBeenCalledWith({
        'personalInfo.fullName': { $regex: 'Teacher 1', $options: 'i' },
        isActive: true
      })
    })

    it('should apply instrument filter correctly', async () => {
      // Setup
      const filterBy = { instrument: 'Piano' }
      mockCollection.toArray.mockResolvedValue([])

      // Execute
      await teacherService.getTeachers(filterBy)

      // Assert
      expect(mockCollection.find).toHaveBeenCalledWith({
        'personalInfo.instrument': 'Piano',
        isActive: true
      })
    })

    it('should apply student filter correctly', async () => {
      // Setup
      const filterBy = { studentId: '123' }
      mockCollection.toArray.mockResolvedValue([])

      // Execute
      await teacherService.getTeachers(filterBy)

      // Assert
      expect(mockCollection.find).toHaveBeenCalledWith({
        'teaching.studentIds': '123',
        isActive: true
      })
    })

    it('should apply orchestra filter correctly', async () => {
      // Setup
      const filterBy = { orchestraId: '456' }
      mockCollection.toArray.mockResolvedValue([])

      // Execute
      await teacherService.getTeachers(filterBy)

      // Assert
      expect(mockCollection.find).toHaveBeenCalledWith({
        'conducting.orchestraIds': '456',
        isActive: true
      })
    })

    it('should apply ensemble filter correctly', async () => {
      // Setup
      const filterBy = { ensembleId: '789' }
      mockCollection.toArray.mockResolvedValue([])

      // Execute
      await teacherService.getTeachers(filterBy)

      // Assert
      expect(mockCollection.find).toHaveBeenCalledWith({
        'ensembleIds': '789',
        isActive: true
      })
    })

    it('should include inactive teachers when showInactive is true', async () => {
      // Setup
      const filterBy = { showInactive: true, isActive: false }
      mockCollection.toArray.mockResolvedValue([])

      // Execute
      await teacherService.getTeachers(filterBy)

      // Assert
      expect(mockCollection.find).toHaveBeenCalledWith({
        isActive: false
      })
    })

    it('should handle database errors', async () => {
      // Setup
      const dbError = new Error('Database error')
      mockCollection.toArray.mockRejectedValue(dbError)

      // Execute & Assert
      await expect(teacherService.getTeachers({}))
        .rejects.toThrow('Error getting teachers: Database error')
    })
  })

  describe('getTeacherById', () => {
    it('should get a teacher by ID', async () => {
      // Setup
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const mockTeacher = {
        _id: teacherId,
        personalInfo: { fullName: 'Test Teacher' }
      }
      
      mockFindOne.mockResolvedValue(mockTeacher)

      // Execute
      const result = await teacherService.getTeacherById(teacherId.toString())

      // Assert
      expect(mockFindOne).toHaveBeenCalledWith({ _id: expect.any(ObjectId) })
      expect(result).toEqual(mockTeacher)
    })

    it('should throw error if teacher is not found', async () => {
      // Setup
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      mockFindOne.mockResolvedValue(null)

      // Execute & Assert
      await expect(teacherService.getTeacherById(teacherId.toString()))
        .rejects.toThrow(`Error getting teacher by id: Teacher with id ${teacherId} not found`)
    })

    it('should handle database errors', async () => {
      // Setup
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      mockFindOne.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(teacherService.getTeacherById(teacherId.toString()))
        .rejects.toThrow('Error getting teacher by id: Database error')
    })
  })

  describe('addTeacher', () => {
    it('should add a new teacher with encrypted password', async () => {
      // Setup
      const teacherToAdd = {
        personalInfo: {
          fullName: 'New Teacher',
          phone: '0501234567',
          email: 'teacher@example.com',
          address: 'Address'
        },
        roles: ['מורה'],
        credentials: {
          email: 'teacher@example.com',
          password: 'plainPassword'
        }
      }
      
      const validationResult = {
        error: null,
        value: { ...teacherToAdd }
      }
      
      validateTeacher.mockReturnValue(validationResult)
      authService.encryptPassword.mockResolvedValue('hashedPassword')
      
      const insertedId = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      mockInsertOne.mockResolvedValue({ insertedId })

      // Execute
      const result = await teacherService.addTeacher(teacherToAdd)

      // Assert
      expect(validateTeacher).toHaveBeenCalledWith(teacherToAdd)
      expect(authService.encryptPassword).toHaveBeenCalledWith('plainPassword')
      
      expect(mockInsertOne).toHaveBeenCalledWith(expect.objectContaining({
        credentials: expect.objectContaining({
          email: 'teacher@example.com',
          password: 'hashedPassword'
        }),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      }))
      
      expect(result).toEqual({
        _id: insertedId,
        ...validationResult.value,
        credentials: { 
          email: 'teacher@example.com',
          password: 'hashedPassword'
        },
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      })
    })

    it('should throw error for invalid teacher data', async () => {
      // Setup
      const teacherToAdd = { invalidData: true }
      
      const validationResult = {
        error: new Error('Invalid teacher data'),
        value: null
      }
      
      validateTeacher.mockReturnValue(validationResult)

      // Execute & Assert
      await expect(teacherService.addTeacher(teacherToAdd))
        .rejects.toThrow('Error adding teacher: Invalid teacher data')
    })

    it('should handle database errors', async () => {
      // Setup
      const teacherToAdd = {
        personalInfo: { fullName: 'New Teacher' },
        credentials: { email: 'teacher@example.com', password: 'password' }
      }
      
      const validationResult = {
        error: null,
        value: teacherToAdd
      }
      
      validateTeacher.mockReturnValue(validationResult)
      authService.encryptPassword.mockResolvedValue('hashedPassword')
      mockInsertOne.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(teacherService.addTeacher(teacherToAdd))
        .rejects.toThrow('Error adding teacher: Database error')
    })
  })

  describe('updateTeacher', () => {
    it('should update an existing teacher', async () => {
      // Setup
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const teacherToUpdate = {
        personalInfo: {
          fullName: 'Updated Teacher',
          phone: '0501234567',
          email: 'updated@example.com',
          address: 'Updated Address'
        },
        roles: ['מורה', 'מנצח']
      }
      
      const validationResult = {
        error: null,
        value: { ...teacherToUpdate }
      }
      
      validateTeacher.mockReturnValue(validationResult)
      
      const updatedTeacher = {
        _id: teacherId,
        ...teacherToUpdate,
        updatedAt: new Date()
      }
      
      mockFindOneAndUpdate.mockResolvedValue(updatedTeacher)

      // Execute
      const result = await teacherService.updateTeacher(teacherId.toString(), teacherToUpdate)

      // Assert
      expect(validateTeacher).toHaveBeenCalledWith(teacherToUpdate)
      
      expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        { $set: expect.objectContaining({
          ...validationResult.value,
          updatedAt: expect.any(Date)
        })},
        { returnDocument: 'after' }
      )
      
      expect(result).toEqual(updatedTeacher)
    })

    it('should throw error for invalid teacher data', async () => {
      // Setup
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const teacherToUpdate = { invalidData: true }
      
      const validationResult = {
        error: new Error('Invalid teacher data'),
        value: null
      }
      
      validateTeacher.mockReturnValue(validationResult)

      // Execute & Assert
      await expect(teacherService.updateTeacher(teacherId.toString(), teacherToUpdate))
        .rejects.toThrow('Error updating teacher: Invalid teacher data')
    })

    it('should throw error if teacher is not found', async () => {
      // Setup
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const teacherToUpdate = {
        personalInfo: { fullName: 'Updated Teacher' }
      }
      
      const validationResult = {
        error: null,
        value: teacherToUpdate
      }
      
      validateTeacher.mockReturnValue(validationResult)
      mockFindOneAndUpdate.mockResolvedValue(null)

      // Execute & Assert
      await expect(teacherService.updateTeacher(teacherId.toString(), teacherToUpdate))
        .rejects.toThrow(`Error updating teacher: Teacher with id ${teacherId} not found`)
    })

    it('should handle database errors', async () => {
      // Setup
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const teacherToUpdate = {
        personalInfo: { fullName: 'Updated Teacher' }
      }
      
      const validationResult = {
        error: null,
        value: teacherToUpdate
      }
      
      validateTeacher.mockReturnValue(validationResult)
      mockFindOneAndUpdate.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(teacherService.updateTeacher(teacherId.toString(), teacherToUpdate))
        .rejects.toThrow('Error updating teacher: Database error')
    })
  })

  describe('removeTeacher', () => {
    it('should deactivate a teacher (soft delete)', async () => {
      // Setup
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      
      const deactivatedTeacher = {
        _id: teacherId,
        personalInfo: { fullName: 'Deactivated Teacher' },
        isActive: false,
        updatedAt: new Date()
      }
      
      mockFindOneAndUpdate.mockResolvedValue(deactivatedTeacher)

      // Execute
      const result = await teacherService.removeTeacher(teacherId.toString())

      // Assert
      expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        {
          $set: {
            isActive: false,
            updatedAt: expect.any(Date)
          }
        },
        { returnDocument: 'after' }
      )
      
      expect(result).toEqual(deactivatedTeacher)
    })

    it('should throw error if teacher is not found', async () => {
      // Setup
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      mockFindOneAndUpdate.mockResolvedValue(null)

      // Execute & Assert
      await expect(teacherService.removeTeacher(teacherId.toString()))
        .rejects.toThrow(`Error removing teacher: Teacher with id ${teacherId} not found`)
    })

    it('should handle database errors', async () => {
      // Setup
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      mockFindOneAndUpdate.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(teacherService.removeTeacher(teacherId.toString()))
        .rejects.toThrow('Error removing teacher: Database error')
    })
  })

  describe('getTeacherByRole', () => {
    it('should get teachers by role', async () => {
      // Setup
      const role = 'מורה'
      const mockTeachers = [
        { _id: '1', personalInfo: { fullName: 'Teacher 1' }, roles: ['מורה'] },
        { _id: '2', personalInfo: { fullName: 'Teacher 2' }, roles: ['מורה', 'מנצח'] }
      ]
      
      mockCollection.toArray.mockResolvedValue(mockTeachers)

      // Execute
      const result = await teacherService.getTeacherByRole(role)

      // Assert
      expect(mockCollection.find).toHaveBeenCalledWith({
        roles: role,
        isActive: true
      })
      expect(result).toEqual(mockTeachers)
    })

    it('should handle database errors', async () => {
      // Setup
      mockCollection.toArray.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(teacherService.getTeacherByRole('מורה'))
        .rejects.toThrow('Error getting teacher by role: Database error')
    })
  })
})