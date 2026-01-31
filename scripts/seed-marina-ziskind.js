/**
 * Seed Marina Ziskind's Schedule
 *
 * This script adds מרינה זיסקינד's students and schedule to the database.
 *
 * Usage:
 *   node scripts/seed-marina-ziskind.js --dry-run    # Preview changes
 *   node scripts/seed-marina-ziskind.js --apply      # Apply changes
 */

import 'dotenv/config'
import { MongoClient, ObjectId } from 'mongodb'

// מרינה זיסקינד's schedule
const MARINA_SCHEDULE = [
  // יום א' (Sunday) - Room 23
  { day: 'ראשון', time: '13:45', familyName: 'קרים', firstName: 'אביטל', duration: 30, room: '23' },
  { day: 'ראשון', time: '14:15', familyName: 'וינברג', firstName: 'שרה', duration: 45, room: '23' },
  { day: 'ראשון', time: '15:00', familyName: 'גולברג', firstName: 'מארק', duration: 45, room: '23' },
  { day: 'ראשון', time: '15:45', familyName: 'גוטמן', firstName: 'נעמי', duration: 60, room: '23' },
  { day: 'ראשון', time: '16:45', familyName: 'מירושניק', firstName: 'איתמר', duration: 45, room: '23' },

  // יום ב' (Monday)
  { day: 'שני', time: '13:45', familyName: 'בלנקי', firstName: 'דימה', duration: 45, room: '23' },
  { day: 'שני', time: '14:30', familyName: 'ברקוביץ', firstName: 'אדם', duration: 45, room: '23' },
  { day: 'שני', time: '15:15', familyName: 'סויברט', firstName: 'עלמה', duration: 60, room: '23' },
  { day: 'שני', time: '16:15', familyName: 'דמבו בן יוחנה', firstName: 'ללה', duration: 30, room: '23' },
  { day: 'שני', time: '16:45', familyName: 'סיימון', firstName: 'לאו', duration: 30, room: '23' },
  { day: 'שני', time: '17:30', familyName: 'פיש', firstName: 'דניאל', duration: 60, room: '23' },
  { day: 'שני', time: '18:30', familyName: 'רזאל', firstName: 'זוהר', duration: 45, room: '23' },
  { day: 'שני', time: '19:15', familyName: 'רוזן', firstName: 'יולי', duration: 45, room: '23' },

  // יום ד' (Wednesday) - Room 23
  { day: 'רביעי', time: '14:00', familyName: 'דמבו בן יוחנה', firstName: 'ללה', duration: 30, room: '23' },
  { day: 'רביעי', time: '14:30', familyName: 'גוטמן', firstName: 'נעמי', duration: 60, room: '23' },
  { day: 'רביעי', time: '15:30', familyName: 'ברקוביץ', firstName: 'אדם', duration: 45, room: '23' },
  { day: 'רביעי', time: '18:00', familyName: 'גולברג', firstName: 'מארק', duration: 45, room: '23' },
  { day: 'רביעי', time: '18:45', familyName: 'איגוס', firstName: 'איתן', duration: 60, room: '23' },
  { day: 'רביעי', time: '19:45', familyName: 'גולדברג', firstName: 'מארק', duration: 60, room: '23' },

  // יום ה' (Thursday) - Room 23
  { day: 'חמישי', time: '13:15', familyName: 'סיימון', firstName: 'לאו', duration: 30, room: '23' },
  { day: 'חמישי', time: '13:45', familyName: 'קרים', firstName: 'אביטל', duration: 30, room: '23' },
  { day: 'חמישי', time: '14:15', familyName: 'וינברג', firstName: 'שרה', duration: 45, room: '23' },
  { day: 'חמישי', time: '15:00', familyName: 'פיש', firstName: 'דניאל', duration: 60, room: '23' },
  { day: 'חמישי', time: '16:00', familyName: 'סויברט', firstName: 'עלמה', duration: 60, room: '23' },
  { day: 'חמישי', time: '17:00', familyName: 'בלנקי', firstName: 'דימה', duration: 45, room: '23' },
  { day: 'חמישי', time: '17:45', familyName: 'רזאל', firstName: 'זוהר', duration: 45, room: '23' },
  { day: 'חמישי', time: '18:30', familyName: 'מירושניק', firstName: 'איתמר', duration: 60, room: '23' },
  { day: 'חמישי', time: '19:30', familyName: 'רוזן', firstName: 'יולי', duration: 45, room: '23' },
]

