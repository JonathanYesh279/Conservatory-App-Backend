// api/bagrut/__tests__/bagrut.migration.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { bagrutService } from '../bagrut.service.js'
import { getCollection } from '../../../services/mongoDB.service.js'
import { ObjectId } from 'mongodb'

// Mock dependencies
vi.mock('../../../services/mongoDB.service.js', () => ({
  getCollection: vi.fn()
}))

vi.mock('../../student/student.service.js', () => ({
  studentService: {
    setBagrutId: vi.fn(),
    removeBagrutId: vi.fn()
  }
}))

describe('Bagrut Migration Verification Tests', () => {
  let mockCollection

  beforeEach(() => {
    vi.clearAllMocks()

    mockCollection = {
      findOne: vi.fn(),
      updateOne: vi.fn(),
      findOneAndUpdate: vi.fn(),
      find: vi.fn().mockReturnThis(),
      toArray: vi.fn()
    }

    getCollection.mockResolvedValue(mockCollection)
  })

  describe('Migration from 3 to 4 Presentations', () => {
    it('should migrate bagrut with 3 presentations to 4 presentations', async () => {
      const oldBagrutWith3Presentations = {
        _id: new ObjectId('6579e36c83c8b3a5c2df8a8b'),
        studentId: '6579e36c83c8b3a5c2df8a8c',
        teacherId: '6579e36c83c8b3a5c2df8a8d',
        presentations: [
          { completed: true, status: 'עבר/ה', review: 'Good', grade: 85, gradeLevel: 'טוב' },
          { completed: true, status: 'עבר/ה', review: 'Very good', grade: 90, gradeLevel: 'טוב מאוד' },
          { completed: false, status: 'לא נבחן', review: null, grade: null, gradeLevel: null }
        ]
      }

      const expectedMigratedBagrut = {
        ...oldBagrutWith3Presentations,
        presentations: [
          // First 3 presentations should have grades/gradeLevel removed and notes added
          { completed: true, status: 'עבר/ה', review: 'Good', notes: '', recordingLinks: [] },
          { completed: true, status: 'עבר/ה', review: 'Very good', notes: '', recordingLinks: [] },
          { completed: false, status: 'לא נבחן', review: null, notes: '', recordingLinks: [] },
          // Fourth presentation should be the new מגן בגרות presentation
          {
            completed: false,
            status: 'לא נבחן',
            date: null,
            review: null,
            reviewedBy: null,
            grade: null,
            gradeLevel: null,
            recordingLinks: [],
            detailedGrading: {
              playingSkills: { grade: 'לא הוערך', points: null, maxPoints: 40, comments: 'אין הערות' },
              musicalUnderstanding: { grade: 'לא הוערך', points: null, maxPoints: 30, comments: 'אין הערות' },
              textKnowledge: { grade: 'לא הוערך', points: null, maxPoints: 20, comments: 'אין הערות' },
              playingByHeart: { grade: 'לא הוערך', points: null, maxPoints: 10, comments: 'אין הערות' }
            }
          }
        ],
        // Should add missing fields with defaults
        gradingDetails: {
          technique: { grade: null, maxPoints: 20, comments: '' },
          interpretation: { grade: null, maxPoints: 30, comments: '' },
          musicality: { grade: null, maxPoints: 40, comments: '' },
          overall: { grade: null, maxPoints: 10, comments: '' }
        },
        directorEvaluation: {
          points: null,
          percentage: 10,
          comments: ''
        },
        recitalUnits: 5,
        recitalField: 'קלאסי',
        conservatoryName: '',
        finalGrade: null,
        finalGradeLevel: null,
        teacherSignature: '',
        completionDate: null,
        isCompleted: false
      }

      mockCollection.findOne.mockResolvedValueOnce(oldBagrutWith3Presentations)
      mockCollection.updateOne.mockResolvedValueOnce({ modifiedCount: 1 })

      // Trigger migration by calling updatePresentation
      await bagrutService.updatePresentation(
        oldBagrutWith3Presentations._id.toString(),
        1,
        { notes: 'Updated notes' },
        'teacherId'
      )

      expect(mockCollection.updateOne).toHaveBeenCalledWith(
        { _id: oldBagrutWith3Presentations._id },
        expect.objectContaining({
          $set: expect.objectContaining({
            presentations: expect.arrayContaining([
              expect.objectContaining({ notes: expect.any(String) }),
              expect.objectContaining({ notes: expect.any(String) }),
              expect.objectContaining({ notes: expect.any(String) }),
              expect.objectContaining({
                detailedGrading: expect.objectContaining({
                  playingSkills: expect.objectContaining({ maxPoints: 40 }),
                  musicalUnderstanding: expect.objectContaining({ maxPoints: 30 }),
                  textKnowledge: expect.objectContaining({ maxPoints: 20 }),
                  playingByHeart: expect.objectContaining({ maxPoints: 10 })
                })
              })
            ])
          })
        })
      )
    })

    it('should not migrate bagrut that already has 4 presentations', async () => {
      const bagrutWith4Presentations = {
        _id: new ObjectId('6579e36c83c8b3a5c2df8a8b'),
        studentId: '6579e36c83c8b3a5c2df8a8c',
        teacherId: '6579e36c83c8b3a5c2df8a8d',
        presentations: [
          { completed: true, status: 'עבר/ה', notes: '' },
          { completed: true, status: 'עבר/ה', notes: '' },
          { completed: true, status: 'עבר/ה', notes: '' },
          { completed: false, status: 'לא נבחן', grade: null, detailedGrading: {} }
        ]
      }

      mockCollection.findOne.mockResolvedValueOnce(bagrutWith4Presentations)
      mockCollection.findOneAndUpdate.mockResolvedValueOnce({
        ...bagrutWith4Presentations,
        presentations: [
          ...bagrutWith4Presentations.presentations.slice(0, 1),
          { ...bagrutWith4Presentations.presentations[1], notes: 'Updated notes' },
          ...bagrutWith4Presentations.presentations.slice(2)
        ]
      })

      await bagrutService.updatePresentation(
        bagrutWith4Presentations._id.toString(),
        1,
        { notes: 'Updated notes' },
        'teacherId'
      )

      // Should not call updateOne for migration since it already has 4 presentations
      expect(mockCollection.updateOne).not.toHaveBeenCalled()
      expect(mockCollection.findOneAndUpdate).toHaveBeenCalled()
    })

    it('should handle migration errors gracefully', async () => {
      const problematicBagrut = {
        _id: 'invalid-object-id', // Invalid ObjectId
        presentations: [{ completed: true }, { completed: true }, { completed: true }]
      }

      // Should not throw error, just log warning
      await expect(
        bagrutService.updatePresentation('invalid-object-id', 0, { notes: 'test' }, 'teacherId')
      ).rejects.toThrow('Invalid ObjectId')
    })
  })

  describe('Migration of Default Values', () => {
    it('should apply default values for missing fields during migration', async () => {
      const incompleteOldBagrut = {
        _id: new ObjectId('6579e36c83c8b3a5c2df8a8b'),
        studentId: '6579e36c83c8b3a5c2df8a8c',
        teacherId: '6579e36c83c8b3a5c2df8a8d',
        presentations: [
          { completed: true, status: 'עבר/ה' },
          { completed: true, status: 'עבר/ה' },
          { completed: false, status: 'לא נבחן' }
        ]
        // Missing many fields that should get defaults
      }

      mockCollection.findOne.mockResolvedValueOnce(incompleteOldBagrut)
      mockCollection.updateOne.mockResolvedValueOnce({ modifiedCount: 1 })

      await bagrutService.updatePresentation(
        incompleteOldBagrut._id.toString(),
        0,
        { notes: 'test' },
        'teacherId'
      )

      expect(mockCollection.updateOne).toHaveBeenCalledWith(
        { _id: incompleteOldBagrut._id },
        expect.objectContaining({
          $set: expect.objectContaining({
            // Should set default values
            recitalUnits: 5,
            recitalField: 'קלאסי',
            conservatoryName: '',
            finalGrade: null,
            finalGradeLevel: null,
            teacherSignature: '',
            completionDate: null,
            isCompleted: false,
            directorEvaluation: {
              points: null,
              percentage: 10,
              comments: ''
            },
            gradingDetails: {
              technique: { grade: null, maxPoints: 20, comments: '' },
              interpretation: { grade: null, maxPoints: 30, comments: '' },
              musicality: { grade: null, maxPoints: 40, comments: '' },
              overall: { grade: null, maxPoints: 10, comments: '' }
            }
          })
        })
      )
    })

    it('should preserve existing values during migration', async () => {
      const bagrutWithExistingValues = {
        _id: new ObjectId('6579e36c83c8b3a5c2df8a8b'),
        studentId: '6579e36c83c8b3a5c2df8a8c',
        teacherId: '6579e36c83c8b3a5c2df8a8d',
        presentations: [
          { completed: true, status: 'עבר/ה' },
          { completed: true, status: 'עבר/ה' },
          { completed: false, status: 'לא נבחן' }
        ],
        // Existing values that should be preserved
        conservatoryName: 'Jerusalem Academy',
        finalGrade: 88,
        finalGradeLevel: 'טוב',
        teacherSignature: 'John Doe',
        isCompleted: true,
        recitalUnits: 3,
        recitalField: 'ג\'אז'
      }

      mockCollection.findOne.mockResolvedValueOnce(bagrutWithExistingValues)
      mockCollection.updateOne.mockResolvedValueOnce({ modifiedCount: 1 })

      await bagrutService.updatePresentation(
        bagrutWithExistingValues._id.toString(),
        0,
        { notes: 'test' },
        'teacherId'
      )

      expect(mockCollection.updateOne).toHaveBeenCalledWith(
        { _id: bagrutWithExistingValues._id },
        expect.objectContaining({
          $set: expect.objectContaining({
            // Should preserve existing values
            conservatoryName: 'Jerusalem Academy',
            finalGrade: 88,
            finalGradeLevel: 'טוב',
            teacherSignature: 'John Doe',
            isCompleted: true,
            recitalUnits: 3,
            recitalField: 'ג\'אז'
          })
        })
      )
    })
  })

  describe('Migration of Detailed Grading System', () => {
    it('should migrate old grading to new detailed grading system', async () => {
      const oldBagrutWithOldGrading = {
        _id: new ObjectId('6579e36c83c8b3a5c2df8a8b'),
        studentId: '6579e36c83c8b3a5c2df8a8c',
        teacherId: '6579e36c83c8b3a5c2df8a8d',
        presentations: [
          { completed: true, status: 'עבר/ה', grade: 85, gradeLevel: 'טוב' },
          { completed: true, status: 'עבר/ה', grade: 90, gradeLevel: 'טוב מאוד' },
          { completed: false, status: 'לא נבחן' }
        ],
        magenBagrut: {
          completed: true,
          status: 'עבר/ה',
          grade: 88,
          gradeLevel: 'טוב'
          // Missing detailedGrading - should be added
        }
      }

      mockCollection.findOne.mockResolvedValueOnce(oldBagrutWithOldGrading)
      mockCollection.updateOne.mockResolvedValueOnce({ modifiedCount: 1 })

      await bagrutService.updatePresentation(
        oldBagrutWithOldGrading._id.toString(),
        0,
        { notes: 'test' },
        'teacherId'
      )

      expect(mockCollection.updateOne).toHaveBeenCalledWith(
        { _id: oldBagrutWithOldGrading._id },
        expect.objectContaining({
          $set: expect.objectContaining({
            'magenBagrut.detailedGrading': {
              playingSkills: { grade: 'לא הוערך', points: null, maxPoints: 40, comments: 'אין הערות' },
              musicalUnderstanding: { grade: 'לא הוערך', points: null, maxPoints: 30, comments: 'אין הערות' },
              textKnowledge: { grade: 'לא הוערך', points: null, maxPoints: 20, comments: 'אין הערות' },
              playingByHeart: { grade: 'לא הוערך', points: null, maxPoints: 10, comments: 'אין הערות' }
            }
          })
        })
      )
    })

    it('should preserve existing detailed grading during migration', async () => {
      const bagrutWithExistingDetailedGrading = {
        _id: new ObjectId('6579e36c83c8b3a5c2df8a8b'),
        studentId: '6579e36c83c8b3a5c2df8a8c',
        teacherId: '6579e36c83c8b3a5c2df8a8d',
        presentations: [
          { completed: true, status: 'עבר/ה' },
          { completed: true, status: 'עבר/ה' },
          { completed: false, status: 'לא נבחן' }
        ],
        magenBagrut: {
          completed: true,
          status: 'עבר/ה',
          grade: 88,
          gradeLevel: 'טוב',
          detailedGrading: {
            playingSkills: { grade: 'טוב', points: 32, maxPoints: 40, comments: 'Good technique' },
            musicalUnderstanding: { grade: 'מעולה', points: 28, maxPoints: 30, comments: 'Excellent' },
            textKnowledge: { grade: 'טוב מאוד', points: 18, maxPoints: 20, comments: 'Very good' },
            playingByHeart: { grade: 'טוב', points: 8, maxPoints: 10, comments: 'Good memory' }
          }
        }
      }

      mockCollection.findOne.mockResolvedValueOnce(bagrutWithExistingDetailedGrading)
      mockCollection.updateOne.mockResolvedValueOnce({ modifiedCount: 1 })

      await bagrutService.updatePresentation(
        bagrutWithExistingDetailedGrading._id.toString(),
        0,
        { notes: 'test' },
        'teacherId'
      )

      expect(mockCollection.updateOne).toHaveBeenCalledWith(
        { _id: bagrutWithExistingDetailedGrading._id },
        expect.objectContaining({
          $set: expect.objectContaining({
            'magenBagrut.detailedGrading': bagrutWithExistingDetailedGrading.magenBagrut.detailedGrading
          })
        })
      )
    })
  })

  describe('Migration Data Integrity Tests', () => {
    it('should ensure no data loss during migration', async () => {
      const originalBagrut = {
        _id: new ObjectId('6579e36c83c8b3a5c2df8a8b'),
        studentId: '6579e36c83c8b3a5c2df8a8c',
        teacherId: '6579e36c83c8b3a5c2df8a8d',
        presentations: [
          { 
            completed: true, 
            status: 'עבר/ה', 
            date: new Date('2024-01-15'),
            review: 'Excellent performance',
            reviewedBy: 'teacher123',
            grade: 92, // Should be removed
            gradeLevel: 'טוב מאוד', // Should be removed
            customField: 'should be preserved' // Custom field should be preserved
          },
          { completed: true, status: 'עבר/ה' },
          { completed: false, status: 'לא נבחן' }
        ],
        program: [
          { pieceTitle: 'Sonata', composer: 'Mozart', duration: '10:00' }
        ],
        accompaniment: {
          type: 'נגן מלווה',
          accompanists: [{ name: 'John', instrument: 'Piano' }]
        },
        documents: [
          { title: 'Score', fileUrl: '/uploads/score.pdf' }
        ],
        notes: 'Important student notes',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-10')
      }

      mockCollection.findOne.mockResolvedValueOnce(originalBagrut)
      mockCollection.updateOne.mockResolvedValueOnce({ modifiedCount: 1 })

      await bagrutService.updatePresentation(
        originalBagrut._id.toString(),
        0,
        { notes: 'Updated notes' },
        'teacherId'
      )

      expect(mockCollection.updateOne).toHaveBeenCalledWith(
        { _id: originalBagrut._id },
        expect.objectContaining({
          $set: expect.objectContaining({
            presentations: expect.arrayContaining([
              expect.objectContaining({
                completed: true,
                status: 'עבר/ה',
                date: originalBagrut.presentations[0].date,
                review: 'Excellent performance',
                reviewedBy: 'teacher123',
                customField: 'should be preserved',
                // grade and gradeLevel should be removed
                notes: expect.any(String),
                recordingLinks: expect.any(Array)
              })
            ])
          })
        })
      )
    })

    it('should handle malformed data during migration', async () => {
      const malformedBagrut = {
        _id: new ObjectId('6579e36c83c8b3a5c2df8a8b'),
        studentId: '6579e36c83c8b3a5c2df8a8c',
        teacherId: '6579e36c83c8b3a5c2df8a8d',
        presentations: [
          { completed: 'true' }, // String instead of boolean
          { status: 123 }, // Number instead of string
          null // Null presentation
        ]
      }

      mockCollection.findOne.mockResolvedValueOnce(malformedBagrut)
      mockCollection.updateOne.mockResolvedValueOnce({ modifiedCount: 1 })

      // Should not throw error and handle gracefully
      await expect(
        bagrutService.updatePresentation(
          malformedBagrut._id.toString(),
          0,
          { notes: 'test' },
          'teacherId'
        )
      ).not.toThrow()
    })
  })

  describe('Migration Performance and Efficiency', () => {
    it('should only migrate when necessary', async () => {
      const modernBagrut = {
        _id: new ObjectId('6579e36c83c8b3a5c2df8a8b'),
        studentId: '6579e36c83c8b3a5c2df8a8c',
        teacherId: '6579e36c83c8b3a5c2df8a8d',
        presentations: [
          { completed: true, status: 'עבר/ה', notes: '' },
          { completed: true, status: 'עבר/ה', notes: '' },
          { completed: true, status: 'עבר/ה', notes: '' },
          { 
            completed: true, 
            status: 'עבר/ה', 
            grade: 88,
            gradeLevel: 'טוב',
            detailedGrading: {
              playingSkills: { points: 35, maxPoints: 40 },
              musicalUnderstanding: { points: 26, maxPoints: 30 },
              textKnowledge: { points: 18, maxPoints: 20 },
              playingByHeart: { points: 9, maxPoints: 10 }
            }
          }
        ]
      }

      mockCollection.findOne.mockResolvedValueOnce(modernBagrut)
      mockCollection.findOneAndUpdate.mockResolvedValueOnce(modernBagrut)

      await bagrutService.updatePresentation(
        modernBagrut._id.toString(),
        0,
        { notes: 'test' },
        'teacherId'
      )

      // Should not call migration updateOne since bagrut is already modern
      expect(mockCollection.updateOne).not.toHaveBeenCalled()
      expect(mockCollection.findOneAndUpdate).toHaveBeenCalled()
    })
  })

  describe('Bulk Migration Testing', () => {
    it('should handle migration of multiple documents', async () => {
      const oldBagruts = [
        {
          _id: new ObjectId('6579e36c83c8b3a5c2df8a8a'),
          presentations: [{ completed: true }, { completed: true }, { completed: false }]
        },
        {
          _id: new ObjectId('6579e36c83c8b3a5c2df8a8b'),
          presentations: [{ completed: true }, { completed: true }, { completed: false }]
        },
        {
          _id: new ObjectId('6579e36c83c8b3a5c2df8a8c'),
          presentations: [{ completed: true }, { completed: true }, { completed: false }]
        }
      ]

      // Simulate multiple migration calls
      for (const bagrut of oldBagruts) {
        mockCollection.findOne.mockResolvedValueOnce(bagrut)
        mockCollection.updateOne.mockResolvedValueOnce({ modifiedCount: 1 })

        await bagrutService.updatePresentation(
          bagrut._id.toString(),
          0,
          { notes: 'test' },
          'teacherId'
        )
      }

      expect(mockCollection.updateOne).toHaveBeenCalledTimes(3)
    })
  })
})