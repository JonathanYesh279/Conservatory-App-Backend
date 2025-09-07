// api/bagrut/__tests__/bagrut.integration-workflow.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { bagrutService } from '../bagrut.service.js'
import { 
  getGradeLevelFromScore,
  calculateFinalGradeWithDirectorEvaluation,
  validateBagrutCompletion
} from '../bagrut.validation.js'
import { getCollection } from '../../../services/mongoDB.service.js'
import { ObjectId } from 'mongodb'

// Mock dependencies
vi.mock('../../../services/mongoDB.service.js', () => ({
  getCollection: vi.fn()
}))

// Mock student service to avoid circular dependency issues
vi.mock('../../student/student.service.js', () => ({
  studentService: {
    setBagrutId: vi.fn(),
    removeBagrutId: vi.fn()
  }
}))

describe('Bagrut Integration Workflow Tests', () => {
  let mockCollection
  let mockBagrutData

  beforeEach(() => {
    vi.clearAllMocks()

    mockCollection = {
      findOne: vi.fn(),
      findOneAndUpdate: vi.fn(),
      insertOne: vi.fn(),
      updateOne: vi.fn(),
      deleteOne: vi.fn()
    }

    getCollection.mockResolvedValue(mockCollection)

    mockBagrutData = {
      _id: new ObjectId('6579e36c83c8b3a5c2df8a8b'),
      studentId: '6579e36c83c8b3a5c2df8a8c',
      teacherId: '6579e36c83c8b3a5c2df8a8d',
      recitalUnits: 5,
      recitalField: 'קלאסי',
      program: [
        { pieceNumber: 1, pieceTitle: 'Sonata No. 1', composer: 'Mozart', duration: '10:00' },
        { pieceNumber: 2, pieceTitle: 'Etude Op. 10', composer: 'Chopin', duration: '8:00' },
        { pieceNumber: 3, pieceTitle: 'Prelude', composer: 'Bach', duration: '6:00' },
        { pieceNumber: 4, pieceTitle: 'Impromptu', composer: 'Schubert', duration: '7:00' },
        { pieceNumber: 5, pieceTitle: 'Nocturne', composer: 'Chopin', duration: '9:00' }
      ],
      presentations: [
        { completed: true, status: 'עבר/ה', notes: 'Good performance', recordingLinks: [] },
        { completed: true, status: 'עבר/ה', notes: 'Excellent technique', recordingLinks: [] },
        { completed: true, status: 'עבר/ה', notes: 'Musical interpretation', recordingLinks: [] },
        { 
          completed: true, 
          status: 'עבר/ה', 
          grade: 85, 
          gradeLevel: 'טוב',
          detailedGrading: {
            playingSkills: { points: 35, maxPoints: 40 },
            musicalUnderstanding: { points: 25, maxPoints: 30 },
            textKnowledge: { points: 17, maxPoints: 20 },
            playingByHeart: { points: 8, maxPoints: 10 }
          }
        }
      ],
      directorEvaluation: {
        points: 8,
        percentage: 10,
        comments: 'Excellent student'
      },
      magenBagrut: { completed: true, status: 'עבר/ה', grade: 85, gradeLevel: 'טוב' },
      isCompleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  })

  describe('Complete Workflow - Creation to Completion', () => {
    it('should create a new bagrut with all required fields', async () => {
      const newBagrutData = {
        studentId: '6579e36c83c8b3a5c2df8a8c',
        teacherId: '6579e36c83c8b3a5c2df8a8d',
        recitalUnits: 5,
        recitalField: 'קלאסי'
      }

      const insertResult = {
        insertedId: new ObjectId('6579e36c83c8b3a5c2df8a8b')
      }

      mockCollection.findOne.mockResolvedValueOnce(null) // No existing bagrut
      mockCollection.insertOne.mockResolvedValueOnce(insertResult)

      const result = await bagrutService.addBagrut(newBagrutData)

      expect(result).toMatchObject({
        _id: insertResult.insertedId,
        studentId: newBagrutData.studentId,
        teacherId: newBagrutData.teacherId,
        recitalUnits: 5,
        recitalField: 'קלאסי'
      })

      expect(result.presentations).toHaveLength(4)
      expect(result.presentations[0].completed).toBe(false)
      expect(result.presentations[3]).toHaveProperty('detailedGrading')
    })

    it('should update presentations with new point system', async () => {
      const presentationData = {
        completed: true,
        status: 'עבר/ה',
        detailedGrading: {
          playingSkills: { points: 35, maxPoints: 40, comments: 'Excellent technique' },
          musicalUnderstanding: { points: 26, maxPoints: 30, comments: 'Very good interpretation' },
          textKnowledge: { points: 18, maxPoints: 20, comments: 'Good knowledge' },
          playingByHeart: { points: 9, maxPoints: 10, comments: 'Confident performance' }
        }
      }

      const updatedBagrut = {
        ...mockBagrutData,
        presentations: [
          ...mockBagrutData.presentations.slice(0, 3),
          {
            ...presentationData,
            grade: 88, // Should be calculated from detailed grading
            gradeLevel: 'טוב',
            date: expect.any(Date),
            reviewedBy: 'teacherId'
          }
        ]
      }

      mockCollection.findOneAndUpdate.mockResolvedValueOnce(updatedBagrut)

      const result = await bagrutService.updatePresentation(
        mockBagrutData._id.toString(),
        3,
        presentationData,
        'teacherId'
      )

      expect(result.presentations[3].grade).toBe(88)
      expect(result.presentations[3].gradeLevel).toBe('טוב')
      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        expect.objectContaining({
          $set: expect.objectContaining({
            'presentations.3': expect.objectContaining({
              grade: 88,
              gradeLevel: 'טוב'
            })
          })
        }),
        { returnDocument: 'after' }
      )
    })

    it('should add director evaluation and recalculate grade', async () => {
      const evaluation = {
        points: 9,
        comments: 'Outstanding leadership and performance'
      }

      const updatedBagrut = {
        ...mockBagrutData,
        directorEvaluation: {
          points: 9,
          percentage: 10,
          comments: evaluation.comments
        },
        finalGrade: 85, // Will be calculated based on performance + director
        finalGradeLevel: 'טוב'
      }

      mockCollection.findOne.mockResolvedValueOnce(mockBagrutData)
      mockCollection.findOneAndUpdate
        .mockResolvedValueOnce(updatedBagrut) // First update for director evaluation
        .mockResolvedValueOnce({ // Second call for final grade calculation
          ...updatedBagrut,
          finalGrade: Math.round(85 * 0.9 + 9), // 76.5 + 9 = 85.5 → 86
          finalGradeLevel: getGradeLevelFromScore(86)
        })

      const result = await bagrutService.updateDirectorEvaluation(
        mockBagrutData._id.toString(),
        evaluation
      )

      expect(result.directorEvaluation.points).toBe(9)
      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledTimes(2)
    })

    it('should complete bagrut with all requirements met', async () => {
      const completeBagrutData = {
        ...mockBagrutData,
        program: [
          { pieceNumber: 1, pieceTitle: 'Piece 1', composer: 'Composer 1', duration: '10:00' },
          { pieceNumber: 2, pieceTitle: 'Piece 2', composer: 'Composer 2', duration: '8:00' },
          { pieceNumber: 3, pieceTitle: 'Piece 3', composer: 'Composer 3', duration: '6:00' },
          { pieceNumber: 4, pieceTitle: 'Piece 4', composer: 'Composer 4', duration: '7:00' },
          { pieceNumber: 5, pieceTitle: 'Piece 5', composer: 'Composer 5', duration: '9:00' }
        ],
        presentations: [
          { completed: true, status: 'עבר/ה' },
          { completed: true, status: 'עבר/ה' },
          { completed: true, status: 'עבר/ה' },
          { completed: true, status: 'עבר/ה' }
        ],
        magenBagrut: { completed: true, status: 'עבר/ה' },
        directorEvaluation: { points: 8, percentage: 10 },
        recitalUnits: 5
      }

      const completedBagrut = {
        ...completeBagrutData,
        isCompleted: true,
        completionDate: expect.any(Date),
        teacherSignature: 'Teacher Name'
      }

      mockCollection.findOne
        .mockResolvedValueOnce(completeBagrutData) // First call in completeBagrut
        .mockResolvedValueOnce(completeBagrutData) // Second call for validation

      mockCollection.findOneAndUpdate.mockResolvedValueOnce(completedBagrut)

      const result = await bagrutService.completeBagrut(
        mockBagrutData._id.toString(),
        'teacherId',
        'Teacher Name'
      )

      expect(result.isCompleted).toBe(true)
      expect(result.completionDate).toBeInstanceOf(Date)
      expect(result.teacherSignature).toBe('Teacher Name')
    })
  })

  describe('Validation During Workflow', () => {
    it('should validate completion requirements', () => {
      const incompleteBagrut = {
        presentations: [
          { completed: true },
          { completed: false }, // Incomplete presentation
          { completed: true },
          { completed: true }
        ],
        magenBagrut: { completed: true },
        program: [{ pieceTitle: 'Test' }] // Has program
      }

      const errors = validateBagrutCompletion(incompleteBagrut)
      expect(errors).toContain('כל ההשמעות חייבות להיות מושלמות')
    })

    it('should prevent completion without all program pieces', async () => {
      const incompleteProgramBagrut = {
        ...mockBagrutData,
        program: [
          { pieceTitle: 'Piece 1', composer: 'Composer 1', duration: '10:00' },
          { pieceTitle: 'Piece 2', composer: 'Composer 2', duration: '8:00' }
          // Missing pieces 3, 4, 5
        ]
      }

      mockCollection.findOne.mockResolvedValueOnce(incompleteProgramBagrut)

      await expect(
        bagrutService.completeBagrut(mockBagrutData._id.toString(), 'teacherId', 'signature')
      ).rejects.toThrow('כל 5 יצירות התוכנית חייבות להיות מוזנות')
    })

    it('should prevent completion without director evaluation', async () => {
      const noDirectorBagrut = {
        ...mockBagrutData,
        directorEvaluation: { points: null, percentage: 10 }
      }

      mockCollection.findOne.mockResolvedValueOnce(noDirectorBagrut)

      await expect(
        bagrutService.completeBagrut(mockBagrutData._id.toString(), 'teacherId', 'signature')
      ).rejects.toThrow('הערכת מנהל חייבת להיות מושלמת')
    })

    it('should prevent completion without recital units set', async () => {
      const noRecitalUnitsBagrut = {
        ...mockBagrutData,
        recitalUnits: null
      }

      mockCollection.findOne.mockResolvedValueOnce(noRecitalUnitsBagrut)

      await expect(
        bagrutService.completeBagrut(mockBagrutData._id.toString(), 'teacherId', 'signature')
      ).rejects.toThrow('יחידות רסיטל חייבות להיות מוגדרות')
    })
  })

  describe('Grade Recalculation Throughout Workflow', () => {
    it('should recalculate grades when detailed grading is updated', async () => {
      const newDetailedGrading = {
        playingSkills: { points: 38, maxPoints: 40 },
        musicalUnderstanding: { points: 28, maxPoints: 30 },
        textKnowledge: { points: 19, maxPoints: 20 },
        playingByHeart: { points: 9, maxPoints: 10 }
      }

      const expectedTotalGrade = 38 + 28 + 19 + 9 // = 94

      const updatedBagrut = {
        ...mockBagrutData,
        gradingDetails: newDetailedGrading,
        'presentations.3.grade': expectedTotalGrade,
        'presentations.3.gradeLevel': 'מעולה'
      }

      mockCollection.findOne.mockResolvedValueOnce(mockBagrutData)
      mockCollection.findOneAndUpdate.mockResolvedValueOnce(updatedBagrut)

      const result = await bagrutService.updateGradingDetails(
        mockBagrutData._id.toString(),
        newDetailedGrading,
        'teacherId'
      )

      expect(result['presentations.3.grade']).toBe(94)
      expect(result['presentations.3.gradeLevel']).toBe('מעולה')
    })

    it('should calculate final grade with director evaluation throughout workflow', async () => {
      // Test the complete calculation flow
      const performanceGrade = 88
      const directorPoints = 7

      const finalGrade = calculateFinalGradeWithDirectorEvaluation(
        {
          playingSkills: { points: 35, maxPoints: 40 },
          musicalUnderstanding: { points: 26, maxPoints: 30 },
          textKnowledge: { points: 18, maxPoints: 20 },
          playingByHeart: { points: 9, maxPoints: 10 }
        },
        { points: directorPoints, percentage: 10 }
      )

      expect(finalGrade).toBe(86) // 88 * 0.9 + 7 = 79.2 + 7 = 86.2 → 86
    })
  })

  describe('Configuration and Setup Integration', () => {
    it('should set recital configuration correctly', async () => {
      const units = 3
      const field = 'ג\'אז'

      const updatedBagrut = {
        ...mockBagrutData,
        recitalUnits: units,
        recitalField: field
      }

      mockCollection.findOne.mockResolvedValueOnce(mockBagrutData)
      mockCollection.findOneAndUpdate.mockResolvedValueOnce(updatedBagrut)

      const result = await bagrutService.setRecitalConfiguration(
        mockBagrutData._id.toString(),
        units,
        field
      )

      expect(result.recitalUnits).toBe(3)
      expect(result.recitalField).toBe('ג\'אז')
    })

    it('should reject invalid recital configuration', async () => {
      await expect(
        bagrutService.setRecitalConfiguration(
          mockBagrutData._id.toString(),
          4, // Invalid units (must be 3 or 5)
          'קלאסי'
        )
      ).rejects.toThrow('Recital units must be either 3 or 5')

      await expect(
        bagrutService.setRecitalConfiguration(
          mockBagrutData._id.toString(),
          5,
          'invalid-field' // Invalid field
        )
      ).rejects.toThrow('Recital field must be one of')
    })
  })

  describe('Error Handling in Workflow', () => {
    it('should handle database errors gracefully', async () => {
      mockCollection.findOne.mockRejectedValueOnce(new Error('Database connection failed'))

      await expect(
        bagrutService.getBagrutById(mockBagrutData._id.toString())
      ).rejects.toThrow('Database connection failed')
    })

    it('should handle invalid ObjectId gracefully', async () => {
      await expect(
        bagrutService.getBagrutById('invalid-object-id')
      ).rejects.toThrow('Invalid ObjectId')
    })

    it('should handle missing bagrut gracefully', async () => {
      mockCollection.findOne.mockResolvedValueOnce(null)

      await expect(
        bagrutService.getBagrutById(mockBagrutData._id.toString())
      ).rejects.toThrow('not found')
    })
  })

  describe('Data Integrity During Workflow', () => {
    it('should maintain data consistency when updating presentations', async () => {
      const presentationUpdate = {
        completed: true,
        status: 'עבר/ה',
        notes: 'Updated notes'
      }

      // For presentations 0-2, should not have grade/gradeLevel
      for (let i = 0; i < 3; i++) {
        const updatedBagrut = {
          ...mockBagrutData,
          presentations: mockBagrutData.presentations.map((p, index) => 
            index === i ? { ...p, ...presentationUpdate, notes: presentationUpdate.notes } : p
          )
        }

        mockCollection.findOneAndUpdate.mockResolvedValueOnce(updatedBagrut)

        const result = await bagrutService.updatePresentation(
          mockBagrutData._id.toString(),
          i,
          presentationUpdate,
          'teacherId'
        )

        expect(result.presentations[i]).not.toHaveProperty('grade')
        expect(result.presentations[i]).not.toHaveProperty('gradeLevel')
        expect(result.presentations[i]).toHaveProperty('notes')
      }
    })

    it('should preserve existing data when making partial updates', async () => {
      const partialUpdate = {
        notes: 'New notes only'
      }

      const updatedBagrut = {
        ...mockBagrutData,
        presentations: [
          { ...mockBagrutData.presentations[0], notes: 'New notes only' },
          ...mockBagrutData.presentations.slice(1)
        ]
      }

      mockCollection.findOneAndUpdate.mockResolvedValueOnce(updatedBagrut)

      const result = await bagrutService.updatePresentation(
        mockBagrutData._id.toString(),
        0,
        partialUpdate,
        'teacherId'
      )

      // Should preserve other fields
      expect(result.presentations[0].completed).toBe(mockBagrutData.presentations[0].completed)
      expect(result.presentations[0].status).toBe(mockBagrutData.presentations[0].status)
      expect(result.presentations[0].notes).toBe('New notes only')
    })
  })
})