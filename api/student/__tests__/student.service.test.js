// api/student/__tests__/student.service.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { studentService } from '../student.service.js'
import { validateStudent } from '../student.validation.js'
import { getCollection } from '../../../services/mongoDB.service.js'
import { ObjectId } from 'mongodb'

// Mock dependencies
vi.mock('../student.validation.js', () => ({
  validateStudent: vi.fn()
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

describe('Student Service', () => {
  let mockStudentCollection, mockTeacherCollection

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Setup mock collections
    mockStudentCollection = {
      find: vi.fn().mockReturnThis(),
      toArray: vi.fn(),
      findOne: vi.fn(),
      insertOne: vi.fn(),
      updateOne: vi.fn(),
      findOneAndUpdate: vi.fn()
    }

    mockTeacherCollection = {
      findOne: vi.fn(),
      updateOne: vi.fn()
    }

    // Mock getCollection to return different collections based on the name
    getCollection.mockImplementation((name) => {
      switch (name) {
        case 'student':
          return Promise.resolve(mockStudentCollection)
        case 'teacher':
          return Promise.resolve(mockTeacherCollection)
        default:
          return Promise.resolve({})
      }
    })
  })

  describe('getStudents', () => {
    it('should get all students with default filter', async () => {
      // Setup
      const mockStudents = [
        { _id: new ObjectId('6579e36c83c8b3a5c2df8a8b'), personalInfo: { fullName: 'Student 1' } },
        { _id: new ObjectId('6579e36c83c8b3a5c2df8a8c'), personalInfo: { fullName: 'Student 2' } }
      ]
      mockStudentCollection.toArray.mockResolvedValue(mockStudents)

      // Execute
      const result = await studentService.getStudents()

      // Assert
      expect(mockStudentCollection.find).toHaveBeenCalledWith({ isActive: true })
      expect(result).toEqual(mockStudents)
    })

    it('should apply name filter correctly', async () => {
      // Setup
      const filterBy = { name: 'Student 1' }
      mockStudentCollection.toArray.mockResolvedValue([])

      // Execute
      await studentService.getStudents(filterBy)

      // Assert
      expect(mockStudentCollection.find).toHaveBeenCalledWith({
        'personalInfo.fullName': { $regex: 'Student 1', $options: 'i' },
        isActive: true
      })
    })

    it('should apply instrument filter correctly', async () => {
      // Setup
      const filterBy = { instrument: 'Violin' }
      mockStudentCollection.toArray.mockResolvedValue([])

      // Execute
      await studentService.getStudents(filterBy)

      // Assert
      expect(mockStudentCollection.find).toHaveBeenCalledWith({
        'academicInfo.instrument': 'Violin',
        isActive: true
      })
    })

    it('should apply stage filter correctly', async () => {
      // Setup
      const filterBy = { stage: '3' }
      mockStudentCollection.toArray.mockResolvedValue([])

      // Execute
      await studentService.getStudents(filterBy)

      // Assert
      expect(mockStudentCollection.find).toHaveBeenCalledWith({
        'academicInfo.currentStage': 3, // Should convert to number
        isActive: true
      })
    })

    it('should include inactive students when showInactive is true', async () => {
      // Setup
      const filterBy = { showInactive: true, isActive: false }
      mockStudentCollection.toArray.mockResolvedValue([])

      // Execute
      await studentService.getStudents(filterBy)

      // Assert
      expect(mockStudentCollection.find).toHaveBeenCalledWith({
        isActive: false
      })
    })

    it('should handle database errors', async () => {
      // Setup
      mockStudentCollection.toArray.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(studentService.getStudents()).rejects.toThrow('Error getting students: Database error')
    })
  })

  describe('getStudentById', () => {
    it('should get a student by ID', async () => {
      // Setup
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const mockStudent = {
        _id: studentId,
        personalInfo: { fullName: 'Test Student' }
      }
      mockStudentCollection.findOne.mockResolvedValue(mockStudent)

      // Execute
      const result = await studentService.getStudentById(studentId.toString())

      // Assert
      expect(mockStudentCollection.findOne).toHaveBeenCalledWith({ _id: expect.any(ObjectId) })
      expect(result).toEqual(mockStudent)
    })

    it('should throw error if student is not found', async () => {
      // Setup
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      mockStudentCollection.findOne.mockResolvedValue(null)

      // Execute & Assert
      await expect(studentService.getStudentById(studentId.toString()))
        .rejects.toThrow(`Student with id ${studentId} not found`)
    })

    it('should handle database errors', async () => {
      // Setup
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      mockStudentCollection.findOne.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(studentService.getStudentById(studentId.toString()))
        .rejects.toThrow('Error getting student by id: Database error')
    })
  })

  describe('addStudent', () => {
    it('should add a new student with current school year', async () => {
      // Setup
      const studentToAdd = {
        personalInfo: {
          fullName: 'New Student',
          phone: '0501234567'
        },
        academicInfo: {
          instrument: 'Violin',
          currentStage: 1,
          class: 'א'
        }
      }
      
      const validationResult = {
        error: null,
        value: { ...studentToAdd }
      }
      
      validateStudent.mockReturnValue(validationResult)
      
      const currentSchoolYear = {
        _id: new ObjectId('6579e36c83c8b3a5c2df8a8c'),
        name: '2023-2024'
      }
      
      const insertedId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      mockStudentCollection.insertOne.mockResolvedValue({ insertedId })
      
      // Need to get this working for testing
      const schoolYearServiceMock = require('../school-year/school-year.service.js').schoolYearService
      schoolYearServiceMock.getCurrentSchoolYear.mockResolvedValue(currentSchoolYear)

      // Execute
      const result = await studentService.addStudent(studentToAdd)

      // Assert
      expect(validateStudent).toHaveBeenCalledWith(studentToAdd)
      
      // Should add current school year to student's enrollments
      expect(mockStudentCollection.insertOne).toHaveBeenCalledWith(expect.objectContaining({
        enrollments: expect.objectContaining({
          schoolYears: [
            {
              schoolYearId: currentSchoolYear._id.toString(),
              isActive: true
            }
          ]
        }),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      }))
      
      expect(result).toEqual({
        _id: insertedId,
        ...validationResult.value,
        enrollments: expect.any(Object),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      })
    })

    it('should associate student with teacher if teacherId is provided', async () => {
      // Setup
      const studentToAdd = {
        personalInfo: { fullName: 'New Student' },
        academicInfo: { instrument: 'Violin', currentStage: 1, class: 'א' }
      }
      
      const validationResult = {
        error: null,
        value: { ...studentToAdd }
      }
      
      validateStudent.mockReturnValue(validationResult)
      
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8d')
      const isAdmin = false
      
      const insertedId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      mockStudentCollection.insertOne.mockResolvedValue({ insertedId })
      
      // Spy on internal method
      const associateStudentWithTeacherSpy = vi.spyOn(studentService, 'associateStudentWithTeacher')
      associateStudentWithTeacherSpy.mockResolvedValue({ success: true })

      // Execute
      await studentService.addStudent(studentToAdd, teacherId, isAdmin)

      // Assert
      expect(associateStudentWithTeacherSpy).toHaveBeenCalledWith(
        insertedId.toString(),
        teacherId
      )
    })

    it('should throw error for invalid student data', async () => {
      // Setup
      const studentToAdd = { invalidData: true }
      
      const validationResult = {
        error: new Error('Invalid student data'),
        value: null
      }
      
      validateStudent.mockReturnValue(validationResult)

      // Execute & Assert
      await expect(studentService.addStudent(studentToAdd))
        .rejects.toThrow('Error adding student: Invalid student data')
    })

    it('should handle database errors', async () => {
      // Setup
      const studentToAdd = {
        personalInfo: { fullName: 'New Student' },
        academicInfo: { instrument: 'Violin', currentStage: 1, class: 'א' }
      }
      
      const validationResult = {
        error: null,
        value: studentToAdd
      }
      
      validateStudent.mockReturnValue(validationResult)
      mockStudentCollection.insertOne.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(studentService.addStudent(studentToAdd))
        .rejects.toThrow('Error adding student: Database error')
    })
  })

  describe('updateStudent', () => {
    it('should update an existing student by admin', async () => {
      // Setup
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const studentToUpdate = {
        personalInfo: {
          fullName: 'Updated Student',
          phone: '0501234567'
        },
        academicInfo: {
          currentStage: 2
        }
      }
      
      const validationResult = {
        error: null,
        value: { ...studentToUpdate }
      }
      
      validateStudent.mockReturnValue(validationResult)
      
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8d')
      const isAdmin = true // Admin has access to update any student
      
      const updatedStudent = {
        _id: studentId,
        ...studentToUpdate,
        updatedAt: new Date()
      }
      
      mockStudentCollection.findOneAndUpdate.mockResolvedValue(updatedStudent)

      // Execute
      const result = await studentService.updateStudent(
        studentId.toString(),
        studentToUpdate,
        teacherId,
        isAdmin
      )

      // Assert
      expect(validateStudent).toHaveBeenCalledWith(studentToUpdate)
      
      // Admin doesn't need to check access
      expect(mockTeacherCollection.findOne).not.toHaveBeenCalled()
      
      expect(mockStudentCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        { $set: expect.objectContaining({
          ...validationResult.value,
          updatedAt: expect.any(Date)
        })},
        { returnDocument: 'after' }
      )
      
      expect(result).toEqual(updatedStudent)
    })

    it('should check access when non-admin teacher updates a student', async () => {
      // Setup
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const studentToUpdate = {
        personalInfo: { fullName: 'Updated Student' }
      }
      
      const validationResult = {
        error: null,
        value: studentToUpdate
      }
      
      validateStudent.mockReturnValue(validationResult)
      
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8d')
      const isAdmin = false // Not admin, need to check access
      
      // Mock teacher has access to this student
      mockTeacherCollection.findOne.mockResolvedValue({
        _id: teacherId,
        teaching: {
          studentIds: [studentId.toString()]
        }
      })
      
      const updatedStudent = {
        _id: studentId,
        ...studentToUpdate,
        updatedAt: new Date()
      }
      
      mockStudentCollection.findOneAndUpdate.mockResolvedValue(updatedStudent)

      // Execute
      const result = await studentService.updateStudent(
        studentId.toString(),
        studentToUpdate,
        teacherId,
        isAdmin
      )

      // Assert
      // Should check if teacher has access to student
      expect(mockTeacherCollection.findOne).toHaveBeenCalledWith({
        _id: expect.any(ObjectId),
        'teaching.studentIds': studentId.toString(),
        isActive: true
      })
      
      expect(mockStudentCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        { $set: expect.anything() },
        { returnDocument: 'after' }
      )
      
      expect(result).toEqual(updatedStudent)
    })

    it('should throw error when non-admin teacher has no access to student', async () => {
      // Setup
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const studentToUpdate = {
        personalInfo: { fullName: 'Updated Student' }
      }
      
      const validationResult = {
        error: null,
        value: studentToUpdate
      }
      
      validateStudent.mockReturnValue(validationResult)
      
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8d')
      const isAdmin = false // Not admin, need to check access
      
      // Mock teacher does NOT have access to this student
      mockTeacherCollection.findOne.mockResolvedValue(null)

      // Execute & Assert
      await expect(studentService.updateStudent(
        studentId.toString(),
        studentToUpdate,
        teacherId,
        isAdmin
      )).rejects.toThrow('Not authorized to update student')
    })

    it('should throw error for invalid student data', async () => {
      // Setup
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const studentToUpdate = { invalidData: true }
      
      const validationResult = {
        error: new Error('Invalid student data'),
        value: null
      }
      
      validateStudent.mockReturnValue(validationResult)

      // Execute & Assert
      await expect(studentService.updateStudent(studentId.toString(), studentToUpdate))
        .rejects.toThrow('Invalid student data')
    })

    it('should throw error if student is not found', async () => {
      // Setup
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const studentToUpdate = {
        personalInfo: { fullName: 'Updated Student' }
      }
      
      const validationResult = {
        error: null,
        value: studentToUpdate
      }
      
      validateStudent.mockReturnValue(validationResult)
      
      // Admin doesn't need access check
      const isAdmin = true
      
      // Student not found
      mockStudentCollection.findOneAndUpdate.mockResolvedValue(null)

      // Execute & Assert
      await expect(studentService.updateStudent(
        studentId.toString(),
        studentToUpdate,
        null,
        isAdmin
      )).rejects.toThrow(`Student with id ${studentId} not found`)
    })

    it('should handle database errors', async () => {
      // Setup
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const studentToUpdate = {
        personalInfo: { fullName: 'Updated Student' }
      }
      
      const validationResult = {
        error: null,
        value: studentToUpdate
      }
      
      validateStudent.mockReturnValue(validationResult)
      
      const isAdmin = true
      
      mockStudentCollection.findOneAndUpdate.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(studentService.updateStudent(
        studentId.toString(),
        studentToUpdate,
        null,
        isAdmin
      )).rejects.toThrow('Error updating student: Database error')
    })
  })

  describe('removeStudent', () => {
    it('should deactivate a student (soft delete) by admin', async () => {
      // Setup
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8d')
      const isAdmin = true
      
      const deactivatedStudent = {
        _id: studentId,
        personalInfo: { fullName: 'Deactivated Student' },
        isActive: false,
        updatedAt: new Date()
      }
      
      mockStudentCollection.findOneAndUpdate.mockResolvedValue(deactivatedStudent)

      // Execute
      const result = await studentService.removeStudent(
        studentId.toString(),
        teacherId,
        isAdmin
      )

      // Assert
      // As admin, no need to check access or remove associations
      expect(mockTeacherCollection.findOne).not.toHaveBeenCalled()
      
      expect(mockStudentCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        {
          $set: {
            isActive: false,
            updatedAt: expect.any(Date)
          }
        },
        { returnDocument: 'after' }
      )
      
      expect(result).toEqual(deactivatedStudent)
    })

    it('should remove student-teacher association when non-admin removes a student', async () => {
      // Setup
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8d')
      const isAdmin = false
      
      // Mock teacher has access to this student
      mockTeacherCollection.findOne.mockResolvedValue({
        _id: teacherId,
        teaching: {
          studentIds: [studentId.toString()]
        }
      })
      
      // Spy on internal method
      const removeStudentTeacherAssociationSpy = vi.spyOn(studentService, 'removeStudentTeacherAssociation')
      removeStudentTeacherAssociationSpy.mockResolvedValue({
        message: 'Student removed from teacher successfully',
        studentId: studentId.toString(),
        teacherId: teacherId.toString()
      })

      // Execute
      const result = await studentService.removeStudent(
        studentId.toString(),
        teacherId,
        isAdmin
      )

      // Assert
      // Should check if teacher has access to student
      expect(mockTeacherCollection.findOne).toHaveBeenCalledWith({
        _id: expect.any(ObjectId),
        'teaching.studentIds': studentId.toString(),
        isActive: true
      })
      
      // Should remove association instead of deactivating
      expect(mockStudentCollection.findOneAndUpdate).not.toHaveBeenCalled()
      expect(removeStudentTeacherAssociationSpy).toHaveBeenCalledWith(
        studentId.toString(),
        teacherId
      )
      
      expect(result).toEqual({
        message: 'Student removed from teacher successfully',
        studentId: studentId.toString(),
        teacherId: teacherId.toString()
      })
    })

    it('should throw error when non-admin teacher has no access to student', async () => {
      // Setup
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8d')
      const isAdmin = false
      
      // Mock teacher has NO access to this student
      mockTeacherCollection.findOne.mockResolvedValue(null)

      // Execute & Assert
      await expect(studentService.removeStudent(
        studentId.toString(),
        teacherId,
        isAdmin
      )).rejects.toThrow('Not authorized to remove student')
    })

    it('should throw error if student is not found (admin removal)', async () => {
      // Setup
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const teacherId = null
      const isAdmin = true
      
      mockStudentCollection.findOneAndUpdate.mockResolvedValue(null)

      // Execute & Assert
      await expect(studentService.removeStudent(
        studentId.toString(),
        teacherId,
        isAdmin
      )).rejects.toThrow(`Student with id ${studentId} not found`)
    })

    it('should handle database errors', async () => {
      // Setup
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const teacherId = null
      const isAdmin = true
      
      mockStudentCollection.findOneAndUpdate.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(studentService.removeStudent(
        studentId.toString(),
        teacherId,
        isAdmin
      )).rejects.toThrow(`Error removing student ${studentId}: Database error`)
    })
  })

  describe('checkTeacherHasAccessToStudent', () => {
    it('should return true if teacher has access to student', async () => {
      // Setup
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8d')
      const studentId = '6579e36c83c8b3a5c2df8a8b'
      
      mockTeacherCollection.findOne.mockResolvedValue({
        _id: teacherId,
        teaching: {
          studentIds: [studentId]
        }
      })

      // Execute
      const result = await studentService.checkTeacherHasAccessToStudent(teacherId, studentId)

      // Assert
      expect(mockTeacherCollection.findOne).toHaveBeenCalledWith({
        _id: expect.any(ObjectId),
        'teaching.studentIds': studentId,
        isActive: true
      })
      expect(result).toBe(true)
    })

    it('should return false if teacher has no access to student', async () => {
      // Setup
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8d')
      const studentId = '6579e36c83c8b3a5c2df8a8b'
      
      mockTeacherCollection.findOne.mockResolvedValue(null)

      // Execute
      const result = await studentService.checkTeacherHasAccessToStudent(teacherId, studentId)

      // Assert
      expect(result).toBe(false)
    })

    it('should handle database errors', async () => {
      // Setup
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8d')
      const studentId = '6579e36c83c8b3a5c2df8a8b'
      
      mockTeacherCollection.findOne.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(studentService.checkTeacherHasAccessToStudent(teacherId, studentId))
        .rejects.toThrow('Error checking teacher access to student: Database error')
    })
  })

  describe('associateStudentWithTeacher', () => {
    it('should associate student with teacher', async () => {
      // Setup
      const studentId = '6579e36c83c8b3a5c2df8a8b'
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8d')

      // Execute
      const result = await studentService.associateStudentWithTeacher(studentId, teacherId)

      // Assert
      expect(mockTeacherCollection.updateOne).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        { $addToSet: { 'teaching.studentIds': studentId } }
      )
      expect(result).toEqual({ success: true })
    })

    it('should handle database errors', async () => {
      // Setup
      const studentId = '6579e36c83c8b3a5c2df8a8b'
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8d')
      
      mockTeacherCollection.updateOne.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(studentService.associateStudentWithTeacher(studentId, teacherId))
        .rejects.toThrow('Error associating student with teacher: Database error')
    })
  })

  describe('removeStudentTeacherAssociation', () => {
    it('should remove student from teacher', async () => {
      // Setup
      const studentId = '6579e36c83c8b3a5c2df8a8b'
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8d')

      // Execute
      const result = await studentService.removeStudentTeacherAssociation(studentId, teacherId)

      // Assert
      // Should remove from studentIds array
      expect(mockTeacherCollection.updateOne).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        { $pull: { 'teaching.studentIds': studentId } }
      )
      
      // Should remove from schedule
      expect(mockTeacherCollection.updateOne).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        { $pull: { 'teaching.schedule': { studentId: studentId } } }
      )
      
      expect(result).toEqual({
        message: 'Student removed from teacher successfully',
        studentId,
        teacherId: teacherId.toString()
      })
    })

    it('should handle database errors', async () => {
      // Setup
      const studentId = '6579e36c83c8b3a5c2df8a8b'
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8d')
      
      mockTeacherCollection.updateOne.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(studentService.removeStudentTeacherAssociation(studentId, teacherId))
        .rejects.toThrow('Error removing student from teacher: Database error')
    })
  })

  describe('_buildCriteria', () => {
    it('should build criteria with class filter', () => {
      // Execute
      const criteria = studentService._buildCriteria({ class: 'א' })
      
      // Assert
      expect(criteria).toEqual({
        'academicInfo.class': 'א',
        isActive: true
      })
    })

    it('should build criteria with instrument filter', () => {
      // Execute
      const criteria = studentService._buildCriteria({ instrument: 'Violin' })
      
      // Assert
      expect(criteria).toEqual({
        'academicInfo.instrument': 'Violin',
        isActive: true
      })
    })

    it('should build criteria with stage filter as number', () => {
      // Execute
      const criteria = studentService._buildCriteria({ stage: '3' })
      
      // Assert
      expect(criteria).toEqual({
        'academicInfo.currentStage': 3, // Converted to number
        isActive: true
      })
    })

    it('should build criteria with name filter as regex', () => {
      // Execute
      const criteria = studentService._buildCriteria({ name: 'John' })
      
      // Assert
      expect(criteria).toEqual({
        'personalInfo.fullName': { $regex: 'John', $options: 'i' },
        isActive: true
      })
    })

    it('should build criteria with test status filters', () => {
      // Execute
      const criteria = studentService._buildCriteria({
        technicalTest: 'עבר/ה',
        stageTest: 'לא נבחן'
      })
      
      // Assert
      expect(criteria).toEqual({
        'academicInfo.tests.technicalTest.status': 'עבר/ה',
        'academicInfo.tests.stageTest.status': 'לא נבחן',
        isActive: true
      })
    })

    it('should build criteria with teacher filter', () => {
      // Execute
      const criteria = studentService._buildCriteria({ teacherId: '123' })
      
      // Assert
      expect(criteria).toEqual({
        'enrollments.teachers': {
          $elemMatch: {
            teacherId: '123',
            isActive: true
          }
        },
        isActive: true
      })
    })

    it('should build criteria with orchestra filter', () => {
      // Execute
      const criteria = studentService._buildCriteria({ orchestraId: '456' })
      
      // Assert
      expect(criteria).toEqual({
        'enrollments.orchestras': {
          $elemMatch: {
            orchestraId: '456'
          }
        },
        isActive: true
      })
    })

    it('should build criteria with school year filter', () => {
      // Execute
      const criteria = studentService._buildCriteria({ schoolYearId: '789' })
      
      // Assert
      expect(criteria).toEqual({
        'enrollments.schoolYears': {
          $elemMatch: {
            schoolYearId: '789',
            isActive: true
          }
        },
        isActive: true
      })
    })

    it('should include inactive flag when showInactive is true', () => {
      // Execute
      const criteria = studentService._buildCriteria({ 
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
      const criteria = studentService._buildCriteria({})
      
      // Assert
      expect(criteria).toEqual({
        isActive: true
      })
    })

    it('should combine multiple filters', () => {
      // Execute
      const criteria = studentService._buildCriteria({
        name: 'John',
        instrument: 'Violin',
        stage: '2',
        class: 'ג'
      })
      
      // Assert
      expect(criteria).toEqual({
        'personalInfo.fullName': { $regex: 'John', $options: 'i' },
        'academicInfo.instrument': 'Violin',
        'academicInfo.currentStage': 2,
        'academicInfo.class': 'ג',
        isActive: true
      })
    })
  })
})