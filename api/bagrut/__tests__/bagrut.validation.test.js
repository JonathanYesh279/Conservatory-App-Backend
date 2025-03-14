// api/bagrut/__tests__/bagrut.validation.test.js
import { describe, it, expect } from 'vitest'
import { validateBagrut, bagrutSchema, BAGRUT_CONSTANTS } from '../bagrut.validation.js'

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
          { completed: false, status: 'לא נבחן', date: null, review: null, reviewedBy: null },
          { completed: false, status: 'לא נבחן', date: null, review: null, reviewedBy: null },
          { completed: false, status: 'לא נבחן', date: null, review: null, reviewedBy: null }
        ],
        magenBagrut: {
          completed: false,
          status: 'לא נבחן',
          date: null,
          review: null,
          reviewedBy: null
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
            review: 'Test review'
          }
        ]
      }

      // Execute
      const { error } = validateBagrut(invalidBagrut)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"presentations[0].status" must be one of')
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

    it('should validate presentations array is exactly length 3', () => {
      // Setup
      const invalidBagrut = {
        studentId: '6579e36c83c8b3a5c2df8a8b',
        teacherId: '6579e36c83c8b3a5c2df8a8c',
        presentations: [
          { completed: false, status: 'לא נבחן' },
          { completed: false, status: 'לא נבחן' }
          // Only 2 items, should be 3
        ]
      }

      // Execute
      const { error } = validateBagrut(invalidBagrut)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"presentations" must contain 3 items')
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
      expect(value.presentations).toHaveLength(3)
      expect(value.presentations[0]).toEqual({
        completed: false,
        status: 'לא נבחן',
        date: null,
        review: null,
        reviewedBy: null
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
        reviewedBy: null
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
})