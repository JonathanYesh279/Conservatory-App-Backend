// api/bagrut/__tests__/bagrut.controller.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { bagrutController } from '../bagrut.controller.js'
import { bagrutService } from '../bagrut.service.js'
import { ObjectId } from 'mongodb'

// Mock dependencies
vi.mock('../bagrut.service.js', () => ({
  bagrutService: {
    getBagruts: vi.fn(),
    getBagrutById: vi.fn(),
    getBagrutByStudentId: vi.fn(),
    addBagrut: vi.fn(),
    updateBagrut: vi.fn(),
    updatePresentation: vi.fn(),
    updateMagenBagrut: vi.fn(),
    addDocument: vi.fn(),
    removeDocument: vi.fn(),
    addProgramPiece: vi.fn(),
    removeProgramPiece: vi.fn(),
    addAccompanist: vi.fn(),
    removeAccompanist: vi.fn()
  }
}))

// Mock the actual controller module to intercept its imports
vi.mock('../bagrut.controller.js', async () => {
  const actual = await vi.importActual('../bagrut.controller.js')
  return actual
})

// Mock the deleteFile function
vi.mock('../../../services/fileStorage.service.js', () => ({
  deleteFile: vi.fn().mockResolvedValue({ success: true })
}))

// Import the mocked deleteFile function
import { deleteFile } from '../../../services/fileStorage.service.js'

