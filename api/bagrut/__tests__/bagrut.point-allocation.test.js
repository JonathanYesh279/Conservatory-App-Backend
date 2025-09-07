// api/bagrut/__tests__/bagrut.point-allocation.test.js
import { describe, it, expect } from 'vitest'
import { 
  calculateTotalGradeFromDetailedGrading,
  calculateFinalGradeWithDirectorEvaluation,
  getGradeLevelFromScore,
  validateGradeConsistency
} from '../bagrut.validation.js'

describe('Point Allocation Validation Tests', () => {
  
  describe('Playing Skills Category (0-40 points)', () => {
    it('should accept valid points within range', () => {
      const detailedGrading = {
        playingSkills: { points: 35, maxPoints: 40 },
        musicalUnderstanding: { points: 25, maxPoints: 30 },
        textKnowledge: { points: 18, maxPoints: 20 },
        playingByHeart: { points: 8, maxPoints: 10 }
      }
      
      const result = calculateTotalGradeFromDetailedGrading(detailedGrading)
      expect(result).toBe(86)
    })

    it('should accept minimum value (0 points)', () => {
      const detailedGrading = {
        playingSkills: { points: 0, maxPoints: 40 },
        musicalUnderstanding: { points: 25, maxPoints: 30 },
        textKnowledge: { points: 18, maxPoints: 20 },
        playingByHeart: { points: 8, maxPoints: 10 }
      }
      
      const result = calculateTotalGradeFromDetailedGrading(detailedGrading)
      expect(result).toBe(51)
    })

    it('should accept maximum value (40 points)', () => {
      const detailedGrading = {
        playingSkills: { points: 40, maxPoints: 40 },
        musicalUnderstanding: { points: 25, maxPoints: 30 },
        textKnowledge: { points: 18, maxPoints: 20 },
        playingByHeart: { points: 8, maxPoints: 10 }
      }
      
      const result = calculateTotalGradeFromDetailedGrading(detailedGrading)
      expect(result).toBe(91)
    })

    it('should handle null points gracefully', () => {
      const detailedGrading = {
        playingSkills: { points: null, maxPoints: 40 },
        musicalUnderstanding: { points: 25, maxPoints: 30 },
        textKnowledge: { points: 18, maxPoints: 20 },
        playingByHeart: { points: 8, maxPoints: 10 }
      }
      
      const result = calculateTotalGradeFromDetailedGrading(detailedGrading)
      expect(result).toBeNull()
    })

    it('should test boundary values', () => {
      // Test boundary: exactly at max
      let detailedGrading = {
        playingSkills: { points: 40, maxPoints: 40 },
        musicalUnderstanding: { points: 30, maxPoints: 30 },
        textKnowledge: { points: 20, maxPoints: 20 },
        playingByHeart: { points: 10, maxPoints: 10 }
      }
      expect(calculateTotalGradeFromDetailedGrading(detailedGrading)).toBe(100)

      // Test boundary: one below max
      detailedGrading.playingSkills.points = 39
      expect(calculateTotalGradeFromDetailedGrading(detailedGrading)).toBe(99)

      // Test boundary: one above min
      detailedGrading.playingSkills.points = 1
      expect(calculateTotalGradeFromDetailedGrading(detailedGrading)).toBe(61)
    })
  })

  describe('Musical Understanding Category (0-30 points)', () => {
    it('should accept valid points within range', () => {
      const detailedGrading = {
        playingSkills: { points: 35, maxPoints: 40 },
        musicalUnderstanding: { points: 25, maxPoints: 30 },
        textKnowledge: { points: 18, maxPoints: 20 },
        playingByHeart: { points: 8, maxPoints: 10 }
      }
      
      const result = calculateTotalGradeFromDetailedGrading(detailedGrading)
      expect(result).toBe(86)
    })

    it('should accept minimum value (0 points)', () => {
      const detailedGrading = {
        playingSkills: { points: 35, maxPoints: 40 },
        musicalUnderstanding: { points: 0, maxPoints: 30 },
        textKnowledge: { points: 18, maxPoints: 20 },
        playingByHeart: { points: 8, maxPoints: 10 }
      }
      
      const result = calculateTotalGradeFromDetailedGrading(detailedGrading)
      expect(result).toBe(61)
    })

    it('should accept maximum value (30 points)', () => {
      const detailedGrading = {
        playingSkills: { points: 35, maxPoints: 40 },
        musicalUnderstanding: { points: 30, maxPoints: 30 },
        textKnowledge: { points: 18, maxPoints: 20 },
        playingByHeart: { points: 8, maxPoints: 10 }
      }
      
      const result = calculateTotalGradeFromDetailedGrading(detailedGrading)
      expect(result).toBe(91)
    })

    it('should handle null points gracefully', () => {
      const detailedGrading = {
        playingSkills: { points: 35, maxPoints: 40 },
        musicalUnderstanding: { points: null, maxPoints: 30 },
        textKnowledge: { points: 18, maxPoints: 20 },
        playingByHeart: { points: 8, maxPoints: 10 }
      }
      
      const result = calculateTotalGradeFromDetailedGrading(detailedGrading)
      expect(result).toBeNull()
    })

    it('should test boundary values', () => {
      // Test boundary: exactly at max
      let detailedGrading = {
        playingSkills: { points: 40, maxPoints: 40 },
        musicalUnderstanding: { points: 30, maxPoints: 30 },
        textKnowledge: { points: 20, maxPoints: 20 },
        playingByHeart: { points: 10, maxPoints: 10 }
      }
      expect(calculateTotalGradeFromDetailedGrading(detailedGrading)).toBe(100)

      // Test boundary: one below max
      detailedGrading.musicalUnderstanding.points = 29
      expect(calculateTotalGradeFromDetailedGrading(detailedGrading)).toBe(99)

      // Test boundary: one above min
      detailedGrading.musicalUnderstanding.points = 1
      expect(calculateTotalGradeFromDetailedGrading(detailedGrading)).toBe(71)
    })
  })

  describe('Text Knowledge Category (0-20 points)', () => {
    it('should accept valid points within range', () => {
      const detailedGrading = {
        playingSkills: { points: 35, maxPoints: 40 },
        musicalUnderstanding: { points: 25, maxPoints: 30 },
        textKnowledge: { points: 18, maxPoints: 20 },
        playingByHeart: { points: 8, maxPoints: 10 }
      }
      
      const result = calculateTotalGradeFromDetailedGrading(detailedGrading)
      expect(result).toBe(86)
    })

    it('should accept minimum value (0 points)', () => {
      const detailedGrading = {
        playingSkills: { points: 35, maxPoints: 40 },
        musicalUnderstanding: { points: 25, maxPoints: 30 },
        textKnowledge: { points: 0, maxPoints: 20 },
        playingByHeart: { points: 8, maxPoints: 10 }
      }
      
      const result = calculateTotalGradeFromDetailedGrading(detailedGrading)
      expect(result).toBe(68)
    })

    it('should accept maximum value (20 points)', () => {
      const detailedGrading = {
        playingSkills: { points: 35, maxPoints: 40 },
        musicalUnderstanding: { points: 25, maxPoints: 30 },
        textKnowledge: { points: 20, maxPoints: 20 },
        playingByHeart: { points: 8, maxPoints: 10 }
      }
      
      const result = calculateTotalGradeFromDetailedGrading(detailedGrading)
      expect(result).toBe(88)
    })

    it('should handle null points gracefully', () => {
      const detailedGrading = {
        playingSkills: { points: 35, maxPoints: 40 },
        musicalUnderstanding: { points: 25, maxPoints: 30 },
        textKnowledge: { points: null, maxPoints: 20 },
        playingByHeart: { points: 8, maxPoints: 10 }
      }
      
      const result = calculateTotalGradeFromDetailedGrading(detailedGrading)
      expect(result).toBeNull()
    })

    it('should test boundary values', () => {
      // Test boundary: exactly at max
      let detailedGrading = {
        playingSkills: { points: 40, maxPoints: 40 },
        musicalUnderstanding: { points: 30, maxPoints: 30 },
        textKnowledge: { points: 20, maxPoints: 20 },
        playingByHeart: { points: 10, maxPoints: 10 }
      }
      expect(calculateTotalGradeFromDetailedGrading(detailedGrading)).toBe(100)

      // Test boundary: one below max
      detailedGrading.textKnowledge.points = 19
      expect(calculateTotalGradeFromDetailedGrading(detailedGrading)).toBe(99)

      // Test boundary: one above min
      detailedGrading.textKnowledge.points = 1
      expect(calculateTotalGradeFromDetailedGrading(detailedGrading)).toBe(81)
    })
  })

  describe('Playing By Heart Category (0-10 points)', () => {
    it('should accept valid points within range', () => {
      const detailedGrading = {
        playingSkills: { points: 35, maxPoints: 40 },
        musicalUnderstanding: { points: 25, maxPoints: 30 },
        textKnowledge: { points: 18, maxPoints: 20 },
        playingByHeart: { points: 8, maxPoints: 10 }
      }
      
      const result = calculateTotalGradeFromDetailedGrading(detailedGrading)
      expect(result).toBe(86)
    })

    it('should accept minimum value (0 points)', () => {
      const detailedGrading = {
        playingSkills: { points: 35, maxPoints: 40 },
        musicalUnderstanding: { points: 25, maxPoints: 30 },
        textKnowledge: { points: 18, maxPoints: 20 },
        playingByHeart: { points: 0, maxPoints: 10 }
      }
      
      const result = calculateTotalGradeFromDetailedGrading(detailedGrading)
      expect(result).toBe(78)
    })

    it('should accept maximum value (10 points)', () => {
      const detailedGrading = {
        playingSkills: { points: 35, maxPoints: 40 },
        musicalUnderstanding: { points: 25, maxPoints: 30 },
        textKnowledge: { points: 18, maxPoints: 20 },
        playingByHeart: { points: 10, maxPoints: 10 }
      }
      
      const result = calculateTotalGradeFromDetailedGrading(detailedGrading)
      expect(result).toBe(88)
    })

    it('should handle null points gracefully', () => {
      const detailedGrading = {
        playingSkills: { points: 35, maxPoints: 40 },
        musicalUnderstanding: { points: 25, maxPoints: 30 },
        textKnowledge: { points: 18, maxPoints: 20 },
        playingByHeart: { points: null, maxPoints: 10 }
      }
      
      const result = calculateTotalGradeFromDetailedGrading(detailedGrading)
      expect(result).toBeNull()
    })

    it('should test boundary values', () => {
      // Test boundary: exactly at max
      let detailedGrading = {
        playingSkills: { points: 40, maxPoints: 40 },
        musicalUnderstanding: { points: 30, maxPoints: 30 },
        textKnowledge: { points: 20, maxPoints: 20 },
        playingByHeart: { points: 10, maxPoints: 10 }
      }
      expect(calculateTotalGradeFromDetailedGrading(detailedGrading)).toBe(100)

      // Test boundary: one below max
      detailedGrading.playingByHeart.points = 9
      expect(calculateTotalGradeFromDetailedGrading(detailedGrading)).toBe(99)

      // Test boundary: one above min
      detailedGrading.playingByHeart.points = 1
      expect(calculateTotalGradeFromDetailedGrading(detailedGrading)).toBe(91)
    })
  })

  describe('Total Points Validation', () => {
    it('should enforce maximum total of 100 points', () => {
      // This should theoretically give 105 points but be capped at 100
      const detailedGrading = {
        playingSkills: { points: 40, maxPoints: 40 },
        musicalUnderstanding: { points: 30, maxPoints: 30 },
        textKnowledge: { points: 20, maxPoints: 20 },
        playingByHeart: { points: 15, maxPoints: 10 } // Over the individual max but system should handle
      }
      
      const result = calculateTotalGradeFromDetailedGrading(detailedGrading)
      expect(result).toBe(100) // Should be capped at 100
    })

    it('should handle edge case where all categories are at maximum', () => {
      const detailedGrading = {
        playingSkills: { points: 40, maxPoints: 40 },
        musicalUnderstanding: { points: 30, maxPoints: 30 },
        textKnowledge: { points: 20, maxPoints: 20 },
        playingByHeart: { points: 10, maxPoints: 10 }
      }
      
      const result = calculateTotalGradeFromDetailedGrading(detailedGrading)
      expect(result).toBe(100)
    })

    it('should handle edge case where all categories are at minimum', () => {
      const detailedGrading = {
        playingSkills: { points: 0, maxPoints: 40 },
        musicalUnderstanding: { points: 0, maxPoints: 30 },
        textKnowledge: { points: 0, maxPoints: 20 },
        playingByHeart: { points: 0, maxPoints: 10 }
      }
      
      const result = calculateTotalGradeFromDetailedGrading(detailedGrading)
      expect(result).toBe(0)
    })

    it('should return null if any category has null points', () => {
      const testCases = [
        { playingSkills: { points: null, maxPoints: 40 }, musicalUnderstanding: { points: 25, maxPoints: 30 }, textKnowledge: { points: 18, maxPoints: 20 }, playingByHeart: { points: 8, maxPoints: 10 } },
        { playingSkills: { points: 35, maxPoints: 40 }, musicalUnderstanding: { points: null, maxPoints: 30 }, textKnowledge: { points: 18, maxPoints: 20 }, playingByHeart: { points: 8, maxPoints: 10 } },
        { playingSkills: { points: 35, maxPoints: 40 }, musicalUnderstanding: { points: 25, maxPoints: 30 }, textKnowledge: { points: null, maxPoints: 20 }, playingByHeart: { points: 8, maxPoints: 10 } },
        { playingSkills: { points: 35, maxPoints: 40 }, musicalUnderstanding: { points: 25, maxPoints: 30 }, textKnowledge: { points: 18, maxPoints: 20 }, playingByHeart: { points: null, maxPoints: 10 } }
      ]
      
      testCases.forEach((detailedGrading, index) => {
        const result = calculateTotalGradeFromDetailedGrading(detailedGrading)
        expect(result, `Test case ${index + 1} should return null`).toBeNull()
      })
    })

    it('should return null if detailedGrading is null or undefined', () => {
      expect(calculateTotalGradeFromDetailedGrading(null)).toBeNull()
      expect(calculateTotalGradeFromDetailedGrading(undefined)).toBeNull()
    })

    it('should return null if any required category is missing', () => {
      const incompleteCases = [
        // Missing playingSkills
        { musicalUnderstanding: { points: 25, maxPoints: 30 }, textKnowledge: { points: 18, maxPoints: 20 }, playingByHeart: { points: 8, maxPoints: 10 } },
        // Missing musicalUnderstanding
        { playingSkills: { points: 35, maxPoints: 40 }, textKnowledge: { points: 18, maxPoints: 20 }, playingByHeart: { points: 8, maxPoints: 10 } },
        // Missing textKnowledge
        { playingSkills: { points: 35, maxPoints: 40 }, musicalUnderstanding: { points: 25, maxPoints: 30 }, playingByHeart: { points: 8, maxPoints: 10 } },
        // Missing playingByHeart
        { playingSkills: { points: 35, maxPoints: 40 }, musicalUnderstanding: { points: 25, maxPoints: 30 }, textKnowledge: { points: 18, maxPoints: 20 } }
      ]
      
      incompleteCases.forEach((detailedGrading, index) => {
        const result = calculateTotalGradeFromDetailedGrading(detailedGrading)
        expect(result, `Incomplete case ${index + 1} should return null`).toBeNull()
      })
    })
  })

  describe('Point Distribution Test Cases', () => {
    it('should correctly calculate various point distributions', () => {
      const testCases = [
        // High performance across all categories
        { input: { playingSkills: { points: 38, maxPoints: 40 }, musicalUnderstanding: { points: 28, maxPoints: 30 }, textKnowledge: { points: 19, maxPoints: 20 }, playingByHeart: { points: 9, maxPoints: 10 } }, expected: 94 },
        // Medium performance
        { input: { playingSkills: { points: 30, maxPoints: 40 }, musicalUnderstanding: { points: 22, maxPoints: 30 }, textKnowledge: { points: 15, maxPoints: 20 }, playingByHeart: { points: 7, maxPoints: 10 } }, expected: 74 },
        // Low performance
        { input: { playingSkills: { points: 20, maxPoints: 40 }, musicalUnderstanding: { points: 15, maxPoints: 30 }, textKnowledge: { points: 10, maxPoints: 20 }, playingByHeart: { points: 5, maxPoints: 10 } }, expected: 50 },
        // Uneven distribution - strong in some areas, weak in others
        { input: { playingSkills: { points: 40, maxPoints: 40 }, musicalUnderstanding: { points: 10, maxPoints: 30 }, textKnowledge: { points: 20, maxPoints: 20 }, playingByHeart: { points: 2, maxPoints: 10 } }, expected: 72 }
      ]
      
      testCases.forEach(({ input, expected }, index) => {
        const result = calculateTotalGradeFromDetailedGrading(input)
        expect(result, `Test case ${index + 1}: Expected ${expected}, got ${result}`).toBe(expected)
      })
    })
  })
})