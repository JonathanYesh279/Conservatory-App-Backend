// api/bagrut/__tests__/bagrut.grade-levels.test.js
import { describe, it, expect } from 'vitest'
import { 
  getGradeLevelFromScore,
  validateGradeConsistency,
  BAGRUT_CONSTANTS
} from '../bagrut.validation.js'

describe('Grade Level Assignment Tests', () => {
  
  describe('Grade Level Categories', () => {
    it('should return מעולה for scores 95-100', () => {
      const testScores = [95, 96, 97, 98, 99, 100]
      
      testScores.forEach(score => {
        const result = getGradeLevelFromScore(score)
        expect(result, `Score ${score} should return מעולה`).toBe('מעולה')
      })
    })

    it('should return טוב מאוד for scores 90-94', () => {
      const testScores = [90, 91, 92, 93, 94]
      
      testScores.forEach(score => {
        const result = getGradeLevelFromScore(score)
        expect(result, `Score ${score} should return טוב מאוד`).toBe('טוב מאוד')
      })
    })

    it('should return טוב for scores 75-89', () => {
      const testScores = [75, 76, 80, 85, 88, 89]
      
      testScores.forEach(score => {
        const result = getGradeLevelFromScore(score)
        expect(result, `Score ${score} should return טוב`).toBe('טוב')
      })
    })

    it('should return מספיק for scores 55-74', () => {
      const testScores = [55, 56, 60, 65, 70, 74]
      
      testScores.forEach(score => {
        const result = getGradeLevelFromScore(score)
        expect(result, `Score ${score} should return מספיק`).toBe('מספיק')
      })
    })

    it('should return מספיק בקושי for scores 45-54', () => {
      const testScores = [45, 46, 50, 52, 54]
      
      testScores.forEach(score => {
        const result = getGradeLevelFromScore(score)
        expect(result, `Score ${score} should return מספיק בקושי`).toBe('מספיק בקושי')
      })
    })

    it('should return לא עבר/ה for scores 0-44', () => {
      const testScores = [0, 1, 10, 20, 30, 40, 44]
      
      testScores.forEach(score => {
        const result = getGradeLevelFromScore(score)
        expect(result, `Score ${score} should return לא עבר/ה`).toBe('לא עבר/ה')
      })
    })
  })

  describe('Boundary Value Tests', () => {
    it('should test exact boundary values between categories', () => {
      const boundaryTests = [
        // Upper boundaries
        { score: 100, expected: 'מעולה' },
        { score: 94, expected: 'טוב מאוד' },
        { score: 89, expected: 'טוב' },
        { score: 74, expected: 'מספיק' },
        { score: 54, expected: 'מספיק בקושי' },
        { score: 44, expected: 'לא עבר/ה' },
        
        // Lower boundaries
        { score: 95, expected: 'מעולה' },
        { score: 90, expected: 'טוב מאוד' },
        { score: 75, expected: 'טוב' },
        { score: 55, expected: 'מספיק' },
        { score: 45, expected: 'מספיק בקושי' },
        { score: 0, expected: 'לא עבר/ה' },
        
        // Boundary transitions (one point before/after boundaries)
        { score: 99, expected: 'מעולה' },
        { score: 96, expected: 'מעולה' },
        { score: 93, expected: 'טוב מאוד' },
        { score: 91, expected: 'טוב מאוד' },
        { score: 88, expected: 'טוב' },
        { score: 76, expected: 'טוב' },
        { score: 73, expected: 'מספיק' },
        { score: 56, expected: 'מספיק' },
        { score: 53, expected: 'מספיק בקושי' },
        { score: 46, expected: 'מספיק בקושי' },
        { score: 43, expected: 'לא עבר/ה' },
        { score: 1, expected: 'לא עבר/ה' }
      ]
      
      boundaryTests.forEach(({ score, expected }) => {
        const result = getGradeLevelFromScore(score)
        expect(result, `Score ${score} should map to ${expected}`).toBe(expected)
      })
    })

    it('should test critical transition points', () => {
      // Test exactly at transition boundaries
      expect(getGradeLevelFromScore(94.99)).toBe('טוב מאוד') // Just below מעולה
      expect(getGradeLevelFromScore(95)).toBe('מעולה') // Just at מעולה
      
      expect(getGradeLevelFromScore(89.99)).toBe('טוב') // Just below טוב מאוד
      expect(getGradeLevelFromScore(90)).toBe('טוב מאוד') // Just at טוב מאוד
      
      expect(getGradeLevelFromScore(74.99)).toBe('מספיק') // Just below טוב
      expect(getGradeLevelFromScore(75)).toBe('טוב') // Just at טוב
      
      expect(getGradeLevelFromScore(54.99)).toBe('מספיק בקושי') // Just below מספיק
      expect(getGradeLevelFromScore(55)).toBe('מספיק') // Just at מספיק
      
      expect(getGradeLevelFromScore(44.99)).toBe('לא עבר/ה') // Just below מספיק בקושי
      expect(getGradeLevelFromScore(45)).toBe('מספיק בקושי') // Just at מספיק בקושי
    })
  })

  describe('Edge Cases and Special Values', () => {
    it('should handle null and undefined scores', () => {
      expect(getGradeLevelFromScore(null)).toBeNull()
      expect(getGradeLevelFromScore(undefined)).toBeNull()
    })

    it('should handle negative scores', () => {
      const negativeScores = [-1, -10, -100]
      
      negativeScores.forEach(score => {
        const result = getGradeLevelFromScore(score)
        expect(result, `Negative score ${score} should return לא עבר/ה`).toBe('לא עבר/ה')
      })
    })

    it('should handle scores above 100', () => {
      const highScores = [101, 110, 150, 200]
      
      highScores.forEach(score => {
        const result = getGradeLevelFromScore(score)
        // Since no range covers >100, should fall back to לא עבר/ה
        expect(result, `Score above 100 (${score}) should return לא עבר/ה`).toBe('לא עבר/ה')
      })
    })

    it('should handle decimal scores correctly', () => {
      const decimalTests = [
        { score: 95.5, expected: 'מעולה' },
        { score: 94.9, expected: 'טוב מאוד' },
        { score: 89.1, expected: 'טוב' },
        { score: 74.5, expected: 'מספיק' },
        { score: 54.9, expected: 'מספיק בקושי' },
        { score: 44.1, expected: 'לא עבר/ה' }
      ]
      
      decimalTests.forEach(({ score, expected }) => {
        const result = getGradeLevelFromScore(score)
        expect(result, `Decimal score ${score} should return ${expected}`).toBe(expected)
      })
    })
  })

  describe('Grade Consistency Validation', () => {
    it('should validate correct grade-level pairs', () => {
      const validPairs = [
        { grade: 98, level: 'מעולה' },
        { grade: 92, level: 'טוב מאוד' },
        { grade: 85, level: 'טוב' },
        { grade: 65, level: 'מספיק' },
        { grade: 50, level: 'מספיק בקושי' },
        { grade: 30, level: 'לא עבר/ה' }
      ]
      
      validPairs.forEach(({ grade, level }) => {
        const isValid = validateGradeConsistency(grade, level)
        expect(isValid, `Grade ${grade} with level ${level} should be valid`).toBe(true)
      })
    })

    it('should invalidate incorrect grade-level pairs', () => {
      const invalidPairs = [
        { grade: 98, level: 'טוב מאוד' }, // Should be מעולה
        { grade: 85, level: 'מעולה' }, // Should be טוב
        { grade: 65, level: 'טוב' }, // Should be מספיק
        { grade: 30, level: 'מספיק' }, // Should be לא עבר/ה
        { grade: 95, level: 'טוב מאוד' }, // Should be מעולה
        { grade: 44, level: 'מספיק בקושי' } // Should be לא עבר/ה
      ]
      
      invalidPairs.forEach(({ grade, level }) => {
        const isValid = validateGradeConsistency(grade, level)
        expect(isValid, `Grade ${grade} with level ${level} should be invalid`).toBe(false)
      })
    })

    it('should handle null values in grade consistency validation', () => {
      // Null values should be considered valid (allow incomplete data)
      expect(validateGradeConsistency(null, 'מעולה')).toBe(true)
      expect(validateGradeConsistency(95, null)).toBe(true)
      expect(validateGradeConsistency(null, null)).toBe(true)
    })
  })

  describe('All Grade Level Constants Verification', () => {
    it('should verify all grade levels are correctly defined in constants', () => {
      const expectedGradeLevels = {
        'מעולה': { min: 95, max: 100 },
        'טוב מאוד': { min: 90, max: 94 },
        'טוב': { min: 75, max: 89 },
        'מספיק': { min: 55, max: 74 },
        'מספיק בקושי': { min: 45, max: 54 },
        'לא עבר/ה': { min: 0, max: 44 }
      }
      
      expect(BAGRUT_CONSTANTS.GRADE_LEVELS).toEqual(expectedGradeLevels)
    })

    it('should verify all grade level names are available', () => {
      const expectedNames = [
        'מעולה',
        'טוב מאוד', 
        'טוב',
        'מספיק',
        'מספיק בקושי',
        'לא עבר/ה'
      ]
      
      expect(BAGRUT_CONSTANTS.GRADE_LEVEL_NAMES).toEqual(expectedNames)
    })

    it('should verify grade ranges have no gaps or overlaps', () => {
      const ranges = BAGRUT_CONSTANTS.GRADE_LEVELS
      const sortedRanges = Object.entries(ranges)
        .map(([name, range]) => ({ name, ...range }))
        .sort((a, b) => a.min - b.min)
      
      // Check for gaps and overlaps
      for (let i = 1; i < sortedRanges.length; i++) {
        const current = sortedRanges[i]
        const previous = sortedRanges[i - 1]
        
        // Previous max should be exactly one less than current min (no gaps, no overlaps)
        expect(previous.max + 1, 
          `Gap/overlap between ${previous.name} (${previous.max}) and ${current.name} (${current.min})`
        ).toBe(current.min)
      }
    })

    it('should verify complete score coverage from 0 to 100', () => {
      // Test that every integer from 0 to 100 maps to exactly one grade level
      for (let score = 0; score <= 100; score++) {
        const gradeLevel = getGradeLevelFromScore(score)
        expect(gradeLevel, `Score ${score} should map to a valid grade level`).not.toBeNull()
        expect(typeof gradeLevel, `Score ${score} should map to a string`).toBe('string')
        expect(BAGRUT_CONSTANTS.GRADE_LEVEL_NAMES.includes(gradeLevel), 
          `Score ${score} mapped to invalid grade level: ${gradeLevel}`
        ).toBe(true)
      }
    })
  })

  describe('Comprehensive Grade Level Coverage', () => {
    it('should test representative scores from each grade level range', () => {
      const testCases = [
        // מעולה (95-100)
        { scores: [95, 97, 100], expected: 'מעולה' },
        // טוב מאוד (90-94)  
        { scores: [90, 92, 94], expected: 'טוב מאוד' },
        // טוב (75-89)
        { scores: [75, 80, 85, 89], expected: 'טוב' },
        // מספיק (55-74)
        { scores: [55, 60, 65, 70, 74], expected: 'מספיק' },
        // מספיק בקושי (45-54)
        { scores: [45, 48, 50, 54], expected: 'מספיק בקושי' },
        // לא עבר/ה (0-44)
        { scores: [0, 10, 20, 30, 40, 44], expected: 'לא עבר/ה' }
      ]
      
      testCases.forEach(({ scores, expected }) => {
        scores.forEach(score => {
          const result = getGradeLevelFromScore(score)
          expect(result, `Score ${score} in ${expected} range`).toBe(expected)
        })
      })
    })

    it('should verify grade level distribution makes pedagogical sense', () => {
      // Verify that the grade level ranges make sense from an educational standpoint
      
      // Excellence should be hard to achieve (top 6% of possible scores)
      const excellenceRange = BAGRUT_CONSTANTS.GRADE_LEVELS['מעולה']
      expect(excellenceRange.max - excellenceRange.min + 1).toBe(6) // 95-100 = 6 points
      
      // Very good should be narrow band (5% of possible scores)  
      const veryGoodRange = BAGRUT_CONSTANTS.GRADE_LEVELS['טוב מאוד']
      expect(veryGoodRange.max - veryGoodRange.min + 1).toBe(5) // 90-94 = 5 points
      
      // Good should be broader (15% of possible scores)
      const goodRange = BAGRUT_CONSTANTS.GRADE_LEVELS['טוב']
      expect(goodRange.max - goodRange.min + 1).toBe(15) // 75-89 = 15 points
      
      // Sufficient should be broad middle range (20% of possible scores)
      const sufficientRange = BAGRUT_CONSTANTS.GRADE_LEVELS['מספיק']
      expect(sufficientRange.max - sufficientRange.min + 1).toBe(20) // 55-74 = 20 points
      
      // Barely sufficient should be narrow (10% of possible scores)
      const barelySufficientRange = BAGRUT_CONSTANTS.GRADE_LEVELS['מספיק בקושי']
      expect(barelySufficientRange.max - barelySufficientRange.min + 1).toBe(10) // 45-54 = 10 points
      
      // Fail should encompass lower scores (45% of possible scores)
      const failRange = BAGRUT_CONSTANTS.GRADE_LEVELS['לא עבר/ה']
      expect(failRange.max - failRange.min + 1).toBe(45) // 0-44 = 45 points
    })
  })
})