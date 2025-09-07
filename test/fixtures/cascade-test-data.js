import { ObjectId } from 'mongodb';

/**
 * Test fixtures for cascade deletion system
 * Provides realistic test data for various scenarios
 */

export const MOCK_STUDENT_ID = '507f1f77bcf86cd799439011';
export const MOCK_TEACHER_ID = '507f1f77bcf86cd799439012';
export const MOCK_ORCHESTRA_ID = '507f1f77bcf86cd799439013';
export const MOCK_BAGRUT_ID = '507f1f77bcf86cd799439014';

/**
 * Student with multiple relationships for comprehensive testing
 */
export const mockStudentData = {
  _id: new ObjectId(MOCK_STUDENT_ID),
  personalInfo: {
    fullName: 'ישראל כהן',
    firstName: 'ישראל',
    lastName: 'כהן',
    dateOfBirth: '2005-03-15',
    phone: '052-1234567',
    email: 'israel.cohen@example.com'
  },
  academicInfo: {
    class: 'י1',
    year: '2023',
    instruments: ['כינור', 'פסנתר']
  },
  contactInfo: {
    address: 'רחוב הרצל 123, תל אביב',
    parentPhone: '054-9876543',
    parentEmail: 'parent@example.com'
  },
  isActive: true,
  createdAt: new Date('2023-01-01'),
  lastModified: new Date('2023-09-15')
};

/**
 * Teachers with student assignments
 */
export const mockTeachersData = [
  {
    _id: new ObjectId(MOCK_TEACHER_ID),
    personalInfo: {
      fullName: 'מרים לוי',
      firstName: 'מרים',
      lastName: 'לוי',
      email: 'miriam.levi@conservatory.edu',
      phone: '050-1111111'
    },
    teaching: {
      instruments: ['כינור'],
      studentIds: [new ObjectId(MOCK_STUDENT_ID)],
      lastModified: new Date('2023-09-01')
    },
    schedules: [
      {
        studentId: new ObjectId(MOCK_STUDENT_ID),
        day: 'ב',
        startTime: '14:00',
        endTime: '15:00',
        isActive: true
      }
    ],
    isActive: true,
    createdAt: new Date('2022-08-01')
  },
  {
    _id: new ObjectId('507f1f77bcf86cd799439015'),
    personalInfo: {
      fullName: 'דוד שמר',
      firstName: 'דוד',
      lastName: 'שמר',
      email: 'david.shamir@conservatory.edu',
      phone: '050-2222222'
    },
    teaching: {
      instruments: ['פסנתר'],
      studentIds: [new ObjectId(MOCK_STUDENT_ID), new ObjectId('507f1f77bcf86cd799439020')],
      lastModified: new Date('2023-09-10')
    },
    schedules: [
      {
        studentId: new ObjectId(MOCK_STUDENT_ID),
        day: 'ד',
        startTime: '15:30',
        endTime: '16:30',
        isActive: true
      }
    ],
    isActive: true,
    createdAt: new Date('2022-07-15')
  }
];

/**
 * Orchestras with student memberships
 */
export const mockOrchestrasData = [
  {
    _id: new ObjectId(MOCK_ORCHESTRA_ID),
    name: 'תזמורת הקאמרית',
    conductor: 'מאסטרו כהן',
    memberIds: [
      new ObjectId(MOCK_STUDENT_ID),
      new ObjectId('507f1f77bcf86cd799439021'),
      new ObjectId('507f1f77bcf86cd799439022')
    ],
    rehearsalDay: 'ג',
    rehearsalTime: '16:00-18:00',
    isActive: true,
    createdAt: new Date('2023-02-01'),
    lastModified: new Date('2023-09-05')
  },
  {
    _id: new ObjectId('507f1f77bcf86cd799439016'),
    name: 'תזמורת הרוח',
    conductor: 'מאסטרו רוזן',
    memberIds: [
      new ObjectId(MOCK_STUDENT_ID),
      new ObjectId('507f1f77bcf86cd799439023')
    ],
    rehearsalDay: 'א',
    rehearsalTime: '17:00-19:00',
    isActive: true,
    createdAt: new Date('2023-03-01'),
    lastModified: new Date('2023-08-20')
  }
];

/**
 * Rehearsals with attendance records
 */
export const mockRehearsalsData = [
  {
    _id: new ObjectId('507f1f77bcf86cd799439017'),
    orchestraId: new ObjectId(MOCK_ORCHESTRA_ID),
    date: '2023-09-13',
    startTime: '16:00',
    endTime: '18:00',
    attendance: [
      {
        studentId: new ObjectId(MOCK_STUDENT_ID),
        status: 'נוכח',
        arrivalTime: '16:00'
      },
      {
        studentId: new ObjectId('507f1f77bcf86cd799439021'),
        status: 'נוכח',
        arrivalTime: '16:05'
      }
    ],
    notes: 'חזרה על יצירה חדשה',
    isActive: true,
    createdAt: new Date('2023-09-13'),
    lastModified: new Date('2023-09-13')
  },
  {
    _id: new ObjectId('507f1f77bcf86cd799439018'),
    orchestraId: new ObjectId('507f1f77bcf86cd799439016'),
    date: '2023-09-11',
    startTime: '17:00',
    endTime: '19:00',
    attendance: [
      {
        studentId: new ObjectId(MOCK_STUDENT_ID),
        status: 'חסר',
        reason: 'חולה'
      }
    ],
    notes: 'חזרה על קונצרט',
    isActive: true,
    createdAt: new Date('2023-09-11'),
    lastModified: new Date('2023-09-11')
  }
];

