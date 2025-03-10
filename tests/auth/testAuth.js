import request from 'supertest'
import jwt from 'jsonwebtoken'
import { MongoClient, ObjectId } from 'mongodb'
import { setupTestApp } from '../setup-test-server.js'
import { connectDB, closeDB, clearDB, getCollection } from '../test-db-config.js'
import { setupTestUsers } from '../fixtures/auth.fixtures.js'

process.env.ACCESS_TOKEN_SECRET = 'test-access-token-secret'
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-token-secret'

describe('Auth api tests', () => {
  let app
  let testUsers
  let adminId, teacherId, conductorId

  beforeAll(async () => {
    await connectDB()
    app = setupTestApp()
    testUsers = await setupTestUsers()  
  })

  beforeEach(async () => {
    await clearDB()

    const collection = await getCollection('teacher')

    const adminResult = await collection.insertOne({
      ...testUsers.admin,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    adminId = adminResult.insertedId

    const teacherResult = await collection.insertOne({
      ...testUsers.teacher,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    teacherId = teacherResult.insertedId

    const conductorResult = await collection.insertOne({
      ...testUsers.conductor,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    conductorId = conductorResult.insertedId
  })

  afterAll(async () => { 
    await closeDB()
  })

  describe('POST /api/auth/login', () => {
    it('should login admin successfully with correct credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'admin123'
        })
      
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('accessToken')
      expect(response.body).toHaveProperty('teacher')
      expect(response.body.teacher.roles).toContain('מנהל')

      expect(response.headers['set-cookie'][0].toContain('refreshToken'))
    })

    it('should login teacher successfully with correct credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'teacher@test.com',
          password: 'teacher123'
        })
      
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('accessToken')
      expect(response.body).toHaveProperty('מורה')
      expect(response.body.teacher.roles).toContain('מורה')
    })

    it('should return 401 with incorrect credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'wrongPassword'
        })
      
      expect(response.status).toBe(401)
      expect(response.body).toHaveProperty('error')
    })

    it('should return 401 with non-existing user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'anypassword'
        })
      
      expect(response.status).toBe(401)
      expect(response.body).toHaveProperty('error')
    })
  })

  describe('POST /api/auth/refresh', () => {
    it('should generate a new access token with valid refresh token', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'admin123'
        })
      
      const cookies = loginResponse.headers['set-cookie']
      const refreshTokenCookie = cookies.find(cookie => cookie.startsWith('refreshToken='))
      const refreshToken = refreshTokenCookie.split(';')[0].split('=')[1]

      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', `refreshToken=${refreshToken}`)
      
      expect(refreshResponse.status).toBe(200)
      expect(refreshResponse.body).toHaveProperty('accessToken')
    })

    it('should return 401 with missing refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
      
      expect(response.status).toBe(401)
      expect(response.body).toHaveProperty('error', 'Refresh token is required')
    })

    it('should return 401 with invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', 'refreshToken=invalidToken')
      
      expect(response.status).toBe(401)
      expect(response.body).toHaveProperty('error', 'Invalid refresh token')
    })
  })

  describe('POST /api/auth/logout', () => {
    it('should successfully logout a user', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'admin123'
        })
      
      const accessToken = loginResponse.body.accessToken  

      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
      
      expect(logoutResponse.status).toBe(200)
      expect(logoutResponse.body).toHaveProperty('message', 'Logged out successfully')
      
      expect(logoutResponse.headers['set-cookie'][0].toContain('refreshToken=;'))
    })

    it('should return 401 when trying to logout without authentication', async () => {
      const response = await request(app) 
        .post('/api/auth/logout')
      
      expect(response.status).toBe(401) 
      expect(response.body).toHaveProperty('error', 'Unauthorized')
    })
  })

  describe('POST /api/auth/init-admin', () => {
    it('should initialize admin user successfully', async () => {
      await clearDB()

      const response = await request(app)
        .post('/api/auth/init-admin')
      
      expect(response.status).toBe(201)
      expect(response.body).toHaveProperty('message', 'Admin user initialized successfully')

      const collection = await getCollection('teacher');
      const admins = await collection.find({ roles: { $in: ['מנהל'] } }).toArray()
      
      expect(admins.length).toBe(1)
      expect(admins[0].personalInfo.fullName).toBe('מנהל מערכת')  
    })

    it('should return 400 when trying to initialize admin when one already exists', async () => {
      const response = await request(app)
        .post('/api/auth/init-admin')
      
      expect(response.status).toBe(400)
      expect(response.body).toHaveProperty('error', 'Admin user already exists')
    })
  })
})