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

// Mock school year service with ES module compatible approach
vi.mock('../../school-year/school-year.service.js', async () => {
  const schoolYearService = {
    getCurrentSchoolYear: vi.fn().mockResolvedValue({
      _id: new ObjectId('6579e36c83c8b3a5c2df8a8d'),
      name: '2023-2024',
      isCurrent: true
    })
  }
  return { schoolYearService }
})

describe('Student Service', () => {
  let mockStudentCollection, mockTeacherCollection, mockFind, mockFindOne, mockInsertOne, mockFindOneAndUpdate, mockUpdateOne

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Setup MongoDB collection mock methods
    mockFind = vi.fn().mockReturnThis()
    mockFindOne = vi.fn()
    mockInsertOne = vi.fn()
    mockFindOneAndUpdate = vi.fn()
    mockUpdateOne = vi.fn()
    
    mockStudentCollection = {
      find: mockFind,
      toArray: vi.fn(),
      findOne: mockFindOne,
      insertOne: mockInsertOne,
      findOneAndUpdate: mockFindOneAndUpdate
    }
    
    mockTeacherCollection = {
      findOne: vi.fn(),
      updateOne: mockUpdateOne
    }
    
    // Properly chain the find and toArray methods
    mockFind.mockReturnValue({
      toArray: mockStudentCollection.toArray
    })
    
    // Mock getCollection to return different collections based on name
    getCollection.mockImplementation((name) => {
      if (name === 'teacher') {
        return Promise.resolve(mockTeacherCollection)
      }
      return Promise.resolve(mockStudentCollection)
    })
  })

  describe('getStudents', () => {
    it('should get all students with default filter', async () => {
      // Setup
      const mockStudents = [
        { _id: '1', personalInfo: { fullName: 'Student 1' } },
        { _id: '2', personalInfo: { fullName: 'Student 2' } }
      ]
      
      mockStudentCollection.toArray.mockResolvedValue(mockStudents)

      // Execute
      const result = await studentService.getStudents({})

      // Assert
      expect(mockStudentCollection.find).toHaveBeenCalledWith(expect.objectContaining({
        isActive: true
      }))
      expect(result).toEqual(mockStudents)
    })

    it('should apply name filter correctly', async () => {
      // Setup
      const filterBy = { name: 'Student 1' }
      mockStudentCollection.toArray.mockResolvedValue([])

      // Execute
      await studentService.getStudents(filterBy)

      // Assert
      expect(mockStudentCollection.find).toHaveBeenCalledWith(expect.objectContaining({
        'personalInfo.fullName': { $regex: 'Student 1', $options: 'i' }
      }))
    })

    it('should apply instrument filter correctly', async () => {
      // Setup
      const filterBy = { instrument: 'חצוצרה' }
      mockStudentCollection.toArray.mockResolvedValue([])

      // Execute
      await studentService.getStudents(filterBy)

      // Assert
      expect(mockStudentCollection.find).toHaveBeenCalledWith(expect.objectContaining({
        'academicInfo.instrument': 'חצוצרה'
      }))
    })

    it('should apply stage filter correctly', async () => {
      // Setup
      const filterBy = { stage: '3' }
      mockStudentCollection.toArray.mockResolvedValue([])

      // Execute
      await studentService.getStudents(filterBy)

      // Assert
      expect(mockStudentCollection.find).toHaveBeenCalledWith(expect.objectContaining({
        'academicInfo.currentStage': 3
      }))
    })

    it('should include inactive students when showInactive is true', async () => {
      // Setup
      const filterBy = { showInactive: true, isActive: false }
      mockStudentCollection.toArray.mockResolvedValue([])

      // Execute
      await studentService.getStudents(filterBy)

      // Assert
      expect(mockStudentCollection.find).toHaveBeenCalledWith(expect.objectContaining({
        isActive: false
      }))
    })

    it('should handle database errors', async () => {
      // Setup
      mockStudentCollection.toArray.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(studentService.getStudents({}))
        .rejects.toThrow('Error getting students: Database error')
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
      
      mockFindOne.mockResolvedValue(mockStudent)

      // Execute
      const result = await studentService.getStudentById(studentId.toString())

      // Assert
      expect(mockFindOne).toHaveBeenCalledWith({ 
        _id: expect.anything() // Using expect.anything() instead of expect.any(ObjectId)
      })
      expect(result).toEqual(mockStudent)
    })

    it('should throw error if student is not found', async () => {
      // Setup
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      mockFindOne.mockResolvedValue(null)

      // Execute & Assert
      await expect(studentService.getStudentById(studentId.toString()))
        .rejects.toThrow(`Error getting student by id: Student with id ${studentId} not found`)
    })

    it('should handle database errors', async () => {
      // Setup
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      mockFindOne.mockRejectedValue(new Error('Database error'))

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
          instrument: 'חצוצרה',
          currentStage: 1,
          class: 'א'
        },
        enrollments: {
          schoolYears: []
        }
      }
      
      const validationResult = {
        error: null,
        value: { ...studentToAdd }
      }
      
      validateStudent.mockReturnValue(validationResult)
      
      const insertedId = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      mockInsertOne.mockResolvedValue({ insertedId })

      // Execute
      const result = await studentService.addStudent(studentToAdd)

      // Assert
      expect(validateStudent).toHaveBeenCalledWith(studentToAdd)
      expect(mockInsertOne).toHaveBeenCalled()
      expect(result).toHaveProperty('_id', insertedId)
    })

    it('should associate student with teacher if teacherId is provided', async () => {
      // Setup
      const studentToAdd = {
        personalInfo: {
          fullName: 'New Student',
          phone: '0501234567'
        },
        academicInfo: {
          instrument: 'חצוצרה',
          currentStage: 1,
          class: 'א'
        },
        enrollments: {
          schoolYears: []
        }
      }
      
      const validationResult = {
        error: null,
        value: { ...studentToAdd }
      }
      
      validateStudent.mockReturnValue(validationResult)
      
      const insertedId = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      mockInsertOne.mockResolvedValue({ insertedId })
      
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const isAdmin = false
      
      // Mock updateOne for associateStudentWithTeacher
      mockUpdateOne.mockResolvedValue({ modifiedCount: 1 })

      // Execute
      const result = await studentService.addStudent(studentToAdd, teacherId.toString(), isAdmin)

      // Assert
      expect(validateStudent).toHaveBeenCalledWith(studentToAdd)
      expect(mockInsertOne).toHaveBeenCalled()
      expect(mockUpdateOne).toHaveBeenCalledWith(
        { _id: expect.anything() },
        { $addToSet: { 'teaching.studentIds': insertedId.toString() } }
      )
      expect(result).toHaveProperty('_id', insertedId)
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
      
      const updatedStudent = {
        _id: studentId,
        personalInfo: {
          fullName: 'Updated Student',
          phone: '0501234567'
        },
        academicInfo: {
          currentStage: 2
        },
        updatedAt: new Date()
      }
      
      mockFindOneAndUpdate.mockResolvedValue(updatedStudent)

      // Execute - Test admin update
      const result = await studentService.updateStudent(studentId.toString(), studentToUpdate, null, true)

      // Assert
      expect(validateStudent).toHaveBeenCalledWith(studentToUpdate, true)
      expect(mockFindOneAndUpdate).toHaveBeenCalled()
      expect(result).toEqual(updatedStudent)
    })

    it('should check access when non-admin teacher updates a student', async () => {
      // Setup
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      const isAdmin = false
      
      const studentToUpdate = {
        personalInfo: {
          fullName: 'Updated Student'
        }
      }
      
      const validationResult = {
        error: null,
        value: studentToUpdate
      }
      
      validateStudent.mockReturnValue(validationResult)
      
      // Mock teacher has access
      mockTeacherCollection.findOne.mockResolvedValue({
        _id: teacherId,
        teaching: { studentIds: [studentId.toString()] }
      })
      
      const updatedStudent = {
        _id: studentId,
        personalInfo: {
          fullName: 'Updated Student'
        },
        updatedAt: new Date()
      }
      
      mockFindOneAndUpdate.mockResolvedValue(updatedStudent)

      // Execute
      const result = await studentService.updateStudent(
        studentId.toString(), 
        studentToUpdate,
        teacherId.toString(),
        isAdmin
      )

      // Assert
      expect(mockTeacherCollection.findOne).toHaveBeenCalledWith({
        _id: expect.anything(),
        'teaching.studentIds': studentId.toString(),
        isActive: true
      })
      expect(mockFindOneAndUpdate).toHaveBeenCalled()
      expect(result).toEqual(updatedStudent)
    })

    it('should throw error when non-admin teacher has no access to student', async () => {
      // Setup
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      const isAdmin = false
      
      const studentToUpdate = {
        personalInfo: {
          fullName: 'Updated Student'
        }
      }
      
      const validationResult = {
        error: null,
        value: studentToUpdate
      }
      
      validateStudent.mockReturnValue(validationResult)
      
      // Mock teacher has NO access
      mockTeacherCollection.findOne.mockResolvedValue(null)

      // Execute & Assert
      await expect(studentService.updateStudent(
        studentId.toString(),
        studentToUpdate,
        teacherId.toString(),
        isAdmin
      )).rejects.toThrow('Error updating student: Not authorized to update student')
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
        .rejects.toThrow('Error updating student: Invalid student data: Invalid student data')
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
      mockFindOneAndUpdate.mockResolvedValue(null)

      // Execute & Assert
      await expect(studentService.updateStudent(studentId.toString(), studentToUpdate, null, true))
        .rejects.toThrow(`Error updating student: Student with id ${studentId} not found`)
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
      
      // Mock findOneAndUpdate to throw a database error 
      mockFindOneAndUpdate.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(studentService.updateStudent(studentId.toString(), studentToUpdate, null, true))
        .rejects.toThrow('Error updating student: Database error')
    })
  })

  describe('removeStudent', () => {
    it('should deactivate a student (soft delete) by admin', async () => {
      // Setup
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const isAdmin = true
      
      const deactivatedStudent = {
        _id: studentId,
        personalInfo: { fullName: 'Deactivated Student' },
        isActive: false,
        updatedAt: new Date()
      }
      
      mockFindOneAndUpdate.mockResolvedValue(deactivatedStudent)

      // Execute
      const result = await studentService.removeStudent(studentId.toString(), null, isAdmin)

      // Assert
      expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
        { _id: expect.anything() },
        { $set: expect.objectContaining({
          isActive: false,
          updatedAt: expect.any(Date)
        })},
        { returnDocument: 'after' }
      )
      expect(result).toEqual(deactivatedStudent)
    })

    it('should remove student-teacher association when non-admin removes a student', async () => {
      // Setup
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      const isAdmin = false
      
      // Mock teacher has access
      mockTeacherCollection.findOne.mockResolvedValue({
        _id: teacherId,
        teaching: { studentIds: [studentId.toString()] }
      })
      
      // Mock the update operations
      mockUpdateOne.mockResolvedValue({ modifiedCount: 1 })

      // Execute
      await studentService.removeStudent(studentId.toString(), teacherId.toString(), isAdmin)

      // Assert
      expect(mockTeacherCollection.findOne).toHaveBeenCalledWith({
        _id: expect.anything(),
        'teaching.studentIds': studentId.toString(),
        isActive: true
      })
      
      // Should call updateOne to remove studentId from teaching.studentIds
      expect(mockUpdateOne).toHaveBeenCalledWith(
        { _id: expect.anything() },
        { $pull: { 'teaching.studentIds': studentId.toString() } }
      )
    })

    it('should throw error when non-admin teacher has no access to student', async () => {
      // Setup
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      const isAdmin = false
      
      // Mock teacher has NO access
      mockTeacherCollection.findOne.mockResolvedValue(null)

      // Execute & Assert
      await expect(studentService.removeStudent(
        studentId.toString(),
        teacherId.toString(),
        isAdmin
      )).rejects.toThrow('Not authorized to remove student')
    })

    it('should throw error if student is not found (admin removal)', async () => {
      // Setup
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const isAdmin = true
      
      mockFindOneAndUpdate.mockResolvedValue(null)

      // Execute & Assert
      await expect(studentService.removeStudent(studentId.toString(), null, isAdmin))
        .rejects.toThrow(`Student with id ${studentId} not found`)
    })

    it('should handle database errors', async () => {
      // Setup
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const isAdmin = true
      
      mockFindOneAndUpdate.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(studentService.removeStudent(studentId.toString(), null, isAdmin))
        .rejects.toThrow(`Database error`)
    })
  })

  describe('checkTeacherHasAccessToStudent', () => {
    it('should return true if teacher has access to student', async () => {
      // Setup
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      
      // Mock the teacher collection to find a teacher with this student
      mockTeacherCollection.findOne.mockResolvedValue({
        _id: teacherId,
        teaching: {
          studentIds: [studentId.toString()]
        }
      })

      // Execute
      const result = await studentService.checkTeacherHasAccessToStudent(
        teacherId.toString(),
        studentId.toString()
      )

      // Assert
      expect(mockTeacherCollection.findOne).toHaveBeenCalledWith({
        _id: expect.anything(),
        'teaching.studentIds': studentId.toString(),
        isActive: true
      })
      expect(result).toBe(true)
    })

    it('should return false if teacher has no access to student', async () => {
      // Setup
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      
      // Teacher not found with this student
      mockTeacherCollection.findOne.mockResolvedValue(null)

      // Execute
      const result = await studentService.checkTeacherHasAccessToStudent(
        teacherId.toString(),
        studentId.toString()
      )

      // Assert
      expect(mockTeacherCollection.findOne).toHaveBeenCalled()
      expect(result).toBe(false)
    })

    it('should handle database errors', async () => {
      // Setup
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      
      mockTeacherCollection.findOne.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(studentService.checkTeacherHasAccessToStudent(
        teacherId.toString(),
        studentId.toString()
      )).rejects.toThrow('Error checking teacher access to student: Database error')
    })
  })

  describe('associateStudentWithTeacher', () => {
    it('should associate student with teacher', async () => {
      // Setup
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      
      mockUpdateOne.mockResolvedValue({ modifiedCount: 1 })

      // Execute
      const result = await studentService.associateStudentWithTeacher(
        studentId.toString(),
        teacherId.toString()
      )

      // Assert
      expect(mockUpdateOne).toHaveBeenCalledWith(
        { _id: expect.anything() },
        { $addToSet: { 'teaching.studentIds': studentId.toString() } }
      )
      expect(result).toMatchObject({
        success: true,
        studentId: studentId.toString(),
        teacherId: teacherId.toString()
      })
    })

    it('should handle database errors', async () => {
      // Setup
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      
      mockUpdateOne.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(studentService.associateStudentWithTeacher(
        studentId.toString(),
        teacherId.toString()
      )).rejects.toThrow('Error associating student with teacher: Database error')
    })
  })

  describe('removeStudentTeacherAssociation', () => {
    it('should remove student from teacher', async () => {
      // Setup
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      
      mockUpdateOne.mockResolvedValue({ modifiedCount: 1 })

      // Execute
      const result = await studentService.removeStudentTeacherAssociation(
        studentId.toString(),
        teacherId.toString()
      )

      // Assert
      // Should remove from studentIds array
      expect(mockUpdateOne).toHaveBeenCalledWith(
        { _id: expect.anything() },
        { $pull: { 'teaching.studentIds': studentId.toString() } }
      )
      // Should also remove from schedule
      expect(mockUpdateOne).toHaveBeenCalledWith(
        { _id: expect.anything() },
        { $pull: { 'teaching.schedule': { studentId: studentId.toString() } } }
      )
      expect(result).toMatchObject({
        message: 'Student removed from teacher successfully',
        studentId: studentId.toString(),
        teacherId: teacherId.toString()
      })
    })

    it('should handle database errors', async () => {
      // Setup
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      
      mockUpdateOne.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(studentService.removeStudentTeacherAssociation(
        studentId.toString(),
        teacherId.toString()
      )).rejects.toThrow('Error removing student from teacher: Database error')
    })
  })

  // Filter building functionality tests
  describe('Filter building functionality', () => {
    it('should build criteria with class filter', async () => {
      // Setup
      const filterBy = { class: 'א' }
      mockStudentCollection.toArray.mockResolvedValue([])

      // Execute
      await studentService.getStudents(filterBy)

      // Assert
      expect(mockStudentCollection.find).toHaveBeenCalledWith(expect.objectContaining({
        'academicInfo.class': 'א',
        isActive: true
      }))
    })

    it('should build criteria with orchestra filter', async () => {
      // Setup
      const filterBy = { orchestraId: 'orchestra1' }
      mockStudentCollection.toArray.mockResolvedValue([])

      // Execute
      await studentService.getStudents(filterBy)

      // Assert
      expect(mockStudentCollection.find).toHaveBeenCalled()
    })

    it('should build criteria with school year filter', async () => {
      // Setup
      const filterBy = { schoolYearId: 'year1' }
      mockStudentCollection.toArray.mockResolvedValue([])

      // Execute
      await studentService.getStudents(filterBy)

      // Assert
      expect(mockStudentCollection.find).toHaveBeenCalled()
    })
  })
})