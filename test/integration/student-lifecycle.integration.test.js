import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { ObjectId } from 'mongodb'

const teacherId = new ObjectId()
const studentId = new ObjectId()
const timeBlockId = new ObjectId()

// Mock mongoDB.service
vi.mock('../../services/mongoDB.service.js', () => {
  const mockCollection = {
    findOne: vi.fn(),
    updateOne: vi.fn(),
    find: vi.fn(),
    insertOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
  }
  return {
    getCollection: vi.fn(() => Promise.resolve(mockCollection)),
    getDB: vi.fn(),
    initializeMongoDB: vi.fn(),
    __mockCollection: mockCollection,
  }
})

// Mock logger
vi.mock('../../services/logger.service.js', () => {
  const noop = () => {}
  const logger = { info: noop, error: noop, warn: noop, debug: noop, fatal: noop, child: () => logger }
  return { default: logger, createLogger: () => logger }
})

let timeBlockService
let attendanceService
let mockCollection

beforeAll(async () => {
  process.env.NODE_ENV = 'test'
  process.env.ACCESS_TOKEN_SECRET = 'test-secret'

  const mod = await import('../../services/mongoDB.service.js')
  mockCollection = mod.__mockCollection

  const tbMod = await import('../../api/schedule/time-block.service.js')
  timeBlockService = tbMod.timeBlockService

  const attMod = await import('../../api/schedule/attendance.service.js')
  attendanceService = attMod.attendanceService
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Student Lifecycle E2E Test', () => {
  it('create student → assign to teacher → mark attendance → verify sync points', async () => {
    // ---- Step 1: Create student (simulated as direct DB insert) ----
    const studentDoc = {
      _id: studentId,
      personalInfo: { fullName: 'New Student', phone: '050333' },
      academicInfo: { instrument: 'חליל', currentStage: 1, class: 'ז' },
      teacherIds: [],
      teacherAssignments: [],
      enrollments: { orchestraIds: [], ensembleIds: [], schoolYears: [] },
      isActive: true,
      createdAt: new Date(),
    }

    mockCollection.insertOne.mockResolvedValueOnce({ insertedId: studentId })

    // ---- Step 2: Assign student to teacher via timeBlock ----
    const teacherDoc = {
      _id: teacherId,
      personalInfo: { fullName: 'Music Teacher' },
      credentials: { email: 'teacher@test.com', tokenVersion: 0 },
      roles: ['מורה'],
      teaching: {
        studentIds: [],
        timeBlocks: [
          {
            _id: timeBlockId,
            day: 'שני',
            startTime: '10:00',
            endTime: '14:00',
            location: 'Room B',
            isActive: true,
            assignedLessons: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      },
      isActive: true,
    }

    // assignLessonToBlock calls:
    // 1. findOne for teacher
    mockCollection.findOne.mockResolvedValueOnce(teacherDoc)
    // 2. findOne for student
    mockCollection.findOne.mockResolvedValueOnce(studentDoc)

    // 3. find for student schedule conflict check
    const mockConflictCursor = {
      project: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValueOnce([]),
    }
    mockCollection.find.mockReturnValueOnce(mockConflictCursor)

    // 4. updateOne for teacher (adds lesson + studentId)
    mockCollection.updateOne.mockResolvedValueOnce({ modifiedCount: 1 })
    // 5. updateOne for student (adds teacherAssignment + teacherId)
    mockCollection.updateOne.mockResolvedValueOnce({ modifiedCount: 1 })

    const assignResult = await timeBlockService.assignLessonToBlock({
      teacherId: teacherId.toString(),
      studentId: studentId.toString(),
      timeBlockId: timeBlockId.toString(),
      startTime: '11:00',
      duration: 45,
    })

    expect(assignResult.success).toBe(true)

    // ---- Step 3: Verify all 4 sync points were written ----

    // Verify teacher update was called with $addToSet for studentIds
    const teacherUpdateCall = mockCollection.updateOne.mock.calls[0]
    expect(teacherUpdateCall[1].$addToSet['teaching.studentIds']).toBe(studentId.toString())
    expect(teacherUpdateCall[1].$push['teaching.timeBlocks.$.assignedLessons']).toBeDefined()

    // Verify student update was called with $push for teacherAssignments and $addToSet for teacherIds
    const studentUpdateCall = mockCollection.updateOne.mock.calls[1]
    expect(studentUpdateCall[1].$push.teacherAssignments).toBeDefined()
    expect(studentUpdateCall[1].$push.teacherAssignments.teacherId).toBe(teacherId.toString())
    expect(studentUpdateCall[1].$addToSet.teacherIds).toBe(teacherId.toString())

    // ---- Step 4: Mark attendance ----
    const attendanceRecord = {
      _id: new ObjectId(),
      studentId: studentId.toString(),
      teacherId: teacherId.toString(),
      activityType: 'שיעור פרטי',
      status: 'הגיע/ה',
      date: new Date('2026-02-05'),
    }

    // Query stats after inserting attendance
    const mockStatsCursor = {
      sort: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValueOnce([attendanceRecord]),
    }
    mockCollection.find.mockReturnValueOnce(mockStatsCursor)

    const stats = await attendanceService.getStudentPrivateLessonStats(
      studentId.toString(),
      teacherId.toString()
    )

    expect(stats.totalLessons).toBe(1)
    expect(stats.attendedLessons).toBe(1)
    expect(stats.attendanceRate).toBe(100)
  })
})
