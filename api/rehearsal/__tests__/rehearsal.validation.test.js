// api/rehearsal/__tests__/rehearsal.validation.test.js
import { describe, it, expect } from 'vitest'
import { 
  validateRehearsal, 
  rehearsalSchema, 
  validateBulkCreate, 
  bulkCreateSchema, 
  validateAttendance, 
  attendanceSchema,
  VALID_DAYS_OF_WEEK,
  VALID_REHEARSAL_TYPES
} from '../rehearsal.validation.js'

describe('Rehearsal Validation', () => {
  describe('validateRehearsal', () => {
    it('should validate a valid rehearsal object', () => {
      // Setup
      const validRehearsal = {
        groupId: '6579e36c83c8b3a5c2df8a8b',
        type: 'תזמורת',
        date: new Date('2023-05-10'),
        dayOfWeek: 3, // Wednesday
        startTime: '18:00',
        endTime: '20:00',
        location: 'Main Hall',
        schoolYearId: '6579e36c83c8b3a5c2df8a8c'
      }

      // Execute
      const { error, value } = validateRehearsal(validRehearsal)

      // Assert
      expect(error).toBeUndefined()
      expect(value).toMatchObject(validRehearsal)
    })

    it('should validate with default values for optional fields', () => {
      // Setup
      const minimalRehearsal = {
        groupId: '6579e36c83c8b3a5c2df8a8b',
        type: 'תזמורת',
        date: new Date('2023-05-10'),
        dayOfWeek: 3,
        startTime: '18:00',
        endTime: '20:00',
        location: 'Main Hall',
        schoolYearId: '6579e36c83c8b3a5c2df8a8c'
      }

      // Execute
      const { error, value } = validateRehearsal(minimalRehearsal)

      // Assert
      expect(error).toBeUndefined()
      expect(value).toMatchObject({
        ...minimalRehearsal,
        attendance: { present: [], absent: [] },
        notes: '',
        isActive: true
      })
    })

    it('should require groupId', () => {
      // Setup
      const invalidRehearsal = {
        // Missing groupId
        type: 'תזמורת',
        date: new Date('2023-05-10'),
        dayOfWeek: 3,
        startTime: '18:00',
        endTime: '20:00',
        location: 'Main Hall',
        schoolYearId: '6579e36c83c8b3a5c2df8a8c'
      }

      // Execute
      const { error } = validateRehearsal(invalidRehearsal)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"groupId" is required')
    })

    it('should validate rehearsal type', () => {
      // Setup
      const invalidRehearsal = {
        groupId: '6579e36c83c8b3a5c2df8a8b',
        type: 'invalid-type', // Not in allowed values
        date: new Date('2023-05-10'),
        dayOfWeek: 3,
        startTime: '18:00',
        endTime: '20:00',
        location: 'Main Hall',
        schoolYearId: '6579e36c83c8b3a5c2df8a8c'
      }

      // Execute
      const { error } = validateRehearsal(invalidRehearsal)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"type" must be one of')
    })

    it('should require date', () => {
      // Setup
      const invalidRehearsal = {
        groupId: '6579e36c83c8b3a5c2df8a8b',
        type: 'תזמורת',
        // Missing date
        dayOfWeek: 3,
        startTime: '18:00',
        endTime: '20:00',
        location: 'Main Hall',
        schoolYearId: '6579e36c83c8b3a5c2df8a8c'
      }

      // Execute
      const { error } = validateRehearsal(invalidRehearsal)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"date" is required')
    })

    it('should validate dayOfWeek range', () => {
      // Setup
      const invalidRehearsal = {
        groupId: '6579e36c83c8b3a5c2df8a8b',
        type: 'תזמורת',
        date: new Date('2023-05-10'),
        dayOfWeek: 9, // Invalid - days are 0-6
        startTime: '18:00',
        endTime: '20:00',
        location: 'Main Hall',
        schoolYearId: '6579e36c83c8b3a5c2df8a8c'
      }

      // Execute
      const { error } = validateRehearsal(invalidRehearsal)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"dayOfWeek" must be less than or equal to 6')
    })

    it('should validate time format', () => {
      // Setup
      const invalidRehearsal = {
        groupId: '6579e36c83c8b3a5c2df8a8b',
        type: 'תזמורת',
        date: new Date('2023-05-10'),
        dayOfWeek: 3,
        startTime: 'not-a-time', // Invalid time format
        endTime: '20:00',
        location: 'Main Hall',
        schoolYearId: '6579e36c83c8b3a5c2df8a8c'
      }

      // Execute
      const { error } = validateRehearsal(invalidRehearsal)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"startTime" with value "not-a-time" fails to match the required pattern')
    })

    it('should require location', () => {
      // Setup
      const invalidRehearsal = {
        groupId: '6579e36c83c8b3a5c2df8a8b',
        type: 'תזמורת',
        date: new Date('2023-05-10'),
        dayOfWeek: 3,
        startTime: '18:00',
        endTime: '20:00',
        // Missing location
        schoolYearId: '6579e36c83c8b3a5c2df8a8c'
      }

      // Execute
      const { error } = validateRehearsal(invalidRehearsal)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"location" is required')
    })

    it('should require schoolYearId', () => {
      // Setup
      const invalidRehearsal = {
        groupId: '6579e36c83c8b3a5c2df8a8b',
        type: 'תזמורת',
        date: new Date('2023-05-10'),
        dayOfWeek: 3,
        startTime: '18:00',
        endTime: '20:00',
        location: 'Main Hall'
        // Missing schoolYearId
      }

      // Execute
      const { error } = validateRehearsal(invalidRehearsal)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"schoolYearId" is required')
    })

    it('should validate attendance structure', () => {
      // Setup
      const invalidRehearsal = {
        groupId: '6579e36c83c8b3a5c2df8a8b',
        type: 'תזמורת',
        date: new Date('2023-05-10'),
        dayOfWeek: 3,
        startTime: '18:00',
        endTime: '20:00',
        location: 'Main Hall',
        schoolYearId: '6579e36c83c8b3a5c2df8a8c',
        attendance: {
          // Missing absent array
          present: []
        }
      }

      // Execute
      const { error } = validateRehearsal(invalidRehearsal)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"attendance.absent" is required')
    })

    it('should allow empty string for notes', () => {
      // Setup
      const rehearsalWithEmptyNotes = {
        groupId: '6579e36c83c8b3a5c2df8a8b',
        type: 'תזמורת',
        date: new Date('2023-05-10'),
        dayOfWeek: 3,
        startTime: '18:00',
        endTime: '20:00',
        location: 'Main Hall',
        schoolYearId: '6579e36c83c8b3a5c2df8a8c',
        notes: ''
      }

      // Execute
      const { error } = validateRehearsal(rehearsalWithEmptyNotes)

      // Assert
      expect(error).toBeUndefined()
    })
  })

  describe('validateBulkCreate', () => {
    it('should validate a valid bulk create object', () => {
      // Setup
      const validBulkCreate = {
        orchestraId: '6579e36c83c8b3a5c2df8a8b',
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-06-30'),
        dayOfWeek: 3, // Wednesday
        startTime: '18:00',
        endTime: '20:00',
        location: 'Main Hall'
      }

      // Execute
      const { error, value } = validateBulkCreate(validBulkCreate)

      // Assert
      expect(error).toBeUndefined()
      expect(value).toMatchObject(validBulkCreate)
    })

    it('should validate with default values for optional fields', () => {
      // Setup
      const minimalBulkCreate = {
        orchestraId: '6579e36c83c8b3a5c2df8a8b',
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-06-30'),
        dayOfWeek: 3,
        startTime: '18:00',
        endTime: '20:00',
        location: 'Main Hall'
      }

      // Execute
      const { error, value } = validateBulkCreate(minimalBulkCreate)

      // Assert
      expect(error).toBeUndefined()
      expect(value).toMatchObject({
        ...minimalBulkCreate,
        notes: '',
        excludeDates: []
      })
    })

    it('should require orchestraId', () => {
      // Setup
      const invalidBulkCreate = {
        // Missing orchestraId
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-06-30'),
        dayOfWeek: 3,
        startTime: '18:00',
        endTime: '20:00',
        location: 'Main Hall'
      }

      // Execute
      const { error } = validateBulkCreate(invalidBulkCreate)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"orchestraId" is required')
    })

    it('should require startDate', () => {
      // Setup
      const invalidBulkCreate = {
        orchestraId: '6579e36c83c8b3a5c2df8a8b',
        // Missing startDate
        endDate: new Date('2023-06-30'),
        dayOfWeek: 3,
        startTime: '18:00',
        endTime: '20:00',
        location: 'Main Hall'
      }

      // Execute
      const { error } = validateBulkCreate(invalidBulkCreate)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"startDate" is required')
    })

    it('should require endDate and validate it is after startDate', () => {
      // Setup - End date before start date
      const invalidBulkCreate = {
        orchestraId: '6579e36c83c8b3a5c2df8a8b',
        startDate: new Date('2023-06-30'),
        endDate: new Date('2023-01-01'), // Before startDate
        dayOfWeek: 3,
        startTime: '18:00',
        endTime: '20:00',
        location: 'Main Hall'
      }

      // Execute
      const { error } = validateBulkCreate(invalidBulkCreate)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"endDate" must be greater than or equal to "ref:startDate"')
    })

    it('should validate dayOfWeek range', () => {
      // Setup
      const invalidBulkCreate = {
        orchestraId: '6579e36c83c8b3a5c2df8a8b',
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-06-30'),
        dayOfWeek: -1, // Invalid - days are 0-6
        startTime: '18:00',
        endTime: '20:00',
        location: 'Main Hall'
      }

      // Execute
      const { error } = validateBulkCreate(invalidBulkCreate)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"dayOfWeek" must be greater than or equal to 0')
    })

    it('should validate time format', () => {
      // Setup
      const invalidBulkCreate = {
        orchestraId: '6579e36c83c8b3a5c2df8a8b',
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-06-30'),
        dayOfWeek: 3,
        startTime: '18:00',
        endTime: '24:00', // Invalid time format (max is 23:59)
        location: 'Main Hall'
      }

      // Execute
      const { error } = validateBulkCreate(invalidBulkCreate)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"endTime" with value "24:00" fails to match the required pattern')
    })

    it('should validate excludeDates as array of dates', () => {
      // Setup
      const bulkCreateWithExcludeDates = {
        orchestraId: '6579e36c83c8b3a5c2df8a8b',
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-06-30'),
        dayOfWeek: 3,
        startTime: '18:00',
        endTime: '20:00',
        location: 'Main Hall',
        excludeDates: [
          new Date('2023-01-25'),
          new Date('2023-02-08')
        ]
      }

      // Execute
      const { error, value } = validateBulkCreate(bulkCreateWithExcludeDates)

      // Assert
      expect(error).toBeUndefined()
      expect(value.excludeDates).toHaveLength(2)
      expect(value.excludeDates[0]).toBeInstanceOf(Date)
    })
  })

  describe('validateAttendance', () => {
    it('should validate a valid attendance object', () => {
      // Setup
      const validAttendance = {
        present: ['student1', 'student2'],
        absent: ['student3', 'student4']
      }

      // Execute
      const { error, value } = validateAttendance(validAttendance)

      // Assert
      expect(error).toBeUndefined()
      expect(value).toMatchObject(validAttendance)
    })

    it('should validate with default empty arrays', () => {
      // Setup
      const emptyAttendance = {}

      // Execute
      const { error, value } = validateAttendance(emptyAttendance)

      // Assert
      expect(error).toBeUndefined()
      expect(value).toEqual({
        present: [],
        absent: []
      })
    })

    it('should validate with student IDs as strings', () => {
      // Setup
      const validAttendance = {
        present: ['student1'],
        absent: ['student2']
      }

      // Execute
      const { error } = validateAttendance(validAttendance)

      // Assert
      expect(error).toBeUndefined()
    })

    it('should validate arrays with non-string values', () => {
      // Setup
      const invalidAttendance = {
        present: [123, true], // Not strings
        absent: ['student3']
      }

      // Execute
      const { error } = validateAttendance(invalidAttendance)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"present[0]" must be a string')
    })
  })

  describe('Rehearsal Constants', () => {
    it('should define valid days of week', () => {
      // Assert
      expect(VALID_DAYS_OF_WEEK).toEqual({
        0: 'ראשון', // Sunday
        1: 'שני', // Monday
        2: 'שלישי', // Tuesday
        3: 'רביעי', // Wednesday
        4: 'חמישי', // Thursday
        5: 'שישי', // Friday
        6: 'שבת', // Saturday
      })
    })

    it('should define valid rehearsal types', () => {
      // Assert
      expect(VALID_REHEARSAL_TYPES).toEqual(['תזמורת', 'הרכב'])
    })
  })

  describe('Schema Objects', () => {
    it('should define rehearsalSchema as a valid Joi schema', () => {
      // Assert
      expect(rehearsalSchema).toBeDefined()
      expect(rehearsalSchema.validate).toBeTypeOf('function')
    })

    it('should define bulkCreateSchema as a valid Joi schema', () => {
      // Assert
      expect(bulkCreateSchema).toBeDefined()
      expect(bulkCreateSchema.validate).toBeTypeOf('function')
    })

    it('should define attendanceSchema as a valid Joi schema', () => {
      // Assert
      expect(attendanceSchema).toBeDefined()
      expect(attendanceSchema.validate).toBeTypeOf('function')
    })
  })
})