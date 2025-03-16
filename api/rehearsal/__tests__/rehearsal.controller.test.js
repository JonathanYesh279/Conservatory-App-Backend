import { describe, it, expect, vi, beforeEach } from 'vitest'
import { rehearsalController } from '../rehearsal.controller.js'
import { rehearsalService } from '../rehearsal.service.js'
import { ObjectId } from 'mongodb'

// Mock dependencies
vi.mock('../rehearsal.service.js', () => ({
  rehearsalService: {
    getRehearsals: vi.fn(),
    getRehearsalById: vi.fn(),
    getOrchestraRehearsals: vi.fn(),
    addRehearsal: vi.fn(),
    updateRehearsal: vi.fn(),
    removeRehearsal: vi.fn(),
    bulkCreateRehearsals: vi.fn(),
    updateAttendance: vi.fn()
  }
}))

describe('Rehearsal Controller', () => {
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

  describe('getRehearsals', () => {
    it('should get all rehearsals with correct filters', async () => {
      // Setup
      req.query = {
        groupId: 'orchestra1',
        type: 'תזמורת',
        fromDate: '2023-01-01',
        toDate: '2023-12-31',
        isActive: 'true',
        showInactive: 'true'
      }

      const mockRehearsals = [
        { _id: '1', groupId: 'orchestra1', date: new Date('2023-01-15') },
        { _id: '2', groupId: 'orchestra1', date: new Date('2023-02-15') }
      ]
      rehearsalService.getRehearsals.mockResolvedValue(mockRehearsals)

      // Execute
      await rehearsalController.getRehearsals(req, res, next)

      // Assert
      expect(rehearsalService.getRehearsals).toHaveBeenCalledWith({
        groupId: 'orchestra1',
        type: 'תזמורת',
        fromDate: '2023-01-01',
        toDate: '2023-12-31',
        isActive: 'true',
        showInactive: true // Boolean true
      })
      expect(res.json).toHaveBeenCalledWith(mockRehearsals)
    })

    it('should handle errors and pass them to next middleware', async () => {
      // Setup
      const error = new Error('Failed to get rehearsals')
      rehearsalService.getRehearsals.mockRejectedValue(error)

      // Execute
      await rehearsalController.getRehearsals(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })

  describe('getRehearsalById', () => {
    it('should get a rehearsal by ID', async () => {
      // Setup
      const rehearsalId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      req.params = { id: rehearsalId.toString() }

      const mockRehearsal = {
        _id: rehearsalId,
        groupId: 'orchestra1',
        date: new Date('2023-01-15'),
        location: 'Main Hall'
      }
      rehearsalService.getRehearsalById.mockResolvedValue(mockRehearsal)

      // Execute
      await rehearsalController.getRehearsalById(req, res, next)

      // Assert
      expect(rehearsalService.getRehearsalById).toHaveBeenCalledWith(rehearsalId.toString())
      expect(res.json).toHaveBeenCalledWith(mockRehearsal)
    })

    it('should handle errors and pass them to next middleware', async () => {
      // Setup
      req.params = { id: 'invalid-id' }
      const error = new Error('Rehearsal not found')
      rehearsalService.getRehearsalById.mockRejectedValue(error)

      // Execute
      await rehearsalController.getRehearsalById(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })

  describe('getOrchestraRehearsals', () => {
    it('should get rehearsals for an orchestra with filters', async () => {
      // Setup
      const orchestraId = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      req.params = { orchestraId: orchestraId.toString() }
      req.query = {
        type: 'תזמורת',
        fromDate: '2023-01-01',
        toDate: '2023-12-31',
        isActive: 'true',
        showInactive: 'true'
      }

      const mockRehearsals = [
        { _id: '1', groupId: orchestraId.toString(), date: new Date('2023-01-15') },
        { _id: '2', groupId: orchestraId.toString(), date: new Date('2023-02-15') }
      ]
      rehearsalService.getOrchestraRehearsals.mockResolvedValue(mockRehearsals)

      // Execute
      await rehearsalController.getOrchestraRehearsals(req, res, next)

      // Assert
      expect(rehearsalService.getOrchestraRehearsals).toHaveBeenCalledWith(
        orchestraId.toString(),
        {
          type: 'תזמורת',
          fromDate: '2023-01-01',
          toDate: '2023-12-31',
          isActive: 'true',
          showInactive: true // Boolean true
        }
      )
      expect(res.json).toHaveBeenCalledWith(mockRehearsals)
    })

    it('should handle errors and pass them to next middleware', async () => {
      // Setup
      req.params = { orchestraId: 'invalid-id' }
      const error = new Error('Failed to get orchestra rehearsals')
      rehearsalService.getOrchestraRehearsals.mockRejectedValue(error)

      // Execute
      await rehearsalController.getOrchestraRehearsals(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })

  describe('addRehearsal', () => {
    it('should add a new rehearsal as admin', async () => {
      // Setup
      const rehearsalToAdd = {
        groupId: 'orchestra1',
        type: 'תזמורת',
        date: new Date('2023-03-15'),
        dayOfWeek: 3, // Wednesday
        startTime: '18:00',
        endTime: '20:00',
        location: 'Main Hall'
      }
      req.body = rehearsalToAdd
      req.teacher.roles = ['מנהל'] // Admin role

      const addedRehearsal = { 
        _id: new ObjectId('6579e36c83c8b3a5c2df8a8b'),
        ...rehearsalToAdd
      }
      rehearsalService.addRehearsal.mockResolvedValue(addedRehearsal)

      // Execute
      await rehearsalController.addRehearsal(req, res, next)

      // Assert
      expect(rehearsalService.addRehearsal).toHaveBeenCalledWith(
        rehearsalToAdd,
        req.teacher._id,
        true // isAdmin
      )
      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith(addedRehearsal)
    })

    it('should add rehearsal as conductor (not admin)', async () => {
      // Setup
      const rehearsalToAdd = {
        groupId: 'orchestra1',
        type: 'תזמורת',
        date: new Date('2023-03-15'),
        startTime: '18:00',
        endTime: '20:00',
        location: 'Main Hall'
      }
      req.body = rehearsalToAdd
      req.teacher.roles = ['מנצח'] // Conductor role, not admin

      const addedRehearsal = { 
        _id: new ObjectId(),
        ...rehearsalToAdd
      }
      rehearsalService.addRehearsal.mockResolvedValue(addedRehearsal)

      // Execute
      await rehearsalController.addRehearsal(req, res, next)

      // Assert
      expect(rehearsalService.addRehearsal).toHaveBeenCalledWith(
        rehearsalToAdd,
        req.teacher._id,
        false // Not admin
      )
      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith(addedRehearsal)
    })

    it('should return 403 for authorization errors', async () => {
      // Setup
      const rehearsalToAdd = {
        groupId: 'orchestra1',
        type: 'תזמורת'
      }
      req.body = rehearsalToAdd
      req.teacher.roles = ['מורה'] // Not authorized for adding rehearsals

      const error = new Error('Not authorized to add rehearsal for this orchestra')
      rehearsalService.addRehearsal.mockRejectedValue(error)

      // Execute
      await rehearsalController.addRehearsal(req, res, next)

      // Assert
      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({ error: 'Not authorized to add rehearsal for this orchestra' })
      expect(next).not.toHaveBeenCalled()
    })

    it('should handle other errors and pass them to next middleware', async () => {
      // Setup
      req.body = { invalidData: true }
      const error = new Error('Invalid rehearsal data')
      rehearsalService.addRehearsal.mockRejectedValue(error)

      // Execute
      await rehearsalController.addRehearsal(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })

  describe('updateRehearsal', () => {
    it('should update an existing rehearsal as admin', async () => {
      // Setup
      const rehearsalId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      req.params = { id: rehearsalId.toString() }
      
      const rehearsalToUpdate = {
        groupId: 'orchestra1',
        date: new Date('2023-04-15'),
        location: 'Updated Location'
      }
      req.body = rehearsalToUpdate
      req.teacher.roles = ['מנהל'] // Admin role

      const updatedRehearsal = { 
        _id: rehearsalId,
        ...rehearsalToUpdate
      }
      rehearsalService.updateRehearsal.mockResolvedValue(updatedRehearsal)

      // Execute
      await rehearsalController.updateRehearsal(req, res, next)

      // Assert
      expect(rehearsalService.updateRehearsal).toHaveBeenCalledWith(
        rehearsalId.toString(),
        rehearsalToUpdate,
        req.teacher._id,
        true // isAdmin
      )
      expect(res.json).toHaveBeenCalledWith(updatedRehearsal)
    })

    it('should return 403 for authorization errors', async () => {
      // Setup
      const rehearsalId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      req.params = { id: rehearsalId.toString() }
      
      const rehearsalToUpdate = {
        location: 'Updated Location'
      }
      req.body = rehearsalToUpdate
      req.teacher.roles = ['מורה'] // Not authorized for updating rehearsals

      const error = new Error('Not authorized to modify this rehearsal')
      rehearsalService.updateRehearsal.mockRejectedValue(error)

      // Execute
      await rehearsalController.updateRehearsal(req, res, next)

      // Assert
      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({ error: 'Not authorized to modify this rehearsal' })
      expect(next).not.toHaveBeenCalled()
    })

    it('should handle other errors and pass them to next middleware', async () => {
      // Setup
      req.params = { id: 'invalid-id' }
      req.body = { invalidData: true }
      
      const error = new Error('Failed to update rehearsal')
      rehearsalService.updateRehearsal.mockRejectedValue(error)

      // Execute
      await rehearsalController.updateRehearsal(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })

  describe('removeRehearsal', () => {
    it('should remove (deactivate) a rehearsal as admin', async () => {
      // Setup
      const rehearsalId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      req.params = { id: rehearsalId.toString() }
      req.teacher.roles = ['מנהל'] // Admin role

      const removedRehearsal = { 
        _id: rehearsalId,
        groupId: 'orchestra1',
        isActive: false
      }
      rehearsalService.removeRehearsal.mockResolvedValue(removedRehearsal)

      // Execute
      await rehearsalController.removeRehearsal(req, res, next)

      // Assert
      expect(rehearsalService.removeRehearsal).toHaveBeenCalledWith(
        rehearsalId.toString(),
        req.teacher._id,
        true // isAdmin
      )
      expect(res.json).toHaveBeenCalledWith(removedRehearsal)
    })

    it('should return 403 for authorization errors', async () => {
      // Setup
      const rehearsalId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      req.params = { id: rehearsalId.toString() }
      req.teacher.roles = ['מורה'] // Not authorized for removing rehearsals

      const error = new Error('Not authorized to modify this rehearsal')
      rehearsalService.removeRehearsal.mockRejectedValue(error)

      // Execute
      await rehearsalController.removeRehearsal(req, res, next)

      // Assert
      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({ error: 'Not authorized to modify this rehearsal' })
      expect(next).not.toHaveBeenCalled()
    })

    it('should handle other errors and pass them to next middleware', async () => {
      // Setup
      req.params = { id: 'invalid-id' }
      
      const error = new Error('Failed to remove rehearsal')
      rehearsalService.removeRehearsal.mockRejectedValue(error)

      // Execute
      await rehearsalController.removeRehearsal(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })

  describe('bulkCreateRehearsals', () => {
    it('should bulk create rehearsals as admin', async () => {
      // Setup
      const bulkCreateData = {
        orchestraId: 'orchestra1',
        startDate: '2023-01-01',
        endDate: '2023-06-30',
        dayOfWeek: 3, // Wednesday
        startTime: '18:00',
        endTime: '20:00',
        location: 'Main Hall'
      }
      req.body = bulkCreateData
      req.teacher.roles = ['מנהל'] // Admin role

      const bulkCreateResult = { 
        insertedCount: 24,
        rehearsalIds: ['id1', 'id2', 'id3'] // Shortened for brevity
      }
      rehearsalService.bulkCreateRehearsals.mockResolvedValue(bulkCreateResult)

      // Execute
      await rehearsalController.bulkCreateRehearsals(req, res, next)

      // Assert
      expect(rehearsalService.bulkCreateRehearsals).toHaveBeenCalledWith(
        bulkCreateData,
        req.teacher._id,
        true // isAdmin
      )
      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith(bulkCreateResult)
    })

    it('should bulk create rehearsals as conductor (not admin)', async () => {
      // Setup
      const bulkCreateData = {
        orchestraId: 'orchestra1',
        startDate: '2023-01-01',
        endDate: '2023-06-30',
        dayOfWeek: 3, // Wednesday
        startTime: '18:00',
        endTime: '20:00',
        location: 'Main Hall'
      }
      req.body = bulkCreateData
      req.teacher.roles = ['מנצח'] // Conductor role, not admin

      const bulkCreateResult = { 
        insertedCount: 24,
        rehearsalIds: ['id1', 'id2', 'id3'] // Shortened for brevity
      }
      rehearsalService.bulkCreateRehearsals.mockResolvedValue(bulkCreateResult)

      // Execute
      await rehearsalController.bulkCreateRehearsals(req, res, next)

      // Assert
      expect(rehearsalService.bulkCreateRehearsals).toHaveBeenCalledWith(
        bulkCreateData,
        req.teacher._id,
        false // Not admin
      )
      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith(bulkCreateResult)
    })

    it('should return 403 for authorization errors', async () => {
      // Setup
      const bulkCreateData = {
        orchestraId: 'orchestra1',
        startDate: '2023-01-01',
        endDate: '2023-06-30'
      }
      req.body = bulkCreateData
      req.teacher.roles = ['מורה'] // Not authorized for bulk creating rehearsals

      const error = new Error('Not authorized to bulk create rehearsals for this orchestra')
      rehearsalService.bulkCreateRehearsals.mockRejectedValue(error)

      // Execute
      await rehearsalController.bulkCreateRehearsals(req, res, next)

      // Assert
      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Not authorized to bulk create rehearsals for this orchestra' 
      })
      expect(next).not.toHaveBeenCalled()
    })

    it('should handle other errors and pass them to next middleware', async () => {
      // Setup
      req.body = { invalidData: true }
      const error = new Error('Invalid bulk create data')
      rehearsalService.bulkCreateRehearsals.mockRejectedValue(error)

      // Execute
      await rehearsalController.bulkCreateRehearsals(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })

  describe('updateAttendance', () => {
    it('should update rehearsal attendance as admin', async () => {
      // Setup
      const rehearsalId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      req.params = { rehearsalId: rehearsalId.toString() }
      
      const attendanceData = {
        present: ['student1', 'student2'],
        absent: ['student3', 'student4']
      }
      req.body = attendanceData
      req.teacher.roles = ['מנהל'] // Admin role

      const updatedRehearsal = { 
        _id: rehearsalId,
        groupId: 'orchestra1',
        attendance: attendanceData
      }
      rehearsalService.updateAttendance.mockResolvedValue(updatedRehearsal)

      // Execute
      await rehearsalController.updateAttendance(req, res, next)

      // Assert
      expect(rehearsalService.updateAttendance).toHaveBeenCalledWith(
        rehearsalId.toString(),
        attendanceData,
        req.teacher._id,
        true // isAdmin
      )
      expect(res.json).toHaveBeenCalledWith(updatedRehearsal)
    })

    it('should return 403 for authorization errors', async () => {
      // Setup
      const rehearsalId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      req.params = { rehearsalId: rehearsalId.toString() }
      
      const attendanceData = {
        present: ['student1'],
        absent: ['student2']
      }
      req.body = attendanceData
      req.teacher.roles = ['מורה'] // Not authorized for updating attendance

      const error = new Error('Not authorized to modify this rehearsal')
      rehearsalService.updateAttendance.mockRejectedValue(error)

      // Execute
      await rehearsalController.updateAttendance(req, res, next)

      // Assert
      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({ error: 'Not authorized to modify this rehearsal' })
      expect(next).not.toHaveBeenCalled()
    })

    it('should handle other errors and pass them to next middleware', async () => {
      // Setup
      req.params = { rehearsalId: 'invalid-id' }
      req.body = { invalidData: true }
      
      const error = new Error('Failed to update attendance')
      rehearsalService.updateAttendance.mockRejectedValue(error)

      // Execute
      await rehearsalController.updateAttendance(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })
})