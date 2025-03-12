import request from 'supertest'
import { setupTestApp } from '../setup-test-server.js'
import { connectDB, closeDB, clearDB, getCollection } from '../test-db-config.js'
import { setupTestUsers, generateTokens } from '../fixtures/auth.fixtures.js'
import { setupTestSchoolYears } from '../school-year.fixtures.js'
import { ObjectId } from 'mongodb'


process.env.ACCESS_TOKEN_SECRET = 'test-access-token-secret'
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-token-secret'

describe('Teacher Api Tests', () => {s
  let app
  let testUsers
  let adminId, teacherId, conductorId
  let adminToken, teacherToken, conductorToken
  let schoolYears
  let currentSchoolYearId

  beforeAll(async () => {
    await connectDB()
    app = setupTestApp()
    testUsers = await setupTestUsers()
    schoolYears = setupTestSchoolYears()
  })

  beforeEach(async () => {
    await clearDB()

    // Insert school Years
    const schoolYearCollection = await getCollection('school_year')
    await schoolYearCollection.insertMany(Object.values(schoolYears))
    currentSchoolYearId = schoolYears.current._id

    // Insert test users into the database
    const collection = await getCollection('teacher')

    const adminUser = {
      ...testUsers.admin,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const adminResult = await collection.insertOne(adminUser)
    adminId = adminResult.insertedId
    adminUser._id = adminId

    const teacherUser = {
      ...testUsers.teacher,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const teacherResult = await collection.insertOne(teacherUser)
    teacherId = teacherResult.insertedId
    teacherUser._id = teacherId

    const conductorUser = {
      ...testUsers.conductor,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const conductorResult = await collection.insertOne(conductorUser)
    conductorId = conductorResult.insertedId
    conductorUser._id = conductorId

    // Generate tokens for testing
    const adminTokens = generateTokens(adminUser)
    adminToken = adminTokens.accessToken

    const teacherTokens = generateTokens(teacherUser)
    teacherToken = teacherTokens.accessToken

    const conductorTokens = generateTokens(conductorUser)
    conductorToken = conductorTokens.accessToken
  })

  afterAll(async () => {
    await closeDB()
  })

  describe('GET /api/teacher', () => {
    it('should allow admin to get all teachers', async () => {
      const response = await request(app)
        .get('/api/teacher')
        .set('Authorization', `Bearer ${adminToken}`)
      
      expect(response.status).toBe(200)
      expect(Array.isArray(response.body)).toBe(true)
      expect(response.body.length).toBe(3)
    })

    it('should allow teacher to get all teachers', async () => {
      const response = await request(app)
        .get('/api/teacher')
        .set('Authorization', `Bearer ${teacherToken}`)
      
      expect(response.status).toBe(200)
      expect(Array.isArray(response.body)).toBe(true)
    })

    it('should allow conductor to get all teachers', async () => {
      const response = await request(app)
        .get('/api/teacher')
        .set('Authorization', `Bearer ${conductorToken}`)
      
      expect(response.status).toBe(200)
      expect(Array.isArray(response.body)).toBe(true)
    })

    it('should reject unauthorized access', async () => {
      const response = await request(app)
        .get('/api/teacher')
      
      expect(response.status).toBe(401)
      expect(response.body).toHaveProperty('error')
    })
  })

  describe('GET /api/teacher/:id', () => {
    it('should allow admin to get a specific teacher', async () => {
      const response = await request(app)
        .get(`/api/teacher/${teacherId}`)
        .set('Authorization', `Bearer ${adminToken}`)
      
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('_id')
      expect(response.body.personalInfo.fullName).toBe('Test Teacher')
    })

    it('should allow teacher to get a specific teacher', async () => {
      const response = await request(app)
        .get(`/api/teacher/${teacherId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
      
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('_id')
    })

    it('should return 500 for non-existent teacher', async () => {
      const nonExistentId = new ObjectId()
      const response = await request(app)
        .get(`/api/teacher/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
      
      expect(response.status).toBe(500)
      expect(response.body).toHaveProperty('error')
    })
  })

  describe('GET /api/teacher/role/:role', () => {
    it('should get teachers by role', async () => {
      const response = await request(app)
        .get('/api/teacher/role/מורה')
        .set('Authorization', `Bearer ${adminToken}`)
      
      expect(response.status).toBe(200)
      expect(Array.isArray(response.body)).toBe(true)
      expect(response.body.length).toBe(1)
      expect(response.body[0].roles).toContain('מורה')  
    })
  })

  describe('POST /api/teacher', () => {
    it('should allow admin to add a new teacher', async () => {
      const newTeacher = {
        personalInfo: {
          fullName: 'New Test Teacher',
          phone: '0541234567',
          email: 'newteacher@test.com',
          address: 'New Teacher address',
        },
        roles: ['מורה'],
        professionalInfo: {
          instrument: 'סקסופון', // Fixed: added required instrument field
          isActive: true,
        },
        teaching: {
          studentIds: [],
          schedule: [],
        },
        credentials: {
          email: 'newteacher@test.com',
          password: 'newteacher123'
        },
        isActive: true
      }

      const response = await request(app)
        .post('/api/teacher')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newTeacher)
      
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('_id')
      expect(response.body.personalInfo.fullName).toBe('New Test Teacher')

      const collection = await getCollection('teacher')
      const addedTeacher = await collection.findOne({ 'personalInfo.fullName': 'New Test Teacher' })
      expect(addedTeacher).not.toBeNull()
    })

    it('should not allow teacher to add a new teacher', async () => {
      const newTeacher = {
        personalInfo: {
          fullName: 'New Test Teacher',
          phone: '0541234567',
          email: 'newteacher@test.com',
          address: 'New Teacher address',
        },
        roles: ['מורה'],
        professionalInfo: {
          instrument: 'סקסופון',
          isActive: true
        },
        teaching: {
          studentIds: [],
          schedule: []
        },
        credentials: {
          email: 'newteacher@test.com',
          password: 'newteacher123'
        },
        isActive: true
      }

      const response = await request(app)
        .post('/api/teacher') 
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(newTeacher)
      
      expect(response.status).toBe(403)
      expect(response.body).toHaveProperty('error')
    })
  })

  describe('PUT /api/teacher/:id', () => {
    it('should allow admin to update a teacher', async () => {
      const teacherUpdate = {
        personalInfo: {
          fullName: 'Updated Teacher Name',
          phone: '0541234567',
          email: 'teacher@test.com',
          address: 'Updated address',
        },
        roles: ['מורה'],
        professionalInfo: {
          instrument: 'קלרינט',
          isActive: true,
        },
        teaching: {
          studentIds: [],
          schedule: [],
        },
        credentials: {
          email: 'teacher@test.com',
          password: 'teacher123'
        },
        isActive: true
      }

      const response = await request(app)
        .put(`/api/teacher/${teacherId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(teacherUpdate)
      
      expect(response.status).toBe(200) 
      expect(response.body.personalInfo.fullName).toBe('Updated Teacher Name')
      expect(response.body.personalInfo.address).toBe('Updated address')

      const collection = await getCollection('teacher')
      const updatedTeacher = await collection.findOne({ _id: teacherId })
      expect(updatedTeacher.personalInfo.fullName).toBe('Updated Teacher Name')
    })

    it('should not allow teacher to update a teacher', async () => {
      const teacherUpdate = {
        personalInfo: {
          fullName: 'Updated Teacher Name',
          phone: '0541234567',
          email: 'teacher@test.com',
          address: 'Updated address',
        },
        roles: ['מורה'],
        professionalInfo: {
          instrument: 'קלרינט',
          isActive: true,
        },
        teaching: {
          studentIds: [],
          schedule: [],
        },
        credentials: {
          email: 'teacher@test.com',
          password: 'teacher123'
        },
        isActive: true
      }

      const response = await request(app)
        .put(`/api/teacher/${teacherId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(teacherUpdate)
      
      expect(response.status).toBe(403)
      expect(response.body).toHaveProperty('error')
    })
  })

  describe('DELETE /api/teacher/:id', () => {
    it('should allow admin to soft-delete a teacher', async () => {
      const response = await request(app)
        .delete(`/api/teacher/${teacherId}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.isActive).toBe(false)

      const collection = await getCollection('teacher')
      const deletedTeacher = await collection.findOne({ _id: teacherId }) 
      expect(deletedTeacher.isActive).toBe(false)
    })

    it('should not allow teacher to delete a teacher', async () => {
      const response = await request(app)
        .delete(`/api/teacher/${teacherId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
      
      expect(response.status).toBe(403)
      expect(response.body).toHaveProperty('error')
    })
  })
})