describe('Bagrut Controller', () => {
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
        _id: new ObjectId('6579e36c83c8b3a5c2df8a8b').toString()
      },
      bagrut: null,
      processedFile: null
    }

    // Setup response object with chainable methods
    res = {
      status: vi.fn(() => res),
      json: vi.fn(() => res)
    }

    // Setup next function
    next = vi.fn()
  })

  describe('getBagruts', () => {
    it('should get all bagruts with correct filters', async () => {
      // Setup
      req.query = {
        studentId: '123',
        teacherId: '456',
        isActive: 'true',
        showInactive: 'true'
      }

      const mockBagruts = [
        { _id: '1', studentId: '123', teacherId: '456' },
        { _id: '2', studentId: '789', teacherId: '456' }
      ]
      bagrutService.getBagruts.mockResolvedValue(mockBagruts)

      // Execute
      await bagrutController.getBagruts(req, res, next)

      // Assert
      expect(bagrutService.getBagruts).toHaveBeenCalledWith({
        studentId: '123',
        teacherId: '456',
        isActive: 'true',
        showInactive: true
      })
      expect(res.json).toHaveBeenCalledWith(mockBagruts)
    })

    it('should handle errors and pass them to next middleware', async () => {
      // Setup
      const error = new Error('Failed to get bagruts')
      bagrutService.getBagruts.mockRejectedValue(error)

      // Execute
      await bagrutController.getBagruts(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })

  describe('getBagrutById', () => {
    it('should get bagrut from req object (set by middleware)', async () => {
      // Setup
      const mockBagrut = {
        _id: new ObjectId('6579e36c83c8b3a5c2df8a8b'),
        studentId: '123',
        teacherId: '456'
      }
      req.bagrut = mockBagrut

      // Execute
      await bagrutController.getBagrutById(req, res, next)

      // Assert
      expect(res.json).toHaveBeenCalledWith(mockBagrut)
      // Service shouldn't be called since middleware already fetched the bagrut
      expect(bagrutService.getBagrutById).not.toHaveBeenCalled()
    })

    it('should handle errors and pass them to next middleware', async () => {
      // Setup
      const error = new Error('Failed to get bagrut')
      
      // Set request to throw when accessing req.bagrut
      Object.defineProperty(req, 'bagrut', {
        get: () => { throw error }
      })

      // Execute
      await bagrutController.getBagrutById(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })

  describe('getBagrutByStudentId', () => {
    it('should get bagrut by student ID', async () => {
      // Setup
      const studentId = '123'
      req.params = { studentId }

      const mockBagrut = {
        _id: new ObjectId('6579e36c83c8b3a5c2df8a8b'),
        studentId,
        teacherId: '456'
      }
      bagrutService.getBagrutByStudentId.mockResolvedValue(mockBagrut)

      // Execute
      await bagrutController.getBagrutByStudentId(req, res, next)

      // Assert
      expect(bagrutService.getBagrutByStudentId).toHaveBeenCalledWith(studentId)
      expect(res.json).toHaveBeenCalledWith(mockBagrut)
    })

    it('should return 404 if no bagrut found for student', async () => {
      // Setup
      const studentId = '123'
      req.params = { studentId }
      bagrutService.getBagrutByStudentId.mockResolvedValue(null)

      // Execute
      await bagrutController.getBagrutByStudentId(req, res, next)

      // Assert
      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({ error: `Bagrut for student ${studentId} not found` })
    })

    it('should handle errors and pass them to next middleware', async () => {
      // Setup
      req.params = { studentId: '123' }
      const error = new Error('Failed to get bagrut by student ID')
      bagrutService.getBagrutByStudentId.mockRejectedValue(error)

      // Execute
      await bagrutController.getBagrutByStudentId(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })

  describe('addBagrut', () => {
    it('should add a new bagrut', async () => {
      // Setup
      const bagrutToAdd = {
        studentId: '123',
        teacherId: '456',
        program: []
      }
      req.body = bagrutToAdd

      const addedBagrut = { 
        _id: new ObjectId('6579e36c83c8b3a5c2df8a8b'),
        ...bagrutToAdd
      }
      bagrutService.addBagrut.mockResolvedValue(addedBagrut)

      // Execute
      await bagrutController.addBagrut(req, res, next)

      // Assert
      expect(bagrutService.addBagrut).toHaveBeenCalledWith(bagrutToAdd)
      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith(addedBagrut)
    })

    it('should handle errors and pass them to next middleware', async () => {
      // Setup
      req.body = { invalidData: true }
      const error = new Error('Invalid bagrut data')
      bagrutService.addBagrut.mockRejectedValue(error)

      // Execute
      await bagrutController.addBagrut(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })

  describe('updateBagrut', () => {
    it('should update an existing bagrut', async () => {
      // Setup
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      req.params = { id: bagrutId.toString() }
      
      const bagrutToUpdate = {
        studentId: '123',
        teacherId: '456',
        program: [{
          pieceTitle: 'Updated Piece',
          composer: 'Composer',
          duration: '5:00'
        }]
      }
      req.body = bagrutToUpdate

      const updatedBagrut = { 
        _id: bagrutId,
        ...bagrutToUpdate
      }
      bagrutService.updateBagrut.mockResolvedValue(updatedBagrut)

      // Execute
      await bagrutController.updateBagrut(req, res, next)

      // Assert
      expect(bagrutService.updateBagrut).toHaveBeenCalledWith(bagrutId.toString(), bagrutToUpdate)
      expect(res.json).toHaveBeenCalledWith(updatedBagrut)
    })

    it('should handle errors and pass them to next middleware', async () => {
      // Setup
      req.params = { id: 'invalid-id' }
      req.body = { invalidData: true }
      const error = new Error('Failed to update bagrut')
      bagrutService.updateBagrut.mockRejectedValue(error)

      // Execute
      await bagrutController.updateBagrut(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })

  describe('updatePresentation', () => {
    it('should update a specific presentation', async () => {
      // Setup
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const presentationIndex = '1'
      req.params = { 
        id: bagrutId.toString(),
        presentationIndex
      }
      
      const presentationData = {
        status: 'עבר/ה',
        review: 'Good performance'
      }
      req.body = presentationData
      
      const teacherId = req.teacher._id
      
      const updatedBagrut = { 
        _id: bagrutId,
        studentId: '123',
        teacherId: '456',
        presentations: [{}, presentationData, {}]
      }
      bagrutService.updatePresentation.mockResolvedValue(updatedBagrut)

      // Execute
      await bagrutController.updatePresentation(req, res, next)

      // Assert
      expect(bagrutService.updatePresentation).toHaveBeenCalledWith(
        bagrutId.toString(),
        parseInt(presentationIndex),
        presentationData,
        teacherId
      )
      expect(res.json).toHaveBeenCalledWith(updatedBagrut)
    })

    it('should handle errors and pass them to next middleware', async () => {
      // Setup
      req.params = { 
        id: 'invalid-id',
        presentationIndex: '1'  // Valid index so it reaches the service
      }
      req.body = { status: 'עבר/ה' }
      req.teacher = { _id: new ObjectId('6579e36c83c8b3a5c2df8a8c') }
      
      const error = new Error('Failed to update presentation')
      bagrutService.updatePresentation.mockRejectedValue(error)

      // Execute
      await bagrutController.updatePresentation(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })

  describe('updateMagenBagrut', () => {
    it('should update magen bagrut data', async () => {
      // Setup
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      req.params = { id: bagrutId.toString() }
      
      const magenBagrutData = {
        status: 'עבר/ה',
        review: 'Good performance'
      }
      req.body = magenBagrutData
      
      const teacherId = req.teacher._id
      
      const updatedBagrut = { 
        _id: bagrutId,
        studentId: '123',
        teacherId: '456',
        magenBagrut: magenBagrutData
      }
      bagrutService.updateMagenBagrut.mockResolvedValue(updatedBagrut)

      // Execute
      await bagrutController.updateMagenBagrut(req, res, next)

      // Assert
      expect(bagrutService.updateMagenBagrut).toHaveBeenCalledWith(
        bagrutId.toString(),
        magenBagrutData,
        teacherId
      )
      expect(res.json).toHaveBeenCalledWith(updatedBagrut)
    })

    it('should handle errors and pass them to next middleware', async () => {
      // Setup
      req.params = { id: 'invalid-id' }
      req.body = { status: 'עבר/ה' }
      
      const error = new Error('Failed to update magen bagrut')
      bagrutService.updateMagenBagrut.mockRejectedValue(error)

      // Execute
      await bagrutController.updateMagenBagrut(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })

  describe('addDocument', () => {
    it('should return 400 if no file information available', async () => {
      // Setup
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      req.params = { id: bagrutId.toString() }
      req.processedFile = null // No file information
      
      // Execute
      await bagrutController.addDocument(req, res, next)

      // Assert
      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ error: 'No file information available' })
      expect(bagrutService.addDocument).not.toHaveBeenCalled()
    })

    it('should add a document to bagrut', async () => {
      // Setup
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      req.params = { id: bagrutId.toString() }
      
      req.body = { title: 'Test Document' }
      req.processedFile = {
        originalname: 'test-document.pdf',
        url: '/uploads/test-document.pdf',
        key: 'uploads/test-document.pdf'
      }
      
      const teacherId = req.teacher._id
      
      const updatedBagrut = { 
        _id: bagrutId,
        studentId: '123',
        teacherId: '456',
        documents: [{
          title: 'Test Document',
          fileUrl: '/uploads/test-document.pdf',
          fileKey: 'uploads/test-document.pdf'
        }]
      }
      bagrutService.addDocument.mockResolvedValue(updatedBagrut)

      // Execute
      await bagrutController.addDocument(req, res, next)

      // Assert
      expect(bagrutService.addDocument).toHaveBeenCalledWith(
        bagrutId.toString(),
        {
          title: 'Test Document',
          fileUrl: '/uploads/test-document.pdf',
          fileKey: 'uploads/test-document.pdf',
          uploadDate: expect.any(Date),
          uploadedBy: teacherId
        },
        teacherId
      )
      expect(res.json).toHaveBeenCalledWith(updatedBagrut)
    })

    it('should use originalname as title if title not provided', async () => {
      // Setup
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      req.params = { id: bagrutId.toString() }
      
      req.body = {} // No title provided
      req.processedFile = {
        originalname: 'test-document.pdf',
        url: '/uploads/test-document.pdf'
      }
      
      const teacherId = req.teacher._id
      
      bagrutService.addDocument.mockResolvedValue({})

      // Execute
      await bagrutController.addDocument(req, res, next)

      // Assert
      expect(bagrutService.addDocument).toHaveBeenCalledWith(
        bagrutId.toString(),
        expect.objectContaining({
          title: 'test-document.pdf', // Uses originalname
          fileUrl: '/uploads/test-document.pdf'
        }),
        teacherId
      )
    })

    it('should handle errors and pass them to next middleware', async () => {
      // Setup
      req.params = { id: 'invalid-id' }
      req.processedFile = {
        originalname: 'test-document.pdf',
        url: '/uploads/test-document.pdf'
      }
      
      const error = new Error('Failed to add document')
      bagrutService.addDocument.mockRejectedValue(error)

      // Execute
      await bagrutController.addDocument(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })

  describe('removeDocument', () => {
    it('should remove a document and delete the file', async () => {
      // Setup
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const documentId = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      req.params = { 
        id: bagrutId.toString(),
        documentId: documentId.toString()
      }
      
      // Set up req.bagrut with documents
      req.bagrut = {
        _id: bagrutId,
        documents: [{
          _id: documentId,
          fileUrl: '/uploads/test-document.pdf'
        }]
      }
      
      const updatedBagrut = { 
        _id: bagrutId,
        documents: [] // Document removed
      }
      bagrutService.removeDocument.mockResolvedValue(updatedBagrut)

      // Execute
      await bagrutController.removeDocument(req, res, next)

      // Assert
      expect(deleteFile).toHaveBeenCalledWith('/uploads/test-document.pdf')
      expect(bagrutService.removeDocument).toHaveBeenCalledWith(
        bagrutId.toString(),
        documentId.toString()
      )
      expect(res.json).toHaveBeenCalledWith(updatedBagrut)
    })

    it('should continue even if file deletion fails', async () => {
      // Setup
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const documentId = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      req.params = { 
        id: bagrutId.toString(),
        documentId: documentId.toString()
      }
      
      // Set up req.bagrut with documents
      req.bagrut = {
        _id: bagrutId,
        documents: [{
          _id: documentId,
          fileUrl: '/uploads/test-document.pdf'
        }]
      }
      
      const updatedBagrut = { 
        _id: bagrutId,
        documents: [] // Document removed
      }
      
      const deleteError = new Error('File not found')
      deleteFile.mockRejectedValueOnce(deleteError)
      bagrutService.removeDocument.mockResolvedValue(updatedBagrut)
      
      // Spy on console.warn
      const consoleSpy = vi.spyOn(console, 'warn')

      // Execute
      await bagrutController.removeDocument(req, res, next)

      // Assert
      expect(deleteFile).toHaveBeenCalledWith('/uploads/test-document.pdf')
      expect(consoleSpy).toHaveBeenCalledWith(`Error deleting file: ${deleteError.message}`)
      expect(bagrutService.removeDocument).toHaveBeenCalledWith(
        bagrutId.toString(),
        documentId.toString()
      )
      expect(res.json).toHaveBeenCalledWith(updatedBagrut)
    })

    it('should handle errors and pass them to next middleware', async () => {
      // Setup
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const documentId = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      req.params = { 
        id: bagrutId.toString(),
        documentId: documentId.toString()
      }
      
      // Set up req.bagrut with documents
      req.bagrut = {
        _id: bagrutId,
        documents: [{
          _id: documentId,
          fileUrl: '/uploads/test-document.pdf'
        }]
      }
      
      const error = new Error('Failed to remove document')
      bagrutService.removeDocument.mockRejectedValue(error)

      // Execute
      await bagrutController.removeDocument(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })

  describe('addProgramPiece', () => {
    it('should add a program piece to bagrut', async () => {
      // Setup
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      req.params = { id: bagrutId.toString() }
      
      const pieceData = {
        pieceTitle: 'New Piece',
        composer: 'Composer',
        duration: '5:00',
        youtubeLink: 'https://youtube.com/watch?v=123'
      }
      req.body = pieceData
      
      const updatedBagrut = { 
        _id: bagrutId,
        program: [pieceData]
      }
      bagrutService.addProgramPiece.mockResolvedValue(updatedBagrut)

      // Execute
      await bagrutController.addProgramPiece(req, res, next)

      // Assert
      expect(bagrutService.addProgramPiece).toHaveBeenCalledWith(
        bagrutId.toString(),
        pieceData
      )
      expect(res.json).toHaveBeenCalledWith(updatedBagrut)
    })

    it('should handle errors and pass them to next middleware', async () => {
      // Setup
      req.params = { id: 'invalid-id' }
      req.body = { pieceTitle: 'New Piece' }
      
      const error = new Error('Failed to add program piece')
      bagrutService.addProgramPiece.mockRejectedValue(error)

      // Execute
      await bagrutController.addProgramPiece(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })

  describe('removeProgramPiece', () => {
    it('should remove a program piece from bagrut', async () => {
      // Setup
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const pieceId = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      req.params = { 
        id: bagrutId.toString(),
        pieceId: pieceId.toString()
      }
      
      const updatedBagrut = { 
        _id: bagrutId,
        program: [] // Piece removed
      }
      bagrutService.removeProgramPiece.mockResolvedValue(updatedBagrut)

      // Execute
      await bagrutController.removeProgramPiece(req, res, next)

      // Assert
      expect(bagrutService.removeProgramPiece).toHaveBeenCalledWith(
        bagrutId.toString(),
        pieceId.toString()
      )
      expect(res.json).toHaveBeenCalledWith(updatedBagrut)
    })

    it('should handle errors and pass them to next middleware', async () => {
      // Setup
      req.params = { 
        id: 'invalid-id',
        pieceId: 'invalid-piece-id'
      }
      
      const error = new Error('Failed to remove program piece')
      bagrutService.removeProgramPiece.mockRejectedValue(error)

      // Execute
      await bagrutController.removeProgramPiece(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })

  describe('addAccompanist', () => {
    it('should add an accompanist to bagrut', async () => {
      // Setup
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      req.params = { id: bagrutId.toString() }
      
      const accompanistData = {
        name: 'Accompanist Name',
        instrument: 'Piano',
        phone: '0501234567'
      }
      req.body = accompanistData
      
      const updatedBagrut = { 
        _id: bagrutId,
        accompaniment: {
          type: 'נגן מלווה',
          accompanists: [accompanistData]
        }
      }
      bagrutService.addAccompanist.mockResolvedValue(updatedBagrut)

      // Execute
      await bagrutController.addAccompanist(req, res, next)

      // Assert
      expect(bagrutService.addAccompanist).toHaveBeenCalledWith(
        bagrutId.toString(),
        accompanistData
      )
      expect(res.json).toHaveBeenCalledWith(updatedBagrut)
    })

    it('should handle errors and pass them to next middleware', async () => {
      // Setup
      req.params = { id: 'invalid-id' }
      req.body = { name: 'Accompanist' }
      
      const error = new Error('Failed to add accompanist')
      bagrutService.addAccompanist.mockRejectedValue(error)

      // Execute
      await bagrutController.addAccompanist(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })

  describe('removeAccompanist', () => {
    it('should remove an accompanist from bagrut', async () => {
      // Setup
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const accompanistId = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      req.params = { 
        id: bagrutId.toString(),
        accompanistId: accompanistId.toString()
      }
      
      const updatedBagrut = { 
        _id: bagrutId,
        accompaniment: {
          type: 'נגן מלווה',
          accompanists: [] // Accompanist removed
        }
      }
      bagrutService.removeAccompanist.mockResolvedValue(updatedBagrut)

      // Execute
      await bagrutController.removeAccompanist(req, res, next)

      // Assert
      expect(bagrutService.removeAccompanist).toHaveBeenCalledWith(
        bagrutId.toString(),
        accompanistId.toString()
      )
      expect(res.json).toHaveBeenCalledWith(updatedBagrut)
    })

    it('should handle errors and pass them to next middleware', async () => {
      // Setup
      req.params = { 
        id: 'invalid-id',
        accompanistId: 'invalid-accompanist-id'
      }
      
      const error = new Error('Failed to remove accompanist')
      bagrutService.removeAccompanist.mockRejectedValue(error)

      // Execute
      await bagrutController.removeAccompanist(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })
})