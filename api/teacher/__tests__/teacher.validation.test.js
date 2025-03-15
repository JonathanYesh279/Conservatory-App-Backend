// api/teacher/__tests__/teacher.validation.test.js
import { describe, it, expect } from 'vitest'
import { validateTeacher, teacherSchema, TEACHER_CONSTANTS } from '../teacher.validation.js'

describe('Teacher Validation', () => {
  describe('validateTeacher', () => {
    it('should validate a valid teacher object', () => {
      // Setup
      const validTeacher = {
        personalInfo: {
          fullName: 'Test Teacher',
          phone: '0501234567',
          email: 'teacher@example.com',
          address: 'Test Address'
        },
        roles: ['מורה'],
        professionalInfo: {
          instrument: 'Piano',
          isActive: true
        },
        teaching: {
          studentIds: ['123', '456'],
          schedule: [
            {
              studentId: '123',
              day: 'ראשון',
              time: '14:00',
              duration: 45
            }
          ]
        },
        credentials: {
          email: 'teacher@example.com',
          password: 'password123'
        }
      }

      // Execute
      const { error, value } = validateTeacher(validTeacher)

      // Assert
      expect(error).toBeUndefined()
      expect(value).toMatchObject(validTeacher)
    })

    it('should validate with default values for optional fields', () => {
      // Setup
      const minimalTeacher = {
        personalInfo: {
          fullName: 'Test Teacher',
          phone: '0501234567',
          email: 'teacher@example.com',
          address: 'Test Address'
        },
        roles: ['מורה'],
        professionalInfo: {
          instrument: 'Piano',
          isActive: true
        },
        teaching: {
          studentIds: [],
          schedule: []
        },
        credentials: {
          email: 'teacher@example.com',
          password: 'password123'
        }
      }

      // Execute
      const { error, value } = validateTeacher(minimalTeacher)

      // Assert
      expect(error).toBeUndefined()
      
      // Update expectations to match the actual schema behavior
      expect(value).toMatchObject({
        ...minimalTeacher,
        conducting: {}, // Schema changed - this is now an empty object, not an array
        ensemblesIds: [],
        schoolYears: [],
        isActive: true
      })
    })

    it('should require personalInfo', () => {
      // Setup
      const invalidTeacher = {
        // Missing personalInfo
        roles: ['מורה'],
        professionalInfo: {
          instrument: 'Piano',
          isActive: true
        },
        teaching: {
          studentIds: [],
          schedule: []
        },
        credentials: {
          email: 'teacher@example.com',
          password: 'password123'
        }
      }

      // Execute
      const { error } = validateTeacher(invalidTeacher)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"personalInfo" is required')
    })

    it('should require roles array', () => {
      // Setup
      const invalidTeacher = {
        personalInfo: {
          fullName: 'Test Teacher',
          phone: '0501234567',
          email: 'teacher@example.com',
          address: 'Test Address'
        },
        // Missing roles
        professionalInfo: {
          instrument: 'Piano',
          isActive: true
        },
        teaching: {
          studentIds: [],
          schedule: []
        },
        credentials: {
          email: 'teacher@example.com',
          password: 'password123'
        }
      }

      // Execute
      const { error } = validateTeacher(invalidTeacher)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"roles" is required')
    })

    it('should validate valid roles', () => {
      // Setup
      const invalidTeacher = {
        personalInfo: {
          fullName: 'Test Teacher',
          phone: '0501234567',
          email: 'teacher@example.com',
          address: 'Test Address'
        },
        roles: ['invalid-role'], // Not in allowed values
        professionalInfo: {
          instrument: 'Piano',
          isActive: true
        },
        teaching: {
          studentIds: [],
          schedule: []
        },
        credentials: {
          email: 'teacher@example.com',
          password: 'password123'
        }
      }

      // Execute
      const { error } = validateTeacher(invalidTeacher)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"roles[0]" must be one of')
    })

    it('should require professionalInfo', () => {
      // Setup
      const invalidTeacher = {
        personalInfo: {
          fullName: 'Test Teacher',
          phone: '0501234567',
          email: 'teacher@example.com',
          address: 'Test Address'
        },
        roles: ['מורה'],
        // Missing professionalInfo
        teaching: {
          studentIds: [],
          schedule: []
        },
        credentials: {
          email: 'teacher@example.com',
          password: 'password123'
        }
      }

      // Execute
      const { error } = validateTeacher(invalidTeacher)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"professionalInfo" is required')
    })

    it('should require teaching object', () => {
      // Setup
      const invalidTeacher = {
        personalInfo: {
          fullName: 'Test Teacher',
          phone: '0501234567',
          email: 'teacher@example.com',
          address: 'Test Address'
        },
        roles: ['מורה'],
        professionalInfo: {
          instrument: 'Piano',
          isActive: true
        },
        // Missing teaching
        credentials: {
          email: 'teacher@example.com',
          password: 'password123'
        }
      }

      // Execute
      const { error } = validateTeacher(invalidTeacher)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"teaching" is required')
    })

    it('should require credentials', () => {
      // Setup
      const invalidTeacher = {
        personalInfo: {
          fullName: 'Test Teacher',
          phone: '0501234567',
          email: 'teacher@example.com',
          address: 'Test Address'
        },
        roles: ['מורה'],
        professionalInfo: {
          instrument: 'Piano',
          isActive: true
        },
        teaching: {
          studentIds: [],
          schedule: []
        }
        // Missing credentials
      }

      // Execute
      const { error } = validateTeacher(invalidTeacher)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"credentials" is required')
    })

    it('should validate phone number format', () => {
      // Setup
      const invalidTeacher = {
        personalInfo: {
          fullName: 'Test Teacher',
          phone: '123456789', // Invalid format (should start with 05)
          email: 'teacher@example.com',
          address: 'Test Address'
        },
        roles: ['מורה'],
        professionalInfo: {
          instrument: 'Piano',
          isActive: true
        },
        teaching: {
          studentIds: [],
          schedule: []
        },
        credentials: {
          email: 'teacher@example.com',
          password: 'password123'
        }
      }

      // Execute
      const { error } = validateTeacher(invalidTeacher)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"personalInfo.phone" with value')
    })

    it('should validate email format', () => {
      // Setup
      const invalidTeacher = {
        personalInfo: {
          fullName: 'Test Teacher',
          phone: '0501234567',
          email: 'not-an-email', // Invalid email format
          address: 'Test Address'
        },
        roles: ['מורה'],
        professionalInfo: {
          instrument: 'Piano',
          isActive: true
        },
        teaching: {
          studentIds: [],
          schedule: []
        },
        credentials: {
          email: 'not-an-email', // Invalid email format
          password: 'password123'
        }
      }

      // Execute
      const { error } = validateTeacher(invalidTeacher)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"personalInfo.email" must be a valid email')
    })

    it('should validate schedule entries', () => {
      // Setup
      const invalidTeacher = {
        personalInfo: {
          fullName: 'Test Teacher',
          phone: '0501234567',
          email: 'teacher@example.com',
          address: 'Test Address'
        },
        roles: ['מורה'],
        professionalInfo: {
          instrument: 'Piano',
          isActive: true
        },
        teaching: {
          studentIds: ['123'],
          schedule: [
            {
              // Missing studentId
              day: 'ראשון',
              time: '14:00',
              duration: 45
            }
          ]
        },
        credentials: {
          email: 'teacher@example.com',
          password: 'password123'
        }
      }

      // Execute
      const { error } = validateTeacher(invalidTeacher)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"teaching.schedule[0].studentId" is required')
    })

    it('should validate lesson duration values', () => {
      // Setup
      const invalidTeacher = {
        personalInfo: {
          fullName: 'Test Teacher',
          phone: '0501234567',
          email: 'teacher@example.com',
          address: 'Test Address'
        },
        roles: ['מורה'],
        professionalInfo: {
          instrument: 'Piano',
          isActive: true
        },
        teaching: {
          studentIds: ['123'],
          schedule: [
            {
              studentId: '123',
              day: 'ראשון',
              time: '14:00',
              duration: 40 // Invalid duration (not in allowed values)
            }
          ]
        },
        credentials: {
          email: 'teacher@example.com',
          password: 'password123'
        }
      }

      // Execute
      const { error } = validateTeacher(invalidTeacher)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"teaching.schedule[0].duration" must be one of')
    })

    it('should require emails in credentials and personalInfo to match', () => {
      // Setup
      const invalidTeacher = {
        personalInfo: {
          fullName: 'Test Teacher',
          phone: '0501234567',
          email: 'teacher@example.com',
          address: 'Test Address'
        },
        roles: ['מורה'],
        professionalInfo: {
          instrument: 'Piano',
          isActive: true
        },
        teaching: {
          studentIds: [],
          schedule: []
        },
        credentials: {
          email: 'different@example.com', // Different from personalInfo.email
          password: 'password123'
        }
      }

      // Execute
      const { error } = validateTeacher(invalidTeacher)

      // Assert
      expect(error).toBeDefined()
      // Update the expectation to match the actual error message
      expect(error.message).toContain('"value" contains an invalid value')
    })
  })

  describe('TEACHER_CONSTANTS', () => {
    it('should define valid teacher roles', () => {
      // Assert
      expect(TEACHER_CONSTANTS.VALID_RULES).toEqual(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל', 'מדריך תאוריה'])
    })
  })

  describe('teacherSchema', () => {
    it('should be a valid Joi schema object', () => {
      // Assert
      expect(teacherSchema).toBeDefined()
      expect(teacherSchema.validate).toBeTypeOf('function')
    })

    it('should set default values correctly', () => {
      // Setup - Create a minimal valid teacher
      const minimalTeacher = {
        personalInfo: {
          fullName: 'Test Teacher',
          phone: '0501234567',
          email: 'teacher@example.com',
          address: 'Test Address'
        },
        roles: ['מורה'],
        professionalInfo: {
          instrument: 'Piano',
          isActive: true
        },
        teaching: {
          studentIds: [],
          schedule: []
        },
        credentials: {
          email: 'teacher@example.com',
          password: 'password123'
        }
      }

      // Execute
      const { value } = teacherSchema.validate(minimalTeacher)

      // Assert - Check default values
      expect(value.teaching.studentIds).toEqual([])
      expect(value.teaching.schedule).toEqual([])
      // Update expectation to match actual schema behavior
      expect(value.conducting).toEqual({})
      expect(value.ensemblesIds).toEqual([])
      expect(value.schoolYears).toEqual([])
      expect(value.isActive).toBe(true)
    })

    it('should allow full teacher object with all properties', () => {
      // Setup
      const fullTeacher = {
        personalInfo: {
          fullName: 'Full Test Teacher',
          phone: '0501234567',
          email: 'full.teacher@example.com',
          address: 'Full Address'
        },
        roles: ['מורה', 'מנצח', 'מדריך הרכב'],
        professionalInfo: {
          instrument: 'Violin',
          isActive: true
        },
        teaching: {
          studentIds: ['123', '456', '789'],
          schedule: [
            {
              studentId: '123',
              day: 'ראשון',
              time: '14:00',
              duration: 45
            },
            {
              studentId: '456',
              day: 'שלישי',
              time: '16:30',
              duration: 60
            }
          ]
        },
        conducting: {
          orchestraIds: ['orchestraId1', 'orchestraId2']
        },
        ensemblesIds: ['ensembleId1'],
        schoolYears: [
          {
            schoolYearId: 'yearId1',
            isActive: true
          },
          {
            schoolYearId: 'yearId2',
            isActive: false
          }
        ],
        credentials: {
          email: 'full.teacher@example.com',
          password: 'secure_password'
        },
        isActive: true
      }

      // Execute
      const { error, value } = teacherSchema.validate(fullTeacher)

      // Assert
      expect(error).toBeUndefined()
      expect(value).toMatchObject(fullTeacher)
    })
  })
})