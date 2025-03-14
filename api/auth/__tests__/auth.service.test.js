import { describe, it, expect, vi, beforeEach } from 'vitest'
import { authService } from '../auth.service.js'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { getCollection } from '../../../services/mongoDB.service.js'
import { ObjectId } from 'mongodb'

// Mock dependencies
vi.mock('bcrypt')
vi.mock('jsonwebtoken')
vi.mock('../../../services/mongoDB.service.js')

describe('Auth Service', () => {
  let mockCollection, mockFindOne, mockUpdateOne

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Setup mock collection methods
    mockFindOne = vi.fn()
    mockUpdateOne = vi.fn()
    mockCollection = {
      findOne: mockFindOne,
      updateOne: mockUpdateOne
    }
    getCollection.mockResolvedValue(mockCollection)

    // Set environment variables for tests
    process.env.ACCESS_TOKEN_SECRET = 'test-access-secret'
    process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret'
  })

  describe('login', () => {
    it('should throw an error if teacher is not found', async () => {
      // Setup
      mockFindOne.mockResolvedValue(null)

      // Execute & Assert
      await expect(authService.login('test@example.com', 'password')).rejects.toThrow('Invalid email or password')
      
      expect(mockFindOne).toHaveBeenCalledWith({
        'credentials.email': 'test@example.com',
        isActive: true,
      })
    })

    it('should throw an error if password does not match', async () => {
      // Setup
      const mockTeacher = {
        _id: new ObjectId('6579e36c83c8b3a5c2df8a8b'),
        credentials: {
          password: 'hashed-password'
        }
      }
      mockFindOne.mockResolvedValue(mockTeacher)
      bcrypt.compare.mockResolvedValue(false)

      // Execute & Assert
      await expect(authService.login('test@example.com', 'wrong-password')).rejects.toThrow('Invalid email or password')
      
      expect(bcrypt.compare).toHaveBeenCalledWith('wrong-password', 'hashed-password')
    })

    it('should return tokens and user info when login is successful', async () => {
      // Setup
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const mockTeacher = {
        _id: teacherId,
        personalInfo: {
          fullName: 'Test Teacher'
        },
        credentials: {
          email: 'test@example.com',
          password: 'hashed-password'
        },
        roles: ['מורה']
      }
      mockFindOne.mockResolvedValue(mockTeacher)
      bcrypt.compare.mockResolvedValue(true)

      // Mock tokens generation
      jwt.sign.mockImplementation((data, secret, options) => {
        if (secret === process.env.ACCESS_TOKEN_SECRET) return 'mock-access-token'
        if (secret === process.env.REFRESH_TOKEN_SECRET) return 'mock-refresh-token'
        return 'unknown-token'
      })

      // Execute
      const result = await authService.login('test@example.com', 'password')

      // Assert
      expect(result).toEqual({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        teacher: {
          _id: teacherId.toString(),
          fullName: mockTeacher.personalInfo.fullName,
          email: mockTeacher.credentials.email,
          roles: mockTeacher.roles,
        }
      })

      // Verify token generation
      expect(jwt.sign).toHaveBeenCalledTimes(2)
      
      // Verify refresh token is stored
      expect(mockUpdateOne).toHaveBeenCalledWith(
        { _id: teacherId },
        {
          $set: {
            'credentials.refreshToken': 'mock-refresh-token',
            'credentials.lastLogin': expect.any(Date),
            updatedAt: expect.any(Date),
          },
        }
      )
    })

    it('should log login attempts', async () => {
      // Setup
      const consoleSpy = vi.spyOn(console, 'log')
      mockFindOne.mockResolvedValue(null)

      // Execute
      try {
        await authService.login('test@example.com', 'password')
      } catch (error) {
        // Expected to throw
      }

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith('Login attempt with email:', 'test@example.com')
    })

    it('should handle and log errors', async () => {
      // Setup
      const consoleSpy = vi.spyOn(console, 'error')
      mockFindOne.mockRejectedValue(new Error('Database connection failed'))

      // Execute & Assert
      await expect(authService.login('test@example.com', 'password')).rejects.toThrow('Database connection failed')
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Error in login:'))
    })
  })

  describe('refreshAccessToken', () => {
    it('should throw an error if refresh token is invalid', async () => {
      // Setup
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token')
      })

      // Execute & Assert
      await expect(authService.refreshAccessToken('invalid-token')).rejects.toThrow('Invalid refresh token')
    })

    it('should throw an error if teacher is not found', async () => {
      // Setup
      jwt.verify.mockReturnValue({ _id: '6579e36c83c8b3a5c2df8a8b' })
      mockFindOne.mockResolvedValue(null)

      // Execute & Assert
      await expect(authService.refreshAccessToken('valid-token')).rejects.toThrow('Invalid refresh token')
    })

    it('should return a new access token when refresh token is valid', async () => {
      // Setup
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      const mockTeacher = {
        _id: teacherId,
        personalInfo: {
          fullName: 'Test Teacher'
        },
        credentials: {
          email: 'test@example.com',
          refreshToken: 'valid-refresh-token'
        },
        roles: ['מורה'],
        isActive: true
      }

      jwt.verify.mockReturnValue({ _id: teacherId.toString() })
      mockFindOne.mockResolvedValue(mockTeacher)
      jwt.sign.mockReturnValue('new-access-token')

      // Execute
      const result = await authService.refreshAccessToken('valid-refresh-token')

      // Assert
      expect(result).toEqual({ accessToken: 'new-access-token' })
      expect(jwt.verify).toHaveBeenCalledWith('valid-refresh-token', process.env.REFRESH_TOKEN_SECRET)
      expect(mockFindOne).toHaveBeenCalledWith({
        _id: expect.any(ObjectId),
        'credentials.refreshToken': 'valid-refresh-token',
        isActive: true
      })
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: teacherId.toString(),
          fullName: mockTeacher.personalInfo.fullName,
          email: mockTeacher.credentials.email,
          roles: mockTeacher.roles
        }),
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: '12h' }
      )
    })

    it('should handle and log errors', async () => {
      // Setup
      const consoleSpy = vi.spyOn(console, 'error')
      jwt.verify.mockRejectedValue(new Error('JWT verification failed'))

      // Execute & Assert
      await expect(authService.refreshAccessToken('valid-token')).rejects.toThrow('Invalid refresh token')
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Error in refreshAccessToken:'))
    })
  })

  describe('logout', () => {
    it('should clear the refresh token for the teacher', async () => {
      // Setup
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8b')

      // Execute
      await authService.logout(teacherId)

      // Assert
      expect(mockUpdateOne).toHaveBeenCalledWith(
        { _id: teacherId },
        {
          $set: {
            'credentials.refreshToken': null,
            updatedAt: expect.any(Date),
          },
        }
      )
    })

    it('should throw an error if teacherId is not provided', async () => {
      // Execute & Assert
      await expect(authService.logout(null)).rejects.toThrow('Invalid teacher ID')
    })

    it('should log the teacher ID being logged out', async () => {
      // Setup
      const consoleSpy = vi.spyOn(console, 'log')
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8b')

      // Execute
      await authService.logout(teacherId)

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith('Attempting logout for teacher:', teacherId)
    })

    it('should handle and log errors', async () => {
      // Setup
      const consoleSpy = vi.spyOn(console, 'error')
      const teacherId = new ObjectId('6579e36c83c8b3a5c2df8a8b')
      mockUpdateOne.mockRejectedValue(new Error('Database update failed'))

      // Execute & Assert
      await expect(authService.logout(teacherId)).rejects.toThrow('Database update failed')
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Error in logout:'))
    })
  })

  describe('validateToken', () => {
    it('should return decoded token if valid', async () => {
      // Setup
      const decodedToken = { _id: '6579e36c83c8b3a5c2df8a8b', roles: ['מורה'] }
      jwt.verify.mockReturnValue(decodedToken)

      // Execute
      const result = await authService.validateToken('valid-token')

      // Assert
      expect(result).toBe(decodedToken)
      expect(jwt.verify).toHaveBeenCalledWith('valid-token', process.env.ACCESS_TOKEN_SECRET)
    })

    it('should throw an error if token is invalid', async () => {
      // Setup
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token')
      })

      // Execute & Assert
      await expect(authService.validateToken('invalid-token')).rejects.toThrow('Invalid token')
    })

    it('should handle and log errors', async () => {
      // Setup
      const consoleSpy = vi.spyOn(console, 'error')
      jwt.verify.mockImplementation(() => {
        throw new Error('JWT verification failed')
      })

      // Execute & Assert
      await expect(authService.validateToken('invalid-token')).rejects.toThrow('Invalid token')
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Error in validateToken:'))
    })
  })

  describe('encryptPassword', () => {
    it('should hash a password using bcrypt', async () => {
      // Setup
      bcrypt.hash.mockResolvedValue('hashed-password')

      // Execute
      const result = await authService.encryptPassword('password123')

      // Assert
      expect(result).toBe('hashed-password')
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10)
    })
  })
})