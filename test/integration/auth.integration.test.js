import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { ObjectId } from 'mongodb'

const ACCESS_SECRET = 'test-access-secret'
const REFRESH_SECRET = 'test-refresh-secret'

// Teacher data
const teacherId = new ObjectId()
const hashedPassword = bcrypt.hashSync('correctpass', 10)

let teacherDoc = null

function createTeacherDoc() {
  return {
    _id: teacherId,
    personalInfo: {
      fullName: 'Test Teacher',
      email: 'teacher@test.com',
      phone: '0501234567',
      address: 'Test Address',
    },
    credentials: {
      email: 'teacher@test.com',
      password: hashedPassword,
      refreshToken: null,
      tokenVersion: 0,
      isInvitationAccepted: true,
      passwordSetAt: new Date(),
    },
    roles: ['מורה'],
    professionalInfo: { instrument: 'פסנתר' },
    teaching: { studentIds: [], timeBlocks: [] },
    isActive: true,
    createdAt: new Date(),
  }
}

// Mock mongoDB.service before importing routes
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

// Mock logger to silence output in tests
vi.mock('../../services/logger.service.js', () => {
  const noop = () => {}
  const logger = { info: noop, error: noop, warn: noop, debug: noop, fatal: noop, child: () => logger }
  return { default: logger, createLogger: () => logger }
})

// Mock invitationMigration
vi.mock('../../services/invitationMigration.js', () => ({
  invitationMigration: {
    migratePendingInvitations: vi.fn(),
    getInvitationModeStats: vi.fn(),
  },
}))

let app
let mockCollection

beforeAll(async () => {
  process.env.ACCESS_TOKEN_SECRET = ACCESS_SECRET
  process.env.REFRESH_TOKEN_SECRET = REFRESH_SECRET
  process.env.NODE_ENV = 'test'

  const { getCollection } = await import('../../services/mongoDB.service.js')
  mockCollection = (await getCollection()).__proto__ === undefined
    ? await getCollection()
    : await getCollection()

  // Actually get the mock from the module
  const mod = await import('../../services/mongoDB.service.js')
  mockCollection = mod.__mockCollection

  const authRoutes = (await import('../../api/auth/auth.route.js')).default
  const { authenticateToken } = await import('../../middleware/auth.middleware.js')

  app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api/auth', authRoutes)

  // A protected test route for token expiry testing
  app.get('/api/protected', authenticateToken, (req, res) => {
    res.json({ success: true })
  })
})

beforeEach(() => {
  vi.clearAllMocks()
  teacherDoc = createTeacherDoc()
})

describe('Auth Integration Tests', () => {
  it('should login with valid credentials', async () => {
    mockCollection.findOne.mockResolvedValueOnce(teacherDoc)
    mockCollection.updateOne.mockResolvedValueOnce({ modifiedCount: 1 })

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'teacher@test.com', password: 'correctpass' })

    expect(res.status).toBe(200)
    expect(res.body.accessToken).toBeDefined()
    expect(res.body.teacher).toBeDefined()
    expect(res.body.teacher._id).toBe(teacherId.toString())
    expect(res.body.teacher.personalInfo.fullName).toBe('Test Teacher')

    // Verify refresh token cookie was set
    const cookies = res.headers['set-cookie']
    expect(cookies).toBeDefined()
    expect(cookies.some(c => c.includes('refreshToken'))).toBe(true)
  })

  it('should reject invalid credentials', async () => {
    mockCollection.findOne.mockResolvedValueOnce(teacherDoc)

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'teacher@test.com', password: 'wrongpassword' })

    expect(res.status).toBe(401)
    expect(res.body.code).toBe('INVALID_CREDENTIALS')
  })

  it('should reject expired token', async () => {
    // Create a token that expired 1 hour ago
    const expiredToken = jwt.sign(
      {
        _id: teacherId.toString(),
        fullName: 'Test Teacher',
        email: 'teacher@test.com',
        roles: ['מורה'],
        version: 0,
      },
      ACCESS_SECRET,
      { expiresIn: '-1h' }
    )

    const res = await request(app)
      .get('/api/protected')
      .set('Authorization', `Bearer ${expiredToken}`)

    expect(res.status).toBe(401)
    expect(res.body.code).toBe('TOKEN_EXPIRED')
  })

  it('should refresh token successfully', async () => {
    // Step 1: Login to get tokens
    mockCollection.findOne.mockResolvedValueOnce(teacherDoc)
    mockCollection.updateOne.mockResolvedValueOnce({ modifiedCount: 1 })

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'teacher@test.com', password: 'correctpass' })

    expect(loginRes.status).toBe(200)

    // Extract refresh token from cookie
    const cookies = loginRes.headers['set-cookie']
    const refreshCookie = cookies.find(c => c.includes('refreshToken'))
    const refreshTokenValue = refreshCookie.split('refreshToken=')[1].split(';')[0]

    // Step 2: Use refresh token to get new access token
    // The teacher doc should now have the refresh token stored
    const teacherWithRefreshToken = {
      ...teacherDoc,
      credentials: {
        ...teacherDoc.credentials,
        refreshToken: refreshTokenValue,
      },
    }
    mockCollection.findOne.mockResolvedValueOnce(teacherWithRefreshToken)

    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `refreshToken=${refreshTokenValue}`)

    expect(refreshRes.status).toBe(200)
    expect(refreshRes.body.success).toBe(true)
    expect(refreshRes.body.data.accessToken).toBeDefined()
  })

  it('should reject reused refresh token after logout', async () => {
    // Step 1: Login
    mockCollection.findOne.mockResolvedValueOnce(teacherDoc)
    mockCollection.updateOne.mockResolvedValueOnce({ modifiedCount: 1 })

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'teacher@test.com', password: 'correctpass' })

    const cookies = loginRes.headers['set-cookie']
    const refreshCookie = cookies.find(c => c.includes('refreshToken'))
    const refreshTokenValue = refreshCookie.split('refreshToken=')[1].split(';')[0]

    // Generate a valid access token for the logout request
    const accessToken = jwt.sign(
      {
        _id: teacherId.toString(),
        fullName: 'Test Teacher',
        email: 'teacher@test.com',
        roles: ['מורה'],
        version: 0,
      },
      ACCESS_SECRET,
      { expiresIn: '1h' }
    )

    // Step 2: Logout (need authenticateToken to pass)
    mockCollection.findOne.mockResolvedValueOnce(teacherDoc) // for authenticateToken
    mockCollection.updateOne.mockResolvedValueOnce({ modifiedCount: 1 }) // for logout (clears refreshToken)

    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)

    expect(logoutRes.status).toBe(200)

    // Step 3: Try to use the old refresh token (teacher now has null refreshToken)
    const loggedOutTeacher = {
      ...teacherDoc,
      credentials: {
        ...teacherDoc.credentials,
        refreshToken: null, // cleared by logout
      },
    }
    // findOne should return null because we query by refreshToken match
    mockCollection.findOne.mockResolvedValueOnce(null)

    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `refreshToken=${refreshTokenValue}`)

    expect(refreshRes.status).toBe(401)
  })
})
