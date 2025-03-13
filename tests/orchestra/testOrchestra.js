import request from 'supertest'
import { setupTestApp } from '../setup-test-server.js'
import { connectDB, closeDB, clearDB, getCollection } from '../test-db-config.js'
import { setupTestUsers, generateTokens } from '../fixtures/auth.fixtures.js'
import { setupTestSchoolYears } from '../school-year.fixtures.js'
import { setupTestStudents } from '../fixtures/student.fixtures.js'
import { setupTestOrchestras } from '../fixtures/orchestra.fixtures.js'
import { setupTestRehearsals } from '../fixtures/rehearsal.fixtures.js'
import { ObjectId } from 'mongodb'
import { ORCHESTRA_CONSTANTS } from '../../api/orchestra/orchestra.validation.js'

process.env.ACCESS_TOKEN_SECRET = 'test-access-token-secret'
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-token-secret'

describe('Orchestra API Tests', () => {
  let app
  let testUsers
  let adminId, teacherId, conductorId
  let adminToken, teacherToken, conductorToken
  let schoolYears
  let currentSchoolYearId
  let students
  let orchestraIds = {}

  beforeAll(async () => {
    await connectDB()
    app = await setupTestApp()
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
    
    // Map orchestra names to their IDs for easier reference in tests
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
  })

  afterAll(async () => {
    await closeDB()
  })

  describe('GET /api/orchestra', () => {
    it('should allow admin to get all orchestras', async () => {
      const response = await request(app)
        .get('/api/orchestra')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(Array.isArray(response.body)).toBe(true)
      expect(response.body.length).toBeGreaterThan(0)
      expect(response.body[0]).toHaveProperty('name')
      expect(response.body[0]).toHaveProperty('conductorId')
      expect(response.body[0]).toHaveProperty('memberIds')
    })

    it('should allow conductor to get all orchestras', async () => {
      const response = await request(app)
        .get('/api/orchestra')
        .set('Authorization', `Bearer ${conductorToken}`)

      expect(response.status).toBe(200)
      expect(Array.isArray(response.body)).toBe(true)
    })

    it('should allow teacher to get all orchestras', async () => {
      const response = await request(app)
        .get('/api/orchestra')
        .set('Authorization', `Bearer ${teacherToken}`)

      expect(response.status).toBe(200)
      expect(Array.isArray(response.body)).toBe(true)
    })

    it('should filter orchestras by name', async () => {
      const response = await request(app)
        .get('/api/orchestra?name=מתחילים')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(Array.isArray(response.body)).toBe(true)
      expect(response.body.length).toBe(1)
      expect(response.body[0].name).toBe('תזמורת מתחילים נשיפה')
    })

    it('should filter orchestras by type', async () => {
      const response = await request(app)
        .get('/api/orchestra?type=הרכב')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(Array.isArray(response.body)).toBe(true)
      expect(response.body.length).toBeGreaterThan(0)
      expect(response.body[0].type).toBe('הרכב')
    })

    it('should filter orchestras by conductorId', async () => {
      const response = await request(app)
        .get(`/api/orchestra?conductorId=${conductorId}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(Array.isArray(response.body)).toBe(true)
      expect(response.body.length).toBeGreaterThan(0)
    })

    it('should reject unauthorized access', async () => {
      const response = await request(app)
        .get('/api/orchestra')

      expect(response.status).toBe(401)
      expect(response.body).toHaveProperty('error')
    })
  })

  describe('GET /api/orchestra/:id', () => {
    it('should allow admin to get a specific orchestra', async () => {
      const orchestraId = orchestraIds.beginners
      
      const response = await request(app)
        .get(`/api/orchestra/${orchestraId}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body._id.toString()).toBe(orchestraId)
      expect(response.body.name).toBe('תזמורת מתחילים נשיפה')
    })

    it('should allow conductor to get their own orchestra', async () => {
      const orchestraId = orchestraIds.beginners
      
      const response = await request(app)
        .get(`/api/orchestra/${orchestraId}`)
        .set('Authorization', `Bearer ${conductorToken}`)

      expect(response.status).toBe(200)
      expect(response.body._id.toString()).toBe(orchestraId)
    })

    it('should return 500 for non-existent orchestra', async () => {
      const nonExistentId = new ObjectId().toString()
      const response = await request(app)
        .get(`/api/orchestra/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(500)
      expect(response.body).toHaveProperty('error')
    })
  })

  describe('POST /api/orchestra', () => {
    it('should allow admin to add a new orchestra with valid data', async () => {
      const newOrchestra = {
        name: 'תזמורת עתודה נשיפה', // Valid name from the schema
        type: 'תזמורת',
        conductorId: conductorId.toString(),
        memberIds: [Object.values(students)[0]._id.toString()],
        rehearsalIds: [],
        schoolYearId: currentSchoolYearId,
        isActive: true
      }

      const response = await request(app)
        .post('/api/orchestra')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newOrchestra)

      expect(response.status).toBe(201)
      expect(response.body).toHaveProperty('id')
      expect(response.body.name).toBe('תזמורת עתודה נשיפה')

      // Check that the orchestra was associated with the conductor
      const teacherCollection = await getCollection('teacher')
      const conductor = await teacherCollection.findOne({ _id: conductorId })
      expect(conductor.conducting.orchestraIds).toContain(response.body.id.toString())
    })

    it('should not allow admin to add an orchestra with invalid name', async () => {
      const newOrchestra = {
        name: 'תזמורת חדשה', // Invalid name not in the schema
        type: 'תזמורת',
        conductorId: conductorId.toString(),
        memberIds: [Object.values(students)[0]._id.toString()],
        rehearsalIds: [],
        schoolYearId: currentSchoolYearId,
        isActive: true
      }

      const response = await request(app)
        .post('/api/orchestra')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newOrchestra)

      expect(response.status).toBe(500)
      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toContain('Validation error')
    })

    it('should not allow conductor to add a new orchestra', async () => {
      const newOrchestra = {
        name: 'תזמורת עתודה נשיפה',
        type: 'תזמורת',
        conductorId: conductorId.toString(),
        memberIds: [Object.values(students)[0]._id.toString()],
        rehearsalIds: [],
        schoolYearId: currentSchoolYearId,
        isActive: true
      }

      const response = await request(app)
        .post('/api/orchestra')
        .set('Authorization', `Bearer ${conductorToken}`)
        .send(newOrchestra)

      expect(response.status).toBe(403)
      expect(response.body).toHaveProperty('error')
    })

    it('should validate required fields when adding an orchestra', async () => {
      const incompleteOrchestra = {
        name: 'תזמורת עתודה נשיפה',
        type: 'תזמורת',
        // Missing conductorId which is required
        memberIds: [Object.values(students)[0]._id.toString()],
        rehearsalIds: [],
        schoolYearId: currentSchoolYearId,
        isActive: true
      }

      const response = await request(app)
        .post('/api/orchestra')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(incompleteOrchestra)

      expect(response.status).toBe(500)
      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toContain('Validation error')
    })
  })

  describe('PUT /api/orchestra/:id', () => {
    it('should allow admin to update an orchestra with valid data', async () => {
      const orchestraId = orchestraIds.beginners
      const orchestraUpdate = {
        name: 'תזמורת מתחילים נשיפה', // Same valid name
        type: 'תזמורת',
        conductorId: conductorId.toString(),
        memberIds: [Object.values(students)[0]._id.toString(), Object.values(students)[1]._id.toString()],
        rehearsalIds: [],
        schoolYearId: currentSchoolYearId,
        isActive: true
      }

      const response = await request(app)
        .put(`/api/orchestra/${orchestraId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(orchestraUpdate)

      expect(response.status).toBe(200)
      expect(response.body.name).toBe('תזמורת מתחילים נשיפה')
      expect(response.body.memberIds.length).toBe(2)
    })

    it('should not allow admin to update with invalid orchestra name', async () => {
      const orchestraId = orchestraIds.beginners
      const orchestraUpdate = {
        name: 'תזמורת שם לא חוקי', // Invalid name
        type: 'תזמורת',
        conductorId: conductorId.toString(),
        memberIds: [Object.values(students)[0]._id.toString()],
        rehearsalIds: [],
        schoolYearId: currentSchoolYearId,
        isActive: true
      }

      const response = await request(app)
        .put(`/api/orchestra/${orchestraId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(orchestraUpdate)

      expect(response.status).toBe(500)
      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toContain('Validation error')
    })

    it('should allow admin to change orchestra type from valid types', async () => {
      const orchestraId = orchestraIds.beginners
      const orchestraUpdate = {
        name: 'תזמורת מתחילים נשיפה',
        type: 'הרכב', // Changed from 'תזמורת' to 'הרכב'
        conductorId: conductorId.toString(),
        memberIds: [Object.values(students)[0]._id.toString()],
        rehearsalIds: [],
        schoolYearId: currentSchoolYearId,
        isActive: true
      }

      const response = await request(app)
        .put(`/api/orchestra/${orchestraId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(orchestraUpdate)

      expect(response.status).toBe(200)
      expect(response.body.type).toBe('הרכב')
    })

    it('should allow conductor to update their own orchestra', async () => {
      const orchestraId = orchestraIds.beginners
      const orchestraUpdate = {
        name: 'תזמורת מתחילים נשיפה',
        type: 'תזמורת',
        conductorId: conductorId.toString(),
        memberIds: [Object.values(students)[0]._id.toString(), Object.values(students)[1]._id.toString()],
        rehearsalIds: [],
        schoolYearId: currentSchoolYearId,
        isActive: true
      }

      const response = await request(app)
        .put(`/api/orchestra/${orchestraId}`)
        .set('Authorization', `Bearer ${conductorToken}`)
        .send(orchestraUpdate)

      expect(response.status).toBe(200)
      expect(response.body.memberIds.length).toBe(2)
    })

    it('should allow admin to change orchestra to another valid name', async () => {
      const orchestraId = orchestraIds.beginners
      // Get a different valid name from the constants
      const differentValidName = ORCHESTRA_CONSTANTS.VALID_NAMES.find(
        name => name !== 'תזמורת מתחילים נשיפה'
      )

      const orchestraUpdate = {
        name: differentValidName,
        type: 'תזמורת',
        conductorId: conductorId.toString(),
        memberIds: [Object.values(students)[0]._id.toString()],
        rehearsalIds: [],
        schoolYearId: currentSchoolYearId,
        isActive: true
      }

      const response = await request(app)
        .put(`/api/orchestra/${orchestraId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(orchestraUpdate)

      expect(response.status).toBe(200)
      expect(response.body.name).toBe(differentValidName)
    })

    it('should not allow teacher to update an orchestra', async () => {
      const orchestraId = orchestraIds.beginners
      const orchestraUpdate = {
        name: 'תזמורת מתחילים נשיפה',
        type: 'תזמורת',
        conductorId: conductorId.toString(),
        memberIds: [Object.values(students)[0]._id.toString()],
        rehearsalIds: [],
        schoolYearId: currentSchoolYearId,
        isActive: true
      }

      const response = await request(app)
        .put(`/api/orchestra/${orchestraId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(orchestraUpdate)

      expect(response.status).toBe(403)
      expect(response.body).toHaveProperty('error')
    })

    it('should not allow conductor to update another conductor\'s orchestra', async () => {
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

      // Now try to update the new orchestra with the original conductor
      const orchestraUpdate = {
        name: 'תזמורת עתודה נשיפה',
        type: 'תזמורת',
        conductorId: newConductorId.toString(),
        memberIds: [Object.values(students)[0]._id.toString()],
        rehearsalIds: [],
        schoolYearId: currentSchoolYearId,
        isActive: true
      }

      const response = await request(app)
        .put(`/api/orchestra/${newOrchestraId}`)
        .set('Authorization', `Bearer ${conductorToken}`)
        .send(orchestraUpdate)

      expect(response.status).toBe(403)
      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toContain('Not authorized to modify this orchestra')
    })
  })

  describe('DELETE /api/orchestra/:id', () => {
    it('should allow admin to soft-delete an orchestra', async () => {
      const orchestraId = orchestraIds.beginners
      const response = await request(app)
        .delete(`/api/orchestra/${orchestraId}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      
      // Check that the orchestra was soft-deleted
      const orchestraCollection = await getCollection('orchestra')
      const deletedOrchestra = await orchestraCollection.findOne({ _id: ObjectId.createFromHexString(orchestraId) })
      expect(deletedOrchestra.isActive).toBe(false)
      
      // Check that the orchestra was removed from the conductor
      const teacherCollection = await getCollection('teacher')
      const conductor = await teacherCollection.findOne({ _id: conductorId })
      expect(conductor.conducting.orchestraIds).not.toContain(orchestraId)
      
      // Check that the orchestra was removed from all students
      const studentCollection = await getCollection('student')
      const studentsWithOrchestra = await studentCollection.find({ 'enrollments.orchestraIds': orchestraId }).toArray()
      expect(studentsWithOrchestra.length).toBe(0)
    })

    it('should not allow conductor to delete an orchestra (even their own)', async () => {
      // Based on your permissions, only admins can delete orchestras
      const orchestraId = orchestraIds.beginners
      const response = await request(app)
        .delete(`/api/orchestra/${orchestraId}`)
        .set('Authorization', `Bearer ${conductorToken}`)

      expect(response.status).toBe(403)
      expect(response.body).toHaveProperty('error')
    })
  })

  describe('POST /api/orchestra/:id/members', () => {
    it('should allow admin to add a member to an orchestra', async () => {
      const orchestraId = orchestraIds.beginners
      const studentId = Object.values(students)[2]._id.toString() // Student not yet in orchestra
      
      const response = await request(app)
        .post(`/api/orchestra/${orchestraId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ studentId })

      expect(response.status).toBe(200)
      expect(response.body.memberIds).toContain(studentId)
      
      // Check that the student was updated with the orchestra
      const studentCollection = await getCollection('student')
      const student = await studentCollection.findOne({ _id: ObjectId.createFromHexString(studentId) })
      expect(student.enrollments.orchestraIds).toContain(orchestraId)
    })

    it('should allow conductor to add a member to their orchestra', async () => {
      const orchestraId = orchestraIds.beginners
      const studentId = Object.values(students)[2]._id.toString() // Student not yet in orchestra
      
      const response = await request(app)
        .post(`/api/orchestra/${orchestraId}/members`)
        .set('Authorization', `Bearer ${conductorToken}`)
        .send({ studentId })

      expect(response.status).toBe(200)
      expect(response.body.memberIds).toContain(studentId)
    })

    it('should not allow teacher to add a member to an orchestra', async () => {
      const orchestraId = orchestraIds.beginners
      const studentId = Object.values(students)[2]._id.toString()
      
      const response = await request(app)
        .post(`/api/orchestra/${orchestraId}/members`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ studentId })

      expect(response.status).toBe(403)
      expect(response.body).toHaveProperty('error')
    })

    it('should handle attempt to add non-existent student to orchestra', async () => {
      const orchestraId = orchestraIds.beginners
      const nonExistentStudentId = new ObjectId().toString()
      
      const response = await request(app)
        .post(`/api/orchestra/${orchestraId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ studentId: nonExistentStudentId })

      // Your service should handle this case appropriately
      expect(response.status).toBe(500)
    })

    it('should handle attempt to add a student already in the orchestra', async () => {
      const orchestraId = orchestraIds.beginners
      const studentId = Object.values(students)[0]._id.toString() // First student is already in orchestra
      
      // First add the student to ensure they're in the orchestra
      await request(app)
        .post(`/api/orchestra/${orchestraId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ studentId })
      
      // Try adding again
      const response = await request(app)
        .post(`/api/orchestra/${orchestraId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ studentId })

      // Should work because addToSet operation is idempotent
      expect(response.status).toBe(200)
      
      // The student should still be in the orchestra just once
      const orchestraCollection = await getCollection('orchestra')
      const orchestra = await orchestraCollection.findOne({ _id: ObjectId.createFromHexString(orchestraId) })
      const occurrences = orchestra.memberIds.filter(id => id === studentId).length
      expect(occurrences).toBe(1)
    })
  })

  describe('DELETE /api/orchestra/:id/members/:studentId', () => {
    it('should allow admin to remove a member from an orchestra', async () => {
      const orchestraId = orchestraIds.beginners
      const studentId = Object.values(students)[0]._id.toString() // Student already in orchestra
      
      // First ensure student is in orchestra
      await request(app)
        .post(`/api/orchestra/${orchestraId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ studentId })
      
      const response = await request(app)
        .delete(`/api/orchestra/${orchestraId}/members/${studentId}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.memberIds).not.toContain(studentId)
      
      // Check that the student was updated
      const studentCollection = await getCollection('student')
      const student = await studentCollection.findOne({ _id: ObjectId.createFromHexString(studentId) })
      expect(student.enrollments.orchestraIds).not.toContain(orchestraId)
    })

    it('should allow conductor to remove a member from their orchestra', async () => {
      const orchestraId = orchestraIds.beginners
      const studentId = Object.values(students)[0]._id.toString() // Student already in orchestra
      
      // First ensure student is in orchestra
      await request(app)
        .post(`/api/orchestra/${orchestraId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ studentId })
      
      const response = await request(app)
        .delete(`/api/orchestra/${orchestraId}/members/${studentId}`)
        .set('Authorization', `Bearer ${conductorToken}`)

      expect(response.status).toBe(200)
      expect(response.body.memberIds).not.toContain(studentId)
    })

    it('should not allow teacher to remove a member from an orchestra', async () => {
      const orchestraId = orchestraIds.beginners
      const studentId = Object.values(students)[0]._id.toString()
      
      const response = await request(app)
        .delete(`/api/orchestra/${orchestraId}/members/${studentId}`)
        .set('Authorization', `Bearer ${teacherToken}`)

      expect(response.status).toBe(403)
      expect(response.body).toHaveProperty('error')
    })

    it('should handle removing a student who is not in the orchestra', async () => {
      const orchestraId = orchestraIds.beginners
      const studentId = Object.values(students)[2]._id.toString()
      
      // Ensure student is not in orchestra by removing them if they are
      await request(app)
        .delete(`/api/orchestra/${orchestraId}/members/${studentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
      
      // Try removing again
      const response = await request(app)
        .delete(`/api/orchestra/${orchestraId}/members/${studentId}`)
        .set('Authorization', `Bearer ${adminToken}`)

      // Should still return 200 as the operation is idempotent
      expect(response.status).toBe(200)
    })
  })

  describe('GET /api/orchestra/:id/rehearsals/:rehearsalId/attendance', () => {
    let rehearsals = {}

    beforeEach(async () => {
      // Set up rehearsals with attendance records
      const orchestraId = orchestraIds.beginners
      const rehearsalData = setupTestRehearsals(orchestraId, currentSchoolYearId, 
        Object.values(students).map(s => s._id.toString()))
      
      const rehearsalCollection = await getCollection('rehearsal')
      await rehearsalCollection.insertMany(Object.values(rehearsalData))
      
      // Store rehearsal objects with their IDs for reference in tests
      const insertedRehearsals = await rehearsalCollection.find({
        groupId: orchestraId
      }).toArray()

      for (const rehearsal of insertedRehearsals) {
        if (rehearsal.dayOfWeek === 1) { // Monday
          rehearsals.monday = {
            _id: rehearsal._id.toString(),
            date: rehearsal.date
          }
        } else if (rehearsal.dayOfWeek === 3) { // Wednesday
          rehearsals.wednesday = {
            _id: rehearsal._id.toString(),
            date: rehearsal.date
          }
        }
      }
      
      // Update orchestra with rehearsal IDs
      await getCollection('orchestra').updateOne(
        { _id: ObjectId.createFromHexString(orchestraId) },
        { $set: { rehearsalIds: insertedRehearsals.map(r => r._id.toString()) } }
      )
    })
    
    it('should allow admin to get rehearsal attendance', async () => {
      const orchestraId = orchestraIds.beginners
      const rehearsalId = rehearsals.monday._id
      
      const response = await request(app)
        .get(`/api/orchestra/${orchestraId}/rehearsals/${rehearsalId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('present')
      expect(response.body).toHaveProperty('absent')
      expect(Array.isArray(response.body.present)).toBe(true)
     expect(Array.isArray(response.body.absent)).toBe(true)
   })

   it('should allow conductor to get rehearsal attendance for their orchestra', async () => {
     const orchestraId = orchestraIds.beginners
     const rehearsalId = rehearsals.monday._id
     
     const response = await request(app)
       .get(`/api/orchestra/${orchestraId}/rehearsals/${rehearsalId}/attendance`)
       .set('Authorization', `Bearer ${conductorToken}`)

     expect(response.status).toBe(200)
     expect(response.body).toHaveProperty('present')
     expect(response.body).toHaveProperty('absent')
   })

   it('should allow teacher to get rehearsal attendance', async () => {
     const orchestraId = orchestraIds.beginners
     const rehearsalId = rehearsals.monday._id
     
     const response = await request(app)
       .get(`/api/orchestra/${orchestraId}/rehearsals/${rehearsalId}/attendance`)
       .set('Authorization', `Bearer ${teacherToken}`)

     expect(response.status).toBe(200)
   })

   it('should return 500 for non-existent rehearsal', async () => {
     const orchestraId = orchestraIds.beginners
     const nonExistentRehearsalId = new ObjectId().toString()
     
     const response = await request(app)
       .get(`/api/orchestra/${orchestraId}/rehearsals/${nonExistentRehearsalId}/attendance`)
       .set('Authorization', `Bearer ${adminToken}`)

     expect(response.status).toBe(500)
     expect(response.body).toHaveProperty('error')
   })
 })

 describe('PUT /api/orchestra/:id/rehearsals/:rehearsalId/attendance', () => {
   let rehearsals = {}

   beforeEach(async () => {
     // Set up rehearsals with attendance records
     const orchestraId = orchestraIds.beginners
     const rehearsalData = setupTestRehearsals(orchestraId, currentSchoolYearId, 
       Object.values(students).map(s => s._id.toString()))
     
     const rehearsalCollection = await getCollection('rehearsal')
     await rehearsalCollection.insertMany(Object.values(rehearsalData))
     
     // Store rehearsal objects with their IDs for reference in tests
     const insertedRehearsals = await rehearsalCollection.find({
       groupId: orchestraId
     }).toArray()

     for (const rehearsal of insertedRehearsals) {
       if (rehearsal.dayOfWeek === 1) { // Monday
         rehearsals.monday = {
           _id: rehearsal._id.toString(),
           date: rehearsal.date
         }
       } else if (rehearsal.dayOfWeek === 3) { // Wednesday
         rehearsals.wednesday = {
           _id: rehearsal._id.toString(),
           date: rehearsal.date
         }
       }
     }
     
     // Update orchestra with rehearsal IDs
     await getCollection('orchestra').updateOne(
       { _id: ObjectId.createFromHexString(orchestraId) },
       { $set: { rehearsalIds: insertedRehearsals.map(r => r._id.toString()) } }
     )
   })
   
   it('should allow admin to update rehearsal attendance', async () => {
     const orchestraId = orchestraIds.beginners
     const rehearsalId = rehearsals.monday._id
     
     const updatedAttendance = {
       present: [Object.values(students)[0]._id.toString(), Object.values(students)[1]._id.toString()],
       absent: [Object.values(students)[2]._id.toString()]
     }
     
     const response = await request(app)
       .put(`/api/orchestra/${orchestraId}/rehearsals/${rehearsalId}/attendance`)
       .set('Authorization', `Bearer ${adminToken}`)
       .send(updatedAttendance)

     expect(response.status).toBe(200)
     expect(response.body.attendance.present).toEqual(updatedAttendance.present)
     expect(response.body.attendance.absent).toEqual(updatedAttendance.absent)
     
     // Check that attendance records were created
     const attendanceCollection = await getCollection('activity_attendance')
     const attendanceRecords = await attendanceCollection.find({ 
       sessionId: rehearsalId,
       activityType: 'תזמורת'
     }).toArray()
     
     expect(attendanceRecords.length).toBe(3) // Total of present + absent students
   })

   it('should allow conductor to update rehearsal attendance for their orchestra', async () => {
     const orchestraId = orchestraIds.beginners
     const rehearsalId = rehearsals.monday._id
     
     const updatedAttendance = {
       present: [Object.values(students)[0]._id.toString()],
       absent: [Object.values(students)[1]._id.toString(), Object.values(students)[2]._id.toString()]
     }
     
     const response = await request(app)
       .put(`/api/orchestra/${orchestraId}/rehearsals/${rehearsalId}/attendance`)
       .set('Authorization', `Bearer ${conductorToken}`)
       .send(updatedAttendance)

     expect(response.status).toBe(200)
     expect(response.body.attendance.present).toEqual(updatedAttendance.present)
     expect(response.body.attendance.absent).toEqual(updatedAttendance.absent)
   })

   it('should not allow teacher to update rehearsal attendance', async () => {
     const orchestraId = orchestraIds.beginners
     const rehearsalId = rehearsals.monday._id
     
     const updatedAttendance = {
       present: [Object.values(students)[0]._id.toString()],
       absent: [Object.values(students)[1]._id.toString(), Object.values(students)[2]._id.toString()]
     }
     
     const response = await request(app)
       .put(`/api/orchestra/${orchestraId}/rehearsals/${rehearsalId}/attendance`)
       .set('Authorization', `Bearer ${teacherToken}`)
       .send(updatedAttendance)

     expect(response.status).toBe(403)
     expect(response.body).toHaveProperty('error')
   })
   
   it('should validate attendance data format', async () => {
     const orchestraId = orchestraIds.beginners
     const rehearsalId = rehearsals.monday._id
     
     const invalidAttendanceData = {
       // Missing 'absent' field which should be required
       present: [Object.values(students)[0]._id.toString()]
     }
     
     const response = await request(app)
       .put(`/api/orchestra/${orchestraId}/rehearsals/${rehearsalId}/attendance`)
       .set('Authorization', `Bearer ${adminToken}`)
       .send(invalidAttendanceData)

     // Your validation might handle this differently
     expect(response.status).not.toBe(200)
   })
   
   it('should handle invalid student IDs in attendance data', async () => {
     const orchestraId = orchestraIds.beginners
     const rehearsalId = rehearsals.monday._id
     
     const invalidStudentId = new ObjectId().toString()
     const attendanceWithInvalidStudent = {
       present: [invalidStudentId],
       absent: [Object.values(students)[1]._id.toString()]
     }
     
     const response = await request(app)
       .put(`/api/orchestra/${orchestraId}/rehearsals/${rehearsalId}/attendance`)
       .set('Authorization', `Bearer ${adminToken}`)
       .send(attendanceWithInvalidStudent)

     // Should still work, as your service might not validate student existence
     expect(response.status).toBe(200)
   })
 })

 describe('GET /api/orchestra/:orchestraId/student/:studentId/attendance', () => {
   let rehearsals = {}

   beforeEach(async () => {
     // Set up rehearsals with attendance records
     const orchestraId = orchestraIds.beginners
     const rehearsalData = setupTestRehearsals(orchestraId, currentSchoolYearId, 
       Object.values(students).map(s => s._id.toString()))
     
     const rehearsalCollection = await getCollection('rehearsal')
     await rehearsalCollection.insertMany(Object.values(rehearsalData))
     
     // Store rehearsal objects with their IDs for reference in tests
     const insertedRehearsals = await rehearsalCollection.find({
       groupId: orchestraId
     }).toArray()
     
     // Create activity attendance records
     const attendanceCollection = await getCollection('activity_attendance')
     const attendanceRecords = insertedRehearsals.flatMap(rehearsal => {
       const student1Record = {
         studentId: Object.values(students)[0]._id.toString(),
         sessionId: rehearsal._id.toString(),
         activityType: 'תזמורת',
         groupId: orchestraId,
         date: rehearsal.date,
         status: 'הגיע/ה',
         createdAt: new Date()
       }
       
       const student2Record = {
         studentId: Object.values(students)[1]._id.toString(),
         sessionId: rehearsal._id.toString(),
         activityType: 'תזמורת',
         groupId: orchestraId,
         date: rehearsal.date,
         status: 'לא הגיע/ה',
         createdAt: new Date()
       }
       
       return [student1Record, student2Record]
     })
     
     await attendanceCollection.insertMany(attendanceRecords)
   })

   it('should allow admin to get student attendance stats', async () => {
     const orchestraId = orchestraIds.beginners
     const studentId = Object.values(students)[0]._id.toString()
     
     const response = await request(app)
       .get(`/api/orchestra/${orchestraId}/student/${studentId}/attendance`)
       .set('Authorization', `Bearer ${adminToken}`)

     expect(response.status).toBe(200)
     expect(response.body).toHaveProperty('totalRehearsals')
     expect(response.body).toHaveProperty('attended')
     expect(response.body).toHaveProperty('attendanceRate')
     expect(response.body).toHaveProperty('recentHistory')
     expect(Array.isArray(response.body.recentHistory)).toBe(true)
   })

   it('should allow conductor to get student attendance stats', async () => {
     const orchestraId = orchestraIds.beginners
     const studentId = Object.values(students)[0]._id.toString()
     
     const response = await request(app)
       .get(`/api/orchestra/${orchestraId}/student/${studentId}/attendance`)
       .set('Authorization', `Bearer ${conductorToken}`)

     expect(response.status).toBe(200)
     expect(response.body).toHaveProperty('attended')
     expect(response.body).toHaveProperty('attendanceRate')
   })

   it('should allow teacher to get student attendance stats', async () => {
     const orchestraId = orchestraIds.beginners
     const studentId = Object.values(students)[0]._id.toString()
     
     const response = await request(app)
       .get(`/api/orchestra/${orchestraId}/student/${studentId}/attendance`)
       .set('Authorization', `Bearer ${teacherToken}`)

     expect(response.status).toBe(200)
     expect(response.body).toHaveProperty('attended')
   })
   
   it('should return appropriate response for student with no attendance records', async () => {
     const orchestraId = orchestraIds.beginners
     const studentWithNoRecords = Object.values(students)[2]._id.toString() // Third student has no records
     
     const response = await request(app)
       .get(`/api/orchestra/${orchestraId}/student/${studentWithNoRecords}/attendance`)
       .set('Authorization', `Bearer ${adminToken}`)

     expect(response.status).toBe(200)
     expect(response.body).toHaveProperty('totalRehearsals', 0)
     expect(response.body).toHaveProperty('attended', 0)
     expect(response.body).toHaveProperty('attendanceRate', 0)
     expect(response.body).toHaveProperty('message')
   })
   
   it('should handle non-existent student', async () => {
     const orchestraId = orchestraIds.beginners
     const nonExistentStudentId = new ObjectId().toString()
     
     const response = await request(app)
       .get(`/api/orchestra/${orchestraId}/student/${nonExistentStudentId}/attendance`)
       .set('Authorization', `Bearer ${adminToken}`)

     // Your service should handle this appropriately
     expect(response.status).toBe(200)
     expect(response.body.totalRehearsals).toBe(0)
   })
   
   it('should handle non-existent orchestra', async () => {
     const nonExistentOrchestraId = new ObjectId().toString()
     const studentId = Object.values(students)[0]._id.toString()
     
     const response = await request(app)
       .get(`/api/orchestra/${nonExistentOrchestraId}/student/${studentId}/attendance`)
       .set('Authorization', `Bearer ${adminToken}`)

     // Your service should handle this appropriately
     expect(response.status).toBe(200)
     expect(response.body.totalRehearsals).toBe(0)
   })
 })
})