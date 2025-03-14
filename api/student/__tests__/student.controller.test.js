// api/student/__tests__/student.controller.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { studentController } from '../student.controller.js'
import { studentService } from '../student.service.js'
import { ObjectId } from 'mongodb'

// Mock dependencies
vi.mock('../student.service.js', () => ({
  studentService: {
    getStudents: vi.fn(),
    getStudentById: vi.fn(),
    addStudent: vi.fn(),
    updateStudent: vi.fn(),
    removeStudent: vi.fn()
  }
}))

describe('Student Controller', () => {
  let req, res, next

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Setup request object
    req = {
      params: {},
      query: {},
      body: {},
      teacher: {
        _id: new ObjectId('6579e36c83c8b3a5c2df8a8b').toString(),
        roles: []
      }
    }

    // Setup response object with chainable methods
    res = {
      status: vi.fn(() => res),
      json: vi.fn(() => res)
    }

    // Setup next function
    next = vi.fn()
  })

  describe('getStudents', () => {
    it('should get all students with correct filters', async () => {
      // Setup
      req.query = {
        name: 'Test Student',
        instrument: 'Violin',
        stage: '3',
        isActive: 'true',
        showInActive: 'true'
      }

      const mockStudents = [
        { _id: '1', personalInfo: { fullName: 'Test Student 1' } },
        { _id: '2', personalInfo: { fullName: 'Test Student 2' } }
      ]
      studentService.getStudents.mockResolvedValue(mockStudents)

      // Execute
      await studentController.getStudents(req, res, next)

      // Assert
      expect(studentService.getStudents).toHaveBeenCalledWith({
        name: 'Test Student',
        instrument: 'Violin',
        stage: '3',
        isActive: 'true',
        showInActive: 'true'
      })
      expect(res.json).toHaveBeenCalledWith(mockStudents)
    })

    it('should handle errors and pass them to next middleware', async () => {
      // Setup
      const error = new Error('Failed to get students')
      studentService.getStudents.mockRejectedValue(error)

      // Execute
      await studentController.getStudents(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })

  describe('getStudentById', () => {
    it('should get a student by ID', async () => {
      // Setup
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      req.params = { id: studentId.toString() }

      const mockStudent = {
        _id: studentId,
        personalInfo: { fullName: 'Test Student' },
        academicInfo: { instrument: 'Violin', currentStage: 3 }
      }
      studentService.getStudentById.mockResolvedValue(mockStudent)

      // Execute
      await studentController.getStudentById(req, res, next)

      // Assert
      expect(studentService.getStudentById).toHaveBeenCalledWith(studentId.toString())
      expect(res.json).toHaveBeenCalledWith(mockStudent)
    })

    it('should handle errors and pass them to next middleware', async () => {
      // Setup
      req.params = { id: 'invalid-id' }
      const error = new Error('Student not found')
      studentService.getStudentById.mockRejectedValue(error)

      // Execute
      await studentController.getStudentById(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })

  describe('addStudent', () => {
    it('should add a new student', async () => {
      // Setup
      const studentToAdd = {
        personalInfo: {
          fullName: 'New Student',
          phone: '0501234567',
          parentName: 'Parent Name'
        },
        academicInfo: {
          instrument: 'Violin',
          currentStage: 1,
          class: 'א'
        }
      }
      req.body = studentToAdd
      req.teacher.roles = ['מנהל'] // Admin role

      const addedStudent = { 
        _id: new ObjectId('6579e36c83c8b3a5c2df8a8b'),
        ...studentToAdd
      }
      studentService.addStudent.mockResolvedValue(addedStudent)

      // Execute
      await studentController.addStudent(req, res, next)

      // Assert
      expect(studentService.addStudent).toHaveBeenCalledWith(
        studentToAdd,
        req.teacher._id,
        true // isAdmin
      )
      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith(addedStudent)
    })

    it('should add student with teacher role (not admin)', async () => {
      // Setup
      const studentToAdd = {
        personalInfo: { fullName: 'New Student' },
        academicInfo: { instrument: 'Violin', currentStage: 1, class: 'א' }
      }
      req.body = studentToAdd
      req.teacher.roles = ['מורה'] // Teacher role, not admin

      const addedStudent = { 
        _id: new ObjectId(),
        ...studentToAdd
      }
      studentService.addStudent.mockResolvedValue(addedStudent)

      // Execute
      await studentController.addStudent(req, res, next)

      // Assert
      expect(studentService.addStudent).toHaveBeenCalledWith(
        studentToAdd,
        req.teacher._id,
        false // Not admin
      )
      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith(addedStudent)
    })

    it('should handle errors and pass them to next middleware', async () => {
      // Setup
      req.body = { invalidData: true }
      const error = new Error('Invalid student data')
      studentService.addStudent.mockRejectedValue(error)

      // Execute
      await studentController.addStudent(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })

  describe('updateStudent', () => {
    it('should update an existing student as admin', async () => {
      // Setup
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      req.params = { id: studentId.toString() }
      
      const studentToUpdate = {
        personalInfo: { fullName: 'Updated Student' },
        academicInfo: { currentStage: 2 }
      }
      req.body = studentToUpdate
      req.teacher.roles = ['מנהל'] // Admin role

      const updatedStudent = { 
        _id: studentId,
        ...studentToUpdate
      }
      studentService.updateStudent.mockResolvedValue(updatedStudent)

      // Execute
      await studentController.updateStudent(req, res, next)

      // Assert
      expect(studentService.updateStudent).toHaveBeenCalledWith(
        studentId.toString(),
        studentToUpdate,
        req.teacher._id,
        true // isAdmin
      )
      expect(res.json).toHaveBeenCalledWith(updatedStudent)
    })

    it('should update student as teacher (not admin)', async () => {
      // Setup
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      req.params = { id: studentId.toString() }
      
      const studentToUpdate = {
        personalInfo: { fullName: 'Updated Student' }
      }
      req.body = studentToUpdate
      req.teacher.roles = ['מורה'] // Teacher role, not admin

      const updatedStudent = { 
        _id: studentId,
        ...studentToUpdate
      }
      studentService.updateStudent.mockResolvedValue(updatedStudent)

      // Execute
      await studentController.updateStudent(req, res, next)

      // Assert
      expect(studentService.updateStudent).toHaveBeenCalledWith(
        studentId.toString(),
        studentToUpdate,
        req.teacher._id,
        false // Not admin
      )
      expect(res.json).toHaveBeenCalledWith(updatedStudent)
    })

    it('should handle errors and pass them to next middleware', async () => {
      // Setup
      req.params = { id: 'invalid-id' }
      req.body = { invalidData: true }
      const error = new Error('Failed to update student')
      studentService.updateStudent.mockRejectedValue(error)

      // Execute
      await studentController.updateStudent(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })

  describe('removeStudent', () => {
    it('should remove (deactivate) a student as admin', async () => {
      // Setup
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      req.params = { id: studentId.toString() }
      req.teacher.roles = ['מנהל'] // Admin role

      const removedStudent = { 
        _id: studentId,
        isActive: false,
        message: 'Student removed successfully'
      }
      studentService.removeStudent.mockResolvedValue(removedStudent)

      // Execute
      await studentController.removeStudent(req, res, next)

      // Assert
      expect(studentService.removeStudent).toHaveBeenCalledWith(
        studentId.toString(),
        req.teacher._id,
        true // isAdmin
      )
      expect(res.json).toHaveBeenCalledWith(removedStudent)
    })

    it('should remove student as teacher (not admin)', async () => {
      // Setup
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      req.params = { id: studentId.toString() }
      req.teacher.roles = ['מורה'] // Teacher role, not admin

      const result = { 
        message: 'Student removed from teacher successfully',
        studentId: studentId.toString(),
        teacherId: req.teacher._id
      }
      studentService.removeStudent.mockResolvedValue(result)

      // Execute
      await studentController.removeStudent(req, res, next)

      // Assert
      expect(studentService.removeStudent).toHaveBeenCalledWith(
        studentId.toString(),
        req.teacher._id,
        false // Not admin
      )
      expect(res.json).toHaveBeenCalledWith(result)
    })

    it('should handle errors and pass them to next middleware', async () => {
      // Setup
      req.params = { id: 'invalid-id' }
      const error = new Error('Failed to remove student')
      studentService.removeStudent.mockRejectedValue(error)

      // Execute
      await studentController.removeStudent(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })
})