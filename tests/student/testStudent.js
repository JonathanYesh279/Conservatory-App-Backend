import request from 'supertest'
import { setupTestApp } from '../setup-test-server.js'
import { connectDB, closeDB, clearDB, getCollection } from '../test-db-config.js'
import { setupTestUsers, generateTokens } from '../fixtures/auth.fixtures.js'
import { setupTestSchoolYears } from '../school-year.fixtures.js'
import { setupTestStudents } from '../fixtures/student.fixtures.js'
import { ObjectId } from 'mongodb'

process.env.ACCESS_TOKEN_SECRET = 'test-access-token-secret'
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-token-secret'

describe('Student API Tests', () => {
  let app
  let testUsers
  let adminId, teacherId, conductorId
  let adminToken, teacherToken, conductorToken
  let schoolYears
  let currentSchoolYearId
  let students

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

    // Insert test students
    students = setupTestStudents(currentSchoolYearId)
    await getCollection('student').insertMany(Object.values(students))

    // Associate a student with the teacher
    await teacherCollection.updateOne(
      { _id: teacherId },
      { $push: { 'teaching.studentIds': students.student1._id.toString() } }
    )
  })

  afterAll(async () => {
    await closeDB()
  })

  describe('GET /api/student', () => {
    it('should allow admin to get all students', async () => {
      const response = await request(app)
        .get('/api/student')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(Array.isArray(response.body)).toBe(true)
      expect(response.body.length).toBe(3)
    })

    it('should allow teacher to get all students', async () => {
      const response = await request(app)
        .get('/api/student')
        .set('Authorization', `Bearer ${teacherToken}`)

      expect(response.status).toBe(200)
      expect(Array.isArray(response.body)).toBe(true)
    })

    it('should reject unauthorized access', async () => {
      const response = await request(app).get('/api/student')

      expect(response.status).toBe(401)
      expect(response.body).toHaveProperty('error')
    })
  })

  describe('GET /api/student/:id', () => {
    it('should allow admin to get a specific student', async () => {
      const studentId = students.student1._id.toString()
      const response = await request(app)
        .get(`/api/student/${studentId}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body._id.toString()).toBe(studentId)
      expect(response.body.personalInfo.fullName).toBe('יונתן כהן')
    })

    it('should allow teacher to get a specific student', async () => {
      const studentId = students.student1._id.toString()
      const response = await request(app)
        .get(`/api/student/${studentId}`)
        .set('Authorization', `Bearer ${teacherToken}`)

      expect(response.status).toBe(200)
      expect(response.body._id.toString()).toBe(studentId)
    })

    it('should return 500 for non-existent student', async () => {
      const nonExistentId = new ObjectId().toString()
      const response = await request(app)
        .get(`/api/student/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(500)
      expect(response.body).toHaveProperty('error')
    })
  })

  describe('POST /api/student', () => {
    it('should allow admin to add a new student', async () => {
      const newStudent = {
        personalInfo: {
          fullName: 'תלמיד חדש',
          phone: '0541234567',
          age: 10,
          address: 'כתובת חדשה',
          parentName: 'הורה חדש',
          parentPhone: '0501234567',
          parentEmail: 'parent@test.com',
        },
        academicInfo: {
          instrument: 'חצוצרה',
          currentStage: 1,
          class: 'ד',
        },
        enrollments: {
          orchestraIds: [],
          ensembleIds: [],
          schoolYears: [
            {
              schoolYearId: currentSchoolYearId,
              isActive: true,
            },
          ],
        },
        isActive: true,
      }

      const response = await request(app)
        .post('/api/student')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newStudent)

      expect(response.status).toBe(201)
      expect(response.body).toHaveProperty('_id')
      expect(response.body.personalInfo.fullName).toBe('תלמיד חדש')

      const collection = await getCollection('student')
      const addedStudent = await collection.findOne({
        'personalInfo.fullName': 'תלמיד חדש',
      })
      expect(addedStudent).not.toBeNull()
    })

    it('should allow teacher to add a new student', async () => {
      const newStudent = {
        personalInfo: {
          fullName: 'תלמיד חדש של מורה',
          phone: '0541234567',
          age: 10,
          address: 'כתובת חדשה',
          parentName: 'הורה חדש',
          parentPhone: '0501234567',
          parentEmail: 'parent@test.com',
        },
        academicInfo: {
          instrument: 'קלרינט',
          currentStage: 1,
          class: 'ד',
        },
        enrollments: {
          orchestraIds: [],
          ensembleIds: [],
          schoolYears: [
            {
              schoolYearId: currentSchoolYearId,
              isActive: true,
            },
          ],
        },
        isActive: true,
      };

      const response = await request(app)
        .post('/api/student')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(newStudent)

      expect(response.status).toBe(201)
      expect(response.body).toHaveProperty('_id')

      // Check that the student was associated with the teacher
      const teacherCollection = await getCollection('teacher')
      const teacher = await teacherCollection.findOne({ _id: teacherId })
      expect(teacher.teaching.studentIds).toContain(
        response.body._id.toString()
      )
    })
  })

  describe('PUT /api/student/:id', () => {
    it('should allow admin to update any student', async () => {
      const studentId = students.student2._id.toString(); // Not associated with the teacher
      const studentUpdate = {
        personalInfo: {
          fullName: 'דניאל לוי - מעודכן',
          phone: '0541234567',
          age: 13,
          address: 'כתובת מעודכנת',
          parentName: 'אבי לוי',
          parentPhone: '0501234567',
          parentEmail: 'parent2@test.com',
          studentEmail: 'student2@test.com',
        },
        academicInfo: {
          instrument: 'סקסופון',
          currentStage: 4, // Updated stage
          class: 'ב',
        },
        enrollments: {
          orchestraIds: [],
          ensembleIds: [],
          schoolYears: [
            {
              schoolYearId: currentSchoolYearId,
              isActive: true,
            },
          ],
        },
        isActive: true,
      };

      const response = await request(app)
        .put(`/api/student/${studentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(studentUpdate)

      expect(response.status).toBe(200)
      expect(response.body.personalInfo.fullName).toBe('דניאל לוי - מעודכן')
      expect(response.body.academicInfo.currentStage).toBe(4)
    })

    it('should allow teacher to update their own student', async () => {
      const studentId = students.student1._id.toString(); // Associated with the teacher
      const studentUpdate = {
        personalInfo: {
          fullName: 'יונתן כהן - מעודכן',
          phone: '054-1234567',
          age: 13,
          address: 'רחוב טסט 1 - מעודכן',
          parentName: 'אבי כהן',
          parentPhone: '054-1234567',
          parentEmail: 'parent1@test.com',
          studentEmail: 'student1@test.com',
        },
        academicInfo: {
          instrument: 'חצוצרה',
          currentStage: 6, // Updated stage
          class: 'ט', // Updated class
        },
        enrollments: {
          orchestraIds: [],
          ensembleIds: [],
          schoolYears: [
            {
              schoolYearId: currentSchoolYearId,
              isActive: true,
            },
          ],
        },
        isActive: true,
      };

      const response = await request(app)
        .put(`/api/student/${studentId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(studentUpdate);

      expect(response.status).toBe(200);
      expect(response.body.personalInfo.fullName).toBe('יונתן כהן - מעודכן');
      expect(response.body.academicInfo.currentStage).toBe(6);
      expect(response.body.academicInfo.class).toBe('ט');
    })

    it('should not allow teacher to update a student not associated with them', async () => {
      const studentId = students.student2._id.toString(); // Not associated with the teacher
      const studentUpdate = {
        personalInfo: {
          fullName: 'דניאל לוי - מעודכן',
          phone: '0541234567',
          age: 13,
          address: 'כתובת מעודכנת',
          parentName: 'אבי לוי',
          parentPhone: '0501234567',
          parentEmail: 'parent2@test.com',
          studentEmail: 'student2@test.com',
        },
        academicInfo: {
          instrument: 'סקסופון',
          currentStage: 4,
          class: 'ב',
        },
        enrollments: {
          orchestraIds: [],
          ensembleIds: [],
          schoolYears: [
            {
              schoolYearId: currentSchoolYearId,
              isActive: true,
            },
          ],
        },
        isActive: true,
      };

      const response = await request(app)
        .put(`/api/student/${studentId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(studentUpdate);

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Not authorized to update student');
    });
  })

  describe('DELETE /api/student/:id', () => {
    it('should allow admin to soft-delete any student', async () => {
      const studentId = students.student2._id.toString()
      const response = await request(app)
        .delete(`/api/student/${studentId}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)

      const studentCollection = await getCollection('student')
      const deletedStudent = await studentCollection.findOne({
        _id: ObjectId.createFromHexString(studentId),
      })
      expect(deletedStudent.isActive).toBe(false)
    })

    it('should allow teacher to remove a student association (not soft-delete)', async () => {
      const studentId = students.student1._id.toString() // Associated with the teacher
      const response = await request(app)
        .delete(`/api/student/${studentId}`)
        .set('Authorization', `Bearer ${teacherToken}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty(
        'message',
        'Student removed from teacher successfully'
      )

      // Check that the student was removed from the teacher's students list
      const teacherCollection = await getCollection('teacher')
      const teacher = await teacherCollection.findOne({ _id: teacherId })
      expect(teacher.teaching.studentIds).not.toContain(studentId)

      // But the student is still active in the database
      const studentCollection = await getCollection('student')
      const student = await studentCollection.findOne({
        _id: ObjectId.createFromHexString(studentId),
      })
      expect(student.isActive).toBe(true) // Student is still active
    })

    it('should not allow teacher to remove a student not associated with them', async () => {
      const studentId = students.student2._id.toString() // Not associated with the teacher
      const response = await request(app)
        .delete(`/api/student/${studentId}`)
        .set('Authorization', `Bearer ${teacherToken}`)

      expect(response.status).toBe(500)
      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toContain('Not authorized to remove student')
    })
  })
})
