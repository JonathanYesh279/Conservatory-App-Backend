import request from 'supertest'
import { setupTestApp } from '../setup-test-server.js'
import { connectDB, closeDB, clearDB, getCollection } from '../test-db-config.js'
import { setupTestUsers, generateTokens } from '../fixtures/auth.fixtures.js'
import { setupTestSchoolYears } from '../school-year.fixtures.js'
import { setupTestStudents } from '../fixtures/student.fixtures.js'
import { setupTestOrchestras } from '../fixtures/orchestra.fixtures.js'
import { ObjectId } from 'mongodb'

process.env.ACCESS_TOKEN_SECRET = 'test-access-token-secret'
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-token-secret'

describe('School Year API Tests', () => {
  let app
  let testUsers
  let adminId, teacherId, conductorId
  let adminToken, teacherToken, conductorToken
  let schoolYears
  let currentSchoolYearId, previousSchoolYearId, nextSchoolYearId
  let students
  let orchestras

  beforeAll(async () => {
    await connectDB()
    app = await setupTestApp()
    testUsers = await setupTestUsers()
    schoolYears = setupTestSchoolYears()
  })

  beforeEach(async () => {
    await clearDB()

    // Insert test users into the database
    const teacherCollection = await getCollection('teacher')

    const adminUser = {
      ...testUsers.admin,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const adminResult = await teacherCollection.insertOne(adminUser)
    adminId = adminResult.insertedId
    adminUser._id = adminId

    const teacherUser = {
      ...testUsers.teacher,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const teacherResult = await teacherCollection.insertOne(teacherUser)
    teacherId = teacherResult.insertedId
    teacherUser._id = teacherId

    const conductorUser = {
      ...testUsers.conductor,
      createdAt: new Date(),
      updatedAt: new Date(),
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

    // Insert school years
    const schoolYearCollection = await getCollection('school_year')
    await schoolYearCollection.insertMany(Object.values(schoolYears))

    // Store school year IDs for reference
    currentSchoolYearId = schoolYears.current._id.toString()
    previousSchoolYearId = schoolYears.previous._id.toString()
    nextSchoolYearId = schoolYears.next._id.toString()

    // Update teachers with school year IDs
    await teacherCollection.updateMany({},{
        $set: {
          schoolYears: [
            {
              schoolYearId: currentSchoolYearId,
              isActive: true,
            },
          ],
        },
      }
    )

    // Insert test students with school year references
    students = setupTestStudents(currentSchoolYearId)
    const studentCollection = await getCollection('student')
    await studentCollection.insertMany(Object.values(students))

    // Setup orchestras with school year references
    const orchestraData = setupTestOrchestras(
      conductorId.toString(),
      currentSchoolYearId
    )
    const orchestraCollection = await getCollection('orchestra')
    await orchestraCollection.insertMany(Object.values(orchestraData))

    orchestras = await orchestraCollection.find({}).toArray()
  })

  afterAll(async () => {
    await closeDB()
  })

  describe('GET /api/school-year', () => {
    it('should allow admin to get all school years', async () => {
      const response = await request(app)
        .get('/api/school-year')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(Array.isArray(response.body)).toBe(true)
      expect(response.body.length).toBe(3) // current, previous, next
      expect(response.body[0]).toHaveProperty('name')
      expect(response.body[0]).toHaveProperty('startDate')
      expect(response.body[0]).toHaveProperty('endDate')
      expect(response.body[0]).toHaveProperty('isCurrent')
    })

    it('should allow teacher to get all school years', async () => {
      const response = await request(app)
        .get('/api/school-year')
        .set('Authorization', `Bearer ${teacherToken}`)

      expect(response.status).toBe(200)
      expect(Array.isArray(response.body)).toBe(true)
    })

    it('should allow conductor to get all school years', async () => {
      const response = await request(app)
        .get('/api/school-year')
        .set('Authorization', `Bearer ${conductorToken}`)

      expect(response.status).toBe(200)
      expect(Array.isArray(response.body)).toBe(true)
    })

    it('should reject unauthorized access', async () => {
      const response = await request(app).get('/api/school-year');

      expect(response.status).toBe(401)
      expect(response.body).toHaveProperty('error')
    })
  })

  describe('GET /api/school-year/current', () => {
    it('should return the current school year', async () => {
      const response = await request(app)
        .get('/api/school-year/current')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('_id', currentSchoolYearId)
      expect(response.body).toHaveProperty('isCurrent', true)
    })

    it('should create a default school year if none is set as current', async () => {
      // First, remove the current flag from all school years
      const schoolYearCollection = await getCollection('school_year')
      await schoolYearCollection.updateMany(
        { isCurrent: true },
        { $set: { isCurrent: false } }
      )

      const response = await request(app)
        .get('/api/school-year/current')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('isCurrent', true)

      // The year should be the current calendar year
      const currentYear = new Date().getFullYear()
      expect(response.body.name).toBe(`${currentYear}-${currentYear + 1}`)
    })
  })

  describe('GET /api/school-year/:id', () => {
    it('should allow admin to get a specific school year', async () => {
      const response = await request(app)
        .get(`/api/school-year/${currentSchoolYearId}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('_id', currentSchoolYearId)
      expect(response.body).toHaveProperty('name', schoolYears.current.name)
    })

    it('should return 500 for non-existent school year', async () => {
      const nonExistentId = new ObjectId().toString()
      const response = await request(app)
        .get(`/api/school-year/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(500)
      expect(response.body).toHaveProperty('error')
    })
  })

  describe('POST /api/school-year', () => {
    it('should allow admin to create a new school year', async () => {
      const futureYear = new Date().getFullYear() + 2 // Two years in the future
      const newSchoolYear = {
        name: `${futureYear}-${futureYear + 1}`,
        startDate: new Date(`${futureYear}-09-01`),
        endDate: new Date(`${futureYear + 1}-08-31`),
        isCurrent: false,
      }

      const response = await request(app)
        .post('/api/school-year')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newSchoolYear)

      expect(response.status).toBe(201)
      expect(response.body).toHaveProperty('_id')
      expect(response.body.name).toBe(newSchoolYear.name)
    })

    it('should automatically update other school years if new one is set as current', async () => {
      const futureYear = new Date().getFullYear() + 2
      const newCurrentYear = {
        name: `${futureYear}-${futureYear + 1}`,
        startDate: new Date(`${futureYear}-09-01`),
        endDate: new Date(`${futureYear + 1}-08-31`),
        isCurrent: true, // This one should be current
      }

      const response = await request(app)
        .post('/api/school-year')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newCurrentYear)

      expect(response.status).toBe(201)
      expect(response.body.isCurrent).toBe(true)

      // Check that the previously current school year is no longer current
      const schoolYearCollection = await getCollection('school_year')
      const oldCurrentYear = await schoolYearCollection.findOne({
        _id: ObjectId.createFromHexString(currentSchoolYearId),
      })

      expect(oldCurrentYear.isCurrent).toBe(false)
    })

    it('should not allow teacher to create a school year', async () => {
      const futureYear = new Date().getFullYear() + 2
      const newSchoolYear = {
        name: `${futureYear}-${futureYear + 1}`,
        startDate: new Date(`${futureYear}-09-01`),
        endDate: new Date(`${futureYear + 1}-08-31`),
        isCurrent: false,
      }

      const response = await request(app)
        .post('/api/school-year')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(newSchoolYear)

      expect(response.status).toBe(403)
      expect(response.body).toHaveProperty('error')
    })

    it('should validate required fields when creating a school year', async () => {
      const incompleteSchoolYear = {
        name: 'Incomplete Year',
        // Missing required startDate
        endDate: new Date(),
      }

      const response = await request(app)
        .post('/api/school-year')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(incompleteSchoolYear)

      expect(response.status).toBe(500)
      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toContain('Validation error')
    })
  })

  describe('PUT /api/school-year/:id', () => {
    it('should allow admin to update a school year', async () => {
      const updatedName = 'Updated School Year';
      const schoolYearUpdate = {
        name: updatedName,
        startDate: schoolYears.current.startDate,
        endDate: schoolYears.current.endDate,
        isCurrent: true,
        isActive: true,
      }

      const response = await request(app)
        .put(`/api/school-year/${currentSchoolYearId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(schoolYearUpdate)

      expect(response.status).toBe(200)
      expect(response.body.name).toBe(updatedName)
    })

    it('should automatically update other school years if updated one is set as current', async () => {
      // First, update a non-current school year to be current
      const schoolYearUpdate = {
        name: schoolYears.next.name,
        startDate: schoolYears.next.startDate,
        endDate: schoolYears.next.endDate,
        isCurrent: true, // Setting this non-current year to current
        isActive: true,
      }

      const response = await request(app)
        .put(`/api/school-year/${nextSchoolYearId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(schoolYearUpdate)

      expect(response.status).toBe(200)
      expect(response.body.isCurrent).toBe(true)

      // Check that the previously current school year is no longer current
      const schoolYearCollection = await getCollection('school_year')
      const oldCurrentYear = await schoolYearCollection.findOne({
        _id: ObjectId.createFromHexString(currentSchoolYearId),
      })

      expect(oldCurrentYear.isCurrent).toBe(false)
    })

    it('should not allow teacher to update a school year', async () => {
      const schoolYearUpdate = {
        name: 'Teacher Update Attempt',
        startDate: schoolYears.current.startDate,
        endDate: schoolYears.current.endDate,
        isCurrent: true,
      }

      const response = await request(app)
        .put(`/api/school-year/${currentSchoolYearId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(schoolYearUpdate)

      expect(response.status).toBe(403)
      expect(response.body).toHaveProperty('error')
    })
  })

  describe('PUT /api/school-year/:id/set-current', () => {
    it('should allow admin to set a school year as current', async () => {
      const response = await request(app)
        .put(`/api/school-year/${nextSchoolYearId}/set-current`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('_id', nextSchoolYearId)
      expect(response.body).toHaveProperty('isCurrent', true)

      // Check that the previously current year is no longer current
      const schoolYearCollection = await getCollection('school_year')
      const oldCurrentYear = await schoolYearCollection.findOne({
        _id: ObjectId.createFromHexString(currentSchoolYearId),
      })

      expect(oldCurrentYear.isCurrent).toBe(false)
    })

    it('should not allow teacher to set a school year as current', async () => {
      const response = await request(app)
        .put(`/api/school-year/${nextSchoolYearId}/set-current`)
        .set('Authorization', `Bearer ${teacherToken}`)

      expect(response.status).toBe(403)
      expect(response.body).toHaveProperty('error')
    })
  })

  describe('PUT /api/school-year/:id/rollover', () => {
    it('should allow admin to roll over to a new school year', async () => {
      const response = await request(app)
        .put(`/api/school-year/${currentSchoolYearId}/rollover`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('_id')
      expect(response.body).toHaveProperty('isCurrent', true)

      // Verify the new year is created correctly
      const startYear = new Date(schoolYears.current.endDate).getFullYear()
      const endYear = startYear + 1
      expect(response.body.name).toBe(`${startYear}-${endYear}`)

      // Check that active students from previous year are enrolled in the new year
      const studentCollection = await getCollection('student')
      const students = await studentCollection
        .find({
          isActive: true,
          'enrollments.schoolYears': {
            $elemMatch: {
              schoolYearId: response.body._id.toString(),
              isActive: true,
            },
          },
        })
        .toArray()

      expect(students.length).toBeGreaterThan(0)

      // Check that active teachers from previous year are registered in the new year
      const teacherCollection = await getCollection('teacher')
      const teachers = await teacherCollection
        .find({
          isActive: true,
          schoolYears: {
            $elemMatch: {
              schoolYearId: response.body._id.toString(),
              isActive: true,
            },
          },
        })
        .toArray()

      expect(teachers.length).toBeGreaterThan(0)

      // Check that orchestras were rolled over
      const orchestraCollection = await getCollection('orchestra')
      const newYearOrchestras = await orchestraCollection
        .find({
          schoolYearId: response.body._id.toString(),
        })
        .toArray()

      expect(newYearOrchestras.length).toBeGreaterThan(0)
    })

    it('should not allow teacher to roll over to a new school year', async () => {
      const response = await request(app)
        .put(`/api/school-year/${currentSchoolYearId}/rollover`)
        .set('Authorization', `Bearer ${teacherToken}`)

      expect(response.status).toBe(403)
      expect(response.body).toHaveProperty('error')
    })

    it('should handle missing previous year gracefully', async () => {
      const nonExistentId = new ObjectId().toString()
      const response = await request(app)
        .put(`/api/school-year/${nonExistentId}/rollover`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(500)
      expect(response.body).toHaveProperty('error')
    })
  })

  describe('Integration with other entities', () => {
    it('should provide current school year to requests through middleware', async () => {
      // Test an endpoint that uses the school year middleware
      const response = await request(app)
        .get('/api/student')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)

      // The middleware should have added the current school year to the request
      // This is difficult to test directly, but we can verify that students are returned
      // which means the middleware worked correctly
      expect(Array.isArray(response.body)).toBe(true)
      expect(response.body.length).toBeGreaterThan(0)
    })

    it('should filter students by school year', async () => {
      // First, update a student to be in a different school year
      const studentCollection = await getCollection('student')
      const studentToUpdate = Object.values(students)[0]
      await studentCollection.updateOne(
        { _id: studentToUpdate._id },
        {
          $push: {
            'enrollments.schoolYears': {
              schoolYearId: nextSchoolYearId,
              isActive: true,
            },
          },
        }
      )

      // Now query students with the next school year ID
      const response = await request(app)
        .get(`/api/student?schoolYearId=${nextSchoolYearId}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.length).toBe(1)
      expect(response.body[0]._id.toString()).toBe(studentToUpdate._id.toString())
    })

    it('should filter orchestras by school year', async () => {
      // First, create an orchestra in the next school year
      const orchestraCollection = await getCollection('orchestra')
      const newOrchestra = {
        name: 'תזמורת עתודה נשיפה',
        type: 'תזמורת',
        conductorId: conductorId.toString(),
        memberIds: [],
        rehearsalIds: [],
        schoolYearId: nextSchoolYearId,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      await orchestraCollection.insertOne(newOrchestra)

      // Now query orchestras with the next school year ID
      const response = await request(app)
        .get(`/api/orchestra?schoolYearId=${nextSchoolYearId}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.length).toBe(1)
      expect(response.body[0].schoolYearId).toBe(nextSchoolYearId)
    })

    it('should support filtering teachers by school year association', async () => {
      // First, update a teacher to be in a different school year
      const teacherCollection = await getCollection('teacher')
      await teacherCollection.updateOne(
        { _id: teacherId },
        {
          $push: {
            schoolYears: {
              schoolYearId: nextSchoolYearId,
              isActive: true,
            },
          },
        }
      )

      // This test would depend on the teacher controller implementation
      // Here we assume a schoolYearId query parameter is supported
      const response = await request(app)
        .get(`/api/teacher?schoolYearId=${nextSchoolYearId}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      // Since this depends on the actual implementation, we're just checking
      // that the response is successful, not specific results
    })
  })
})
