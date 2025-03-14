import { describe, it, expect } from 'vitest'
import { validateOrchestra, ORCHESTRA_CONSTANTS } from '../orchestra.validation.js'

describe('Orchestra Validation', () => {
  describe('validateOrchestra', () => {
    it('should validate a valid orchestra object', () => {
      // Setup
      const validOrchestra = {
        name: 'תזמורת מתחילים נשיפה',
        type: 'תזמורת',
        conductorId: '6579e36c83c8b3a5c2df8a8b',
        memberIds: ['123', '456'],
        rehearsalIds: ['789', '012'],
        schoolYearId: '6579e36c83c8b3a5c2df8a8c',
        isActive: true
      }

      // Execute
      const { error, value } = validateOrchestra(validOrchestra)

      // Assert
      expect(error).toBeUndefined()
      expect(value).toEqual(validOrchestra)
    })

    it('should validate with default values for optional fields', () => {
      // Setup
      const minimalOrchestra = {
        name: 'תזמורת יצוגית נשיפה',
        type: 'תזמורת',
        conductorId: '6579e36c83c8b3a5c2df8a8b',
        schoolYearId: '6579e36c83c8b3a5c2df8a8c'
      }

      // Execute
      const { error, value } = validateOrchestra(minimalOrchestra)

      // Assert
      expect(error).toBeUndefined()
      expect(value).toEqual({
        ...minimalOrchestra,
        memberIds: [],
        rehearsalIds: [],
        isActive: true
      })
    })

    it('should reject invalid orchestra name', () => {
      // Setup
      const invalidOrchestra = {
        name: 'Invalid Orchestra Name', // Not in allowed list
        type: 'תזמורת',
        conductorId: '6579e36c83c8b3a5c2df8a8b',
        schoolYearId: '6579e36c83c8b3a5c2df8a8c'
      }

      // Execute
      const { error, value } = validateOrchestra(invalidOrchestra)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"name" must be')
    })

    it('should reject invalid orchestra type', () => {
      // Setup
      const invalidOrchestra = {
        name: 'תזמורת מתחילים נשיפה',
        type: 'invalid-type', // Not in allowed list
        conductorId: '6579e36c83c8b3a5c2df8a8b',
        schoolYearId: '6579e36c83c8b3a5c2df8a8c'
      }

      // Execute
      const { error, value } = validateOrchestra(invalidOrchestra)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"type" must be')
    })

    it('should require conductorId', () => {
      // Setup
      const invalidOrchestra = {
        name: 'תזמורת מתחילים נשיפה',
        type: 'תזמורת',
        // Missing conductorId
        schoolYearId: '6579e36c83c8b3a5c2df8a8c'
      }

      // Execute
      const { error, value } = validateOrchestra(invalidOrchestra)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"conductorId" is required')
    })

    it('should require schoolYearId', () => {
      // Setup
      const invalidOrchestra = {
        name: 'תזמורת מתחילים נשיפה',
        type: 'תזמורת',
        conductorId: '6579e36c83c8b3a5c2df8a8b'
        // Missing schoolYearId
      }

      // Execute
      const { error, value } = validateOrchestra(invalidOrchestra)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"schoolYearId" is required')
    })

    it('should require memberIds to be an array', () => {
      // Setup
      const invalidOrchestra = {
        name: 'תזמורת מתחילים נשיפה',
        type: 'תזמורת',
        conductorId: '6579e36c83c8b3a5c2df8a8b',
        memberIds: 'not-an-array', // Should be an array
        schoolYearId: '6579e36c83c8b3a5c2df8a8c'
      }

      // Execute
      const { error, value } = validateOrchestra(invalidOrchestra)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"memberIds" must be an array')
    })

    it('should require rehearsalIds to be an array', () => {
      // Setup
      const invalidOrchestra = {
        name: 'תזמורת מתחילים נשיפה',
        type: 'תזמורת',
        conductorId: '6579e36c83c8b3a5c2df8a8b',
        rehearsalIds: 'not-an-array', // Should be an array
        schoolYearId: '6579e36c83c8b3a5c2df8a8c'
      }

      // Execute
      const { error, value } = validateOrchestra(invalidOrchestra)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"rehearsalIds" must be an array')
    })

    it('should require isActive to be a boolean', () => {
      // Setup
      const invalidOrchestra = {
        name: 'תזמורת מתחילים נשיפה',
        type: 'תזמורת',
        conductorId: '6579e36c83c8b3a5c2df8a8b',
        schoolYearId: '6579e36c83c8b3a5c2df8a8c',
        isActive: 'yes' // Should be a boolean
      }

      // Execute
      const { error, value } = validateOrchestra(invalidOrchestra)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"isActive" must be a boolean')
    })
  })

  describe('ORCHESTRA_CONSTANTS', () => {
    it('should define valid orchestra types', () => {
      // Assert
      expect(ORCHESTRA_CONSTANTS.VALID_TYPES).toEqual(['הרכב', 'תזמורת'])
    })

    it('should define valid orchestra names', () => {
      // Assert
      expect(ORCHESTRA_CONSTANTS.VALID_NAMES).toEqual([
        'תזמורת מתחילים נשיפה', 
        'תזמורת עתודה נשיפה', 
        'תזמורת צעירה נשיפה', 
        'תזמורת יצוגית נשיפה', 
        'תזמורת סימפונית'
      ])
    })
  })
})