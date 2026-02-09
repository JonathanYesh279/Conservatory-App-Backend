import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'
import { ObjectId } from 'mongodb'

const ACCESS_SECRET = 'test-access-secret'

const adminId = new ObjectId()
const teacherAId = new ObjectId()
const teacherBId = new ObjectId()
const student1Id = new ObjectId()
const student2Id = new ObjectId()

const adminDoc = {
  _id: adminId,
  personalInfo: { fullName: 'Admin User', email: 'admin@test.com' },
  credentials: { email: 'admin@test.com', tokenVersion: 0 },
  roles: ['מנהל'],
  teaching: { studentIds: [] },
  isActive: true,
}

const teacherADoc = {
  _id: teacherAId,
  personalInfo: { fullName: 'Teacher A', email: 'teacherA@test.com' },
  credentials: { email: 'teacherA@test.com', tokenVersion: 0 },
  roles: ['מורה'],
  teaching: { studentIds: [student1Id.toString()] },
  isActive: true,
}

const teacherBDoc = {
  _id: teacherBId,
  personalInfo: { fullName: 'Teacher B', email: 'teacherB@test.com' },
  credentials: { email: 'teacherB@test.com', tokenVersion: 0 },
  roles: ['מורה'],
  teaching: { studentIds: [student2Id.toString()] },
  isActive: true,
}

const student1Doc = {
  _id: student1Id,
  personalInfo: { fullName: 'Student 1', phone: '050111' },
  academicInfo: { instrument: 'פסנתר', currentStage: 1, class: 'ז' },
  teacherIds: [teacherAId.toString()],
  teacherAssignments: [{ teacherId: teacherAId.toString(), isActive: true }],
  enrollments: { orchestraIds: [], ensembleIds: [], schoolYears: [] },
  isActive: true,
  createdAt: new Date(),
}

const student2Doc = {
  _id: student2Id,
  personalInfo: { fullName: 'Student 2', phone: '050222' },
  academicInfo: { instrument: 'כינור', currentStage: 2, class: 'ח' },
  teacherIds: [teacherBId.toString()],
  teacherAssignments: [{ teacherId: teacherBId.toString(), isActive: true }],
  enrollments: { orchestraIds: [], ensembleIds: [], schoolYears: [] },
  isActive: true,
  createdAt: new Date(),
}

function makeToken(teacher) {
  return jwt.sign(
    {
      _id: teacher._id.toString(),
      fullName: teacher.personalInfo.fullName,
      email: teacher.credentials.email,
      roles: teacher.roles,
      version: 0,
    },
    ACCESS_SECRET,
    { expiresIn: '1h' }
  )
}

// Mock mongoDB.service
vi.mock('../../services/mongoDB.service.js', () => {
  const mockCollection = {
    findOne: vi.fn(),
    updateOne: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
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

// Mock school year middleware
vi.mock('../../middleware/school-year.middleware.js', () => ({
  addSchoolYearToRequest: (req, res, next) => next(),
}))

// Mock student-assignments validation
vi.mock('../../api/student/student-assignments.validation.js', () => ({
  validateTeacherAssignmentsMiddleware: (req, res, next) => next(),
}))

let app
let mockCollection

beforeAll(async () => {
  process.env.ACCESS_TOKEN_SECRET = ACCESS_SECRET
  process.env.NODE_ENV = 'test'

  const mod = await import('../../services/mongoDB.service.js')
  mockCollection = mod.__mockCollection

  const { authenticateToken } = await import('../../middleware/auth.middleware.js')
  const studentRoutes = (await import('../../api/student/student.route.js')).default

  app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api/student', authenticateToken, studentRoutes)
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('IDOR Prevention Tests', () => {
  it('teacher should only see their own students', async () => {
    const token = makeToken(teacherADoc)

    // authenticateToken: findOne for teacher
    mockCollection.findOne.mockResolvedValueOnce(teacherADoc)

    // getStudents: find() returns only Teacher A's students (IDOR filter applied)
    const mockCursor = {
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValueOnce([student1Doc]),
    }
    mockCollection.find.mockReturnValueOnce(mockCursor)
    mockCollection.countDocuments.mockResolvedValueOnce(1)

    const res = await request(app)
      .get('/api/student')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)

    // The response should only contain Student 1
    const students = Array.isArray(res.body) ? res.body : res.body.students || res.body.data
    expect(students).toHaveLength(1)
    expect(students[0].personalInfo.fullName).toBe('Student 1')
  })

  it('admin should see all students', async () => {
    const token = makeToken(adminDoc)

    // authenticateToken: findOne for admin
    mockCollection.findOne.mockResolvedValueOnce(adminDoc)

    // getStudents: admin sees all students
    const mockCursor = {
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValueOnce([student1Doc, student2Doc]),
    }
    mockCollection.find.mockReturnValueOnce(mockCursor)
    mockCollection.countDocuments.mockResolvedValueOnce(2)

    const res = await request(app)
      .get('/api/student')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)

    const students = Array.isArray(res.body) ? res.body : res.body.students || res.body.data
    expect(students).toHaveLength(2)
  })

  it('teacher cannot access another teacher\'s student', async () => {
    const token = makeToken(teacherADoc)

    // authenticateToken: findOne for teacher A
    mockCollection.findOne
      .mockResolvedValueOnce(teacherADoc) // authenticateToken
      .mockResolvedValueOnce(student2Doc) // getStudentById - finds the student
      .mockResolvedValueOnce(null) // checkTeacherHasAccessToStudent - teacher A does NOT have student 2

    const res = await request(app)
      .get(`/api/student/${student2Id.toString()}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(403)
    expect(res.body.error).toMatch(/access denied/i)
  })
})
