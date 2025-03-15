import { describe, it, expect, vi, beforeEach } from 'vitest'
import { studentController } from '../student.controller.js'
import { studentService } from '../student.service.js'
import { ObjectId } from 'mongodb'

// Mock the student service
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
        _id: new ObjectId('6579e36c83c8b3a5c2df8a8b'),
        roles: ['מורה']
      },
      isAdmin: false
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
        { _id: '1', personalInfo: { fullName: 'Student 1' } },
        { _id: '2', personalInfo: { fullName: 'Student 2' } }
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
        showInactive: true  // This should match what the controller passes
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
        personalInfo: { fullName: 'Test Student' }
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
      // Setup - Admin user
      req.teacher.roles = ['מנהל']
      
      const studentToAdd = {
        personalInfo: { fullName: 'New Student' },
        academicInfo: { instrument: 'Violin', currentStage: 1, class: 'א' }
      }
      req.body = studentToAdd

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
        req.teacher._id.toString(),
        true // isAdmin should be true for this test
      )
      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith(addedStudent)
    })

    it('should add student with teacher role (not admin)', async () => {
      // Setup - Teacher (not admin)
      req.teacher = { 
        _id: new ObjectId('6579e36c83c8b3a5c2df8a8b'),
        roles: ['מורה']
      }
      
      const studentToAdd = {
        personalInfo: { fullName: 'New Student' },
        academicInfo: { instrument: 'Violin', currentStage: 1, class: 'א' }
      }
      req.body = studentToAdd

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
        req.teacher._id.toString(),
        false // isAdmin should be false for this test
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
      // Setup - Admin user
      req.teacher.roles = ['מנהל']
      
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      req.params = { id: studentId.toString() }
      
      const studentToUpdate = {
        personalInfo: { fullName: 'Updated Student' },
        academicInfo: { instrument: 'Violin', currentStage: 2, class: 'ב' }
      }
      req.body = studentToUpdate

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
        req.teacher._id.toString(),
        true // isAdmin should be true for this test
      )
      expect(res.json).toHaveBeenCalledWith(updatedStudent)
    })

    it('should update student as teacher (not admin)', async () => {
      // Setup - Teacher (not admin)
      req.teacher = { 
        _id: new ObjectId('6579e36c83c8b3a5c2df8a8b'),
        roles: ['מורה']
      }
      
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      req.params = { id: studentId.toString() }
      
      const studentToUpdate = {
        personalInfo: { fullName: 'Updated Student' },
        academicInfo: { instrument: 'Violin', currentStage: 2, class: 'ב' }
      }
      req.body = studentToUpdate

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
        req.teacher._id.toString(),
        false // isAdmin should be false for this test
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
      // Setup - Admin user
      req.teacher.roles = ['מנהל']
      
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      req.params = { id: studentId.toString() }

      const removedStudent = { 
        _id: studentId,
        personalInfo: { fullName: 'Removed Student' },
        isActive: false
      }
      studentService.removeStudent.mockResolvedValue(removedStudent)

      // Execute
      await studentController.removeStudent(req, res, next)

      // Assert
      expect(studentService.removeStudent).toHaveBeenCalledWith(
        studentId.toString(),
        req.teacher._id.toString(),
        true // isAdmin should be true for this test
      )
      expect(res.json).toHaveBeenCalledWith(removedStudent)
    })

    it('should remove student as teacher (not admin)', async () => {
      // Setup - Teacher (not admin)
      req.teacher = { 
        _id: new ObjectId('6579e36c83c8b3a5c2df8a8b'),
        roles: ['מורה']
      }
      
      const studentId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      req.params = { id: studentId.toString() }

      const removedStudent = { 
        _id: studentId,
        personalInfo: { fullName: 'Removed Student' },
        isActive: false
      }
      studentService.removeStudent.mockResolvedValue(removedStudent)

      // Execute
      await studentController.removeStudent(req, res, next)

      // Assert
      expect(studentService.removeStudent).toHaveBeenCalledWith(
        studentId.toString(),
        req.teacher._id.toString(),
        false // isAdmin should be false for this test
      )
      expect(res.json).toHaveBeenCalledWith(removedStudent)
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