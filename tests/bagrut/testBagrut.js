import request from 'supertest'
import { setupTestApp } from '../setup-test-server.js'
import { connectDB, closeDB, clearDB, getCollection } from '../test-db-config.js'
import { setupTestUsers, generateTokens } from '../fixtures/auth.fixtures.js'
import { setupTestSchoolYears } from '../school-year.fixtures.js'
import { setupTestStudents } from '../fixtures/student.fixtures.js'
import { setupTestBagruts } from '../fixtures/bagrut.fixtures.js'
import { ObjectId } from 'mongodb'


process.env.ACCESS_TOKEN_SECRET = 'test-access-token-secret'
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-token-secret'

describe('Bagrut API Tests', () => {
  let app
  let testUsers
  let adminId, teacherId, conductorId
  let adminToken, teacherToken, conductorToken
  let schoolYears
  let currentSchoolYearId
  let students
  let bagruts = {}

  beforeAll(async () => {
    await connectDB()
    app = setupTestApp()
    testUsers = await setupTestUsers()
    schoolYears = setupTestSchoolYears()
  })

  beforeEach(async () => {
    await clearDB()

    // Insert school years
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

    const conductorResult = await teacherCollection.insertOne(conductorUser);
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

    // Set up bagrut test data
    const studentIds = Object.values(students).map((student) =>
      student._id.toString()
    )
    const bagrutData = setupTestBagruts(studentIds[0], teacherId.toString())

    // Insert bagrut records
    const bagrutCollection = await getCollection('bagrut')
    await bagrutCollection.insertMany(Object.values(bagrutData))

    // Store bagrut objects for reference in tests
    const insertedBagruts = await bagrutCollection.find({}).toArray()
    bagruts = insertedBagruts.reduce((acc, bagrut) => {
      acc[bagrut._id.toString()] = bagrut
      return acc
    }, {})

    // Update student with bagrutId
    await studentCollection.updateOne(
      { _id: ObjectId.createFromHexString(studentIds[0]) },
      { $set: { 'academicInfo.tests.bagrutId': Object.keys(bagruts)[0] } }
    )
  })

  afterAll(async () => {
    await closeDB()
  })

  describe('GET /api/bagrut', () => {
    it('should allow admin to get all bagruts', async () => {
      const response = await request(app)
        .get('/api/bagrut')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(Array.isArray(response.body)).toBe(true)
      expect(response.body.length).toBeGreaterThan(0)
      expect(response.body[0]).toHaveProperty('studentId')
      expect(response.body[0]).toHaveProperty('teacherId')
      expect(response.body[0]).toHaveProperty('program')
      expect(response.body[0]).toHaveProperty('presentations')
    })

    it('should not allow teacher to get all bagruts', async () => {
      const response = await request(app)
        .get('/api/bagrut')
        .set('Authorization', `Bearer ${teacherToken}`)

      expect(response.status).toBe(403)
      expect(response.body).toHaveProperty('error')
    })

    it('should reject unauthorized access', async () => {
      const response = await request(app).get('/api/bagrut')

      expect(response.status).toBe(401)
      expect(response.body).toHaveProperty('error')
    })
  })

  describe('GET /api/bagrut/:id', () => {
    it('should allow admin to get a specific bagrut', async () => {
      const bagrutId = Object.keys(bagruts)[0]

      const response = await request(app)
        .get(`/api/bagrut/${bagrutId}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body._id.toString()).toBe(bagrutId)
      expect(response.body).toHaveProperty('studentId')
      expect(response.body).toHaveProperty('teacherId')
    })

    it("should allow teacher to get their own student's bagrut", async () => {
      const bagrutId = Object.keys(bagruts)[0]

      const response = await request(app)
        .get(`/api/bagrut/${bagrutId}`)
        .set('Authorization', `Bearer ${teacherToken}`)

      expect(response.status).toBe(200)
      expect(response.body._id.toString()).toBe(bagrutId)
    })

    it("should not allow teacher to access another teacher's student bagrut", async () => {
      // Create a new teacher and bagrut for a different student
      const teacherCollection = await getCollection('teacher')
      const newTeacherData = {
        ...testUsers.teacher,
        personalInfo: {
          ...testUsers.teacher.personalInfo,
          fullName: 'מורה אחר',
          email: 'otherteacher@test.com',
        },
        credentials: {
          email: 'otherteacher@test.com',
          password: 'teacher123',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const newTeacherResult = await teacherCollection.insertOne(
        newTeacherData
      );
      const newTeacherId = newTeacherResult.insertedId;

      const bagrutCollection = await getCollection('bagrut');
      const newBagrutData = setupTestBagruts(
        Object.values(students)[1]._id.toString(),
        newTeacherId.toString()
      );

      const newBagrutResult = await bagrutCollection.insertOne(
        Object.values(newBagrutData)[0]
      );
      const newBagrutId = newBagrutResult.insertedId.toString();

      const response = await request(app)
        .get(`/api/bagrut/${newBagrutId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 404 for non-existent bagrut', async () => {
      const nonExistentId = new ObjectId().toString()
      const response = await request(app)
        .get(`/api/bagrut/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(404)
      expect(response.body).toHaveProperty('error')
    })
  })

  describe('GET /api/bagrut/student/:studentId', () => {
    it('should allow admin to get bagrut by student ID', async () => {
      const studentId = Object.values(students)[0]._id.toString()

      const response = await request(app)
        .get(`/api/bagrut/student/${studentId}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('studentId', studentId)
    })

    it('should allow teacher to get bagrut for their student', async () => {
      const studentId = Object.values(students)[0]._id.toString()

      const response = await request(app)
        .get(`/api/bagrut/student/${studentId}`)
        .set('Authorization', `Bearer ${teacherToken}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('studentId', studentId)
    })

    it('should return 404 for student without bagrut', async () => {
      const studentWithoutBagrutId = Object.values(students)[2]._id.toString();

      const response = await request(app)
        .get(`/api/bagrut/student/${studentWithoutBagrutId}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(404)
      expect(response.body).toHaveProperty('error')
    })
  })

  describe('POST /api/bagrut', () => {
    it('should allow admin to create a bagrut record', async () => {
      const studentWithoutBagrutId = Object.values(students)[2]._id.toString()

      const newBagrut = {
        studentId: studentWithoutBagrutId,
        teacherId: teacherId.toString(),
        program: [
          {
            pieceTitle: 'יצירה חדשה',
            composer: 'מלחין חדש',
            duration: '4:30',
            youtubeLink: 'https://www.youtube.com/watch?v=newpiece',
          },
        ],
        accompaniment: {
          type: 'נגן מלווה',
          accompanists: [
            {
              name: 'מלווה חדש',
              instrument: 'פסנתר',
              phone: '0501234567',
            },
          ],
        },
        notes: 'הערות לבגרות חדשה',
        testDate: new Date('2024-05-20'),
      };

      const response = await request(app)
        .post('/api/bagrut')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newBagrut);

      expect(response.status).toBe(201)
      expect(response.body).toHaveProperty('_id')
      expect(response.body.studentId).toBe(studentWithoutBagrutId)
      expect(response.body.teacherId).toBe(teacherId.toString())
      expect(response.body.program.length).toBe(1)
      expect(response.body.program[0].pieceTitle).toBe('יצירה חדשה')

      // Check that the student was updated with the bagrut ID
      const studentCollection = await getCollection('student')
      const updatedStudent = await studentCollection.findOne({
        _id: ObjectId.createFromHexString(studentWithoutBagrutId),
      })

      expect(updatedStudent.academicInfo.tests.bagrutId).toBe(
        response.body._id.toString()
      )
    })

    it('should allow teacher to create a bagrut record', async () => {
      const studentWithoutBagrutId = Object.values(students)[1]._id.toString()

      const newBagrut = {
        studentId: studentWithoutBagrutId,
        teacherId: teacherId.toString(),
        program: [
          {
            pieceTitle: 'יצירה חדשה',
            composer: 'מלחין חדש',
            duration: '4:30',
            youtubeLink: 'https://www.youtube.com/watch?v=newpiece',
          },
        ],
        testDate: new Date('2024-06-15'),
      };

      const response = await request(app)
        .post('/api/bagrut')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(newBagrut)

      expect(response.status).toBe(201)
      expect(response.body.studentId).toBe(studentWithoutBagrutId)
    })

    it('should not allow creating duplicate bagrut for same student', async () => {
      const existingBagrutStudentId = Object.values(students)[0]._id.toString()

      const duplicateBagrut = {
        studentId: existingBagrutStudentId,
        teacherId: teacherId.toString(),
        program: [],
        testDate: new Date('2024-07-10'),
      };

      const response = await request(app)
        .post('/api/bagrut')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(duplicateBagrut)

      expect(response.status).toBe(500)
      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toContain('already exists')
    })

    it('should validate required fields when creating a bagrut', async () => {
      const incompleteBagrut = {
        // Missing required studentId field
        teacherId: teacherId.toString(),
        program: [],
      }

      const response = await request(app)
        .post('/api/bagrut')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(incompleteBagrut)

      expect(response.status).toBe(500)
      expect(response.body).toHaveProperty('error')
    })
  })

  describe('PUT /api/bagrut/:id', () => {
    it('should allow admin to update a bagrut record', async () => {
      const bagrutId = Object.keys(bagruts)[0];
      const bagrutToUpdate = {
        ...bagruts[bagrutId],
        program: [
          ...bagruts[bagrutId].program,
          {
            pieceTitle: 'יצירה נוספת',
            composer: 'מלחין נוסף',
            duration: '3:45',
            youtubeLink: 'https://www.youtube.com/watch?v=additionalpiece',
          },
        ],
        notes: 'הערות מעודכנות לבגרות',
        testDate: new Date('2024-06-01'),
      }

      // Convert ObjectId to string
      bagrutToUpdate._id = bagrutToUpdate._id.toString()
      bagrutToUpdate.presentations.forEach((p) => {
        if (p.reviewedBy) p.reviewedBy = p.reviewedBy.toString()
      })
      if (bagrutToUpdate.magenBagrut.reviewedBy) {
        bagrutToUpdate.magenBagrut.reviewedBy =
          bagrutToUpdate.magenBagrut.reviewedBy.toString()
      }
      bagrutToUpdate.program.forEach((p) => {
        if (p._id) p._id = p._id.toString()
      })
      bagrutToUpdate.accompaniment.accompanists.forEach((a) => {
        if (a._id) a._id = a._id.toString()
      })

      const response = await request(app)
        .put(`/api/bagrut/${bagrutId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(bagrutToUpdate)

      expect(response.status).toBe(200)
      expect(response.body.program.length).toBe(bagrutToUpdate.program.length)
      expect(response.body.notes).toBe('הערות מעודכנות לבגרות')
    })

    it("should allow teacher to update their student's bagrut", async () => {
      const bagrutId = Object.keys(bagruts)[0];
      const bagrutToUpdate = {
        ...bagruts[bagrutId],
        notes: 'הערות מהמורה',
        testDate: new Date('2024-06-15'),
      }

      // Convert ObjectId to string
      bagrutToUpdate._id = bagrutToUpdate._id.toString()
      bagrutToUpdate.presentations.forEach((p) => {
        if (p.reviewedBy) p.reviewedBy = p.reviewedBy.toString()
      })
      if (bagrutToUpdate.magenBagrut.reviewedBy) {
        bagrutToUpdate.magenBagrut.reviewedBy =
          bagrutToUpdate.magenBagrut.reviewedBy.toString()
      }
      bagrutToUpdate.program.forEach((p) => {
        if (p._id) p._id = p._id.toString()
      })
      bagrutToUpdate.accompaniment.accompanists.forEach((a) => {
        if (a._id) a._id = a._id.toString()
      })

      const response = await request(app)
        .put(`/api/bagrut/${bagrutId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(bagrutToUpdate)

      expect(response.status).toBe(200)
      expect(response.body.notes).toBe('הערות מהמורה')
    })
  })

  describe('PUT /api/bagrut/:id/presentation/:presentationIndex', () => {
    it('should allow teacher to update a presentation', async () => {
      const bagrutId = Object.keys(bagruts)[0]
      const presentationIndex = 1 // Update the second presentation

      const presentationData = {
        completed: true,
        status: 'עבר/ה',
        date: new Date(),
        review: 'ביצוע טוב מאוד',
      }

      const response = await request(app)
        .put(`/api/bagrut/${bagrutId}/presentation/${presentationIndex}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(presentationData)

      expect(response.status).toBe(200)
      expect(response.body.presentations[presentationIndex].completed).toBe(true)
      expect(response.body.presentations[presentationIndex].status).toBe('עבר/ה')
      expect(response.body.presentations[presentationIndex].review).toBe('ביצוע טוב מאוד')
      expect(response.body.presentations[presentationIndex].reviewedBy).toBe(teacherId.toString())
    })

    it('should validate presentation status is from valid options', async () => {
      const bagrutId = Object.keys(bagruts)[0]
      const presentationIndex = 1

      const invalidStatusData = {
        completed: true,
        status: 'סטטוס לא חוקי', // Invalid status
        date: new Date(),
        review: 'ביצוע טוב',
      }

      const response = await request(app)
        .put(`/api/bagrut/${bagrutId}/presentation/${presentationIndex}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidStatusData)

      expect(response.status).toBe(500)
      expect(response.body).toHaveProperty('error')
    })

    it('should validate presentation index is within range', async () => {
      const bagrutId = Object.keys(bagruts)[0]
      const invalidIndex = 5 // Out of range (valid is 0-2)

      const presentationData = {
        completed: true,
        status: 'עבר/ה',
        date: new Date(),
        review: 'ביצוע טוב',
      }

      const response = await request(app)
        .put(`/api/bagrut/${bagrutId}/presentation/${invalidIndex}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(presentationData)

      expect(response.status).toBe(500)
      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toContain('Invalid presentation index')
    })
  })

  describe('PUT /api/bagrut/:id/magenBagrut', () => {
    it('should allow teacher to update magen bagrut', async () => {
      const bagrutId = Object.keys(bagruts)[0];

      const magenBagrutData = {
        completed: true,
        status: 'עבר/ה',
        date: new Date(),
        review: 'מוכן לבגרות הרשמית',
      }

      const response = await request(app)
        .put(`/api/bagrut/${bagrutId}/magenBagrut`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(magenBagrutData);

      expect(response.status).toBe(200)
      expect(response.body.magenBagrut.completed).toBe(true)
      expect(response.body.magenBagrut.status).toBe('עבר/ה')
      expect(response.body.magenBagrut.review).toBe('מוכן לבגרות הרשמית')
      expect(response.body.magenBagrut.reviewedBy).toBe(teacherId.toString())
    })
  })

  describe('POST /api/bagrut/:id/program', () => {
    it('should allow teacher to add a program piece', async () => {
      const bagrutId = Object.keys(bagruts)[0];

      const pieceData = {
        pieceTitle: 'יצירה נוספת לתוכנית',
        composer: 'מלחין נוסף',
        duration: '5:00',
        youtubeLink: 'https://www.youtube.com/watch?v=newprogrampiece',
      }

      const response = await request(app)
        .post(`/api/bagrut/${bagrutId}/program`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(pieceData)

      expect(response.status).toBe(200)
      expect(response.body.program.length).toBeGreaterThan(
        bagruts[bagrutId].program.length
      )

      const addedPiece = response.body.program.find(
        (p) => p.pieceTitle === pieceData.pieceTitle
      )
      expect(addedPiece).toBeDefined()
      expect(addedPiece.composer).toBe(pieceData.composer)
      expect(addedPiece.duration).toBe(pieceData.duration)
    })

    it('should validate required fields for program piece', async () => {
      const bagrutId = Object.keys(bagruts)[0]

      const incompletePieceData = {
        pieceTitle: 'יצירה חסרה',
        // Missing required composer field
        duration: '3:30',
        youtubeLink: 'https://www.youtube.com/watch?v=incomplete',
      }

      const response = await request(app)
        .post(`/api/bagrut/${bagrutId}/program`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(incompletePieceData)

      expect(response.status).toBe(500)
      expect(response.body).toHaveProperty('error')
    })
  })

  describe('DELETE /api/bagrut/:id/program/:pieceId', () => {
    it('should allow teacher to remove a program piece', async () => {
      const bagrutId = Object.keys(bagruts)[0]
      const pieceId = bagruts[bagrutId].program[0]._id.toString()

      const response = await request(app)
        .delete(`/api/bagrut/${bagrutId}/program/${pieceId}`)
        .set('Authorization', `Bearer ${teacherToken}`)

      expect(response.status).toBe(200)
      expect(response.body.program.length).toBeLessThan(bagruts[bagrutId].program.length)
      expect(response.body.program.find((p) => p._id.toString() === pieceId)).toBeUndefined()
    })
  })

  describe('POST /api/bagrut/:id/accompanist', () => {
    it('should allow teacher to add an accompanist', async () => {
      const bagrutId = Object.keys(bagruts)[0]

      const accompanistData = {
        name: 'מלווה נוסף',
        instrument: 'כינור',
        phone: '0501234567',
      }

      const response = await request(app)
        .post(`/api/bagrut/${bagrutId}/accompanist`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(accompanistData)

      expect(response.status).toBe(200)
      expect(response.body.accompaniment.accompanists.length).toBeGreaterThan(
        bagruts[bagrutId].accompaniment.accompanists.length
      )

      const addedAccompanist = response.body.accompaniment.accompanists.find(
        (a) => a.name === accompanistData.name
      )
      expect(addedAccompanist).toBeDefined()
      expect(addedAccompanist.instrument).toBe(accompanistData.instrument)
    })

    it('should validate phone number format for accompanist', async () => {
      const bagrutId = Object.keys(bagruts)[0]

      const invalidPhoneData = {
        name: 'מלווה עם טלפון לא תקין',
        instrument: 'גיטרה',
        phone: '12345678', // Invalid format (should be 05xxxxxxxx)
      }

      const response = await request(app)
        .post(`/api/bagrut/${bagrutId}/accompanist`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidPhoneData)

      expect(response.status).toBe(500)
      expect(response.body).toHaveProperty('error')
    })
  })

  describe('DELETE /api/bagrut/:id/accompanist/:accompanistId', () => {
    it('should allow teacher to remove an accompanist', async () => {
      const bagrutId = Object.keys(bagruts)[0]
      const accompanistId = bagruts[bagrutId].accompaniment.accompanists[0]._id.toString()

      const response = await request(app)
        .delete(`/api/bagrut/${bagrutId}/accompanist/${accompanistId}`)
        .set('Authorization', `Bearer ${teacherToken}`)

      expect(response.status).toBe(200)
      expect(response.body.accompaniment.accompanists.length).toBe(0)
    })
  })

  // Due to the file upload nature, document tests might need mock implementations
  describe('POST /api/bagrut/:id/document', () => {
    it('should validate document upload requirements', async () => {
      // This is a simplified test since actual file uploads require mocking
      const bagrutId = Object.keys(bagruts)[0]

      // Missing file would cause an error
      const response = await request(app)
        .post(`/api/bagrut/${bagrutId}/document`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .field('title', 'מסמך לדוגמה')

      expect(response.status).toBe(400)
      expect(response.body).toHaveProperty('error')
    })
  })
})