class MarinaSeeder {
  constructor(applyChanges = false) {
    this.applyChanges = applyChanges
    this.client = null
    this.db = null
    this.schoolYearId = null
    this.teacher = null
    this.studentMap = new Map()
    this.stats = {
      studentsCreated: 0,
      studentsFound: 0,
      assignmentsCreated: 0,
      errors: []
    }
  }

  async connect() {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI
    if (!uri) throw new Error('MongoDB URI not found')
    this.client = new MongoClient(uri)
    await this.client.connect()
    this.db = this.client.db(process.env.MONGODB_NAME || 'Conservatory-DB')
    console.log('✓ Connected to MongoDB')
  }

  async disconnect() {
    if (this.client) {
      await this.client.close()
      console.log('✓ Disconnected from MongoDB')
    }
  }

  async getSchoolYear() {
    const schoolYear = await this.db.collection('school_year').findOne({ isCurrent: true })
    if (schoolYear) {
      this.schoolYearId = schoolYear._id.toString()
    }
    return this.schoolYearId
  }

  calculateEndTime(startTime, duration) {
    const [hours, minutes] = startTime.split(':').map(Number)
    const totalMinutes = hours * 60 + minutes + duration
    const endHours = Math.floor(totalMinutes / 60)
    const endMins = totalMinutes % 60
    return `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`
  }

