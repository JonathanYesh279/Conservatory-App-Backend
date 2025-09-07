// api/bagrut/__tests__/bagrut.api-endpoints.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import { bagrutController } from '../bagrut.controller.js'
import { bagrutService } from '../bagrut.service.js'
import { ObjectId } from 'mongodb'

// Mock dependencies
vi.mock('../bagrut.service.js', () => ({
  bagrutService: {
    updateDirectorEvaluation: vi.fn(),
    setRecitalConfiguration: vi.fn(),
    updateGradingDetails: vi.fn(),
    completeBagrut: vi.fn(),
    getBagruts: vi.fn(),
    getBagrutById: vi.fn(),
    addBagrut: vi.fn(),
    updatePresentation: vi.fn()
  }
}))

vi.mock('../../services/fileStorage.service.js', () => ({
  deleteFile: vi.fn()
}))

describe('Bagrut API Endpoint Tests', () => {
  let app
  let mockTeacher
  let mockBagrut

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup Express app with middleware
    app = express()
    app.use(express.json())
    
    // Mock authentication middleware
    app.use((req, res, next) => {
      req.teacher = mockTeacher
      req.bagrut = mockBagrut
      next()
    })

    mockTeacher = {
      _id: new ObjectId('6579e36c83c8b3a5c2df8a8d'),
      name: 'Test Teacher'
    }

    mockBagrut = {
      _id: new ObjectId('6579e36c83c8b3a5c2df8a8b'),
      studentId: '6579e36c83c8b3a5c2df8a8c',
      teacherId: mockTeacher._id.toString(),
      recitalUnits: 5,
      recitalField: 'קלאסי'
    }

    // Setup routes
    app.put('/bagrut/:id/director-evaluation', bagrutController.updateDirectorEvaluation)
    app.put('/bagrut/:id/recital-configuration', bagrutController.setRecitalConfiguration)
    app.put('/bagrut/:id/grading-details', bagrutController.updateGradingDetails)
    app.post('/bagrut/:id/complete', bagrutController.completeBagrut)
    app.get('/bagrut', bagrutController.getBagruts)
    app.post('/bagrut', bagrutController.addBagrut)
    app.put('/bagrut/:id/presentation/:presentationIndex', bagrutController.updatePresentation)
  })

  describe('Director Evaluation Endpoint', () => {
    it('should successfully update director evaluation with valid data', async () => {
      const evaluationData = {
        points: 8,
        comments: 'Excellent leadership and performance throughout the year'
      }

      const updatedBagrut = {
        ...mockBagrut,
        directorEvaluation: {
          points: 8,
          percentage: 10,
          comments: evaluationData.comments
        },
        finalGrade: 85,
        finalGradeLevel: 'טוב'
      }

      bagrutService.updateDirectorEvaluation.mockResolvedValueOnce(updatedBagrut)

      const response = await request(app)
        .put('/bagrut/6579e36c83c8b3a5c2df8a8b/director-evaluation')
        .send(evaluationData)
        .expect(200)

      expect(response.body).toEqual(updatedBagrut)
      expect(bagrutService.updateDirectorEvaluation).toHaveBeenCalledWith(
        '6579e36c83c8b3a5c2df8a8b',
        {
          points: 8,
          comments: evaluationData.comments
        }
      )
    })

    it('should reject director evaluation with invalid points (too high)', async () => {
      const invalidData = {
        points: 15, // Above maximum of 10
        comments: 'Test'
      }

      const response = await request(app)
        .put('/bagrut/6579e36c83c8b3a5c2df8a8b/director-evaluation')
        .send(invalidData)
        .expect(400)

      expect(response.body.error).toContain('0 ל-10')
      expect(response.body.errorEn).toContain('between 0 and 10')
      expect(bagrutService.updateDirectorEvaluation).not.toHaveBeenCalled()
    })

    it('should reject director evaluation with invalid points (negative)', async () => {
      const invalidData = {
        points: -5, // Below minimum of 0
        comments: 'Test'
      }

      const response = await request(app)
        .put('/bagrut/6579e36c83c8b3a5c2df8a8b/director-evaluation')
        .send(invalidData)
        .expect(400)

      expect(response.body.error).toContain('0 ל-10')
      expect(bagrutService.updateDirectorEvaluation).not.toHaveBeenCalled()
    })

    it('should reject director evaluation with missing points', async () => {
      const invalidData = {
        comments: 'Test comment without points'
      }

      const response = await request(app)
        .put('/bagrut/6579e36c83c8b3a5c2df8a8b/director-evaluation')
        .send(invalidData)
        .expect(400)

      expect(response.body.error).toContain('נדרשות')
      expect(response.body.errorEn).toContain('required')
      expect(bagrutService.updateDirectorEvaluation).not.toHaveBeenCalled()
    })

    it('should reject director evaluation with non-numeric points', async () => {
      const invalidData = {
        points: 'eight', // String instead of number
        comments: 'Test'
      }

      const response = await request(app)
        .put('/bagrut/6579e36c83c8b3a5c2df8a8b/director-evaluation')
        .send(invalidData)
        .expect(400)

      expect(response.body.error).toContain('0 ל-10')
      expect(bagrutService.updateDirectorEvaluation).not.toHaveBeenCalled()
    })

    it('should accept director evaluation with zero points', async () => {
      const validData = {
        points: 0,
        comments: 'Needs significant improvement'
      }

      const updatedBagrut = {
        ...mockBagrut,
        directorEvaluation: { points: 0, percentage: 10, comments: validData.comments }
      }

      bagrutService.updateDirectorEvaluation.mockResolvedValueOnce(updatedBagrut)

      await request(app)
        .put('/bagrut/6579e36c83c8b3a5c2df8a8b/director-evaluation')
        .send(validData)
        .expect(200)

      expect(bagrutService.updateDirectorEvaluation).toHaveBeenCalledWith(
        '6579e36c83c8b3a5c2df8a8b',
        { points: 0, comments: validData.comments }
      )
    })

    it('should accept director evaluation with maximum points', async () => {
      const validData = {
        points: 10,
        comments: 'Outstanding leadership'
      }

      const updatedBagrut = {
        ...mockBagrut,
        directorEvaluation: { points: 10, percentage: 10, comments: validData.comments }
      }

      bagrutService.updateDirectorEvaluation.mockResolvedValueOnce(updatedBagrut)

      await request(app)
        .put('/bagrut/6579e36c83c8b3a5c2df8a8b/director-evaluation')
        .send(validData)
        .expect(200)

      expect(bagrutService.updateDirectorEvaluation).toHaveBeenCalledWith(
        '6579e36c83c8b3a5c2df8a8b',
        { points: 10, comments: validData.comments }
      )
    })

    it('should default empty comments if not provided', async () => {
      const validData = {
        points: 7
        // No comments provided
      }

      const updatedBagrut = {
        ...mockBagrut,
        directorEvaluation: { points: 7, percentage: 10, comments: '' }
      }

      bagrutService.updateDirectorEvaluation.mockResolvedValueOnce(updatedBagrut)

      await request(app)
        .put('/bagrut/6579e36c83c8b3a5c2df8a8b/director-evaluation')
        .send(validData)
        .expect(200)

      expect(bagrutService.updateDirectorEvaluation).toHaveBeenCalledWith(
        '6579e36c83c8b3a5c2df8a8b',
        { points: 7, comments: '' }
      )
    })
  })

  describe('Recital Configuration Endpoint', () => {
    it('should successfully set recital configuration with valid data', async () => {
      const configData = {
        units: 5,
        field: 'ג\'אז'
      }

      const updatedBagrut = {
        ...mockBagrut,
        recitalUnits: 5,
        recitalField: 'ג\'אז'
      }

      bagrutService.setRecitalConfiguration.mockResolvedValueOnce(updatedBagrut)

      const response = await request(app)
        .put('/bagrut/6579e36c83c8b3a5c2df8a8b/recital-configuration')
        .send(configData)
        .expect(200)

      expect(response.body).toEqual(updatedBagrut)
      expect(bagrutService.setRecitalConfiguration).toHaveBeenCalledWith(
        '6579e36c83c8b3a5c2df8a8b',
        5,
        'ג\'אז'
      )
    })

    it('should accept 3 units configuration', async () => {
      const configData = {
        units: 3,
        field: 'שירה'
      }

      const updatedBagrut = {
        ...mockBagrut,
        recitalUnits: 3,
        recitalField: 'שירה'
      }

      bagrutService.setRecitalConfiguration.mockResolvedValueOnce(updatedBagrut)

      await request(app)
        .put('/bagrut/6579e36c83c8b3a5c2df8a8b/recital-configuration')
        .send(configData)
        .expect(200)

      expect(bagrutService.setRecitalConfiguration).toHaveBeenCalledWith(
        '6579e36c83c8b3a5c2df8a8b',
        3,
        'שירה'
      )
    })

    it('should reject invalid unit values', async () => {
      const invalidUnits = [1, 2, 4, 6, 7, 10]

      for (const units of invalidUnits) {
        const invalidData = {
          units,
          field: 'קלאסי'
        }

        const response = await request(app)
          .put('/bagrut/6579e36c83c8b3a5c2df8a8b/recital-configuration')
          .send(invalidData)
          .expect(400)

        expect(response.body.error).toContain('3 או 5')
        expect(response.body.errorEn).toContain('3 or 5')
      }

      expect(bagrutService.setRecitalConfiguration).not.toHaveBeenCalled()
    })

    it('should reject missing units', async () => {
      const invalidData = {
        field: 'קלאסי'
        // Missing units
      }

      const response = await request(app)
        .put('/bagrut/6579e36c83c8b3a5c2df8a8b/recital-configuration')
        .send(invalidData)
        .expect(400)

      expect(response.body.error).toContain('נדרשות')
      expect(response.body.errorEn).toContain('required')
      expect(bagrutService.setRecitalConfiguration).not.toHaveBeenCalled()
    })

    it('should reject invalid field values', async () => {
      const invalidFields = ['רוק', 'פופ', 'אלקטרוני', 'invalid']

      for (const field of invalidFields) {
        const invalidData = {
          units: 5,
          field
        }

        const response = await request(app)
          .put('/bagrut/6579e36c83c8b3a5c2df8a8b/recital-configuration')
          .send(invalidData)
          .expect(400)

        expect(response.body.error).toContain('קלאסי')
        expect(response.body.errorEn).toContain('Classical')
      }

      expect(bagrutService.setRecitalConfiguration).not.toHaveBeenCalled()
    })

    it('should reject missing field', async () => {
      const invalidData = {
        units: 5
        // Missing field
      }

      const response = await request(app)
        .put('/bagrut/6579e36c83c8b3a5c2df8a8b/recital-configuration')
        .send(invalidData)
        .expect(400)

      expect(response.body.error).toContain('נדרש')
      expect(response.body.errorEn).toContain('required')
      expect(bagrutService.setRecitalConfiguration).not.toHaveBeenCalled()
    })

    it('should accept all valid field combinations', async () => {
      const validFields = ['קלאסי', 'ג\'אז', 'שירה']
      const validUnits = [3, 5]

      for (const field of validFields) {
        for (const units of validUnits) {
          const validData = { units, field }
          const updatedBagrut = { ...mockBagrut, recitalUnits: units, recitalField: field }

          bagrutService.setRecitalConfiguration.mockResolvedValueOnce(updatedBagrut)

          await request(app)
            .put('/bagrut/6579e36c83c8b3a5c2df8a8b/recital-configuration')
            .send(validData)
            .expect(200)

          expect(bagrutService.setRecitalConfiguration).toHaveBeenCalledWith(
            '6579e36c83c8b3a5c2df8a8b',
            units,
            field
          )
        }
      }
    })
  })

  describe('Grading Details Endpoint Validation', () => {
    it('should validate point allocation maximums', async () => {
      const invalidGradingDetails = {
        technique: { grade: 15, maxPoints: 20 },
        interpretation: { grade: 25, maxPoints: 30 },
        musicality: { grade: 35, maxPoints: 40 },
        overall: { grade: 8, maxPoints: 10 },
        detailedGrading: {
          playingSkills: { points: 45 }, // Exceeds 40
          musicalUnderstanding: { points: 25 },
          textKnowledge: { points: 15 },
          playingByHeart: { points: 8 }
        }
      }

      const response = await request(app)
        .put('/bagrut/6579e36c83c8b3a5c2df8a8b/grading-details')
        .send(invalidGradingDetails)
        .expect(400)

      expect(response.body.error).toContain('40 נקודות')
      expect(response.body.errorEn).toContain('40 points')
      expect(bagrutService.updateGradingDetails).not.toHaveBeenCalled()
    })

    it('should validate musical understanding maximum', async () => {
      const invalidGradingDetails = {
        technique: { grade: 15, maxPoints: 20 },
        interpretation: { grade: 25, maxPoints: 30 },
        musicality: { grade: 35, maxPoints: 40 },
        overall: { grade: 8, maxPoints: 10 },
        detailedGrading: {
          playingSkills: { points: 35 },
          musicalUnderstanding: { points: 35 }, // Exceeds 30
          textKnowledge: { points: 15 },
          playingByHeart: { points: 8 }
        }
      }

      const response = await request(app)
        .put('/bagrut/6579e36c83c8b3a5c2df8a8b/grading-details')
        .send(invalidGradingDetails)
        .expect(400)

      expect(response.body.error).toContain('30 נקודות')
      expect(response.body.errorEn).toContain('30 points')
    })

    it('should validate text knowledge maximum', async () => {
      const invalidGradingDetails = {
        technique: { grade: 15, maxPoints: 20 },
        interpretation: { grade: 25, maxPoints: 30 },
        musicality: { grade: 35, maxPoints: 40 },
        overall: { grade: 8, maxPoints: 10 },
        detailedGrading: {
          playingSkills: { points: 35 },
          musicalUnderstanding: { points: 25 },
          textKnowledge: { points: 25 }, // Exceeds 20
          playingByHeart: { points: 8 }
        }
      }

      const response = await request(app)
        .put('/bagrut/6579e36c83c8b3a5c2df8a8b/grading-details')
        .send(invalidGradingDetails)
        .expect(400)

      expect(response.body.error).toContain('20 נקודות')
      expect(response.body.errorEn).toContain('20 points')
    })

    it('should validate playing by heart maximum', async () => {
      const invalidGradingDetails = {
        technique: { grade: 15, maxPoints: 20 },
        interpretation: { grade: 25, maxPoints: 30 },
        musicality: { grade: 35, maxPoints: 40 },
        overall: { grade: 8, maxPoints: 10 },
        detailedGrading: {
          playingSkills: { points: 35 },
          musicalUnderstanding: { points: 25 },
          textKnowledge: { points: 15 },
          playingByHeart: { points: 15 } // Exceeds 10
        }
      }

      const response = await request(app)
        .put('/bagrut/6579e36c83c8b3a5c2df8a8b/grading-details')
        .send(invalidGradingDetails)
        .expect(400)

      expect(response.body.error).toContain('10 נקודות')
      expect(response.body.errorEn).toContain('10 points')
    })

    it('should require all grading fields', async () => {
      const incompleteGradingDetails = {
        technique: { grade: 15, maxPoints: 20 },
        interpretation: { grade: 25, maxPoints: 30 }
        // Missing musicality and overall
      }

      const response = await request(app)
        .put('/bagrut/6579e36c83c8b3a5c2df8a8b/grading-details')
        .send(incompleteGradingDetails)
        .expect(400)

      expect(response.body.error).toContain('שדות הערכה חסרים')
      expect(response.body.errorEn).toContain('Missing required grading fields')
      expect(bagrutService.updateGradingDetails).not.toHaveBeenCalled()
    })

    it('should accept valid grading details', async () => {
      const validGradingDetails = {
        technique: { grade: 18, maxPoints: 20, comments: 'Excellent technique' },
        interpretation: { grade: 28, maxPoints: 30, comments: 'Very musical' },
        musicality: { grade: 38, maxPoints: 40, comments: 'Outstanding musicality' },
        overall: { grade: 9, maxPoints: 10, comments: 'Great performance' },
        detailedGrading: {
          playingSkills: { points: 38, comments: 'Excellent' },
          musicalUnderstanding: { points: 28, comments: 'Very good' },
          textKnowledge: { points: 19, comments: 'Good knowledge' },
          playingByHeart: { points: 9, comments: 'Confident' }
        }
      }

      const updatedBagrut = {
        ...mockBagrut,
        gradingDetails: validGradingDetails
      }

      bagrutService.updateGradingDetails.mockResolvedValueOnce(updatedBagrut)

      await request(app)
        .put('/bagrut/6579e36c83c8b3a5c2df8a8b/grading-details')
        .send(validGradingDetails)
        .expect(200)

      expect(bagrutService.updateGradingDetails).toHaveBeenCalledWith(
        '6579e36c83c8b3a5c2df8a8b',
        validGradingDetails,
        mockTeacher._id.toString()
      )
    })
  })

  describe('Authorization Requirements', () => {
    it('should handle service errors gracefully', async () => {
      bagrutService.updateDirectorEvaluation.mockRejectedValueOnce(
        new Error('Database connection failed')
      )

      const validData = {
        points: 8,
        comments: 'Test'
      }

      await request(app)
        .put('/bagrut/6579e36c83c8b3a5c2df8a8b/director-evaluation')
        .send(validData)
        .expect(500)
    })

    it('should handle service validation errors', async () => {
      bagrutService.setRecitalConfiguration.mockRejectedValueOnce(
        new Error('Bagrut not found')
      )

      const validData = {
        units: 5,
        field: 'קלאסי'
      }

      await request(app)
        .put('/bagrut/6579e36c83c8b3a5c2df8a8b/recital-configuration')
        .send(validData)
        .expect(500)
    })
  })

  describe('Data Validation Edge Cases', () => {
    it('should handle null values in director evaluation', async () => {
      const invalidData = {
        points: null,
        comments: 'Test'
      }

      const response = await request(app)
        .put('/bagrut/6579e36c83c8b3a5c2df8a8b/director-evaluation')
        .send(invalidData)
        .expect(400)

      expect(response.body.error).toContain('נדרשות')
    })

    it('should handle null values in recital configuration', async () => {
      const invalidData = {
        units: null,
        field: 'קלאסי'
      }

      const response = await request(app)
        .put('/bagrut/6579e36c83c8b3a5c2df8a8b/recital-configuration')
        .send(invalidData)
        .expect(400)

      expect(response.body.error).toContain('נדרשות')
    })

    it('should handle decimal points in director evaluation', async () => {
      const validData = {
        points: 7.5,
        comments: 'Good performance with room for improvement'
      }

      const updatedBagrut = {
        ...mockBagrut,
        directorEvaluation: { points: 7.5, percentage: 10, comments: validData.comments }
      }

      bagrutService.updateDirectorEvaluation.mockResolvedValueOnce(updatedBagrut)

      await request(app)
        .put('/bagrut/6579e36c83c8b3a5c2df8a8b/director-evaluation')
        .send(validData)
        .expect(200)

      expect(bagrutService.updateDirectorEvaluation).toHaveBeenCalledWith(
        '6579e36c83c8b3a5c2df8a8b',
        { points: 7.5, comments: validData.comments }
      )
    })
  })
})