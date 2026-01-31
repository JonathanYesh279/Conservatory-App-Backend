/**
 * Seed Schedule for מרינה זיסקינד
 *
 * This script populates the complete lesson schedule for this teacher
 * based on the actual schedule data provided.
 *
 * Usage: node scripts/seed-marina-schedule.js
 */

import 'dotenv/config'
import { MongoClient, ObjectId } from 'mongodb'

// Day mapping: Hebrew letter to full day name
const DAY_MAP = {
  'א': 'ראשון',
  'ב': 'שני',
  'ג': 'שלישי',
  'ד': 'רביעי',
  'ה': 'חמישי',
  'ו': 'שישי'
}

// Complete schedule data for מרינה זיסקינד
const SCHEDULE_DATA = [
  // יום א' (Sunday) - Room 23
  { day: 'ראשון', time: '12:00', familyName: 'שורץ ציגלר', firstName: 'כחל', duration: 60, room: '23' },
  { day: 'ראשון', time: '13:45', familyName: 'קרים', firstName: 'אביטל', duration: 30, room: '23' },
  { day: 'ראשון', time: '14:15', familyName: 'וינברג', firstName: 'שרה', duration: 45, room: '23' },
  { day: 'ראשון', time: '15:00', familyName: 'גולברג', firstName: 'מארק', duration: 45, room: '23' },
  { day: 'ראשון', time: '15:45', familyName: 'גוטמן', firstName: 'נעמי', duration: 60, room: '23' },
  { day: 'ראשון', time: '16:45', familyName: 'מירושניק', firstName: 'איתמר', duration: 45, room: '23' },

  // יום ב' (Monday)
  { day: 'שני', time: '13:45', familyName: 'בלנקי', firstName: 'דימה', duration: 45, room: '' },
  { day: 'שני', time: '14:30', familyName: 'ברקוביץ', firstName: 'אדם', duration: 45, room: '' },
  { day: 'שני', time: '15:15', familyName: 'סויברט', firstName: 'עלמה', duration: 60, room: '' },
  { day: 'שני', time: '16:15', familyName: 'דמבו בן יוחנה', firstName: 'ללה', duration: 30, room: '' },
  { day: 'שני', time: '16:45', familyName: 'סיימון', firstName: 'לאו', duration: 30, room: '' },
  { day: 'שני', time: '17:30', familyName: 'פיש', firstName: 'דניאל', duration: 60, room: '' },
  { day: 'שני', time: '18:30', familyName: 'רזאל', firstName: 'זוהר', duration: 45, room: '' },
  { day: 'שני', time: '19:15', familyName: 'רוזן', firstName: 'יולי', duration: 45, room: '' },

  // יום ד' (Wednesday) - Room 23
  { day: 'רביעי', time: '12:30', familyName: 'שורץ ציגלר', firstName: 'כחל', duration: 60, room: '23' },
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

class ScheduleSeeder {
  constructor() {
    this.client = null
    this.db = null
    this.teacherId = null
    this.studentMap = new Map() // name -> studentId
    this.stats = {
      lessonsCreated: 0,
      lessonsUpdated: 0,
      studentsNotFound: [],
      errors: []
    }
  }

  async connect() {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI
    if (!uri) {
      throw new Error('MONGO_URI or MONGODB_URI environment variable is required')
    }

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

  // Calculate end time from start time and duration
  calculateEndTime(startTime, duration) {
    const [hours, minutes] = startTime.split(':').map(Number)
    const totalMinutes = hours * 60 + minutes + duration
    const endHours = Math.floor(totalMinutes / 60)
    const endMins = totalMinutes % 60
    return `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`
  }

  // Find student by name (tries multiple variations)
  async findStudent(familyName, firstName) {
    const studentCollection = this.db.collection('student')

    // Try different name combinations
    const searchPatterns = [
      { 'personalInfo.fullName': new RegExp(`${familyName}.*${firstName}`, 'i') },
      { 'personalInfo.fullName': new RegExp(`${firstName}.*${familyName}`, 'i') },
      { 'personalInfo.fullName': new RegExp(familyName, 'i') },
    ]

    for (const pattern of searchPatterns) {
      const student = await studentCollection.findOne(pattern)
      if (student) {
        return student
      }
    }

    return null
  }

  // Find the teacher
  async findTeacher() {
    const teacherCollection = this.db.collection('teacher')
    const teacher = await teacherCollection.findOne({
      'personalInfo.fullName': 'מרינה זיסקינד'
    })

    if (!teacher) {
      throw new Error('Teacher מרינה זיסקינד not found')
    }

    this.teacherId = teacher._id.toString()
    console.log(`✓ Found teacher: ${teacher.personalInfo.fullName} (${this.teacherId})`)
    return teacher
  }

  // Create or update schedule entry
  async createScheduleEntry(lesson) {
    const studentCollection = this.db.collection('student')
    const teacherCollection = this.db.collection('teacher')

    // Find student
    const student = await this.findStudent(lesson.familyName, lesson.firstName)

    if (!student) {
      this.stats.studentsNotFound.push(`${lesson.familyName} ${lesson.firstName}`)
      console.log(`  ⚠ Student not found: ${lesson.familyName} ${lesson.firstName}`)
      return false
    }

    const studentId = student._id.toString()
    const studentName = student.personalInfo.fullName
    const endTime = this.calculateEndTime(lesson.time, lesson.duration)
    const instrument = student.academicInfo?.instrumentProgress?.[0]?.instrumentName || 'כינור'

    console.log(`  → ${studentName}: ${lesson.day} ${lesson.time}-${endTime}`)

    // Update student's teacherAssignments (both locations for compatibility)
    const assignmentData = {
      teacherId: this.teacherId,
      day: lesson.day,
      time: lesson.time,
      duration: lesson.duration,
      location: lesson.room,
      isActive: true,
      isRecurring: true,
      startDate: new Date(),
      updatedAt: new Date()
    }

    // Check if assignment already exists for this teacher+day+time
    const existingAssignment = student.teacherAssignments?.find(
      a => a.teacherId === this.teacherId && a.day === lesson.day && a.time === lesson.time
    ) || student.enrollments?.teacherAssignments?.find(
      a => a.teacherId === this.teacherId && a.day === lesson.day && a.time === lesson.time
    )

    if (existingAssignment) {
      // Update existing assignment
      await studentCollection.updateOne(
        {
          _id: student._id,
          'teacherAssignments.teacherId': this.teacherId,
          'teacherAssignments.day': lesson.day,
          'teacherAssignments.time': lesson.time
        },
        {
          $set: {
            'teacherAssignments.$.duration': lesson.duration,
            'teacherAssignments.$.location': lesson.room,
            'teacherAssignments.$.isActive': true,
            'teacherAssignments.$.updatedAt': new Date()
          }
        }
      )
      this.stats.lessonsUpdated++
    } else {
      // Add new assignment to both locations
      await studentCollection.updateOne(
        { _id: student._id },
        {
          $push: {
            teacherAssignments: { ...assignmentData, createdAt: new Date() },
            'enrollments.teacherAssignments': { ...assignmentData, createdAt: new Date() }
          },
          $addToSet: {
            'enrollments.teacherIds': this.teacherId
          },
          $set: {
            'scheduleInfo.day': lesson.day,
            'scheduleInfo.startTime': lesson.time,
            'scheduleInfo.endTime': endTime,
            'scheduleInfo.duration': lesson.duration,
            'scheduleInfo.location': lesson.room,
            'scheduleInfo.isActive': true,
            updatedAt: new Date()
          }
        }
      )
      this.stats.lessonsCreated++
    }

    // Update teacher's schedule
    const scheduleEntry = {
      _id: new ObjectId().toString(),
      studentId: studentId,
      studentName: studentName,
      day: lesson.day,
      startTime: lesson.time,
      endTime: endTime,
      duration: lesson.duration,
      instrument: instrument,
      location: lesson.room,
      isRecurring: true,
      recurringType: 'weekly',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // Check if this schedule entry already exists
    const teacher = await teacherCollection.findOne({ _id: new ObjectId(this.teacherId) })
    const existingSchedule = teacher.teaching?.schedule?.find(
      s => s.studentId === studentId && s.day === lesson.day && s.startTime === lesson.time
    )

    if (!existingSchedule) {
      await teacherCollection.updateOne(
        { _id: new ObjectId(this.teacherId) },
        {
          $push: { 'teaching.schedule': scheduleEntry },
          $addToSet: { 'teaching.studentIds': studentId },
          $set: { updatedAt: new Date() }
        }
      )
    } else {
      // Update existing schedule entry
      await teacherCollection.updateOne(
        {
          _id: new ObjectId(this.teacherId),
          'teaching.schedule.studentId': studentId,
          'teaching.schedule.day': lesson.day,
          'teaching.schedule.startTime': lesson.time
        },
        {
          $set: {
            'teaching.schedule.$.endTime': endTime,
            'teaching.schedule.$.duration': lesson.duration,
            'teaching.schedule.$.location': lesson.room,
            'teaching.schedule.$.status': 'active',
            'teaching.schedule.$.updatedAt': new Date()
          }
        }
      )
    }

    return true
  }

  async run() {
    try {
      console.log('\n' + '='.repeat(60))
      console.log('  Schedule Seeder for מרינה זיסקינד')
      console.log('='.repeat(60) + '\n')

      await this.connect()
      await this.findTeacher()

      // Clear existing schedule for this teacher (optional - comment out to keep existing)
      // await this.clearExistingSchedule()

      console.log('\n--- Creating Schedule Entries ---')
      console.log(`Processing ${SCHEDULE_DATA.length} lessons...\n`)

      for (const lesson of SCHEDULE_DATA) {
        await this.createScheduleEntry(lesson)
      }

      // Summary
      console.log('\n' + '='.repeat(60))
      console.log('  SEED COMPLETE')
      console.log('='.repeat(60))
      console.log(`  Lessons created: ${this.stats.lessonsCreated}`)
      console.log(`  Lessons updated: ${this.stats.lessonsUpdated}`)
      console.log(`  Students not found: ${this.stats.studentsNotFound.length}`)

      if (this.stats.studentsNotFound.length > 0) {
        console.log('\n  Missing students:')
        this.stats.studentsNotFound.forEach(name => console.log(`    - ${name}`))
      }

      console.log('='.repeat(60) + '\n')

    } catch (error) {
      console.error('Error:', error)
      process.exit(1)
    } finally {
      await this.disconnect()
    }
  }
}

// Run
const seeder = new ScheduleSeeder()
seeder.run()