  async findOrCreateStudent(familyName, firstName, instrument) {
    const studentKey = `${familyName} ${firstName}`

    if (this.studentMap.has(studentKey)) {
      return this.studentMap.get(studentKey)
    }

    const studentCollection = this.db.collection('student')

    // Try to find existing student with flexible name matching
    const searchPatterns = [
      { 'personalInfo.fullName': new RegExp(`${familyName}.*${firstName}`, 'i') },
      { 'personalInfo.fullName': new RegExp(`${firstName}.*${familyName}`, 'i') },
    ]

    let student = null
    for (const pattern of searchPatterns) {
      student = await studentCollection.findOne(pattern)
      if (student) break
    }

    if (student) {
      console.log(`    ✓ Found student: ${student.personalInfo.fullName}`)
      this.studentMap.set(studentKey, student)
      this.stats.studentsFound++
      return student
    }

    // Create new student
    console.log(`    + Creating student: ${familyName} ${firstName}`)

    if (this.applyChanges) {
      const fullName = `${familyName} ${firstName}`
      const newStudent = {
        personalInfo: {
          fullName: fullName,
          phone: '',
          age: 0,
          address: '',
          parentName: '',
          parentPhone: '',
          parentEmail: '',
          studentEmail: ''
        },
        academicInfo: {
          instrumentProgress: [{
            instrumentName: instrument,
            isPrimary: true,
            currentStage: 1,
            tests: {
              stageTest: { status: 'לא נבחן', lastTestDate: null, nextTestDate: null, notes: '' },
              technicalTest: { status: 'לא נבחן', lastTestDate: null, nextTestDate: null, notes: '' }
            }
          }],
          class: 'אחר'
        },
        enrollments: {
          orchestraIds: [],
          ensembleIds: [],
          theoryLessonIds: [],
          teacherIds: [],
          teacherAssignments: [],
          schoolYears: this.schoolYearId ? [{ schoolYearId: this.schoolYearId, isActive: true }] : []
        },
        teacherAssignments: [],
        teacherIds: [],
        scheduleInfo: {
          day: null,
          startTime: null,
          endTime: null,
          duration: null,
          location: null,
          notes: null,
          isActive: true
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const result = await studentCollection.insertOne(newStudent)
      newStudent._id = result.insertedId
      this.studentMap.set(studentKey, newStudent)
      this.stats.studentsCreated++
      return newStudent
    } else {
      this.stats.studentsCreated++
      return null
    }
  }

  async run() {
    try {
      console.log('\n' + '═'.repeat(70))
      console.log('  MARINA ZISKIND SCHEDULE SEEDER')
      console.log('  Mode: ' + (this.applyChanges ? 'APPLY CHANGES' : 'DRY RUN'))
      console.log('═'.repeat(70))

      await this.connect()
      await this.getSchoolYear()

      // Find Marina Ziskind
      this.teacher = await this.db.collection('teacher').findOne({
        'personalInfo.fullName': 'מרינה זיסקינד'
      })

      if (!this.teacher) {
        console.log('\n⚠ Teacher מרינה זיסקינד not found!')
        return
      }

      console.log(`\n✓ Found teacher: ${this.teacher.personalInfo.fullName} (ID: ${this.teacher._id})`)
      console.log(`  Instrument: ${this.teacher.professionalInfo?.instrument}`)

      const teacherId = this.teacher._id.toString()
      const instrument = this.teacher.professionalInfo?.instrument || 'כינור'

      // Process schedule
      console.log('\n' + '='.repeat(60))
      console.log('Processing Schedule')
      console.log('='.repeat(60))

      const assignedStudentIds = new Set()

      for (const lesson of MARINA_SCHEDULE) {
        const studentKey = `${lesson.familyName} ${lesson.firstName}`
        console.log(`\n  Processing: ${studentKey} - ${lesson.day} ${lesson.time}`)

        const student = await this.findOrCreateStudent(lesson.familyName, lesson.firstName, instrument)

        if (!student && !this.applyChanges) {
          console.log(`    [DRY RUN] Would create student and assignment`)
          continue
        }

        if (!student) continue

        const studentId = student._id.toString()
        const endTime = this.calculateEndTime(lesson.time, lesson.duration)

        // Create teacher assignment
        const assignment = {
          _id: new ObjectId(),
          teacherId: teacherId,
          day: lesson.day,
          time: lesson.time,
          duration: lesson.duration,
          location: lesson.room || '',
          isActive: true,
          isRecurring: true,
          startDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          scheduleInfo: {
            day: lesson.day,
            startTime: lesson.time,
            endTime: endTime,
            duration: lesson.duration,
            location: lesson.room || '',
            notes: null,
            isActive: true
          }
        }

        if (this.applyChanges) {
          // Check if assignment already exists
          const existingAssignment = await this.db.collection('student').findOne({
            _id: student._id,
            'teacherAssignments': {
              $elemMatch: {
                teacherId: teacherId,
                day: lesson.day,
                time: lesson.time
              }
            }
          })

          if (!existingAssignment) {
            await this.db.collection('student').updateOne(
              { _id: student._id },
              {
                $push: { teacherAssignments: assignment },
                $addToSet: { teacherIds: teacherId },
                $set: { updatedAt: new Date() }
              }
            )
            this.stats.assignmentsCreated++
            console.log(`    ✓ Created assignment: ${lesson.day} ${lesson.time} (${lesson.duration}min)`)
          } else {
            console.log(`    ⚠ Assignment already exists`)
          }
        }

        assignedStudentIds.add(studentId)
      }

      // Update teacher's studentIds
      if (this.applyChanges && assignedStudentIds.size > 0) {
        await this.db.collection('teacher').updateOne(
          { _id: this.teacher._id },
          {
            $addToSet: { 'teaching.studentIds': { $each: Array.from(assignedStudentIds) } },
            $set: { updatedAt: new Date() }
          }
        )
        console.log(`\n✓ Added ${assignedStudentIds.size} students to teacher`)
      }

      // Summary
      console.log('\n' + '═'.repeat(70))
      console.log('  SEEDING COMPLETE')
      console.log('═'.repeat(70))
      console.log(`  Students created: ${this.stats.studentsCreated}`)
      console.log(`  Students found: ${this.stats.studentsFound}`)
      console.log(`  Assignments created: ${this.stats.assignmentsCreated}`)

      if (!this.applyChanges) {
        console.log('\n  ⚠ DRY RUN MODE - No changes were applied')
        console.log('  Run with --apply to apply changes')
      }

      console.log('═'.repeat(70) + '\n')

    } catch (error) {
      console.error('Error:', error)
      process.exit(1)
    } finally {
      await this.disconnect()
    }
  }
}

// Main
const args = process.argv.slice(2)
const applyChanges = args.includes('--apply')

if (!args.includes('--apply') && !args.includes('--dry-run')) {
  console.log('Usage:')
  console.log('  node scripts/seed-marina-ziskind.js --dry-run    # Preview changes')
  console.log('  node scripts/seed-marina-ziskind.js --apply      # Apply changes')
  console.log('')
}

const seeder = new MarinaSeeder(applyChanges)
seeder.run()
