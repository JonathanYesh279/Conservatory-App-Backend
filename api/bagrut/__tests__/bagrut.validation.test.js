// api/bagrut/__tests__/bagrut.validation.test.js
import { describe, it, expect } from 'vitest'
import { validateBagrut, bagrutSchema, BAGRUT_CONSTANTS, calculateTotalGradeFromDetailedGrading } from '../bagrut.validation.js'

describe('Bagrut Validation', () => {
  describe('validateBagrut', () => {
    it('should validate a valid bagrut object', () => {
      // Setup
      const validBagrut = {
        studentId: '6579e36c83c8b3a5c2df8a8b',
        teacherId: '6579e36c83c8b3a5c2df8a8c',
        program: [
          {
            pieceTitle: 'Test Piece',
            composer: 'Test Composer',
            duration: '5:00',
            youtubeLink: 'https://youtube.com/watch?v=123456'
          }
        ],
        testDate: new Date(),
        notes: 'Test notes'
      }

      // Execute
      const { error, value } = validateBagrut(validBagrut)

      // Assert
      expect(error).toBeUndefined()
      expect(value).toMatchObject(validBagrut)
    })

    it('should validate with default values for optional fields', () => {
      // Setup
      const minimalBagrut = {
        studentId: '6579e36c83c8b3a5c2df8a8b',
        teacherId: '6579e36c83c8b3a5c2df8a8c'
      }

      // Execute
      const { error, value } = validateBagrut(minimalBagrut)

      // Assert
      expect(error).toBeUndefined()
      expect(value).toMatchObject({
        studentId: '6579e36c83c8b3a5c2df8a8b',
        teacherId: '6579e36c83c8b3a5c2df8a8c',
        program: [],
        accompaniment: {
          type: 'נגן מלווה',
          accompanists: []
        },
        presentations: [
          { completed: false, status: 'לא נבחן', date: null, review: null, reviewedBy: null, notes: '', recordingLinks: [] },
          { completed: false, status: 'לא נבחן', date: null, review: null, reviewedBy: null, notes: '', recordingLinks: [] },
          { completed: false, status: 'לא נבחן', date: null, review: null, reviewedBy: null, notes: '', recordingLinks: [] },
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
              playingSkills: { grade: 'לא הוערך', points: null, maxPoints: 20, comments: 'אין הערות' },
              musicalUnderstanding: { grade: 'לא הוערך', points: null, maxPoints: 40, comments: 'אין הערות' },
              textKnowledge: { grade: 'לא הוערך', points: null, maxPoints: 30, comments: 'אין הערות' },
              playingByHeart: { grade: 'לא הוערך', points: null, maxPoints: 10, comments: 'אין הערות' }
            }
          }
        ],
        magenBagrut: {
          completed: false,
          status: 'לא נבחן',
          date: null,
          review: null,
          reviewedBy: null,
          grade: null,
          gradeLevel: null,
          recordingLinks: [],
          detailedGrading: {
            playingSkills: { grade: 'לא הוערך', points: null, maxPoints: 20, comments: 'אין הערות' },
            musicalUnderstanding: { grade: 'לא הוערך', points: null, maxPoints: 40, comments: 'אין הערות' },
            textKnowledge: { grade: 'לא הוערך', points: null, maxPoints: 30, comments: 'אין הערות' },
            playingByHeart: { grade: 'לא הוערך', points: null, maxPoints: 10, comments: 'אין הערות' }
          }
        },
        documents: [],
        notes: '',
        isActive: true
      })
    })

    it('should require studentId', () => {
      // Setup
      const invalidBagrut = {
        // Missing studentId
        teacherId: '6579e36c83c8b3a5c2df8a8c'
      }

      // Execute
      const { error } = validateBagrut(invalidBagrut)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"studentId" is required')
    })

    it('should require teacherId', () => {
      // Setup
      const invalidBagrut = {
        studentId: '6579e36c83c8b3a5c2df8a8b'
        // Missing teacherId
      }

      // Execute
      const { error } = validateBagrut(invalidBagrut)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"teacherId" is required')
    })

    it('should validate program pieces', () => {
      // Setup
      const invalidBagrut = {
        studentId: '6579e36c83c8b3a5c2df8a8b',
        teacherId: '6579e36c83c8b3a5c2df8a8c',
        program: [
          {
            // Missing required pieceTitle
            composer: 'Test Composer',
            duration: '5:00',
            youtubeLink: 'https://youtube.com/watch?v=123456'
          }
        ]
      }

      // Execute
      const { error } = validateBagrut(invalidBagrut)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"program[0].pieceTitle" is required')
    })

    it('should validate accompaniment type', () => {
      // Setup
      const invalidBagrut = {
        studentId: '6579e36c83c8b3a5c2df8a8b',
        teacherId: '6579e36c83c8b3a5c2df8a8c',
        accompaniment: {
          type: 'invalid-type', // Not in allowed values
          accompanists: []
        }
      }

      // Execute
      const { error } = validateBagrut(invalidBagrut)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"accompaniment.type" must be one of')
    })

    it('should validate accompanist data', () => {
      // Setup
      const invalidBagrut = {
        studentId: '6579e36c83c8b3a5c2df8a8b',
        teacherId: '6579e36c83c8b3a5c2df8a8c',
        accompaniment: {
          type: 'נגן מלווה',
          accompanists: [
            {
              // Missing required name
              instrument: 'Piano'
            }
          ]
        }
      }

      // Execute
      const { error } = validateBagrut(invalidBagrut)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"accompaniment.accompanists[0].name" is required')
    })

    it('should validate phone number format in accompanist data', () => {
      // Setup
      const invalidBagrut = {
        studentId: '6579e36c83c8b3a5c2df8a8b',
        teacherId: '6579e36c83c8b3a5c2df8a8c',
        accompaniment: {
          type: 'נגן מלווה',
          accompanists: [
            {
              name: 'Test Accompanist',
              instrument: 'Piano',
              phone: '123456789' // Invalid format (should start with 05)
            }
          ]
        }
      }

      // Execute
      const { error } = validateBagrut(invalidBagrut)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"accompaniment.accompanists[0].phone" with value')
    })

    it('should validate presentation status', () => {
      // Setup
      const invalidBagrut = {
        studentId: '6579e36c83c8b3a5c2df8a8b',
        teacherId: '6579e36c83c8b3a5c2df8a8c',
        presentations: [
          {
            completed: true,
            status: 'invalid-status', // Not in allowed values
            date: new Date(),
            review: 'Test review',
            notes: ''
          },
          {
            completed: false,
            status: 'לא נבחן',
            date: null,
            review: null,
            reviewedBy: null,
            notes: ''
          },
          {
            completed: false,
            status: 'לא נבחן',
            date: null,
            review: null,
            reviewedBy: null,
            notes: ''
          },
          {
            completed: false,
            status: 'לא נבחן',
            date: null,
            review: null,
            reviewedBy: null,
            grade: null,
            gradeLevel: null
          }
        ]
      }

      // Execute
      const { error } = validateBagrut(invalidBagrut)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"status" must be one of')
    })

    it('should validate document data', () => {
      // Setup
      const invalidBagrut = {
        studentId: '6579e36c83c8b3a5c2df8a8b',
        teacherId: '6579e36c83c8b3a5c2df8a8c',
        documents: [
          {
            // Missing required title
            fileUrl: '/uploads/test.pdf',
            uploadDate: new Date(),
            uploadedBy: '6579e36c83c8b3a5c2df8a8d'
          }
        ]
      }

      // Execute
      const { error } = validateBagrut(invalidBagrut)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"documents[0].title" is required')
    })

    it('should validate presentations array is exactly length 4', () => {
      // Setup
      const invalidBagrut = {
        studentId: '6579e36c83c8b3a5c2df8a8b',
        teacherId: '6579e36c83c8b3a5c2df8a8c',
        presentations: [
          { completed: false, status: 'לא נבחן' },
          { completed: false, status: 'לא נבחן' }
          // Only 2 items, should be 4
        ]
      }

      // Execute
      const { error } = validateBagrut(invalidBagrut)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"presentations" must contain 4 items')
    })

    it('should validate YouTube link format in program pieces', () => {
      // Setup
      const bagrutWithValidYouTubeLink = {
        studentId: '6579e36c83c8b3a5c2df8a8b',
        teacherId: '6579e36c83c8b3a5c2df8a8c',
        program: [
          {
            pieceTitle: 'Test Piece',
            composer: 'Test Composer',
            duration: '5:00',
            youtubeLink: 'https://youtube.com/watch?v=123456'
          }
        ]
      }

      const bagrutWithNullYouTubeLink = {
        studentId: '6579e36c83c8b3a5c2df8a8b',
        teacherId: '6579e36c83c8b3a5c2df8a8c',
        program: [
          {
            pieceTitle: 'Test Piece',
            composer: 'Test Composer',
            duration: '5:00',
            youtubeLink: null // Null should be allowed
          }
        ]
      }

      const bagrutWithInvalidYouTubeLink = {
        studentId: '6579e36c83c8b3a5c2df8a8b',
        teacherId: '6579e36c83c8b3a5c2df8a8c',
        program: [
          {
            pieceTitle: 'Test Piece',
            composer: 'Test Composer',
            duration: '5:00',
            youtubeLink: 'not-a-url' // Invalid URL format
          }
        ]
      }

      // Execute & Assert
      expect(validateBagrut(bagrutWithValidYouTubeLink).error).toBeUndefined()
      expect(validateBagrut(bagrutWithNullYouTubeLink).error).toBeUndefined()
      expect(validateBagrut(bagrutWithInvalidYouTubeLink).error).toBeDefined()
    })

    it('should allow testDate to be null', () => {
      // Setup
      const bagrutWithNullTestDate = {
        studentId: '6579e36c83c8b3a5c2df8a8b',
        teacherId: '6579e36c83c8b3a5c2df8a8c',
        testDate: null
      }

      // Execute
      const { error } = validateBagrut(bagrutWithNullTestDate)

      // Assert
      expect(error).toBeUndefined()
    })
  })

  describe('BAGRUT_CONSTANTS', () => {
    it('should define valid presentation statuses', () => {
      // Assert
      expect(BAGRUT_CONSTANTS.PRESENTATION_STATUSES).toEqual(['עבר/ה', 'לא עבר/ה', 'לא נבחן'])
    })

    it('should define valid accompaniment types', () => {
      // Assert
      expect(BAGRUT_CONSTANTS.ACCOMPANIMENT_TYPES).toEqual(['נגן מלווה', 'הרכב'])
    })
  })

  describe('bagrutSchema', () => {
    it('should be a valid Joi schema object', () => {
      // Assert
      expect(bagrutSchema).toBeDefined()
      expect(bagrutSchema.validate).toBeTypeOf('function')
    })

    it('should generate default values for presentations', () => {
      // Setup
      const minimalBagrut = {
        studentId: '6579e36c83c8b3a5c2df8a8b',
        teacherId: '6579e36c83c8b3a5c2df8a8c'
      }

      // Execute
      const { value } = bagrutSchema.validate(minimalBagrut)

      // Assert
      expect(value.presentations).toHaveLength(4)
      expect(value.presentations[0]).toEqual({
        completed: false,
        status: 'לא נבחן',
        date: null,
        review: null,
        reviewedBy: null,
        notes: '',
        recordingLinks: []
      })
      expect(value.presentations[3]).toEqual({
        completed: false,
        status: 'לא נבחן',
        date: null,
        review: null,
        reviewedBy: null,
        grade: null,
        gradeLevel: null,
        recordingLinks: [],
        detailedGrading: {
          playingSkills: { grade: 'לא הוערך', points: null, maxPoints: 20, comments: 'אין הערות' },
          musicalUnderstanding: { grade: 'לא הוערך', points: null, maxPoints: 40, comments: 'אין הערות' },
          textKnowledge: { grade: 'לא הוערך', points: null, maxPoints: 30, comments: 'אין הערות' },
          playingByHeart: { grade: 'לא הוערך', points: null, maxPoints: 10, comments: 'אין הערות' }
        }
      })
    })

    it('should generate default value for magenBagrut', () => {
      // Setup
      const minimalBagrut = {
        studentId: '6579e36c83c8b3a5c2df8a8b',
        teacherId: '6579e36c83c8b3a5c2df8a8c'
      }

      // Execute
      const { value } = bagrutSchema.validate(minimalBagrut)

      // Assert
      expect(value.magenBagrut).toEqual({
        completed: false,
        status: 'לא נבחן',
        date: null,
        review: null,
        reviewedBy: null,
        grade: null,
        gradeLevel: null,
        recordingLinks: [],
        detailedGrading: {
          playingSkills: { grade: 'לא הוערך', points: null, maxPoints: 20, comments: 'אין הערות' },
          musicalUnderstanding: { grade: 'לא הוערך', points: null, maxPoints: 40, comments: 'אין הערות' },
          textKnowledge: { grade: 'לא הוערך', points: null, maxPoints: 30, comments: 'אין הערות' },
          playingByHeart: { grade: 'לא הוערך', points: null, maxPoints: 10, comments: 'אין הערות' }
        }
      })
    })

    it('should set empty documents array by default', () => {
      // Setup
      const minimalBagrut = {
        studentId: '6579e36c83c8b3a5c2df8a8b',
        teacherId: '6579e36c83c8b3a5c2df8a8c'
      }

      // Execute
      const { value } = bagrutSchema.validate(minimalBagrut)

      // Assert
      expect(value.documents).toEqual([])
    })

    it('should set default isActive to true', () => {
      // Setup
      const minimalBagrut = {
        studentId: '6579e36c83c8b3a5c2df8a8b',
        teacherId: '6579e36c83c8b3a5c2df8a8c'
      }

      // Execute
      const { value } = bagrutSchema.validate(minimalBagrut)

      // Assert
      expect(value.isActive).toBe(true)
    })

    it('should set timestamps by default', () => {
      // Setup
      const minimalBagrut = {
        studentId: '6579e36c83c8b3a5c2df8a8b',
        teacherId: '6579e36c83c8b3a5c2df8a8c'
      }

      // Execute
      const { value } = bagrutSchema.validate(minimalBagrut)

      // Assert
      expect(value.createdAt).toBeInstanceOf(Date)
      expect(value.updatedAt).toBeInstanceOf(Date)
    })
  })

  describe('calculateTotalGradeFromDetailedGrading', () => {
    it('should calculate total grade from detailed grading categories', () => {
      // Setup
      const detailedGrading = {
        playingSkills: { points: 18, maxPoints: 20 },
        musicalUnderstanding: { points: 35, maxPoints: 40 },
        textKnowledge: { points: 25, maxPoints: 30 },
        playingByHeart: { points: 8, maxPoints: 10 }
      }

      // Execute
      const total = calculateTotalGradeFromDetailedGrading(detailedGrading)

      // Assert
      expect(total).toBe(86)
    })

    it('should return null if any category is missing points', () => {
      // Setup
      const detailedGrading = {
        playingSkills: { points: 18, maxPoints: 20 },
        musicalUnderstanding: { points: null, maxPoints: 40 }, // Missing points
        textKnowledge: { points: 25, maxPoints: 30 },
        playingByHeart: { points: 8, maxPoints: 10 }
      }

      // Execute
      const total = calculateTotalGradeFromDetailedGrading(detailedGrading)

      // Assert
      expect(total).toBeNull()
    })

    it('should cap the total at 100 points', () => {
      // Setup
      const detailedGrading = {
        playingSkills: { points: 20, maxPoints: 20 },
        musicalUnderstanding: { points: 40, maxPoints: 40 },
        textKnowledge: { points: 30, maxPoints: 30 },
        playingByHeart: { points: 15, maxPoints: 10 } // Over the max, but total would exceed 100
      }

      // Execute
      const total = calculateTotalGradeFromDetailedGrading(detailedGrading)

      // Assert
      expect(total).toBe(100)
    })

    it('should handle zero points correctly', () => {
      // Setup
      const detailedGrading = {
        playingSkills: { points: 0, maxPoints: 20 },
        musicalUnderstanding: { points: 0, maxPoints: 40 },
        textKnowledge: { points: 0, maxPoints: 30 },
        playingByHeart: { points: 0, maxPoints: 10 }
      }

      // Execute
      const total = calculateTotalGradeFromDetailedGrading(detailedGrading)

      // Assert
      expect(total).toBe(0)
    })
  })

  describe('recordingLinks validation', () => {
    it('should validate recording links as URI array', () => {
      // Setup
      const validBagrut = {
        studentId: '6579e36c83c8b3a5c2df8a8b',
        teacherId: '6579e36c83c8b3a5c2df8a8c',
        presentations: [
          {
            completed: true,
            status: 'עבר/ה',
            notes: 'הערות על ההצגה',
            recordingLinks: ['https://youtube.com/watch?v=123', 'https://drive.google.com/file/d/456']
          },
          { completed: false, status: 'לא נבחן', notes: '', recordingLinks: [] },
          { completed: false, status: 'לא נבחן', notes: '', recordingLinks: [] },
          {
            completed: true,
            status: 'עבר/ה',
            recordingLinks: ['https://youtube.com/watch?v=789'],
            detailedGrading: {
              playingSkills: { grade: 'טוב', points: 15, comments: 'טוב' },
              musicalUnderstanding: { grade: 'מעולה', points: 35, comments: 'מעולה' },
              textKnowledge: { grade: 'טוב מאוד', points: 28, comments: 'טוב מאוד' },
              playingByHeart: { grade: 'טוב', points: 8, comments: 'טוב' }
            }
          }
        ]
      }

      // Execute
      const { error, value } = validateBagrut(validBagrut)

      // Assert
      expect(error).toBeUndefined()
      expect(value.presentations[0].recordingLinks).toHaveLength(2)
      expect(value.presentations[3].recordingLinks).toHaveLength(1)
    })

    it('should reject invalid recording links', () => {
      // Setup
      const invalidBagrut = {
        studentId: '6579e36c83c8b3a5c2df8a8b',
        teacherId: '6579e36c83c8b3a5c2df8a8c',
        presentations: [
          {
            completed: true,
            status: 'עבר/ה',
            notes: 'הערות',
            recordingLinks: ['not-a-valid-url', 'also-not-valid']
          },
          { completed: false, status: 'לא נבחן', notes: '', recordingLinks: [] },
          { completed: false, status: 'לא נבחן', notes: '', recordingLinks: [] },
          { completed: false, status: 'לא נבחן', recordingLinks: [] }
        ]
      }

      // Execute
      const { error } = validateBagrut(invalidBagrut)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('must be a valid uri')
    })
  })
})