/**
 * Theory lessons with student enrollments
 */
export const mockTheoryLessonsData = [
  {
    _id: new ObjectId('507f1f77bcf86cd799439019'),
    title: 'תורת המוזיקה א',
    teacher: 'פרופ שמואל גרין',
    studentIds: [
      new ObjectId(MOCK_STUDENT_ID),
      new ObjectId('507f1f77bcf86cd799439024'),
      new ObjectId('507f1f77bcf86cd799439025')
    ],
    day: 'ה',
    startTime: '14:00',
    endTime: '15:30',
    semester: 'א',
    year: '2023',
    isActive: true,
    createdAt: new Date('2023-09-01'),
    lastModified: new Date('2023-09-15')
  }
];

/**
 * Bagrut records (academic records)
 */
export const mockBagrutData = [
  {
    _id: new ObjectId(MOCK_BAGRUT_ID),
    studentId: new ObjectId(MOCK_STUDENT_ID),
    subject: 'מוזיקה',
    level: '5 יחידות',
    presentations: [
      {
        type: 'הופעה',
        date: '2023-06-15',
        grade: 95,
        notes: 'הופעה מצוינת'
      },
      {
        type: 'עבודה כתובה',
        date: '2023-05-20',
        grade: 88,
        notes: 'עבודה טובה על היסטוריה של המוזיקה'
      }
    ],
    finalGrade: 92,
    status: 'הושלם',
    year: '2023',
    isActive: true,
    createdAt: new Date('2023-01-15'),
    lastModified: new Date('2023-06-15')
  }
];

/**
 * Activity attendance records
 */
export const mockActivityAttendanceData = [
  {
    _id: new ObjectId('507f1f77bcf86cd799439030'),
    studentId: new ObjectId(MOCK_STUDENT_ID),
    activityType: 'קונצרט',
    activityName: 'קונצרט סוף שנה',
    date: '2023-06-20',
    status: 'נוכח',
    duration: 120,
    notes: 'השתתף בביצוע',
    createdAt: new Date('2023-06-20')
  },
  {
    _id: new ObjectId('507f1f77bcf86cd799439031'),
    studentId: new ObjectId(MOCK_STUDENT_ID),
    activityType: 'מופע',
    activityName: 'מופע חנוכה',
    date: '2023-12-15',
    status: 'נוכח',
    duration: 90,
    notes: 'הופעת סולו',
    createdAt: new Date('2023-12-15')
  }
];

/**
 * Comprehensive test scenario with complex relationships
 */
export const complexStudentScenario = {
  student: mockStudentData,
  teachers: mockTeachersData,
  orchestras: mockOrchestrasData,
  rehearsals: mockRehearsalsData,
  theoryLessons: mockTheoryLessonsData,
  bagrut: mockBagrutData,
  activityAttendance: mockActivityAttendanceData
};

/**
 * Test scenario for partial failure recovery
 */
export const partialFailureScenario = {
  studentId: new ObjectId('507f1f77bcf86cd799439032'),
  student: {
    _id: new ObjectId('507f1f77bcf86cd799439032'),
    personalInfo: { fullName: 'שרה אברהם' },
    isActive: true
  },
  // Orphaned references that should be cleaned up
  orphanedTeacherReference: {
    _id: new ObjectId('507f1f77bcf86cd799439033'),
    teaching: {
      studentIds: [new ObjectId('507f1f77bcf86cd799439032')] // Student doesn't exist
    }
  },
  orphanedOrchestraReference: {
    _id: new ObjectId('507f1f77bcf86cd799439034'),
    memberIds: [new ObjectId('507f1f77bcf86cd799439032')] // Student doesn't exist
  }
};

/**
 * Performance test scenario with 100+ references
 */
