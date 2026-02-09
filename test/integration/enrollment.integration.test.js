import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { ObjectId } from 'mongodb'

const teacherId = new ObjectId()
const studentId = new ObjectId()
const timeBlockId = new ObjectId()

const teacherDoc = {
  _id: teacherId,
  personalInfo: { fullName: 'Music Teacher', email: 'music@test.com' },
  credentials: { email: 'music@test.com', tokenVersion: 0 },
  roles: ['מורה'],
  teaching: {
    studentIds: [],
    timeBlocks: [
      {
        _id: timeBlockId,
        day: 'ראשון',
        startTime: '08:00',
        endTime: '12:00',
        location: 'Room A',
        isActive: true,
        assignedLessons: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  },
  isActive: true,
}

const studentDoc = {
  _id: studentId,
  personalInfo: { fullName: 'Test Student', phone: '050111' },
  academicInfo: { instrument: 'פסנתר', currentStage: 1 },
  teacherIds: [],
  teacherAssignments: [],
  isActive: true,
}

// Mock mongoDB.service
vi.mock('../../services/mongoDB.service.js', () => {
  const mockCollection = {
    findOne: vi.fn(),
    updateOne: vi.fn(),
    find: vi.fn(),
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
let mockCollection

beforeAll(async () => {
  process.env.NODE_ENV = 'test'
  process.env.ACCESS_TOKEN_SECRET = 'test-secret'

  const mod = await import('../../services/mongoDB.service.js')
  mockCollection = mod.__mockCollection

  const tbMod = await import('../../api/schedule/time-block.service.js')
  timeBlockService = tbMod.timeBlockService
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Enrollment Tests', () => {
  it('should assign lesson within time block', async () => {
    // findOne for teacher (with timeBlock match)
    mockCollection.findOne
      .mockResolvedValueOnce(teacherDoc)  // teacher lookup
      .mockResolvedValueOnce(studentDoc)  // student lookup

    // find for student schedule conflict check - returns empty
    const mockCursor = {
      project: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValueOnce([]),
    }
    mockCollection.find.mockReturnValueOnce(mockCursor)

    // updateOne for teacher (add lesson to block)
    mockCollection.updateOne
      .mockResolvedValueOnce({ modifiedCount: 1 }) // teacher update
      .mockResolvedValueOnce({ modifiedCount: 1 }) // student update

    const result = await timeBlockService.assignLessonToBlock({
      teacherId: teacherId.toString(),
      studentId: studentId.toString(),
      timeBlockId: timeBlockId.toString(),
      startTime: '09:00',
      duration: 45,
    })

    expect(result.success).toBe(true)
    expect(result.message).toMatch(/assigned successfully/i)
    expect(result.lessonAssignment).toBeDefined()
    expect(result.lessonAssignment.lessonStartTime).toBe('09:00')
    expect(result.lessonAssignment.duration).toBe(45)
  })

  it('should reject lesson outside block boundaries', async () => {
    // Teacher lookup returns the teacher
    mockCollection.findOne
      .mockResolvedValueOnce(teacherDoc)  // teacher with 08:00-12:00 block
      .mockResolvedValueOnce(studentDoc)

    await expect(
      timeBlockService.assignLessonToBlock({
        teacherId: teacherId.toString(),
        studentId: studentId.toString(),
        timeBlockId: timeBlockId.toString(),
        startTime: '07:00',  // Before block start
        duration: 45,
      })
    ).rejects.toThrow(/doesn't fit within time block/)
  })

  it('should reject conflicting lesson times', async () => {
    // Teacher with an existing lesson at 09:00-09:45
    const teacherWithLesson = {
      ...teacherDoc,
      teaching: {
        ...teacherDoc.teaching,
        timeBlocks: [
          {
            ...teacherDoc.teaching.timeBlocks[0],
            assignedLessons: [
              {
                _id: new ObjectId(),
                studentId: new ObjectId().toString(),
                lessonStartTime: '09:00',
                lessonEndTime: '09:45',
                duration: 45,
                isActive: true,
              },
            ],
          },
        ],
      },
    }

    mockCollection.findOne
      .mockResolvedValueOnce(teacherWithLesson)
      .mockResolvedValueOnce(studentDoc)

    await expect(
      timeBlockService.assignLessonToBlock({
        teacherId: teacherId.toString(),
        studentId: studentId.toString(),
        timeBlockId: timeBlockId.toString(),
        startTime: '09:15',  // Overlaps with 09:00-09:45
        duration: 30,
      })
    ).rejects.toThrow(/conflicts/)
  })
})
