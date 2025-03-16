import { describe, it, expect, vi, beforeEach } from 'vitest'
import { orchestraController } from '../orchestra.controller.js'
import { orchestraService } from '../orchestra.service.js'
import { ObjectId } from 'mongodb'

// Mock dependencies
vi.mock('../orchestra.service.js', () => ({
  orchestraService: {
    getOrchestras: vi.fn(),
    getOrchestraById: vi.fn(),
    addOrchestra: vi.fn(),
    updateOrchestra: vi.fn(),
    removeOrchestra: vi.fn(),
    addMember: vi.fn(),
    removeMember: vi.fn(),
    updateRehearsalAttendance: vi.fn(),
    getRehearsalAttendance: vi.fn(),
    getStudentAttendanceStats: vi.fn()
  }
}))

describe('Orchestra Controller', () => {
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

  describe('getOrchestras', () => {
    it('should get all orchestras with correct filters', async () => {
      // Setup
      req.query = {
        name: 'Test Orchestra',
        type: 'תזמורת',
        conductorId: '123',
        memberIds: '456',
        isActive: 'true',
        showInactive: 'true'
      }

      const mockOrchestras = [
        { _id: '1', name: 'Orchestra 1', type: 'תזמורת' },
        { _id: '2', name: 'Orchestra 2', type: 'תזמורת' }
      ]
      orchestraService.getOrchestras.mockResolvedValue(mockOrchestras)

      // Execute
      await orchestraController.getOrchestras(req, res, next)

      // Assert - Updated to match the actual property name in the controller
      expect(orchestraService.getOrchestras).toHaveBeenCalledWith({
        name: 'Test Orchestra',
        type: 'תזמורת',
        conductorId: '123',
        memberIds: '456',
        isActive: 'true',
        showInActive: true // Matches the actual property name with capital 'A'
      })
      expect(res.json).toHaveBeenCalledWith(mockOrchestras)
    })

    it('should handle errors and pass them to next middleware', async () => {
      // Setup
      const error = new Error('Failed to get orchestras')
      orchestraService.getOrchestras.mockRejectedValue(error)

      // Execute
      await orchestraController.getOrchestras(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })

  describe('getOrchestraById', () => {
    it('should get an orchestra by ID', async () => {
      // Setup
      const orchestraId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      req.params = { id: orchestraId.toString() }

      const mockOrchestra = {
        _id: orchestraId,
        name: 'Test Orchestra',
        type: 'תזמורת',
        conductorId: '123',
        memberIds: ['456', '789']
      }
      orchestraService.getOrchestraById.mockResolvedValue(mockOrchestra)

      // Execute
      await orchestraController.getOrchestraById(req, res, next)

      // Assert
      expect(orchestraService.getOrchestraById).toHaveBeenCalledWith(orchestraId.toString())
      expect(res.json).toHaveBeenCalledWith(mockOrchestra)
    })

    it('should handle errors and pass them to next middleware', async () => {
      // Setup
      req.params = { id: 'invalid-id' }
      const error = new Error('Orchestra not found')
      orchestraService.getOrchestraById.mockRejectedValue(error)

      // Execute
      await orchestraController.getOrchestraById(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })

  describe('addOrchestra', () => {
    it('should add a new orchestra', async () => {
      // Setup
      const orchestraToAdd = {
        name: 'New Orchestra',
        type: 'תזמורת',
        conductorId: '123'
      }
      req.body = orchestraToAdd

      const addedOrchestra = { 
        _id: new ObjectId(),
        ...orchestraToAdd
      }
      orchestraService.addOrchestra.mockResolvedValue(addedOrchestra)

      // Execute
      await orchestraController.addOrchestra(req, res, next)

      // Assert
      expect(orchestraService.addOrchestra).toHaveBeenCalledWith(orchestraToAdd)
      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith(addedOrchestra)
    })

    it('should handle errors and pass them to next middleware', async () => {
      // Setup
      req.body = { invalidData: true }
      const error = new Error('Invalid orchestra data')
      orchestraService.addOrchestra.mockRejectedValue(error)

      // Execute
      await orchestraController.addOrchestra(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })

  describe('updateOrchestra', () => {
    it('should update an existing orchestra', async () => {
      // Setup
      const orchestraId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      req.params = { id: orchestraId.toString() }
      
      const orchestraUpdates = {
        name: 'Updated Orchestra',
        type: 'תזמורת'
      }
      req.body = orchestraUpdates

      req.teacher._id = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      req.teacher.roles = ['מנהל']

      const updatedOrchestra = { 
        _id: orchestraId,
        ...orchestraUpdates
      }
      orchestraService.updateOrchestra.mockResolvedValue(updatedOrchestra)

      // Execute
      await orchestraController.updateOrchestra(req, res, next)

      // Assert
      expect(orchestraService.updateOrchestra).toHaveBeenCalledWith(
        orchestraId.toString(), 
        orchestraUpdates,
        req.teacher._id,
        true // isAdmin
      )
      expect(res.json).toHaveBeenCalledWith(updatedOrchestra)
    })

    it('should return 403 if not authorized to modify orchestra', async () => {
      // Setup
      const orchestraId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      req.params = { id: orchestraId.toString() }
      req.body = { name: 'Updated Orchestra' }
      req.teacher._id = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      req.teacher.roles = ['מורה'] // Not an admin

      const error = new Error('Not authorized to modify this orchestra')
      orchestraService.updateOrchestra.mockRejectedValue(error)

      // Execute
      await orchestraController.updateOrchestra(req, res, next)

      // Assert
      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({ error: error.message })
      expect(next).not.toHaveBeenCalled()
    })

    it('should handle other errors and pass them to next middleware', async () => {
      // Setup
      req.params = { id: 'invalid-id' }
      req.body = { invalidData: true }
      req.teacher.roles = ['מנהל']
      
      const error = new Error('Failed to update orchestra')
      orchestraService.updateOrchestra.mockRejectedValue(error)

      // Execute
      await orchestraController.updateOrchestra(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })

  describe('removeOrchestra', () => {
    it('should remove (deactivate) an orchestra', async () => {
      // Setup
      const orchestraId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      req.params = { id: orchestraId.toString() }
      req.teacher._id = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      req.teacher.roles = ['מנהל']

      const removedOrchestra = { 
        _id: orchestraId,
        name: 'Removed Orchestra',
        isActive: false
      }
      orchestraService.removeOrchestra.mockResolvedValue(removedOrchestra)

      // Execute
      await orchestraController.removeOrchestra(req, res, next)

      // Assert
      expect(orchestraService.removeOrchestra).toHaveBeenCalledWith(
        orchestraId.toString(),
        req.teacher._id,
        true // isAdmin
      )
      expect(res.json).toHaveBeenCalledWith(removedOrchestra)
    })

    it('should return 403 if not authorized to remove orchestra', async () => {
      // Setup
      const orchestraId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      req.params = { id: orchestraId.toString() }
      req.teacher._id = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      req.teacher.roles = ['מורה'] // Not an admin

      const error = new Error('Not authorized to modify this orchestra')
      orchestraService.removeOrchestra.mockRejectedValue(error)

      // Execute
      await orchestraController.removeOrchestra(req, res, next)

      // Assert
      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({ error: error.message })
      expect(next).not.toHaveBeenCalled()
    })

    it('should handle other errors and pass them to next middleware', async () => {
      // Setup
      req.params = { id: 'invalid-id' }
      req.teacher.roles = ['מנהל']
      
      const error = new Error('Failed to remove orchestra')
      orchestraService.removeOrchestra.mockRejectedValue(error)

      // Execute
      await orchestraController.removeOrchestra(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })

  describe('addMember', () => {
    it('should add a member to an orchestra', async () => {
      // Setup
      const orchestraId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      req.params = { id: orchestraId.toString() }
      
      const studentId = '123456'
      req.body = { studentId }

      req.teacher._id = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      req.teacher.roles = ['מנהל']

      const updatedOrchestra = { 
        _id: orchestraId,
        name: 'Test Orchestra',
        memberIds: ['123', '456', studentId]
      }
      orchestraService.addMember.mockResolvedValue(updatedOrchestra)

      // Execute
      await orchestraController.addMember(req, res, next)

      // Assert
      expect(orchestraService.addMember).toHaveBeenCalledWith(
        orchestraId.toString(), 
        studentId,
        req.teacher._id,
        true // isAdmin
      )
      expect(res.json).toHaveBeenCalledWith(updatedOrchestra)
    })

    it('should return 403 if not authorized to add member', async () => {
      // Setup
      const orchestraId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      req.params = { id: orchestraId.toString() }
      req.body = { studentId: '123456' }
      req.teacher._id = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      req.teacher.roles = ['מורה'] // Not an admin

      const error = new Error('Not authorized to modify this orchestra')
      orchestraService.addMember.mockRejectedValue(error)

      // Execute
      await orchestraController.addMember(req, res, next)

      // Assert
      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({ error: error.message })
      expect(next).not.toHaveBeenCalled()
    })

    it('should handle other errors and pass them to next middleware', async () => {
      // Setup
      req.params = { id: 'invalid-id' }
      req.body = { studentId: 'invalid-student' }
      req.teacher.roles = ['מנהל']
      
      const error = new Error('Failed to add member')
      orchestraService.addMember.mockRejectedValue(error)

      // Execute
      await orchestraController.addMember(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })

  describe('removeMember', () => {
    it('should remove a member from an orchestra', async () => {
      // Setup
      const orchestraId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const studentId = '123456'
      req.params = { 
        id: orchestraId.toString(),
        studentId
      }

      req.teacher._id = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      req.teacher.roles = ['מנהל']

      const updatedOrchestra = { 
        _id: orchestraId,
        name: 'Test Orchestra',
        memberIds: ['123', '456'] // studentId removed
      }
      orchestraService.removeMember.mockResolvedValue(updatedOrchestra)

      // Execute
      await orchestraController.removeMember(req, res, next)

      // Assert
      expect(orchestraService.removeMember).toHaveBeenCalledWith(
        orchestraId.toString(), 
        studentId,
        req.teacher._id,
        true // isAdmin
      )
      expect(res.json).toHaveBeenCalledWith(updatedOrchestra)
    })

    it('should return 403 if not authorized to remove member', async () => {
      // Setup
      const orchestraId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      req.params = { 
        id: orchestraId.toString(),
        studentId: '123456'
      }
      req.teacher._id = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      req.teacher.roles = ['מורה'] // Not an admin

      const error = new Error('Not authorized to modify this orchestra')
      orchestraService.removeMember.mockRejectedValue(error)

      // Execute
      await orchestraController.removeMember(req, res, next)

      // Assert
      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({ error: error.message })
      expect(next).not.toHaveBeenCalled()
    })

    it('should handle other errors and pass them to next middleware', async () => {
      // Setup
      req.params = { 
        id: 'invalid-id',
        studentId: 'invalid-student'
      }
      req.teacher.roles = ['מנהל']
      
      const error = new Error('Failed to remove member')
      orchestraService.removeMember.mockRejectedValue(error)

      // Execute
      await orchestraController.removeMember(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })

  describe('updateRehearsalAttendance', () => {
    it('should update rehearsal attendance', async () => {
      // Setup
      const orchestraId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const rehearsalId = new ObjectId('6579e36c83c8b3a5c2df8a8d')
      req.params = { 
        id: orchestraId.toString(),
        rehearsalId: rehearsalId.toString()
      }
      
      const attendance = {
        present: ['123', '456'],
        absent: ['789']
      }
      req.body = attendance

      req.teacher._id = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      req.teacher.roles = ['מנהל']

      const updatedRehearsal = { 
        _id: rehearsalId,
        groupId: orchestraId.toString(),
        date: new Date(),
        attendance
      }
      orchestraService.updateRehearsalAttendance.mockResolvedValue(updatedRehearsal)

      // Execute
      await orchestraController.updateRehearsalAttendance(req, res, next)

      // Assert
      expect(orchestraService.updateRehearsalAttendance).toHaveBeenCalledWith(
        rehearsalId.toString(), 
        attendance,
        req.teacher._id,
        true // isAdmin
      )
      expect(res.json).toHaveBeenCalledWith(updatedRehearsal)
    })

    it('should return 403 if not authorized to update attendance', async () => {
      // Setup
      req.params = { 
        id: new ObjectId().toString(),
        rehearsalId: new ObjectId().toString()
      }
      req.body = { present: [], absent: [] }
      req.teacher._id = new ObjectId()
      req.teacher.roles = ['מורה'] // Not an admin

      const error = new Error('Not authorized to modify this orchestra')
      orchestraService.updateRehearsalAttendance.mockRejectedValue(error)

      // Execute
      await orchestraController.updateRehearsalAttendance(req, res, next)

      // Assert
      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({ error: error.message })
      expect(next).not.toHaveBeenCalled()
    })

    it('should handle other errors and pass them to next middleware', async () => {
      // Setup
      req.params = { 
        id: new ObjectId().toString(),
        rehearsalId: new ObjectId().toString()
      }
      req.body = { invalidData: true }
      req.teacher.roles = ['מנהל']
      
      const error = new Error('Failed to update attendance')
      orchestraService.updateRehearsalAttendance.mockRejectedValue(error)

      // Execute
      await orchestraController.updateRehearsalAttendance(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })

  describe('getRehearsalAttendance', () => {
    it('should get rehearsal attendance', async () => {
      // Setup
      const rehearsalId = new ObjectId('6579e36c83c8b3a5c2df8a8d')
      req.params = { rehearsalId: rehearsalId.toString() }
      
      const attendance = {
        present: ['123', '456'],
        absent: ['789']
      }
      orchestraService.getRehearsalAttendance.mockResolvedValue(attendance)

      // Execute
      await orchestraController.getRehearsalAttendance(req, res, next)

      // Assert
      expect(orchestraService.getRehearsalAttendance).toHaveBeenCalledWith(rehearsalId.toString())
      expect(res.json).toHaveBeenCalledWith(attendance)
    })

    it('should handle errors and pass them to next middleware', async () => {
      // Setup
      req.params = { rehearsalId: 'invalid-id' }
      const error = new Error('Rehearsal not found')
      orchestraService.getRehearsalAttendance.mockRejectedValue(error)

      // Execute
      await orchestraController.getRehearsalAttendance(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })

  describe('getStudentAttendanceStats', () => {
    it('should get student attendance statistics', async () => {
      // Setup
      const orchestraId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const studentId = '123456'
      req.params = { 
        orchestraId: orchestraId.toString(),
        studentId
      }
      
      const stats = {
        totalRehearsals: 10,
        attended: 8,
        attendanceRate: 80,
        recentHistory: []
      }
      orchestraService.getStudentAttendanceStats.mockResolvedValue(stats)

      // Execute
      await orchestraController.getStudentAttendanceStats(req, res, next)

      // Assert
      expect(orchestraService.getStudentAttendanceStats).toHaveBeenCalledWith(
        orchestraId.toString(),
        studentId
      )
      expect(res.json).toHaveBeenCalledWith(stats)
    })

    it('should handle errors and pass them to next middleware', async () => {
      // Setup
      req.params = { 
        orchestraId: 'invalid-id',
        studentId: 'invalid-student'
      }
      const error = new Error('Failed to get attendance stats')
      orchestraService.getStudentAttendanceStats.mockRejectedValue(error)

      // Execute
      await orchestraController.getStudentAttendanceStats(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })
})