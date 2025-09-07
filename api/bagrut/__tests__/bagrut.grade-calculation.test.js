// api/bagrut/__tests__/bagrut.grade-calculation.test.js
import { describe, it, expect } from 'vitest'
import { 
  calculateFinalGradeWithDirectorEvaluation,
  calculateTotalGradeFromDetailedGrading,
  calculateFinalGradeFromDetails,
  calculateFinalGradeWithDirector
} from '../bagrut.validation.js'

describe('Final Grade Calculation Tests', () => {
  
  describe('Performance Grade Weighting (90%)', () => {
    it('should weight performance grade at 90 percent of final grade', () => {
      const detailedGrading = {
        playingSkills: { points: 40, maxPoints: 40 },
        musicalUnderstanding: { points: 30, maxPoints: 30 },
        textKnowledge: { points: 20, maxPoints: 20 },
        playingByHeart: { points: 10, maxPoints: 10 }
      }
      
      const directorEvaluation = {
        points: 10,
        percentage: 10,
        comments: 'Excellent performance'
      }
      
      const result = calculateFinalGradeWithDirectorEvaluation(detailedGrading, directorEvaluation)
      // 100 * 0.9 + 10 * 1 = 90 + 10 = 100
      expect(result).toBe(100)
    })

    it('should correctly calculate 90% weighting with different performance scores', () => {
      const testCases = [
        {
          performance: 80,
          directorPoints: 10,
          expected: Math.round(80 * 0.9 + 10) // 72 + 10 = 82
        },
        {
          performance: 60,
          directorPoints: 8,
          expected: Math.round(60 * 0.9 + 8) // 54 + 8 = 62
        },
        {
          performance: 90,
          directorPoints: 5,
          expected: Math.round(90 * 0.9 + 5) // 81 + 5 = 86
        }
      ]
      
      testCases.forEach(({ performance, directorPoints, expected }, index) => {
        const detailedGrading = {
          playingSkills: { points: Math.floor(performance * 0.4), maxPoints: 40 },
          musicalUnderstanding: { points: Math.floor(performance * 0.3), maxPoints: 30 },
          textKnowledge: { points: Math.floor(performance * 0.2), maxPoints: 20 },
          playingByHeart: { points: Math.floor(performance * 0.1), maxPoints: 10 }
        }
        
        // Adjust to get exact performance score
        const currentTotal = detailedGrading.playingSkills.points + 
                           detailedGrading.musicalUnderstanding.points + 
                           detailedGrading.textKnowledge.points + 
                           detailedGrading.playingByHeart.points
        
        if (currentTotal !== performance) {
          detailedGrading.playingSkills.points += (performance - currentTotal)
        }
        
        const directorEvaluation = {
          points: directorPoints,
          percentage: 10
        }
        
        const result = calculateFinalGradeWithDirectorEvaluation(detailedGrading, directorEvaluation)
        expect(result, `Test case ${index + 1}`).toBe(expected)
      })
    })
  })

  describe('Director Evaluation Contribution (10%)', () => {
    it('should contribute exactly 10 percent to final grade', () => {
      const detailedGrading = {
        playingSkills: { points: 36, maxPoints: 40 }, // 90 * 0.4 = 36
        musicalUnderstanding: { points: 27, maxPoints: 30 }, // 90 * 0.3 = 27
        textKnowledge: { points: 18, maxPoints: 20 }, // 90 * 0.2 = 18
        playingByHeart: { points: 9, maxPoints: 10 } // 90 * 0.1 = 9
      }
      
      const directorEvaluation = {
        points: 8,
        percentage: 10
      }
      
      const result = calculateFinalGradeWithDirectorEvaluation(detailedGrading, directorEvaluation)
      // Performance: 90, Director: 8
      // Final: 90 * 0.9 + 8 = 81 + 8 = 89
      expect(result).toBe(89)
    })

    it('should handle different director evaluation scores', () => {
      const baseDetailedGrading = {
        playingSkills: { points: 32, maxPoints: 40 },
        musicalUnderstanding: { points: 24, maxPoints: 30 },
        textKnowledge: { points: 16, maxPoints: 20 },
        playingByHeart: { points: 8, maxPoints: 10 }
      } // Total: 80 points
      
      const directorScores = [0, 2, 5, 7, 10]
      const expectedResults = [
        Math.round(80 * 0.9 + 0), // 72
        Math.round(80 * 0.9 + 2), // 74
        Math.round(80 * 0.9 + 5), // 77
        Math.round(80 * 0.9 + 7), // 79
        Math.round(80 * 0.9 + 10) // 82
      ]
      
      directorScores.forEach((directorPoints, index) => {
        const directorEvaluation = {
          points: directorPoints,
          percentage: 10
        }
        
        const result = calculateFinalGradeWithDirectorEvaluation(baseDetailedGrading, directorEvaluation)
        expect(result).toBe(expectedResults[index])
      })
    })
  })

  describe('Edge Cases and Null Values', () => {
    it('should return null when performance grade is null', () => {
      const detailedGrading = {
        playingSkills: { points: null, maxPoints: 40 },
        musicalUnderstanding: { points: 25, maxPoints: 30 },
        textKnowledge: { points: 18, maxPoints: 20 },
        playingByHeart: { points: 8, maxPoints: 10 }
      }
      
      const directorEvaluation = {
        points: 8,
        percentage: 10
      }
      
      const result = calculateFinalGradeWithDirectorEvaluation(detailedGrading, directorEvaluation)
      expect(result).toBeNull()
    })

    it('should return null when director evaluation is null', () => {
      const detailedGrading = {
        playingSkills: { points: 35, maxPoints: 40 },
        musicalUnderstanding: { points: 25, maxPoints: 30 },
        textKnowledge: { points: 18, maxPoints: 20 },
        playingByHeart: { points: 8, maxPoints: 10 }
      }
      
      const directorEvaluation = {
        points: null,
        percentage: 10
      }
      
      const result = calculateFinalGradeWithDirectorEvaluation(detailedGrading, directorEvaluation)
      expect(result).toBeNull()
    })

    it('should return null when director evaluation is missing', () => {
      const detailedGrading = {
        playingSkills: { points: 35, maxPoints: 40 },
        musicalUnderstanding: { points: 25, maxPoints: 30 },
        textKnowledge: { points: 18, maxPoints: 20 },
        playingByHeart: { points: 8, maxPoints: 10 }
      }
      
      const result = calculateFinalGradeWithDirectorEvaluation(detailedGrading, null)
      expect(result).toBeNull()
    })

    it('should handle zero scores correctly', () => {
      const detailedGrading = {
        playingSkills: { points: 0, maxPoints: 40 },
        musicalUnderstanding: { points: 0, maxPoints: 30 },
        textKnowledge: { points: 0, maxPoints: 20 },
        playingByHeart: { points: 0, maxPoints: 10 }
      }
      
      const directorEvaluation = {
        points: 0,
        percentage: 10
      }
      
      const result = calculateFinalGradeWithDirectorEvaluation(detailedGrading, directorEvaluation)
      expect(result).toBe(0)
    })

    it('should handle director evaluation of zero points', () => {
      const detailedGrading = {
        playingSkills: { points: 32, maxPoints: 40 },
        musicalUnderstanding: { points: 24, maxPoints: 30 },
        textKnowledge: { points: 16, maxPoints: 20 },
        playingByHeart: { points: 8, maxPoints: 10 }
      } // Total: 80 points
      
      const directorEvaluation = {
        points: 0,
        percentage: 10
      }
      
      const result = calculateFinalGradeWithDirectorEvaluation(detailedGrading, directorEvaluation)
      expect(result).toBe(72) // 80 * 0.9 + 0 = 72
    })
  })

  describe('Maximum Possible Score Verification', () => {
    it('should verify maximum possible score is 100', () => {
      const maxDetailedGrading = {
        playingSkills: { points: 40, maxPoints: 40 },
        musicalUnderstanding: { points: 30, maxPoints: 30 },
        textKnowledge: { points: 20, maxPoints: 20 },
        playingByHeart: { points: 10, maxPoints: 10 }
      }
      
      const maxDirectorEvaluation = {
        points: 10,
        percentage: 10
      }
      
      const result = calculateFinalGradeWithDirectorEvaluation(maxDetailedGrading, maxDirectorEvaluation)
      expect(result).toBe(100)
    })

    it('should cap final grade at 100 even if calculation exceeds', () => {
      // This test ensures the system caps at 100, though mathematically it shouldn't exceed with proper inputs
      const detailedGrading = {
        playingSkills: { points: 40, maxPoints: 40 },
        musicalUnderstanding: { points: 30, maxPoints: 30 },
        textKnowledge: { points: 20, maxPoints: 20 },
        playingByHeart: { points: 10, maxPoints: 10 }
      }
      
      const directorEvaluation = {
        points: 10,
        percentage: 10
      }
      
      const result = calculateFinalGradeWithDirectorEvaluation(detailedGrading, directorEvaluation)
      expect(result).toBeLessThanOrEqual(100)
    })
  })

  describe('Various Score Combinations', () => {
    it('should test various combinations of performance and director scores', () => {
      const testCombinations = [
        { performance: [40, 30, 20, 10], director: 10, expected: 100 }, // Perfect performance
        { performance: [36, 27, 18, 9], director: 8, expected: 89 },   // High performance
        { performance: [32, 24, 16, 8], director: 6, expected: 78 },   // Good performance
        { performance: [28, 21, 14, 7], director: 4, expected: 67 },   // Average performance
        { performance: [24, 18, 12, 6], director: 2, expected: 56 },   // Below average
        { performance: [20, 15, 10, 5], director: 0, expected: 45 },   // Low performance
        { performance: [0, 0, 0, 0], director: 10, expected: 10 },     // Failed performance, excellent director
        { performance: [40, 30, 20, 10], director: 0, expected: 90 }   // Perfect performance, no director points
      ]
      
      testCombinations.forEach(({ performance, director, expected }, index) => {
        const detailedGrading = {
          playingSkills: { points: performance[0], maxPoints: 40 },
          musicalUnderstanding: { points: performance[1], maxPoints: 30 },
          textKnowledge: { points: performance[2], maxPoints: 20 },
          playingByHeart: { points: performance[3], maxPoints: 10 }
        }
        
        const directorEvaluation = {
          points: director,
          percentage: 10
        }
        
        const result = calculateFinalGradeWithDirectorEvaluation(detailedGrading, directorEvaluation)
        expect(result, `Combination ${index + 1}: Performance [${performance.join(', ')}], Director ${director}`).toBe(expected)
      })
    })
  })

  describe('Calculation Precision and Rounding', () => {
    it('should handle decimal results correctly with rounding', () => {
      const detailedGrading = {
        playingSkills: { points: 33, maxPoints: 40 },
        musicalUnderstanding: { points: 25, maxPoints: 30 },
        textKnowledge: { points: 17, maxPoints: 20 },
        playingByHeart: { points: 8, maxPoints: 10 }
      } // Total: 83 points
      
      const directorEvaluation = {
        points: 7,
        percentage: 10
      }
      
      const result = calculateFinalGradeWithDirectorEvaluation(detailedGrading, directorEvaluation)
      // 83 * 0.9 + 7 = 74.7 + 7 = 81.7, should round to 82
      expect(result).toBe(82)
    })

    it('should test edge cases for rounding', () => {
      const testCases = [
        // Test cases where rounding matters
        { totalPerf: 81, directorPts: 6, expected: Math.round(81 * 0.9 + 6) }, // 72.9 + 6 = 78.9 → 79
        { totalPerf: 77, directorPts: 4, expected: Math.round(77 * 0.9 + 4) }, // 69.3 + 4 = 73.3 → 73
        { totalPerf: 79, directorPts: 3, expected: Math.round(79 * 0.9 + 3) }  // 71.1 + 3 = 74.1 → 74
      ]
      
      testCases.forEach(({ totalPerf, directorPts, expected }, index) => {
        // Create grading that totals to totalPerf
        const detailedGrading = {
          playingSkills: { points: Math.floor(totalPerf * 0.4), maxPoints: 40 },
          musicalUnderstanding: { points: Math.floor(totalPerf * 0.3), maxPoints: 30 },
          textKnowledge: { points: Math.floor(totalPerf * 0.2), maxPoints: 20 },
          playingByHeart: { points: Math.floor(totalPerf * 0.1), maxPoints: 10 }
        }
        
        // Adjust to exact total
        const currentTotal = detailedGrading.playingSkills.points + 
                           detailedGrading.musicalUnderstanding.points + 
                           detailedGrading.textKnowledge.points + 
                           detailedGrading.playingByHeart.points
        
        if (currentTotal !== totalPerf) {
          detailedGrading.playingSkills.points += (totalPerf - currentTotal)
        }
        
        const directorEvaluation = { points: directorPts, percentage: 10 }
        const result = calculateFinalGradeWithDirectorEvaluation(detailedGrading, directorEvaluation)
        
        expect(result, `Rounding test ${index + 1}: ${totalPerf}*0.9 + ${directorPts}`).toBe(expected)
      })
    })
  })

  describe('Alternative Calculation Function Tests', () => {
    it('should test calculateFinalGradeWithDirector function', () => {
      const performanceGrade = 85
      const directorEvaluation = { points: 7 }
      
      const result = calculateFinalGradeWithDirector(performanceGrade, directorEvaluation)
      expect(result).toBe(83.5) // 85 * 0.9 + 7 = 76.5 + 7 = 83.5
    })

    it('should return null for invalid inputs in calculateFinalGradeWithDirector', () => {
      expect(calculateFinalGradeWithDirector(null, { points: 7 })).toBeNull()
      expect(calculateFinalGradeWithDirector(85, null)).toBeNull()
      expect(calculateFinalGradeWithDirector(85, { points: null })).toBeNull()
    })
  })
})