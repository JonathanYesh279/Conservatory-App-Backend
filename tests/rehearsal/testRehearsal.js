import request from 'supertest'
import { setupTestApp } from '../setup-test-server.js'
import { connectDB, closeDB, clearDB, getCollection } from '../test-db-config.js'
import { setupTestUsers, generateTokens } from '../fixtures/auth.fixtures.js'
import { setupTestSchoolYears } from '../school-year.fixtures.js'
import { setupTestStudents } from '../fixtures/student.fixtures.js'
import { setupTestOrchestras } from '../fixtures/orchestra.fixtures.js'
import { setupTestRehearsals } from '../fixtures/rehearsal.fixtures.js'
import { ObjectId } from 'mongodb'

process.env.ACCESS_TOKEN_SECRET = 'test-access-token-secret'
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-token-secret'

describe('Rehearsal API Tests', () => {
  let app
  let testUsers
  let adminId, teacherId, conductorId
  let adminToken, teacherToken, conductorToken
  let schoolYears
  let currentSchoolYearId
  let students
  let orchestraIds = {}
  let rehearsalIds = {}

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
    currentSchoolYearId = schoolYears.current._id.toString()

    // Insert test users into the database
    const teacherCollection = await getCollection('teacher')

    const adminUser = {
      ...testUsers.admin,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const adminResult = await teacherCollection.insertOne(adminUser)
    adminId = adminResult.insertedId
    adminUser._id = adminId

    const teacherUser = {
      ...testUsers.teacher,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const teacherResult = await teacherCollection.insertOne(teacherUser)
    teacherId = teacherResult.insertedId
    teacherUser._id = teacherId

    const conductorUser = {
      ...testUsers.conductor,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const conductorResult = await teacherCollection.insertOne(conductorUser)
    conductorId = conductorResult.insertedId
    conductorUser._id = conductorId

    // Generate tokens for testing
    const adminTokens = generateTokens(adminUser)
    adminToken = adminTokens.accessToken

    const teacherTokens = generateTokens(teacherUser)
    teacherToken = teacherTokens.accessToken

    const conductorTokens = generateTokens(conductorUser)
    conductorToken = conductorTokens.accessToken

    // Insert test students
    students = setupTestStudents(currentSchoolYearId)
    const studentCollection = await getCollection('student')
    await studentCollection.insertMany(Object.values(students))

    // Setup orchestras with conductorId and schoolYearId
    const studentIds = Object.values(students).map(student => student._id.toString())
    const orchestraData = setupTestOrchestras(conductorId.toString(), currentSchoolYearId, studentIds)
    const orchestraCollection = await getCollection('orchestra')
    await orchestraCollection.insertMany(Object.values(orchestraData))

    // Get the inserted orchestras by name for later reference
    const insertedOrchestras = await orchestraCollection.find({}).toArray()
    
    // Map orchestra types to their IDs for easier reference in tests
    for (const orchestra of insertedOrchestras) {
      if (orchestra.name === 'תזמורת מתחילים נשיפה') {
        orchestraIds.beginners = orchestra._id.toString()
      } else if (orchestra.name === 'תזמורת יצוגית נשיפה') {
        orchestraIds.advanced = orchestra._id.toString()
      } else if (orchestra.name === 'תזמורת סימפונית') {
        orchestraIds.symphonic = orchestra._id.toString()
      } else if (orchestra.type === 'הרכב') {
        orchestraIds.ensemble = orchestra._id.toString()
      }
    }

    // Update conductor with orchestraIds
    await teacherCollection.updateOne(
      { _id: conductorId },
      { $set: { 'conducting.orchestraIds': Object.values(orchestraIds) } }
    )

    // Set up rehearsals
    const orchestraId = orchestraIds.beginners
    const rehearsalData = setupTestRehearsals(orchestraId, currentSchoolYearId,
      Object.values(students).map(s => s._id.toString()))
    
    const rehearsalCollection = await getCollection('rehearsal')
    await rehearsalCollection.insertMany(Object.values(rehearsalData))
    
    // Store rehearsal IDs for reference in tests
    const insertedRehearsals = await rehearsalCollection.find({
      groupId: orchestraId
    }).toArray()

    for (const rehearsal of insertedRehearsals) {
      if (rehearsal.dayOfWeek === 1) { // Monday
        rehearsalIds.monday = rehearsal._id.toString()
      } else if (rehearsal.dayOfWeek === 3) { // Wednesday
        rehearsalIds.wednesday = rehearsal._id.toString()
      } else if (rehearsal.type === 'הרכב') { // Ensemble rehearsal
        rehearsalIds.ensemble = rehearsal._id.toString()
      }
    }
    
    // Update orchestra with rehearsal IDs
    await orchestraCollection.updateOne(
      { _id: ObjectId.createFromHexString(orchestraId) },
      { $set: { rehearsalIds: insertedRehearsals.map(r => r._id.toString()) } }
    )
  })

  afterAll(async () => {
    await closeDB()
  })

  describe('GET /api/rehearsal', () => {
    it('should allow admin to get all rehearsals', async () => {
      const response = await request(app)
        .get('/api/rehearsal')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(Array.isArray(response.body)).toBe(true)
      expect(response.body.length).toBeGreaterThan(0)
      expect(response.body[0]).toHaveProperty('groupId')
      expect(response.body[0]).toHaveProperty('type')
      expect(response.body[0]).toHaveProperty('date')
      expect(response.body[0]).toHaveProperty('startTime')
      expect(response.body[0]).toHaveProperty('endTime')
    })

    it('should allow conductor to get all rehearsals', async () => {
      const response = await request(app)
        .get('/api/rehearsal')
        .set('Authorization', `Bearer ${conductorToken}`)

      expect(response.status).toBe(200)
      expect(Array.isArray(response.body)).toBe(true)
    })

    it('should allow teacher to get all rehearsals', async () => {
      const response = await request(app)
        .get('/api/rehearsal')
        .set('Authorization', `Bearer ${teacherToken}`)

      expect(response.status).toBe(200)
      expect(Array.isArray(response.body)).toBe(true)
    })

    it('should filter rehearsals by groupId (orchestraId)', async () => {
      const response = await request(app)
        .get(`/api/rehearsal?groupId=${orchestraIds.beginners}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(Array.isArray(response.body)).toBe(true)
      expect(response.body.length).toBeGreaterThan(0)
      expect(response.body[0].groupId).toBe(orchestraIds.beginners)
    })

    it('should filter rehearsals by type', async () => {
      const response = await request(app)
        .get('/api/rehearsal?type=תזמורת')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(Array.isArray(response.body)).toBe(true)
      expect(response.body.length).toBeGreaterThan(0)
      expect(response.body[0].type).toBe('תזמורת')
    })

    it('should filter rehearsals by date range', async () => {
      const todayDate = new Date().toISOString().split('T')[0]
      const futureDate = new Date()
      futureDate.setMonth(futureDate.getMonth() + 1)
      const futureDateStr = futureDate.toISOString().split('T')[0]

      const response = await request(app)
        .get(`/api/rehearsal?fromDate=${todayDate}&toDate=${futureDateStr}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(Array.isArray(response.body)).toBe(true)
    })

    it('should reject unauthorized access', async () => {
      const response = await request(app)
        .get('/api/rehearsal')

      expect(response.status).toBe(401)
      expect(response.body).toHaveProperty('error')
    })
  })

  describe('GET /api/rehearsal/:id', () => {
    it('should allow admin to get a specific rehearsal', async () => {
      const rehearsalId = rehearsalIds.monday
      
      const response = await request(app)
        .get(`/api/rehearsal/${rehearsalId}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body._id.toString()).toBe(rehearsalId)
      expect(response.body).toHaveProperty('groupId')
      expect(response.body).toHaveProperty('type')
      expect(response.body).toHaveProperty('date')
    })

    it('should allow conductor to get a specific rehearsal', async () => {
      const rehearsalId = rehearsalIds.monday
      
      const response = await request(app)
        .get(`/api/rehearsal/${rehearsalId}`)
        .set('Authorization', `Bearer ${conductorToken}`)

      expect(response.status).toBe(200)
      expect(response.body._id.toString()).toBe(rehearsalId)
    })

    it('should allow teacher to get a specific rehearsal', async () => {
      const rehearsalId = rehearsalIds.monday
      
      const response = await request(app)
        .get(`/api/rehearsal/${rehearsalId}`)
        .set('Authorization', `Bearer ${teacherToken}`)

      expect(response.status).toBe(200)
      expect(response.body._id.toString()).toBe(rehearsalId)
    })

    it('should return 500 for non-existent rehearsal', async () => {
      const nonExistentId = new ObjectId().toString()
      const response = await request(app)
        .get(`/api/rehearsal/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(500)
      expect(response.body).toHaveProperty('error')
    })
  })

  describe('GET /api/rehearsal/orchestra/:orchestraId', () => {
    it('should allow admin to get rehearsals for a specific orchestra', async () => {
      const orchestraId = orchestraIds.beginners
      
      const response = await request(app)
        .get(`/api/rehearsal/orchestra/${orchestraId}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(Array.isArray(response.body)).toBe(true)
      expect(response.body.length).toBeGreaterThan(0)
      expect(response.body[0].groupId).toBe(orchestraId)
    })

    it('should allow conductor to get rehearsals for their orchestra', async () => {
      const orchestraId = orchestraIds.beginners
      
      const response = await request(app)
        .get(`/api/rehearsal/orchestra/${orchestraId}`)
        .set('Authorization', `Bearer ${conductorToken}`)

      expect(response.status).toBe(200)
      expect(Array.isArray(response.body)).toBe(true)
    })

    it('should filter orchestra rehearsals by date range', async () => {
      const orchestraId = orchestraIds.beginners
      const todayDate = new Date().toISOString().split('T')[0]
      const futureDate = new Date()
      futureDate.setMonth(futureDate.getMonth() + 1)
      const futureDateStr = futureDate.toISOString().split('T')[0]

      const response = await request(app)
        .get(`/api/rehearsal/orchestra/${orchestraId}?fromDate=${todayDate}&toDate=${futureDateStr}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(Array.isArray(response.body)).toBe(true)
    })

    it('should return empty array for non-existent orchestra', async () => {
      const nonExistentId = new ObjectId().toString()
      const response = await request(app)
        .get(`/api/rehearsal/orchestra/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(Array.isArray(response.body)).toBe(true)
      expect(response.body.length).toBe(0)
    })
  })

  describe('POST /api/rehearsal', () => {
    it('should allow admin to add a new rehearsal with valid data', async () => {
      const newRehearsal = {
        groupId: orchestraIds.beginners,
        type: 'תזמורת',
        date: new Date('2024-05-14T16:00:00'), // Tuesday
        dayOfWeek: 2,
        startTime: '16:00',
        endTime: '18:00',
        location: 'אולם קונצרטים',
        attendance: {
          present: [],
          absent: []
        },
        notes: 'חזרה חדשה',
        schoolYearId: currentSchoolYearId,
        isActive: true
      }

      const response = await request(app)
        .post('/api/rehearsal')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newRehearsal)

      expect(response.status).toBe(201)
      expect(response.body).toHaveProperty('id')
      expect(response.body.groupId).toBe(orchestraIds.beginners)
      expect(response.body.type).toBe('תזמורת')
      expect(response.body.location).toBe('אולם קונצרטים')

      // Check that the rehearsal was associated with the orchestra
      const orchestraCollection = await getCollection('orchestra')
      const orchestra = await orchestraCollection.findOne({
        _id: ObjectId.createFromHexString(orchestraIds.beginners)
      })
      expect(orchestra.rehearsalIds).toContain(response.body.id.toString())
    })

    it('should allow conductor to add a new rehearsal for their orchestra', async () => {
      const newRehearsal = {
        groupId: orchestraIds.beginners,
        type: 'תזמורת',
        date: new Date('2024-05-14T16:00:00'), // Tuesday
        dayOfWeek: 2,
        startTime: '16:00',
        endTime: '18:00',
        location: 'אולם קונצרטים',
        attendance: {
          present: [],
          absent: []
        },
        notes: 'חזרה חדשה של המנצח',
        schoolYearId: currentSchoolYearId,
        isActive: true
      }

      const response = await request(app)
        .post('/api/rehearsal')
        .set('Authorization', `Bearer ${conductorToken}`)
        .send(newRehearsal)

      expect(response.status).toBe(201)
      expect(response.body).toHaveProperty('id')
      expect(response.body.type).toBe('תזמורת')
    })

    it('should not allow teacher to add a new rehearsal', async () => {
      const newRehearsal = {
        groupId: orchestraIds.beginners,
        type: 'תזמורת',
        date: new Date('2024-05-14T16:00:00'),
        dayOfWeek: 2,
        startTime: '16:00',
        endTime: '18:00',
        location: 'אולם קונצרטים',
        schoolYearId: currentSchoolYearId,
        isActive: true
      }

      const response = await request(app)
        .post('/api/rehearsal')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(newRehearsal)

      expect(response.status).toBe(403)
      expect(response.body).toHaveProperty('error')
    })

    it('should not allow conductor to add a rehearsal for another conductor\'s orchestra', async () => {
      // First, create a new conductor
      const newConductor = {
        personalInfo: {
          fullName: 'מנצח חדש',
          phone: '0541234567',
          email: 'newconductor@test.com',
          address: 'כתובת חדשה',
        },
        roles: ['מנצח'],
        professionalInfo: {
          instrument: 'חצוצרה',
          isActive: true,
        },
        conducting: {
          orchestraIds: [],
        },
        credentials: {
          email: 'newconductor@test.com',
          password: 'password123',
        },
        isActive: true
      }

      const teacherCollection = await getCollection('teacher')
      const newConductorResult = await teacherCollection.insertOne(newConductor)
      const newConductorId = newConductorResult.insertedId

      // Create new orchestra for the new conductor
      const orchestraCollection = await getCollection('orchestra')
      const newOrchestra = {
        name: 'תזמורת עתודה נשיפה',
        type: 'תזמורת',
        conductorId: newConductorId.toString(),
        memberIds: [],
        rehearsalIds: [],
        schoolYearId: currentSchoolYearId,
        isActive: true
      }

      const newOrchestraResult = await orchestraCollection.insertOne(newOrchestra)
      const newOrchestraId = newOrchestraResult.insertedId.toString()

      // Try to add a rehearsal to the new orchestra with original conductor
      const newRehearsal = {
        groupId: newOrchestraId,
        type: 'תזמורת',
        date: new Date('2024-05-14T16:00:00'),
        dayOfWeek: 2,
        startTime: '16:00',
        endTime: '18:00',
        location: 'אולם קונצרטים',
        schoolYearId: currentSchoolYearId,
        isActive: true
      }

      const response = await request(app)
        .post('/api/rehearsal')
        .set('Authorization', `Bearer ${conductorToken}`)
        .send(newRehearsal)

      expect(response.status).toBe(403)
      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toContain('Not authorized')
    })

    it('should validate required fields when adding a rehearsal', async () => {
      const incompleteRehearsal = {
        // Missing required groupId
        type: 'תזמורת',
        date: new Date('2024-05-14T16:00:00'),
        dayOfWeek: 2,
        startTime: '16:00',
        endTime: '18:00',
        location: 'אולם קונצרטים',
        schoolYearId: currentSchoolYearId
      }

      const response = await request(app)
        .post('/api/rehearsal')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(incompleteRehearsal)

      expect(response.status).toBe(500)
      expect(response.body).toHaveProperty('error')
    })

    it('should validate rehearsal type with VALID_REHEARSAL_TYPES', async () => {
      const invalidTypeRehearsal = {
        groupId: orchestraIds.beginners,
        type: 'סוג לא חוקי', // Invalid type
        date: new Date('2024-05-14T16:00:00'),
        dayOfWeek: 2,
        startTime: '16:00',
        endTime: '18:00',
        location: 'אולם קונצרטים',
        schoolYearId: currentSchoolYearId
      }

      const response = await request(app)
        .post('/api/rehearsal')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidTypeRehearsal)

      expect(response.status).toBe(500)
      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toContain('Validation error')
    })

    it('should validate dayOfWeek is between 0-6', async () => {
      const invalidDayRehearsal = {
        groupId: orchestraIds.beginners,
        type: 'תזמורת',
        date: new Date('2024-05-14T16:00:00'),
        dayOfWeek: 7, // Invalid day (valid is 0-6)
        startTime: '16:00',
        endTime: '18:00',
        location: 'אולם קונצרטים',
        schoolYearId: currentSchoolYearId
      }

      const response = await request(app)
        .post('/api/rehearsal')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidDayRehearsal)

      expect(response.status).toBe(500)
      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toContain('Validation error')
    })

    it('should validate time format', async () => {
      const invalidTimeRehearsal = {
        groupId: orchestraIds.beginners,
        type: 'תזמורת',
        date: new Date('2024-05-14T16:00:00'),
        dayOfWeek: 2,
        startTime: '16:00',
        endTime: '24:00', // Invalid time (max is 23:59)
        location: 'אולם קונצרטים',
        schoolYearId: currentSchoolYearId
      }

      const response = await request(app)
        .post('/api/rehearsal')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidTimeRehearsal)

      expect(response.status).toBe(500)
      expect(response.body).toHaveProperty('error')
    })
  })

  describe('PUT /api/rehearsal/:id', () => {
    it('should allow admin to update a rehearsal', async () => {
      const rehearsalId = rehearsalIds.monday
      const updatedRehearsal = {
        groupId: orchestraIds.beginners,
        type: 'תזמורת',
        date: new Date('2024-04-01T17:00:00'), // New time
        dayOfWeek: 1,
        startTime: '17:00', // Changed from original
        endTime: '19:00',   // Changed from original
        location: 'אולם מעודכן', // New location
        attendance: {
          present: [],
          absent: []
        },
        notes: 'חזרה מעודכנת',
        schoolYearId: currentSchoolYearId,
        isActive: true
      }

      const response = await request(app)
        .put(`/api/rehearsal/${rehearsalId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedRehearsal)

      expect(response.status).toBe(200)
      expect(response.body._id.toString()).toBe(rehearsalId)
      expect(response.body.startTime).toBe('17:00')
      expect(response.body.endTime).toBe('19:00')
      expect(response.body.location).toBe('אולם מעודכן')
    })

    it('should allow conductor to update their orchestra\'s rehearsal', async () => {
      const rehearsalId = rehearsalIds.monday
      const updatedRehearsal = {
        groupId: orchestraIds.beginners,
        type: 'תזמורת',
        date: new Date('2024-04-01T16:00:00'),
        dayOfWeek: 1,
        startTime: '16:00',
        endTime: '18:00',
        location: 'אולם מנצח מעודכן',
        attendance: {
          present: [],
          absent: []
        },
        notes: 'עדכון מנצח',
        schoolYearId: currentSchoolYearId,
        isActive: true
      }

      const response = await request(app)
        .put(`/api/rehearsal/${rehearsalId}`)
        .set('Authorization', `Bearer ${conductorToken}`)
        .send(updatedRehearsal)

      expect(response.status).toBe(200)
      expect(response.body.location).toBe('אולם מנצח מעודכן')
    })

    it('should not allow teacher to update a rehearsal', async () => {
      const rehearsalId = rehearsalIds.monday
      const updatedRehearsal = {
        groupId: orchestraIds.beginners,
        type: 'תזמורת',
        date: new Date('2024-04-01T16:00:00'),
        dayOfWeek: 1,
        startTime: '16:00',
        endTime: '18:00',
        location: 'אולם מורה מעודכן',
        attendance: {
          present: [],
          absent: []
        },
        notes: 'עדכון מורה',
        schoolYearId: currentSchoolYearId,
        isActive: true
      }

      const response = await request(app)
        .put(`/api/rehearsal/${rehearsalId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(updatedRehearsal)

      expect(response.status).toBe(403)
      expect(response.body).toHaveProperty('error')
    })

    it('should not allow conductor to update another conductor\'s orchestra rehearsal', async () => {
      // First, create a new conductor and orchestra with a rehearsal
      const teacherCollection = await getCollection('teacher')
      const newConductor = {
        personalInfo: {
          fullName: 'מנצח חדש',
          phone: '0541234567',
          email: 'newconductor@test.com',
          address: 'כתובת חדשה',
        },
        roles: ['מנצח'],
        professionalInfo: {
          instrument: 'חצוצרה',
          isActive: true,
        },
        conducting: {
          orchestraIds: [],
        },
        credentials: {
          email: 'newconductor@test.com',
          password: 'password123',
        },
        isActive: true
      }
      const newConductorResult = await teacherCollection.insertOne(newConductor)
      const newConductorId = newConductorResult.insertedId.toString()

      const orchestraCollection = await getCollection('orchestra')
      const newOrchestra = {
        name: 'תזמורת עתודה נשיפה',
        type: 'תזמורת',
        conductorId: newConductorId,
        memberIds: [],
        rehearsalIds: [],
        schoolYearId: currentSchoolYearId,
        isActive: true
      }
      const newOrchestraResult = await orchestraCollection.insertOne(newOrchestra)
      const newOrchestraId = newOrchestraResult.insertedId.toString()

      // Add a rehearsal for the new orchestra
      const rehearsalCollection = await getCollection('rehearsal')
      const newRehearsal = {
        groupId: newOrchestraId,
        type: 'תזמורת',
        date: new Date('2024-05-14T16:00:00'),
        dayOfWeek: 2,
        startTime: '16:00',
        endTime: '18:00',
        location: 'אולם קונצרטים',
        attendance: {
          present: [],
          absent: []
        },
        schoolYearId: currentSchoolYearId,
        isActive: true
      }
      const newRehearsalResult = await rehearsalCollection.insertOne(newRehearsal)
      const newRehearsalId = newRehearsalResult.insertedId.toString()

      // Try to update with original conductor
      const updatedRehearsal = {
        ...newRehearsal,
        location: 'ניסיון עדכון אסור'
      }

      const response = await request(app)
        .put(`/api/rehearsal/${newRehearsalId}`)
        .set('Authorization', `Bearer ${conductorToken}`)
        .send(updatedRehearsal)

      expect(response.status).toBe(403)
      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toContain('Not authorized')
    })

    it('should validate type is from VALID_REHEARSAL_TYPES during update', async () => {
      const rehearsalId = rehearsalIds.monday
      const updatedRehearsal = {
        groupId: orchestraIds.beginners,
        type: 'סוג לא חוקי', // Invalid type
        date: new Date('2024-04-01T16:00:00'),
        dayOfWeek: 1,
        startTime: '16:00',
        endTime: '18:00',
        location: 'אולם מעודכן',
        schoolYearId: currentSchoolYearId,
        isActive: true
      }

      const response = await request(app)
        .put(`/api/rehearsal/${rehearsalId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedRehearsal)

      expect(response.status).toBe(500)
      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toContain('Validation error')
    })
  })

  describe('DELETE /api/rehearsal/:id', () => {
    it('should allow admin to soft-delete a rehearsal', async () => {
      const rehearsalId = rehearsalIds.monday
      const response = await request(app)
        .delete(`/api/rehearsal/${rehearsalId}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
    
      // Check that the rehearsal was soft-deleted
      const rehearsalCollection = await getCollection('rehearsal')
      const deletedRehearsal = await rehearsalCollection.findOne({
        _id: ObjectId.createFromHexString(rehearsalId)
      })
      expect(deletedRehearsal.isActive).toBe(false)
    
      // Check that the rehearsal was removed from the orchestra
      const orchestraCollection = await getCollection('orchestra')
      const orchestra = await orchestraCollection.findOne({
        _id: ObjectId.createFromHexString(orchestraIds.beginners)
      })
      expect(orchestra.rehearsalIds).not.toContain(rehearsalId)
    })

    it('should allow conductor to delete their orchestra\'s rehearsal', async () => {
      const rehearsalId = rehearsalIds.wednesday
      const response = await request(app)
        .delete(`/api/rehearsal/${rehearsalId}`)
        .set('Authorization', `Bearer ${conductorToken}`)

      expect(response.status).toBe(200)
    
      // Check that the rehearsal was soft-deleted
      const rehearsalCollection = await getCollection('rehearsal')
      const deletedRehearsal = await rehearsalCollection.findOne({
        _id: ObjectId.createFromHexString(rehearsalId)
      })
      expect(deletedRehearsal.isActive).toBe(false)
    })

    it('should not allow teacher to delete a rehearsal', async () => {
      const rehearsalId = rehearsalIds.monday
      const response = await request(app)
        .delete(`/api/rehearsal/${rehearsalId}`)
        .set('Authorization', `Bearer ${teacherToken}`)

      expect(response.status).toBe(403)
      expect(response.body).toHaveProperty('error')
    })

    it('should not allow conductor to delete another conductor\'s orchestra rehearsal', async () => {
      // First, create a new conductor and orchestra with a rehearsal
      const teacherCollection = await getCollection('teacher')
      const newConductor = {
        personalInfo: {
          fullName: 'מנצח חדש',
          phone: '0541234567',
          email: 'newconductor@test.com',
          address: 'כתובת חדשה',
        },
        roles: ['מנצח'],
        professionalInfo: {
          instrument: 'חצוצרה',
          isActive: true,
        },
        conducting: {
          orchestraIds: [],
        },
        credentials: {
          email: 'newconductor@test.com',
          password: 'password123',
        },
        isActive: true
      }
      const newConductorResult = await teacherCollection.insertOne(newConductor)
      const newConductorId = newConductorResult.insertedId.toString()

      const orchestraCollection = await getCollection('orchestra')
      const newOrchestra = {
        name: 'תזמורת עתודה נשיפה',
        type: 'תזמורת',
        conductorId: newConductorId,
        memberIds: [],
        rehearsalIds: [],
        schoolYearId: currentSchoolYearId,
        isActive: true
      }
      const newOrchestraResult = await orchestraCollection.insertOne(newOrchestra)
      const newOrchestraId = newOrchestraResult.insertedId.toString()

      // Add a rehearsal for the new orchestra
      const rehearsalCollection = await getCollection('rehearsal')
      const newRehearsal = {
        groupId: newOrchestraId,
        type: 'תזמורת',
        date: new Date('2024-05-14T16:00:00'),
        dayOfWeek: 2,
        startTime: '16:00',
        endTime: '18:00',
        location: 'אולם קונצרטים',
        attendance: {
          present: [],
          absent: []
        },
        schoolYearId: currentSchoolYearId,
        isActive: true
      }
      const newRehearsalResult = await rehearsalCollection.insertOne(newRehearsal)
      const newRehearsalId = newRehearsalResult.insertedId.toString()

      // Try to delete with original conductor
      const response = await request(app)
        .delete(`/api/rehearsal/${newRehearsalId}`)
        .set('Authorization', `Bearer ${conductorToken}`)

      expect(response.status).toBe(403)
      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toContain('Not authorized')
    })
  })

  describe('POST /api/rehearsal/bulk-create', () => {
    it('should allow admin to bulk create rehearsals', async () => {
      const bulkCreateData = {
        orchestraId: orchestraIds.beginners,
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-07-01'),
        dayOfWeek: 2, // Tuesday
        startTime: '17:00',
        endTime: '19:00',
        location: 'אולם התזמורת',
        notes: 'חזרות קיץ'
      }

      const response = await request(app)
        .post('/api/rehearsal/bulk-create')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(bulkCreateData)

      expect(response.status).toBe(201)
      expect(response.body).toHaveProperty('insertedCount')
      expect(response.body.insertedCount).toBeGreaterThan(0)
      expect(response.body).toHaveProperty('rehearsalIds')
      expect(Array.isArray(response.body.rehearsalIds)).toBe(true)

      // Check that rehearsals were created for Tuesdays between start and end dates
      const rehearsalCollection = await getCollection('rehearsal')
      const createdRehearsals = await rehearsalCollection.find({
        _id: { $in: response.body.rehearsalIds.map(id => ObjectId.createFromHexString(id)) }
      }).toArray()

      // Should have one rehearsal for each Tuesday in the date range
      expect(createdRehearsals.length).toBeGreaterThan(0)
    
      // Check that all created rehearsals have the right properties
      createdRehearsals.forEach(rehearsal => {
        expect(rehearsal.groupId).toBe(orchestraIds.beginners)
        expect(rehearsal.dayOfWeek).toBe(2)
        expect(rehearsal.startTime).toBe('17:00')
        expect(rehearsal.location).toBe('אולם התזמורת')
      
        // Check that the date is on a Tuesday in the correct range
        const date = new Date(rehearsal.date)
        expect(date.getDay()).toBe(2)
        expect(date >= new Date('2024-06-01')).toBe(true)
        expect(date <= new Date('2024-07-01')).toBe(true)
      })

      // Check that all rehearsals were associated with the orchestra
      const orchestraCollection = await getCollection('orchestra')
      const orchestra = await orchestraCollection.findOne({
        _id: ObjectId.createFromHexString(orchestraIds.beginners)
      })
    
      createdRehearsals.forEach(rehearsal => {
        expect(orchestra.rehearsalIds).toContain(rehearsal._id.toString())
      })
    })

    it('should allow conductor to bulk create rehearsals for their orchestra', async () => {
      const bulkCreateData = {
        orchestraId: orchestraIds.beginners,
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-06-15'),
        dayOfWeek: 3, // Wednesday
        startTime: '16:00',
        endTime: '18:00',
        location: 'אולם המנצח',
        notes: 'חזרות נוספות'
      }

      const response = await request(app)
        .post('/api/rehearsal/bulk-create')
        .set('Authorization', `Bearer ${conductorToken}`)
        .send(bulkCreateData)

      expect(response.status).toBe(201)
      expect(response.body.insertedCount).toBeGreaterThan(0)
    })

    it('should not allow teacher to bulk create rehearsals', async () => {
      const bulkCreateData = {
        orchestraId: orchestraIds.beginners,
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-07-01'),
        dayOfWeek: 2,
        startTime: '17:00',
        endTime: '19:00',
        location: 'אולם המורה',
        notes: 'חזרות של המורה'
      }

      const response = await request(app)
        .post('/api/rehearsal/bulk-create')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(bulkCreateData)

      expect(response.status).toBe(403)
      expect(response.body).toHaveProperty('error')
    })

    it('should not allow conductor to bulk create rehearsals for another conductor\'s orchestra', async () => {
      // First create a new conductor and orchestra
      const teacherCollection = await getCollection('teacher')
      const newConductor = {
        personalInfo: {
          fullName: 'מנצח חדש',
          phone: '0541234567',
          email: 'newconductor@test.com',
          address: 'כתובת חדשה',
        },
        roles: ['מנצח'],
        professionalInfo: {
          instrument: 'חצוצרה',
          isActive: true,
        },
        conducting: {
          orchestraIds: [],
        },
        credentials: {
          email: 'newconductor@test.com',
          password: 'password123',
        },
        isActive: true
      }
      const newConductorResult = await teacherCollection.insertOne(newConductor)
      const newConductorId = newConductorResult.insertedId.toString()

      const orchestraCollection = await getCollection('orchestra')
      const newOrchestra = {
        name: 'תזמורת עתודה נשיפה',
        type: 'תזמורת',
        conductorId: newConductorId,
        memberIds: [],
        rehearsalIds: [],
        schoolYearId: currentSchoolYearId,
        isActive: true
      }
      const newOrchestraResult = await orchestraCollection.insertOne(newOrchestra)
      const newOrchestraId = newOrchestraResult.insertedId.toString()

      // Try to bulk create rehearsals for the new orchestra using the original conductor
      const bulkCreateData = {
        orchestraId: newOrchestraId,
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-07-01'),
        dayOfWeek: 2,
        startTime: '17:00',
        endTime: '19:00',
        location: 'אולם לא מורשה',
        notes: 'ניסיון לא מורשה'
      }

      const response = await request(app)
        .post('/api/rehearsal/bulk-create')
        .set('Authorization', `Bearer ${conductorToken}`)
        .send(bulkCreateData)

      expect(response.status).toBe(403)
      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toContain('Not authorized')
    })

    it('should validate date range for bulk create (end date must be after start date)', async () => {
      const invalidDateRangeData = {
        orchestraId: orchestraIds.beginners,
        startDate: new Date('2024-07-01'), // Start date is after end date
        endDate: new Date('2024-06-01'),
        dayOfWeek: 2,
        startTime: '17:00',
        endTime: '19:00',
        location: 'אולם התזמורת'
      }

      const response = await request(app)
        .post('/api/rehearsal/bulk-create')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidDateRangeData)

      expect(response.status).toBe(500)
      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toContain('Validation error')
    })

    it('should handle exclude dates option when bulk creating rehearsals', async () => {
      // Get a Tuesday date during the range
      const startDate = new Date('2024-06-01')
      const tuesdayToExclude = new Date('2024-06-04') // First Tuesday in June 2024
    
      const bulkCreateData = {
        orchestraId: orchestraIds.beginners,
        startDate: startDate,
        endDate: new Date('2024-06-20'),
        dayOfWeek: 2, // Tuesday
        startTime: '17:00',
        endTime: '19:00',
        location: 'אולם התזמורת',
        excludeDates: [tuesdayToExclude]
      }

      const response = await request(app)
        .post('/api/rehearsal/bulk-create')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(bulkCreateData)

      expect(response.status).toBe(201)
    
      // Check that rehearsals were created for all Tuesdays EXCEPT the excluded one
      const rehearsalCollection = await getCollection('rehearsal')
      const createdRehearsals = await rehearsalCollection.find({
        _id: { $in: response.body.rehearsalIds.map(id => ObjectId.createFromHexString(id)) }
      }).toArray()
    
      // Ensure no rehearsal was created on the excluded date
      const excludedDateFound = createdRehearsals.some(rehearsal => {
        const rehearsalDate = new Date(rehearsal.date)
        return rehearsalDate.toDateString() === tuesdayToExclude.toDateString()
      })
    
      expect(excludedDateFound).toBe(false)
    })
  })

  describe('PUT /api/rehearsal/:rehearsalId/attendance', () => {
    it('should allow admin to update rehearsal attendance', async () => {
      const rehearsalId = rehearsalIds.monday
    
      const attendanceData = {
        present: [
          Object.values(students)[0]._id.toString(),
          Object.values(students)[1]._id.toString()
        ],
        absent: [
          Object.values(students)[2]._id.toString()
        ]
      }
    
      const response = await request(app)
        .put(`/api/rehearsal/${rehearsalId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(attendanceData)

      expect(response.status).toBe(200)
      expect(response.body.attendance.present).toEqual(attendanceData.present)
      expect(response.body.attendance.absent).toEqual(attendanceData.absent)
    
      // Check that attendance records were created in activity_attendance collection
      const attendanceCollection = await getCollection('activity_attendance')
      const attendanceRecords = await attendanceCollection.find({
        sessionId: rehearsalId
      }).toArray()
    
      expect(attendanceRecords.length).toBe(3) // Total of present + absent students
    
      // Check present students have correct status
      const presentRecords = attendanceRecords.filter(rec =>
        attendanceData.present.includes(rec.studentId) &&
        rec.status === 'הגיע/ה'
      )
      expect(presentRecords.length).toBe(2)
    
      // Check absent students have correct status
      const absentRecords = attendanceRecords.filter(rec =>
        attendanceData.absent.includes(rec.studentId) &&
        rec.status === 'לא הגיע/ה'
      )
      expect(absentRecords.length).toBe(1)
    })

    it('should allow conductor to update rehearsal attendance for their orchestra', async () => {
      const rehearsalId = rehearsalIds.monday
    
      const attendanceData = {
        present: [Object.values(students)[0]._id.toString()],
        absent: [
          Object.values(students)[1]._id.toString(),
          Object.values(students)[2]._id.toString()
        ]
      }
    
      const response = await request(app)
        .put(`/api/rehearsal/${rehearsalId}/attendance`)
        .set('Authorization', `Bearer ${conductorToken}`)
        .send(attendanceData)

      expect(response.status).toBe(200)
      expect(response.body.attendance.present).toEqual(attendanceData.present)
      expect(response.body.attendance.absent).toEqual(attendanceData.absent)
    })

    it('should not allow teacher to update rehearsal attendance', async () => {
      const rehearsalId = rehearsalIds.monday
    
      const attendanceData = {
        present: [Object.values(students)[0]._id.toString()],
        absent: [Object.values(students)[1]._id.toString()]
      }
    
      const response = await request(app)
        .put(`/api/rehearsal/${rehearsalId}/attendance`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(attendanceData)

      expect(response.status).toBe(403)
      expect(response.body).toHaveProperty('error')
    })
  })
})