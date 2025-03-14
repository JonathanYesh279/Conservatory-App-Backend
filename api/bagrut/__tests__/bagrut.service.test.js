// api/bagrut/__tests__/bagrut.service.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { bagrutService } from '../bagrut.service.js'
import { validateBagrut } from '../bagrut.validation.js'
import { getCollection } from '../../../services/mongoDB.service.js'
import { ObjectId } from 'mongodb'

// Mock dependencies
vi.mock('../bagrut.validation.js', () => ({
  validateBagrut: vi.fn()
}))

vi.mock('../../../services/mongoDB.service.js', () => ({
  getCollection: vi.fn()
}))

describe('Bagrut Service', () => {
  let mockBagrutCollection
  let mockStudentCollection

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Setup mock collections
    mockBagrutCollection = {
      find: vi.fn().mockReturnThis(),
      toArray: vi.fn(),
      findOne: vi.fn(),
      insertOne: vi.fn(),
      updateOne: vi.fn(),
      findOneAndUpdate: vi.fn()
    }

    mockStudentCollection = {
      updateOne: vi.fn()
    }

    // Mock getCollection to return different collections based on the name
    getCollection.mockImplementation((name) => {
      switch (name) {
        case 'bagrut':
          return Promise.resolve(mockBagrutCollection)
        case 'student':
          return Promise.resolve(mockStudentCollection)
        default:
          return Promise.resolve({})
      }
    })
  })

  describe('getBagruts', () => {
    it('should get all bagruts with default filter', async () => {
      // Setup
      const mockBagruts = [
        { _id: new ObjectId('6579e36c83c8b3a5c2df8a8b'), studentId: '123', teacherId: '456' },
        { _id: new ObjectId('6579e36c83c8b3a5c2df8a8c'), studentId: '789', teacherId: '012' }
      ]
      mockBagrutCollection.toArray.mockResolvedValue(mockBagruts)

      // Execute
      const result = await bagrutService.getBagruts()

      // Assert
      expect(mockBagrutCollection.find).toHaveBeenCalledWith({ isActive: true })
      expect(result).toEqual(mockBagruts)
    })

    it('should apply studentId filter correctly', async () => {
      // Setup
      const filterBy = { studentId: '123' }
      mockBagrutCollection.toArray.mockResolvedValue([])

      // Execute
      await bagrutService.getBagruts(filterBy)

      // Assert
      expect(mockBagrutCollection.find).toHaveBeenCalledWith({
        studentId: '123',
        isActive: true
      })
    })

    it('should apply teacherId filter correctly', async () => {
      // Setup
      const filterBy = { teacherId: '456' }
      mockBagrutCollection.toArray.mockResolvedValue([])

      // Execute
      await bagrutService.getBagruts(filterBy)

      // Assert
      expect(mockBagrutCollection.find).toHaveBeenCalledWith({
        teacherId: '456',
        isActive: true
      })
    })

    it('should include inactive bagruts when showInactive is true', async () => {
      // Setup
      const filterBy = { showInactive: true, isActive: false }
      mockBagrutCollection.toArray.mockResolvedValue([])

      // Execute
      await bagrutService.getBagruts(filterBy)

      // Assert
      expect(mockBagrutCollection.find).toHaveBeenCalledWith({
        isActive: false
      })
    })

    it('should handle database errors', async () => {
      // Setup
      mockBagrutCollection.toArray.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(bagrutService.getBagruts()).rejects.toThrow('Error in bagrutService.getBagruts: Database error')
    })
  })

  describe('getBagrutById', () => {
    it('should get a bagrut by ID', async () => {
      // Setup
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const mockBagrut = {
        _id: bagrutId,
        studentId: '123',
        teacherId: '456'
      }
      mockBagrutCollection.findOne.mockResolvedValue(mockBagrut)

      // Execute
      const result = await bagrutService.getBagrutById(bagrutId.toString())

      // Assert
      expect(mockBagrutCollection.findOne).toHaveBeenCalledWith({
        _id: expect.any(ObjectId)
      })
      expect(result).toEqual(mockBagrut)
    })

    it('should throw error if bagrut is not found', async () => {
      // Setup
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      mockBagrutCollection.findOne.mockResolvedValue(null)

      // Execute & Assert
      await expect(bagrutService.getBagrutById(bagrutId.toString()))
        .rejects.toThrow(`Bagrut with id ${bagrutId} not found`)
    })

    it('should handle database errors', async () => {
      // Setup
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      mockBagrutCollection.findOne.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(bagrutService.getBagrutById(bagrutId.toString()))
        .rejects.toThrow('Error in bagrutService.getBagrutById: Database error')
    })
  })

  describe('getBagrutByStudentId', () => {
    it('should get a bagrut by student ID', async () => {
      // Setup
      const studentId = '123'
      const mockBagrut = {
        _id: new ObjectId('6579e36c83c8b3a5c2df8a8b'),
        studentId,
        teacherId: '456'
      }
      mockBagrutCollection.findOne.mockResolvedValue(mockBagrut)

      // Execute
      const result = await bagrutService.getBagrutByStudentId(studentId)

      // Assert
      expect(mockBagrutCollection.findOne).toHaveBeenCalledWith({
        studentId,
        isActive: true
      })
      expect(result).toEqual(mockBagrut)
    })

    it('should return null if no bagrut found for student', async () => {
      // Setup
      const studentId = '123'
      mockBagrutCollection.findOne.mockResolvedValue(null)

      // Execute
      const result = await bagrutService.getBagrutByStudentId(studentId)

      // Assert
      expect(result).toBeNull()
    })

    it('should handle database errors', async () => {
      // Setup
      const studentId = '123'
      mockBagrutCollection.findOne.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(bagrutService.getBagrutByStudentId(studentId))
        .rejects.toThrow('Error in bagrutService.getBagrutByStudentId: Database error')
    })
  })

  describe('addBagrut', () => {
    it('should add a new bagrut and update student record', async () => {
      // Setup
      const bagrutToAdd = {
        studentId: '123',
        teacherId: '456',
        program: [],
        testDate: new Date()
      }
      
      const validationResult = {
        error: null,
        value: { ...bagrutToAdd }
      }
      
      validateBagrut.mockReturnValue(validationResult)
      
      // No existing bagrut for this student
      mockBagrutCollection.findOne.mockResolvedValue(null)
      
      const insertedId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      mockBagrutCollection.insertOne.mockResolvedValue({ insertedId })

      // Execute
      const result = await bagrutService.addBagrut(bagrutToAdd)

      // Assert
      expect(validateBagrut).toHaveBeenCalledWith(bagrutToAdd)
      expect(mockBagrutCollection.findOne).toHaveBeenCalledWith({
        studentId: '123',
        isActive: true
      })
      
      expect(mockBagrutCollection.insertOne).toHaveBeenCalledWith(expect.objectContaining({
        ...validationResult.value,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      }))
      
      // Should update student record with bagrut ID reference
      expect(mockStudentCollection.updateOne).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        { $set: { 'academicInfo.tests.bagrutId': insertedId } }
      )
      
      expect(result).toEqual({
        _id: insertedId,
        ...validationResult.value,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      })
    })

    it('should throw error if student already has an active bagrut', async () => {
      // Setup
      const bagrutToAdd = {
        studentId: '123',
        teacherId: '456'
      }
      
      const validationResult = {
        error: null,
        value: bagrutToAdd
      }
      
      validateBagrut.mockReturnValue(validationResult)
      
      // Existing bagrut found for student
      mockBagrutCollection.findOne.mockResolvedValue({
        _id: new ObjectId(),
        studentId: '123'
      })

      // Execute & Assert
      await expect(bagrutService.addBagrut(bagrutToAdd))
        .rejects.toThrow(`Error in bagrutService.addBagrut: Bagrut for student 123 already exists`)
    })

    it('should throw error for invalid bagrut data', async () => {
      // Setup
      const bagrutToAdd = { invalidData: true }
      
      const validationResult = {
        error: new Error('Invalid bagrut data'),
        value: null
      }
      
      validateBagrut.mockReturnValue(validationResult)

      // Execute & Assert
      await expect(bagrutService.addBagrut(bagrutToAdd))
        .rejects.toThrow('Error in bagrutService.addBagrut: Invalid bagrut data')
    })

    it('should handle database errors', async () => {
      // Setup
      const bagrutToAdd = {
        studentId: '123',
        teacherId: '456'
      }
      
      const validationResult = {
        error: null,
        value: bagrutToAdd
      }
      
      validateBagrut.mockReturnValue(validationResult)
      mockBagrutCollection.findOne.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(bagrutService.addBagrut(bagrutToAdd))
        .rejects.toThrow('Error in bagrutService.addBagrut: Database error')
    })
  })

  describe('updateBagrut', () => {
    it('should update an existing bagrut', async () => {
      // Setup
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const bagrutToUpdate = {
        studentId: '123',
        teacherId: '456',
        program: [{
          pieceTitle: 'New Piece',
          composer: 'Composer',
          duration: '5:00'
        }]
      }
      
      const validationResult = {
        error: null,
        value: { ...bagrutToUpdate }
      }
      
      validateBagrut.mockReturnValue(validationResult)
      
      const updatedBagrut = {
        _id: bagrutId,
        ...bagrutToUpdate,
        updatedAt: new Date()
      }
      
      mockBagrutCollection.updateOne.mockResolvedValue({ matchedCount: 1 })
      mockBagrutCollection.findOneAndUpdate.mockResolvedValue(updatedBagrut)

      // Execute
      const result = await bagrutService.updateBagrut(bagrutId.toString(), bagrutToUpdate)

      // Assert
      expect(validateBagrut).toHaveBeenCalledWith(bagrutToUpdate)
      
      expect(mockBagrutCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        { $set: expect.objectContaining({
          ...validationResult.value,
          updatedAt: expect.any(Date)
        })},
        { returnDocument: 'after' }
      )
      
      expect(result).toEqual(updatedBagrut)
    })

    it('should throw error for invalid bagrut data', async () => {
      // Setup
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const bagrutToUpdate = { invalidData: true }
      
      const validationResult = {
        error: new Error('Invalid bagrut data'),
        value: null
      }
      
      validateBagrut.mockReturnValue(validationResult)

      // Execute & Assert
      await expect(bagrutService.updateBagrut(bagrutId.toString(), bagrutToUpdate))
        .rejects.toThrow('Error in bagrutService.updateBagrut: Validation error: Invalid bagrut data')
    })

    it('should throw error if bagrut is not found', async () => {
      // Setup
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const bagrutToUpdate = {
        studentId: '123',
        teacherId: '456'
      }
      
      const validationResult = {
        error: null,
        value: bagrutToUpdate
      }
      
      validateBagrut.mockReturnValue(validationResult)
      mockBagrutCollection.findOneAndUpdate.mockResolvedValue(null)

      // Execute & Assert
      await expect(bagrutService.updateBagrut(bagrutId.toString(), bagrutToUpdate))
        .rejects.toThrow(`Error in bagrutService.updateBagrut: Bagrut with id ${bagrutId} not found`)
    })

    it('should handle database errors', async () => {
      // Setup
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const bagrutToUpdate = {
        studentId: '123',
        teacherId: '456'
      }
      
      const validationResult = {
        error: null,
        value: bagrutToUpdate
      }
      
      validateBagrut.mockReturnValue(validationResult)
      mockBagrutCollection.findOneAndUpdate.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(bagrutService.updateBagrut(bagrutId.toString(), bagrutToUpdate))
        .rejects.toThrow('Error in bagrutService.updateBagrut: Database error')
    })
  })

  describe('updatePresentation', () => {
    it('should update a specific presentation index', async () => {
      // Setup
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const presentationIndex = 1
      const teacherId = '456'
      
      const presentationData = {
        status: 'עבר/ה',
        review: 'Good performance'
      }
      
      const updatedBagrut = {
        _id: bagrutId,
        studentId: '123',
        teacherId: '456',
        presentations: [{}, {
          status: 'עבר/ה',
          review: 'Good performance',
          date: expect.any(Date),
          reviewedBy: teacherId
        }, {}]
      }
      
      mockBagrutCollection.findOneAndUpdate.mockResolvedValue(updatedBagrut)

      // Execute
      const result = await bagrutService.updatePresentation(bagrutId.toString(), presentationIndex, presentationData, teacherId)

      // Assert
      expect(mockBagrutCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        {
          $set: {
            [`presentations.${presentationIndex}`]: expect.objectContaining({
              ...presentationData,
              date: expect.any(Date),
              reviewedBy: teacherId
            }),
            updatedAt: expect.any(Date)
          }
        },
        { returnDocument: 'after' }
      )
      
      expect(result).toEqual(updatedBagrut)
    })

    it('should throw error for invalid presentation index', async () => {
      // Setup
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const invalidIndex = 5 // Out of bounds (0-2 are valid)
      const presentationData = { status: 'עבר/ה' }
      const teacherId = '456'

      // Execute & Assert
      await expect(bagrutService.updatePresentation(bagrutId.toString(), invalidIndex, presentationData, teacherId))
        .rejects.toThrow(`Error in bagrutService.updatePresentation: Invalid presentation index: ${invalidIndex}`)
    })

    it('should throw error if bagrut is not found', async () => {
      // Setup
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const presentationIndex = 0
      const presentationData = { status: 'עבר/ה' }
      const teacherId = '456'
      
      mockBagrutCollection.findOneAndUpdate.mockResolvedValue(null)

      // Execute & Assert
      await expect(bagrutService.updatePresentation(bagrutId.toString(), presentationIndex, presentationData, teacherId))
        .rejects.toThrow(`Error in bagrutService.updatePresentation: Bagrut with id ${bagrutId} not found`)
    })

    it('should handle database errors', async () => {
      // Setup
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const presentationIndex = 0
      const presentationData = { status: 'עבר/ה' }
      const teacherId = '456'
      
      mockBagrutCollection.findOneAndUpdate.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(bagrutService.updatePresentation(bagrutId.toString(), presentationIndex, presentationData, teacherId))
        .rejects.toThrow('Error in bagrutService.updatePresentation: Database error')
    })
  })

  describe('updateMagenBagrut', () => {
    it('should update the magen bagrut data', async () => {
      // Setup
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const teacherId = '456'
      
      const magenBagrutData = {
        status: 'עבר/ה',
        review: 'Good performance'
      }
      
      const updatedBagrut = {
        _id: bagrutId,
        studentId: '123',
        teacherId: '456',
        magenBagrut: {
          status: 'עבר/ה',
          review: 'Good performance',
          date: expect.any(Date),
          reviewedBy: teacherId
        }
      }
      
      mockBagrutCollection.findOneAndUpdate.mockResolvedValue(updatedBagrut)

      // Execute
      const result = await bagrutService.updateMagenBagrut(bagrutId.toString(), magenBagrutData, teacherId)

      // Assert
      expect(mockBagrutCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        {
          $set: {
            magenBagrut: expect.objectContaining({
              ...magenBagrutData,
              date: expect.any(Date),
              reviewedBy: teacherId
            }),
            updatedAt: expect.any(Date)
          }
        },
        { returnDocument: 'after' }
      )
      
      expect(result).toEqual(updatedBagrut)
    })

    it('should throw error if bagrut is not found', async () => {
      // Setup
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const magenBagrutData = { status: 'עבר/ה' }
      const teacherId = '456'
      
      mockBagrutCollection.findOneAndUpdate.mockResolvedValue(null)

      // Execute & Assert
      await expect(bagrutService.updateMagenBagrut(bagrutId.toString(), magenBagrutData, teacherId))
        .rejects.toThrow(`Error in bagrutService.updateMagenBagrut: Bagrut with id ${bagrutId} not found`)
    })

    it('should handle database errors', async () => {
      // Setup
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const magenBagrutData = { status: 'עבר/ה' }
      const teacherId = '456'
      
      mockBagrutCollection.findOneAndUpdate.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(bagrutService.updateMagenBagrut(bagrutId.toString(), magenBagrutData, teacherId))
        .rejects.toThrow('Error in bagrutService.updateMagenBagrut: Database error')
    })
  })

  describe('addDocument', () => {
    it('should add a document to bagrut', async () => {
      // Setup
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const teacherId = '456'
      
      const documentData = {
        title: 'Test Document',
        fileUrl: '/uploads/test-document.pdf'
      }
      
      const updatedBagrut = {
        _id: bagrutId,
        studentId: '123',
        teacherId: '456',
        documents: [{
          title: 'Test Document',
          fileUrl: '/uploads/test-document.pdf',
          uploadDate: expect.any(Date),
          uploadedBy: teacherId
        }]
      }
      
      mockBagrutCollection.findOneAndUpdate.mockResolvedValue(updatedBagrut)

      // Execute
      const result = await bagrutService.addDocument(bagrutId.toString(), documentData, teacherId)

      // Assert
      expect(mockBagrutCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        {
          $push: { 
            documents: expect.objectContaining({
              ...documentData,
              uploadDate: expect.any(Date),
              uploadedBy: teacherId
            })
          },
          $set: { updatedAt: expect.any(Date) }
        },
        { returnDocument: 'after' }
      )
      
      expect(result).toEqual(updatedBagrut)
    })

    it('should throw error if bagrut is not found', async () => {
      // Setup
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const documentData = { title: 'Test Document', fileUrl: '/uploads/test.pdf' }
      const teacherId = '456'
      
      mockBagrutCollection.findOneAndUpdate.mockResolvedValue(null)

      // Execute & Assert
      await expect(bagrutService.addDocument(bagrutId.toString(), documentData, teacherId))
        .rejects.toThrow(`Error in bagrutService.addDocument: Bagrut with id ${bagrutId} not found`)
    })

    it('should handle database errors', async () => {
      // Setup
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const documentData = { title: 'Test Document', fileUrl: '/uploads/test.pdf' }
      const teacherId = '456'
      
      mockBagrutCollection.findOneAndUpdate.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(bagrutService.addDocument(bagrutId.toString(), documentData, teacherId))
        .rejects.toThrow('Error in bagrutService.addDocument: Database error')
    })
  })

  describe('removeDocument', () => {
    it('should remove a document from bagrut', async () => {
      // Setup
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const documentId = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      
      const updatedBagrut = {
        _id: bagrutId,
        studentId: '123',
        teacherId: '456',
        documents: [] // Document removed
      }
      
      mockBagrutCollection.findOneAndUpdate.mockResolvedValue(updatedBagrut)

      // Execute
      const result = await bagrutService.removeDocument(bagrutId.toString(), documentId.toString())

      // Assert
      expect(mockBagrutCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        {
          $pull: { documents: { _id: expect.any(ObjectId) } },
          $set: { updatedAt: expect.any(Date) }
        },
        { returnDocument: 'after' }
      )
      
      expect(result).toEqual(updatedBagrut)
    })

    it('should throw error if bagrut is not found', async () => {
      // Setup
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const documentId = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      
      mockBagrutCollection.findOneAndUpdate.mockResolvedValue(null)

      // Execute & Assert
      await expect(bagrutService.removeDocument(bagrutId.toString(), documentId.toString()))
        .rejects.toThrow(`Error in bagrutService.removeDocument: Bagrut with id ${bagrutId} not found`)
    })

    it('should handle database errors', async () => {
      // Setup
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const documentId = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      
      mockBagrutCollection.findOneAndUpdate.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(bagrutService.removeDocument(bagrutId.toString(), documentId.toString()))
        .rejects.toThrow('Error in bagrutService.removeDocument: Database error')
    })
  })

  describe('addProgramPiece', () => {
    it('should add a program piece to bagrut', async () => {
      // Setup
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      
      const pieceData = {
        pieceTitle: 'New Piece',
        composer: 'Composer',
        duration: '5:00',
        youtubeLink: 'https://youtube.com/watch?v=123'
      }
      
      const updatedBagrut = {
        _id: bagrutId,
        studentId: '123',
        teacherId: '456',
        program: [pieceData]
      }
      
      mockBagrutCollection.findOneAndUpdate.mockResolvedValue(updatedBagrut)

      // Execute
      const result = await bagrutService.addProgramPiece(bagrutId.toString(), pieceData)

      // Assert
      expect(mockBagrutCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        {
          $push: { program: pieceData },
          $set: { updatedAt: expect.any(Date) }
        },
        { returnDocument: 'after' }
      )
      
      expect(result).toEqual(updatedBagrut)
    })

    it('should throw error if bagrut is not found', async () => {
      // Setup
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const pieceData = { pieceTitle: 'New Piece', composer: 'Composer', duration: '5:00' }
      
      mockBagrutCollection.findOneAndUpdate.mockResolvedValue(null)

      // Execute & Assert
      await expect(bagrutService.addProgramPiece(bagrutId.toString(), pieceData))
        .rejects.toThrow(`Error in bagrutService.addProgramPiece: Bagrut with id ${bagrutId} not found`)
    })

    it('should handle database errors', async () => {
      // Setup
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const pieceData = { pieceTitle: 'New Piece', composer: 'Composer', duration: '5:00' }
      
      mockBagrutCollection.findOneAndUpdate.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(bagrutService.addProgramPiece(bagrutId.toString(), pieceData))
        .rejects.toThrow('Error in bagrutService.addProgramPiece: Database error')
    })
  })

  describe('removeProgramPiece', () => {
    it('should remove a program piece from bagrut', async () => {
      // Setup
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const pieceId = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      
      const updatedBagrut = {
        _id: bagrutId,
        studentId: '123',
        teacherId: '456',
        program: [] // Piece removed
      }
      
      mockBagrutCollection.findOneAndUpdate.mockResolvedValue(updatedBagrut)

      // Execute
      const result = await bagrutService.removeProgramPiece(bagrutId.toString(), pieceId.toString())

      // Assert
      expect(mockBagrutCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        {
         $pull: { program: { _id: expect.any(ObjectId) } },
          $set: { updatedAt: expect.any(Date) }
        },
        { returnDocument: 'after' }
      )
      
      expect(result).toEqual(updatedBagrut)
    })

    it('should throw error if bagrut is not found', async () => {
      // Setup
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const pieceId = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      
      mockBagrutCollection.findOneAndUpdate.mockResolvedValue(null)

      // Execute & Assert
      await expect(bagrutService.removeProgramPiece(bagrutId.toString(), pieceId.toString()))
        .rejects.toThrow(`Error in bagrutService.removeProgramPiece: Bagrut with id ${bagrutId} not found`)
    })

    it('should handle database errors', async () => {
      // Setup
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const pieceId = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      
      mockBagrutCollection.findOneAndUpdate.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(bagrutService.removeProgramPiece(bagrutId.toString(), pieceId.toString()))
        .rejects.toThrow('Error in bagrutService.removeProgramPiece: Database error')
    })
  })

  describe('addAccompanist', () => {
    it('should add an accompanist to bagrut', async () => {
      // Setup
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      
      const accompanistData = {
        name: 'Accompanist Name',
        instrument: 'Piano',
        phone: '0501234567'
      }
      
      const updatedBagrut = {
        _id: bagrutId,
        studentId: '123',
        teacherId: '456',
        accompaniment: {
          type: 'נגן מלווה',
          accompanists: [accompanistData]
        }
      }
      
      mockBagrutCollection.findOneAndUpdate.mockResolvedValue(updatedBagrut)

      // Execute
      const result = await bagrutService.addAccompanist(bagrutId.toString(), accompanistData)

      // Assert
      expect(mockBagrutCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        {
          $push: { 'accompaniment.accompanists': accompanistData },
          $set: { updatedAt: expect.any(Date) }
        },
        { returnDocument: 'after' }
      )
      
      expect(result).toEqual(updatedBagrut)
    })

    it('should throw error if bagrut is not found', async () => {
      // Setup
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const accompanistData = { name: 'Accompanist', instrument: 'Piano' }
      
      mockBagrutCollection.findOneAndUpdate.mockResolvedValue(null)

      // Execute & Assert
      await expect(bagrutService.addAccompanist(bagrutId.toString(), accompanistData))
        .rejects.toThrow(`Error in bagrutService.addAccompanist: Bagrut with id ${bagrutId} not found`)
    })

    it('should handle database errors', async () => {
      // Setup
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const accompanistData = { name: 'Accompanist', instrument: 'Piano' }
      
      mockBagrutCollection.findOneAndUpdate.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(bagrutService.addAccompanist(bagrutId.toString(), accompanistData))
        .rejects.toThrow('Error in bagrutService.addAccompanist: Database error')
    })
  })

  describe('removeAccompanist', () => {
    it('should remove an accompanist from bagrut', async () => {
      // Setup
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const accompanistId = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      
      const updatedBagrut = {
        _id: bagrutId,
        studentId: '123',
        teacherId: '456',
        accompaniment: {
          type: 'נגן מלווה',
          accompanists: [] // Accompanist removed
        }
      }
      
      mockBagrutCollection.findOneAndUpdate.mockResolvedValue(updatedBagrut)

      // Execute
      const result = await bagrutService.removeAccompanist(bagrutId.toString(), accompanistId.toString())

      // Assert
      expect(mockBagrutCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        {
          $pull: { 'accompaniment.accompanists': { _id: expect.any(ObjectId) } },
          $set: { updatedAt: expect.any(Date) }
        },
        { returnDocument: 'after' }
      )
      
      expect(result).toEqual(updatedBagrut)
    })

    it('should throw error if bagrut is not found', async () => {
      // Setup
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const accompanistId = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      
      mockBagrutCollection.findOneAndUpdate.mockResolvedValue(null)

      // Execute & Assert
      await expect(bagrutService.removeAccompanist(bagrutId.toString(), accompanistId.toString()))
        .rejects.toThrow(`Error in bagrutService.removeAccompanist: Bagrut with id ${bagrutId} not found`)
    })

    it('should handle database errors', async () => {
      // Setup
      const bagrutId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const accompanistId = new ObjectId('6579e36c83c8b3a5c2df8a8c')
      
      mockBagrutCollection.findOneAndUpdate.mockRejectedValue(new Error('Database error'))

      // Execute & Assert
      await expect(bagrutService.removeAccompanist(bagrutId.toString(), accompanistId.toString()))
        .rejects.toThrow('Error in bagrutService.removeAccompanist: Database error')
    })
  })

  describe('_buildCriteria', () => {
    it('should build criteria with studentId filter', () => {
      // Execute
      const criteria = bagrutService._buildCriteria({ studentId: '123' })
      
      // Assert
      expect(criteria).toEqual({
        studentId: '123',
        isActive: true
      })
    })

    it('should build criteria with teacherId filter', () => {
      // Execute
      const criteria = bagrutService._buildCriteria({ teacherId: '456' })
      
      // Assert
      expect(criteria).toEqual({
        teacherId: '456',
        isActive: true
      })
    })

    it('should include inactive flag when showInactive is true', () => {
      // Execute
      const criteria = bagrutService._buildCriteria({ 
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
      const criteria = bagrutService._buildCriteria({})
      
      // Assert
      expect(criteria).toEqual({
        isActive: true
      })
    })
  })
})