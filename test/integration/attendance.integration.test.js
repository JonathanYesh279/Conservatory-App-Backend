import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { ObjectId } from 'mongodb'

const teacherId = new ObjectId()
const studentId = new ObjectId()

const attendanceRecords = [
  {
    _id: new ObjectId(),
    studentId: studentId.toString(),
    teacherId: teacherId.toString(),
    activityType: 'שיעור פרטי',
    status: 'הגיע/ה',
    date: new Date('2026-01-15'),
    notes: 'Good lesson',
  },
  {
    _id: new ObjectId(),
    studentId: studentId.toString(),
    teacherId: teacherId.toString(),
    activityType: 'שיעור פרטי',
    status: 'לא הגיע/ה',
    date: new Date('2026-01-08'),
    notes: 'Absent',
  },
  {
    _id: new ObjectId(),
    studentId: studentId.toString(),
    teacherId: teacherId.toString(),
    activityType: 'שיעור פרטי',
    status: 'הגיע/ה',
    date: new Date('2026-01-01'),
    notes: 'Excellent',
  },
]

// Mock mongoDB.service
vi.mock('../../services/mongoDB.service.js', () => {
  const mockCollection = {
    findOne: vi.fn(),
    updateOne: vi.fn(),
    find: vi.fn(),
    insertOne: vi.fn(),
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

let attendanceService
let mockCollection

beforeAll(async () => {
  process.env.NODE_ENV = 'test'

  const mod = await import('../../services/mongoDB.service.js')
  mockCollection = mod.__mockCollection

  const attMod = await import('../../api/schedule/attendance.service.js')
  attendanceService = attMod.attendanceService
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Attendance Tests', () => {
  it('should return correct student private lesson stats', async () => {
    const mockCursor = {
      sort: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValueOnce([...attendanceRecords]),
    }
    mockCollection.find.mockReturnValueOnce(mockCursor)

    const stats = await attendanceService.getStudentPrivateLessonStats(
      studentId.toString(),
      teacherId.toString()
    )

    expect(stats.studentId).toBe(studentId.toString())
    expect(stats.teacherId).toBe(teacherId.toString())
    expect(stats.totalLessons).toBe(3)
    expect(stats.attendedLessons).toBe(2)
    expect(stats.missedLessons).toBe(1)
    expect(stats.attendanceRate).toBeCloseTo(66.67, 1)
    expect(stats.recentAttendance).toHaveLength(3)
  })

  it('should retrieve attendance history sorted by date', async () => {
    const mockCursor = {
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValueOnce([...attendanceRecords]),
    }
    mockCollection.find.mockReturnValueOnce(mockCursor)

    const history = await attendanceService.getStudentAttendanceHistory(
      studentId.toString()
    )

    expect(history).toHaveLength(3)
    // Verify sort was called with date desc
    expect(mockCursor.sort).toHaveBeenCalledWith({ date: -1 })
    // Verify the records are returned
    expect(history[0].status).toBe('הגיע/ה')
    expect(history[1].status).toBe('לא הגיע/ה')
    expect(history[2].status).toBe('הגיע/ה')
  })
})