export const performanceTestScenario = {
  studentId: new ObjectId('507f1f77bcf86cd799439035'),
  student: {
    _id: new ObjectId('507f1f77bcf86cd799439035'),
    personalInfo: { fullName: 'בדיקת ביצועים' },
    isActive: true
  },
  generateLargeDataset: (studentId, count = 100) => {
    const scenarios = {
      teachers: [],
      orchestras: [],
      rehearsals: [],
      theoryLessons: [],
      activityAttendance: []
    };

    // Generate multiple teacher relationships
    for (let i = 0; i < Math.min(count / 10, 20); i++) {
      scenarios.teachers.push({
        _id: new ObjectId(),
        teaching: { studentIds: [new ObjectId(studentId)] },
        schedules: [{
          studentId: new ObjectId(studentId),
          isActive: true
        }]
      });
    }

    // Generate multiple orchestra memberships
    for (let i = 0; i < Math.min(count / 20, 10); i++) {
      scenarios.orchestras.push({
        _id: new ObjectId(),
        memberIds: [new ObjectId(studentId)]
      });
    }

    // Generate many rehearsal attendance records
    for (let i = 0; i < Math.min(count / 5, 50); i++) {
      scenarios.rehearsals.push({
        _id: new ObjectId(),
        attendance: [{
          studentId: new ObjectId(studentId),
          status: 'נוכח'
        }]
      });
    }

    // Generate theory lesson enrollments
    for (let i = 0; i < Math.min(count / 10, 15); i++) {
      scenarios.theoryLessons.push({
        _id: new ObjectId(),
        studentIds: [new ObjectId(studentId)]
      });
    }

    // Generate many activity attendance records
    const remainingCount = count - scenarios.teachers.length - scenarios.orchestras.length - scenarios.rehearsals.length - scenarios.theoryLessons.length;
    for (let i = 0; i < remainingCount; i++) {
      scenarios.activityAttendance.push({
        _id: new ObjectId(),
        studentId: new ObjectId(studentId),
        activityType: `פעילות ${i}`,
        date: new Date(2023, 0, 1 + i).toISOString().split('T')[0]
      });
    }

    return scenarios;
  }
};

/**
 * Concurrent operation test scenario
 */
export const concurrentOperationScenario = {
  students: [
    {
      _id: new ObjectId('507f1f77bcf86cd799439040'),
      personalInfo: { fullName: 'בדיקה מקבילית 1' },
      isActive: true
    },
    {
      _id: new ObjectId('507f1f77bcf86cd799439041'),
      personalInfo: { fullName: 'בדיקה מקבילית 2' },
      isActive: true
    },
    {
      _id: new ObjectId('507f1f77bcf86cd799439042'),
      personalInfo: { fullName: 'בדיקה מקבילית 3' },
      isActive: true
    }
  ],
  sharedOrchestra: {
    _id: new ObjectId('507f1f77bcf86cd799439043'),
    name: 'תזמורת משותפת',
    memberIds: [
      new ObjectId('507f1f77bcf86cd799439040'),
      new ObjectId('507f1f77bcf86cd799439041'),
      new ObjectId('507f1f77bcf86cd799439042')
    ]
  }
};

/**
 * Rollback test scenario
 */
export const rollbackTestScenario = {
  studentId: new ObjectId('507f1f77bcf86cd799439050'),
  snapshotData: {
    _id: 'snapshot_test_123',
    operationId: 'del_test_456',
    studentId: '507f1f77bcf86cd799439050',
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    data: {
      students: [mockStudentData],
      teachers: mockTeachersData,
      orchestras: mockOrchestrasData
    },
    used: false
  }
};

/**
 * Audit log test scenario
 */
export const auditLogScenario = {
  auditEntries: [
    {
      operationId: 'del_20230915_001',
      action: 'CASCADE_DELETE',
      timestamp: new Date('2023-09-15T10:00:00Z'),
      adminId: new ObjectId('507f1f77bcf86cd799439060'),
      adminName: 'מנהל מערכת',
      entityType: 'student',
      entityId: MOCK_STUDENT_ID,
      status: 'SUCCESS',
      details: {
        deletedRecords: { teachers: 2, orchestras: 1 },
        executionTime: '1500ms'
      }
    },
    {
      operationId: 'cleanup_20230915_002',
      action: 'CLEANUP',
      timestamp: new Date('2023-09-15T11:00:00Z'),
      adminId: new ObjectId('507f1f77bcf86cd799439060'),
      adminName: 'מנהל מערכת',
      entityType: 'orphaned_references',
      status: 'SUCCESS',
      details: {
        orphanedReferences: { teachers: 3, orchestras: 1 },
        cleanupSummary: { removed: 4, preserved: 0, errors: 0 }
      }
    }
  ]
};

/**
 * Helper functions for test setup
 */
export const testHelpers = {
  /**
   * Create a fresh copy of mock data to avoid test interference
   */
  getCleanMockData: () => JSON.parse(JSON.stringify(complexStudentScenario)),

  /**
   * Generate random ObjectId for tests
   */
  generateTestId: () => new ObjectId(),

  /**
   * Create student with specified number of relationships
   */
  createStudentWithRelationships: (relationshipCount = 10) => {
    const studentId = new ObjectId();
    return performanceTestScenario.generateLargeDataset(studentId, relationshipCount);
  },

  /**
   * Create snapshot data for rollback tests
   */
  createSnapshotData: (studentId, data) => ({
    _id: new ObjectId(),
    operationId: `test_${Date.now()}`,
    studentId: studentId.toString(),
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    data,
    used: false,
    size: JSON.stringify(data).length
  })
};

export default {
  complexStudentScenario,
  partialFailureScenario,
  performanceTestScenario,
  concurrentOperationScenario,
  rollbackTestScenario,
  auditLogScenario,
  testHelpers,
  MOCK_STUDENT_ID,
  MOCK_TEACHER_ID,
  MOCK_ORCHESTRA_ID,
  MOCK_BAGRUT_ID
};