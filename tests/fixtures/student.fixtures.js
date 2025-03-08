import { ObjectId } from 'mongodb'

export const testStudents = {
  student1: {
    personalInfo: {
      fullName: 'יונתן כהן',
      phone: '054-1234567',
      age: 12,
      address: 'רחוב טסט 1',
      parentName: 'אבי כהן',
      parentPhone: '054-1234567',
      parentEmail: 'parent1@test.com',
      studentEmail: 'student1@test.com',
    },
    academicInfo: {
      instrument: 'חצוצרה',
      currentStage: 5,
      class: 'ח',
      tests: {
        stageTest: {
          status: 'עבר/ה',
          lastTestDate: new Date('2023-12-15'),
          nextTestDate: null,
          notes: 'עבר בהצטיינות',
        },
        technicalTsst: {
          status: 'עבר/ה',
          lastTestDate: new Date('2023-12-15'),
          nextTestDate: null,
          notes: '',
        }
      },
    },
    enrollments: {
      orchestraIds: [],
      ensembleIds: [],
      schoolYears: [],
    },
    isActive: true,
    createdAt: new Date('2023-12-15'),
    updatedAt: new Date('2023-12-15'),
  },
  student2: {
    personalInfo: {
      fullName: 'דניאל לוי',
      phone: '054-1234567',
      age: 12,
      address: 'רחוב טסט 2',
      parentName: 'אבי לוי',
      parentPhone: '054-1234567',
      parentEmail: 'parent2@test.com',
      studentEmail: 'student2@test.com'
    },
    academicInfo: {
      instrument: 'סקסופון',
      currentStage: 3,
      class: 'ב',
      tests: {
        stageTest: {
          status: 'עבר/ה',
          lastTestDate: new Date('2023-12-15'),
          nextTestDate: null,
          notes: 'עבר בהצטיינות',
        },
        technicalTsst: {
          status: 'עבר/ה',
          lastTestDate: new Date('2023-12-15'),
          nextTestDate: null,
          notes: '',
        }
      },
    },
    enrollments: {
      orchestraIds: [],
      ensembleIds: [],
      schoolYears: [],
    },
    isActive: true,
    createdAt: new Date('2023-12-15'),
    updatedAt: new Date('2023-12-15'),
  },
  student3: {
    personalInfo: {
      fullName: 'אביב כהן',
      phone: '054-1234567',
      age: 12,
      address: 'רחוב טסט 3',
      parentName: 'אבי כהן',
      parentPhone: '054-1234567',
      parentEmail: ''
    },
    academicInfo: {
      instrument: 'קלרינט',
      currentStage: 2,
      class: 'א',
      tests: {
        stageTest: {
          status: 'עבר/ה',
          lastTestDate: new Date('2023-12-15'),
          nextTestDate: null,
          notes: 'עבר בהצטיינות',
        },
        technicalTsst: {
          status: 'עבר/ה',
          lastTestDate: new Date('2023-12-15'),
          nextTestDate: null,
          notes: '',
        }
      },
    },
    enrollments: {
      orchestraIds: [],
      ensembleIds: [],
      schoolYears: [],
    },
    isActive: true,
    createdAt: new Date('2023-12-15'),
    updatedAt: new Date('2023-12-15'),
  },
}

export function setupTestStudents(schoolYearId = null, orchestraId = null) {
  const students = JSON.parse(JSON.stringify(testStudents))

  for (const key in students) {
    students[key]._id = new ObjectId()

    if (schoolYearId) {
      students[key].enrollments.schoolYears.push({
        schoolYearId: schoolYearId,
        isActive: true
      })
    }

    if (orchestraId) {
      students[key].enrollments.orchestraIds.push(orchestraId)
    }
  }

  return students
}