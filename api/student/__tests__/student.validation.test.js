// api/student/__tests__/student.validation.test.js
import { describe, it, expect } from 'vitest'
import { validateStudent, studentSchema, STUDENT_CONSTANTS } from '../student.validation.js'

describe('Student Validation', () => {
  describe('validateStudent', () => {
    it('should validate a valid student object', () => {
      // Setup
      const validStudent = {
        personalInfo: {
          fullName: 'Test Student',
          phone: '0501234567',
          age: 15,
          address: 'Test Address',
          parentName: 'Parent Name',
          parentPhone: '0509876543',
          parentEmail: 'parent@example.com',
          studentEmail: 'student@example.com'
        },
        academicInfo: {
          instrument: 'חליל צד',
          currentStage: 3,
          class: 'ט',
          tests: {
            stageTest: {
              status: 'עבר/ה',
              lastTestDate: new Date(),
              nextTestDate: null,
              notes: 'Good performance'
            },
            technicalTest: {
              status: 'לא נבחן',
              lastTestDate: null,
              nextTestDate: new Date(),
              notes: ''
            }
          }
        },
        enrollments: {
          orchestraIds: ['orchestra1', 'orchestra2'],
          ensembleIds: ['ensemble1'],
          schoolYears: [
            {
              schoolYearId: 'year1',
              isActive: true
            }
          ]
        }
      }

      // Execute
      const { error, value } = validateStudent(validStudent)

      // Assert
      expect(error).toBeUndefined()
      expect(value).toMatchObject(validStudent)
    })

    it('should validate with default values for optional fields', () => {
      // Setup
      const minimalStudent = {
        personalInfo: {
          fullName: 'Test Student',
          phone: null,
          age: null,
          address: null,
          parentName: null,
          parentPhone: null,
          parentEmail: null,
          studentEmail: null
        },
        academicInfo: {
          instrument: 'חצוצרה',
          currentStage: 1,
          class: 'א'
        }
      }

      // Execute
      const { error, value } = validateStudent(minimalStudent)

      // Assert
      expect(error).toBeUndefined()
      expect(value).toMatchObject({
        ...minimalStudent,
        enrollments: {
          orchestraIds: [],
          ensembleIds: [],
          schoolYears: []
        },
        isActive: true
      })
      expect(value.createdAt).toBeInstanceOf(Date)
      expect(value.updatedAt).toBeInstanceOf(Date)
    })

    it('should require personalInfo', () => {
      // Setup
      const invalidStudent = {
        // Missing personalInfo
        academicInfo: {
          instrument: 'חצוצרה',
          currentStage: 1,
          class: 'א'
        }
      }

      // Execute
      const { error } = validateStudent(invalidStudent)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"personalInfo" is required')
    })

    it('should require academicInfo', () => {
      // Setup
      const invalidStudent = {
        personalInfo: {
          fullName: 'Test Student',
          phone: null
        }
        // Missing academicInfo
      }

      // Execute
      const { error } = validateStudent(invalidStudent)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"academicInfo" is required')
    })

    it('should require fullName in personalInfo', () => {
      // Setup
      const invalidStudent = {
        personalInfo: {
          // Missing fullName
          phone: '0501234567'
        },
        academicInfo: {
          instrument: 'חצוצרה',
          currentStage: 1,
          class: 'א'
        }
      }

      // Execute
      const { error } = validateStudent(invalidStudent)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"personalInfo.fullName" is required')
    })

    it('should validate phone number format', () => {
      // Setup
      const invalidStudent = {
        personalInfo: {
          fullName: 'Test Student',
          phone: '123456789', // Invalid format (should start with 05)
          parentPhone: '123456789' // Also invalid
        },
        academicInfo: {
          instrument: 'חצוצרה',
          currentStage: 1,
          class: 'א'
        }
      }

      // Execute
      const { error } = validateStudent(invalidStudent)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"personalInfo.phone" with value')
    })

    it('should validate email formats', () => {
      // Setup
      const invalidStudent = {
        personalInfo: {
          fullName: 'Test Student',
          parentEmail: 'not-an-email', // Invalid email format
          studentEmail: 'also-not-an-email' // Invalid email format
        },
        academicInfo: {
          instrument: 'חצוצרה',
          currentStage: 1,
          class: 'א'
        }
      }

      // Execute
      const { error } = validateStudent(invalidStudent)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"personalInfo.parentEmail" must be a valid email')
    })

    it('should require instrument in academicInfo', () => {
      // Setup
      const invalidStudent = {
        personalInfo: {
          fullName: 'Test Student'
        },
        academicInfo: {
          // Missing instrument
          currentStage: 1,
          class: 'א'
        }
      }

      // Execute
      const { error } = validateStudent(invalidStudent)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"academicInfo.instrument" is required')
    })

    it('should validate instrument is in allowed list', () => {
      // Setup
      const invalidStudent = {
        personalInfo: {
          fullName: 'Test Student'
        },
        academicInfo: {
          instrument: 'Guitar', // Not in allowed list
          currentStage: 1,
          class: 'א'
        }
      }

      // Execute
      const { error } = validateStudent(invalidStudent)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"academicInfo.instrument" must be one of')
    })

    it('should require currentStage in academicInfo', () => {
      // Setup
      const invalidStudent = {
        personalInfo: {
          fullName: 'Test Student'
        },
        academicInfo: {
          instrument: 'חצוצרה',
          // Missing currentStage
          class: 'א'
        }
      }

      // Execute
      const { error } = validateStudent(invalidStudent)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"academicInfo.currentStage" is required')
    })

    it('should validate currentStage is in allowed range', () => {
      // Setup
      const invalidStudent = {
        personalInfo: {
          fullName: 'Test Student'
        },
        academicInfo: {
          instrument: 'חצוצרה',
          currentStage: 10, // Not in allowed range (1-8)
          class: 'א'
        }
      }

      // Execute
      const { error } = validateStudent(invalidStudent)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"academicInfo.currentStage" must be one of')
    })

    it('should require class in academicInfo', () => {
      // Setup
      const invalidStudent = {
        personalInfo: {
          fullName: 'Test Student'
        },
        academicInfo: {
          instrument: 'חצוצרה',
          currentStage: 1,
          // Missing class
        }
      }

      // Execute
      const { error } = validateStudent(invalidStudent)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"academicInfo.class" is required')
    })

    it('should validate class is in allowed list', () => {
      // Setup
      const invalidStudent = {
        personalInfo: {
          fullName: 'Test Student'
        },
        academicInfo: {
          instrument: 'חצוצרה',
          currentStage: 1,
          class: 'Invalid Class' // Not in allowed list
        }
      }

      // Execute
      const { error } = validateStudent(invalidStudent)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"academicInfo.class" must be one of')
    })

    it('should validate test status values', () => {
      // Setup
      const invalidStudent = {
        personalInfo: {
          fullName: 'Test Student'
        },
        academicInfo: {
          instrument: 'חצוצרה',
          currentStage: 1,
          class: 'א',
          tests: {
            stageTest: {
              status: 'Invalid Status', // Not in allowed values
              lastTestDate: null,
              nextTestDate: null
            }
          }
        }
      }

      // Execute
      const { error } = validateStudent(invalidStudent)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"academicInfo.tests.stageTest.status" must be one of')
    })

    it('should validate school year entries', () => {
      // Setup
      const invalidStudent = {
        personalInfo: {
          fullName: 'Test Student'
        },
        academicInfo: {
          instrument: 'חצוצרה',
          currentStage: 1,
          class: 'א'
        },
        enrollments: {
          schoolYears: [
            {
              // Missing schoolYearId
              isActive: true
            }
          ]
        }
      }

      // Execute
      const { error } = validateStudent(invalidStudent)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"enrollments.schoolYears[0].schoolYearId" is required')
    })
  })

  describe('STUDENT_CONSTANTS', () => {
    it('should define valid classes', () => {
      // Assert
      expect(STUDENT_CONSTANTS.VALID_CLASSES).toEqual(['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'יא', 'יב', 'אחר'])
    })

    it('should define valid stages', () => {
      // Assert
      expect(STUDENT_CONSTANTS.VALID_STAGES).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    })

    it('should define valid test statuses', () => {
      // Assert
      expect(STUDENT_CONSTANTS.TEST_STATUSES).toEqual(['לא נבחן', 'עבר/ה', 'לא עבר/ה'])
    })
  })

  describe('studentSchema', () => {
    it('should be a valid Joi schema object', () => {
      // Assert
      expect(studentSchema).toBeDefined()
      expect(studentSchema.validate).toBeTypeOf('function')
    })

    it('should set default values correctly', () => {
      // Setup - Create a minimal valid student
      const minimalStudent = {
        personalInfo: {
          fullName: 'Test Student'
        },
        academicInfo: {
          instrument: 'חצוצרה',
          currentStage: 1,
          class: 'א'
        }
      }

      // Execute
      const { value } = studentSchema.validate(minimalStudent)

      // Assert - Check default values
      expect(value.enrollments).toEqual({
        orchestraIds: [],
        ensembleIds: [],
        schoolYears: []
      })
      expect(value.isActive).toBe(true)
      expect(value.createdAt).toBeInstanceOf(Date)
      expect(value.updatedAt).toBeInstanceOf(Date)

      // Check tests default structure
      expect(value.academicInfo.tests).toBeDefined()
      if (value.academicInfo.tests) {
        expect(value.academicInfo.tests.stageTest).toBeDefined()
        expect(value.academicInfo.tests.technicalTest).toBeDefined()
        
        if (value.academicInfo.tests.stageTest) {
          expect(value.academicInfo.tests.stageTest.status).toBe('לא נבחן')
          expect(value.academicInfo.tests.stageTest.lastTestDate).toBeNull()
          expect(value.academicInfo.tests.stageTest.nextTestDate).toBeNull()
          expect(value.academicInfo.tests.stageTest.notes).toBe('')
        }
      }
    })

    it('should allow null for optional personalInfo fields', () => {
      // Setup
      const studentWithNulls = {
        personalInfo: {
          fullName: 'Test Student',
          phone: null,
          age: null,
          address: null,
          parentName: null,
          parentPhone: null,
          parentEmail: null,
          studentEmail: null
        },
        academicInfo: {
          instrument: 'חצוצרה',
          currentStage: 1,
          class: 'א'
        }
      }

      // Execute
      const { error } = studentSchema.validate(studentWithNulls)

      // Assert
      expect(error).toBeUndefined()
    })

    it('should allow empty strings for notes fields', () => {
      // Setup
      const studentWithEmptyNotes = {
        personalInfo: {
          fullName: 'Test Student'
        },
        academicInfo: {
          instrument: 'חצוצרה',
          currentStage: 1,
          class: 'א',
          tests: {
            stageTest: {
              status: 'לא נבחן',
              notes: '' // Empty string
            },
            technicalTest: {
              status: 'לא נבחן',
              notes: '' // Empty string
            }
          }
        }
      }

      // Execute
      const { error } = studentSchema.validate(studentWithEmptyNotes)

      // Assert
      expect(error).toBeUndefined()
    })

    it('should allow full student object with all properties', () => {
      // Setup
      const fullStudent = {
        personalInfo: {
          fullName: 'Full Test Student',
          phone: '0501234567',
          age: 16,
          address: 'Full Address',
          parentName: 'Parent Full Name',
          parentPhone: '0509876543',
          parentEmail: 'parent@example.com',
          studentEmail: 'student@example.com'
        },
        academicInfo: {
          instrument: 'קלרינט',
          currentStage: 4,
          class: 'י',
          tests: {
            stageTest: {
              status: 'עבר/ה',
              lastTestDate: new Date(),
              nextTestDate: null,
              notes: 'Passed with excellence'
            },
            technicalTest: {
              status: 'עבר/ה',
              lastTestDate: new Date(),
              nextTestDate: null,
              notes: 'Good technique'
            }
          }
        },
        enrollments: {
          orchestraIds: ['orch1', 'orch2', 'orch3'],
          ensembleIds: ['ens1', 'ens2'],
          schoolYears: [
            { schoolYearId: 'year1', isActive: true },
            { schoolYearId: 'year2', isActive: false }
          ]
        },
        isActive: true,
        createdAt: new Date('2022-01-01'),
        updatedAt: new Date('2023-01-01')
      }

      // Execute
      const { error, value } = studentSchema.validate(fullStudent)

      // Assert
      expect(error).toBeUndefined()
      expect(value).toMatchObject(fullStudent)
    })
  })
})