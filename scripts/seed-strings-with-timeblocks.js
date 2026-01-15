/**
 * Complete Seed Script for Strings Department (כלי קשת)
 * WITH TIME BLOCKS SUPPORT
 * 
 * This script:
 * 1. Creates teachers with their info AND timeBlocks
 * 2. Creates students with their data
 * 3. Links students to teachers within their time blocks
 * 4. Creates teacher schedules (teacherAssignments)
 * 
 * IMPORTANT: timeBlocks must be created BEFORE student assignments!
 * 
 * Usage:
 *   node scripts/seed-strings-with-timeblocks.js
 */

import 'dotenv/config'
import { MongoClient, ObjectId } from 'mongodb'
import bcrypt from 'bcrypt'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configuration
const SALT_ROUNDS = 10
const DEFAULT_PASSWORD = '123456'

// Valid values
const VALID_CLASSES = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'יא', 'יב', 'אחר']
const INSTRUMENT_MAP = {
  'כינור': 'כינור',
  'ויולה': 'ויולה', 
  'נבל': 'נבל',
  "צ'לו": 'צ\'לו',
  'צ\'לו': 'צ\'לו',
  'קונטרבס': 'קונטרבס'
}

class CompleteSeederWithTimeBlocks {
  constructor() {
    this.client = null
    this.db = null
    this.schoolYearId = null
    this.teacherIdMap = new Map()
    this.studentIdMap = new Map()
    this.studentByPartialName = new Map()
    this.teacherTimeBlocks = new Map() // teacherId -> [timeBlocks]
    this.stats = {
      teachersCreated: 0,
      teachersSkipped: 0,
      timeBlocksCreated: 0,
      studentsCreated: 0,
      studentsSkipped: 0,
      schedulesCreated: 0,
      schedulesNotMatched: 0
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

  async getOrCreateSchoolYear() {
    const collection = this.db.collection('school_year')
    let schoolYear = await collection.findOne({ isCurrent: true })
    
    if (!schoolYear) {
      const currentYear = new Date().getFullYear()
      const startYear = new Date().getMonth() >= 8 ? currentYear : currentYear - 1
      const result = await collection.insertOne({
        name: `${startYear}-${startYear + 1}`,
        startDate: new Date(`${startYear}-09-01`),
        endDate: new Date(`${startYear + 1}-08-31`),
        isCurrent: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      schoolYear = { _id: result.insertedId, name: `${startYear}-${startYear + 1}` }
      console.log(`✓ Created school year: ${schoolYear.name}`)
    } else {
      console.log(`✓ Using school year: ${schoolYear.name}`)
    }
    
    this.schoolYearId = schoolYear._id.toString()
    return this.schoolYearId
  }

  async hashPassword(password) {
    return bcrypt.hash(password, SALT_ROUNDS)
  }

  generateObjectId() {
    return new ObjectId().toString()
  }

  // Create time blocks for a teacher
  createTimeBlocksArray(timeBlocksData) {
    if (!timeBlocksData || !Array.isArray(timeBlocksData)) {
      return []
    }

    return timeBlocksData.map(block => ({
      _id: this.generateObjectId(),
      day: block.day,
      startTime: block.startTime,
      endTime: block.endTime,
      totalDuration: block.totalDuration,
      location: block.location || 'חדר לא מוגדר',
      notes: null,
      isActive: true,
      assignedLessons: [],
      recurring: {
        isRecurring: true,
        excludeDates: []
      },
      createdAt: new Date(),
      updatedAt: new Date()
    }))
  }

  // Create a teacher with time blocks
  async createTeacher(teacherData, timeBlocksData) {
    const collection = this.db.collection('teacher')
    
    // Check if exists
    const existing = await collection.findOne({
      'personalInfo.fullName': teacherData.fullName
    })

    if (existing) {
      this.teacherIdMap.set(teacherData.fullName, existing._id.toString())
      
      // Store existing time blocks for reference
      if (existing.teaching?.timeBlocks) {
        this.teacherTimeBlocks.set(existing._id.toString(), existing.teaching.timeBlocks)
      }
      
      // If teacher exists but has no timeBlocks, add them
      if (timeBlocksData && (!existing.teaching?.timeBlocks || existing.teaching.timeBlocks.length === 0)) {
        const timeBlocks = this.createTimeBlocksArray(timeBlocksData)
        await collection.updateOne(
          { _id: existing._id },
          { 
            $set: { 
              'teaching.timeBlocks': timeBlocks,
              updatedAt: new Date()
            }
          }
        )
        this.teacherTimeBlocks.set(existing._id.toString(), timeBlocks)
        this.stats.timeBlocksCreated += timeBlocks.length
        console.log(`  → Updated teacher "${teacherData.fullName}" with ${timeBlocks.length} time blocks`)
      }
      
      this.stats.teachersSkipped++
      return existing._id.toString()
    }

    const email = teacherData.email || 
      `${teacherData.fullName.replace(/\s+/g, '.').toLowerCase()}@conservatory.local`

    // Create time blocks
    const timeBlocks = this.createTimeBlocksArray(timeBlocksData)

    const teacher = {
      personalInfo: {
        fullName: teacherData.fullName,
        phone: teacherData.phone || '0500000000',
        email: email,
        address: 'כתובת לעדכון'
      },
      roles: ['מורה'],
      professionalInfo: {
        instrument: teacherData.instrument || 'כינור',
        isActive: true
      },
      teaching: {
        studentIds: [],
        schedule: [],
        timeBlocks: timeBlocks  // <-- THIS IS CRITICAL
      },
      conducting: { orchestraIds: [] },
      ensemblesIds: [],
      schoolYears: [{ schoolYearId: this.schoolYearId, isActive: true }],
      credentials: {
        email: email,
        password: await this.hashPassword(DEFAULT_PASSWORD),
        requiresPasswordChange: true,
        passwordSetAt: new Date(),
        invitedAt: new Date(),
        invitedBy: 'seed_script',
        invitationMode: 'DEFAULT_PASSWORD'
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const result = await collection.insertOne(teacher)
    const teacherId = result.insertedId.toString()
    this.teacherIdMap.set(teacherData.fullName, teacherId)
    this.teacherTimeBlocks.set(teacherId, timeBlocks)
    this.stats.teachersCreated++
    this.stats.timeBlocksCreated += timeBlocks.length
    console.log(`  ✓ Created teacher: ${teacherData.fullName} with ${timeBlocks.length} time blocks`)
    return teacherId
  }

  // Create a student
  async createStudent(studentData) {
    const collection = this.db.collection('student')
    
    const existing = await collection.findOne({
      'personalInfo.fullName': studentData.personalInfo.fullName
    })

    if (existing) {
      this.studentIdMap.set(studentData.personalInfo.fullName, existing._id.toString())
      this.addPartialNameMappings(studentData.personalInfo.fullName, existing._id.toString())
      this.stats.studentsSkipped++
      return existing._id.toString()
    }

    let studentClass = studentData.academicInfo.class || 'אחר'
    if (!VALID_CLASSES.includes(studentClass)) {
      studentClass = 'אחר'
    }

    const instrument = INSTRUMENT_MAP[studentData.academicInfo.instrument] || 'כינור'

    const student = {
      personalInfo: {
        fullName: studentData.personalInfo.fullName,
        phone: studentData.personalInfo.phone,
        age: studentData.personalInfo.age,
        address: studentData.personalInfo.address,
        parentName: studentData.personalInfo.parentName,
        parentPhone: studentData.personalInfo.parentPhone,
        parentEmail: studentData.personalInfo.parentEmail,
        studentEmail: studentData.personalInfo.studentEmail
      },
      academicInfo: {
        instrumentProgress: [{
          instrumentName: instrument,
          isPrimary: true,
          currentStage: 1
        }],
        class: studentClass,
        tests: {
          stageTest: { status: 'לא נבחן', lastTestDate: null, nextTestDate: null, notes: '' },
          technicalTest: { status: 'לא נבחן', lastTestDate: null, nextTestDate: null, notes: '' }
        }
      },
      enrollments: {
        orchestraIds: [],
        ensembleIds: [],
        schoolYears: [{ schoolYearId: this.schoolYearId, isActive: true }],
        theoryLessonIds: [],
        teacherIds: [],
        teacherAssignments: []
      },
      scheduleInfo: {
        day: null,
        startTime: null,
        endTime: null,
        duration: studentData.lessonDuration || 45,
        location: null,
        notes: null,
        isActive: true
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const result = await collection.insertOne(student)
    const studentId = result.insertedId.toString()
    this.studentIdMap.set(studentData.personalInfo.fullName, studentId)
    this.addPartialNameMappings(studentData.personalInfo.fullName, studentId)
    this.stats.studentsCreated++
    console.log(`  ✓ Created student: ${studentData.personalInfo.fullName}`)
    return studentId
  }

  addPartialNameMappings(fullName, studentId) {
    this.studentByPartialName.set(fullName.toLowerCase(), studentId)
    const parts = fullName.split(' ')
    if (parts.length >= 2) {
      this.studentByPartialName.set(`${parts[0]} ${parts[1]}`.toLowerCase(), studentId)
      if (parts.length === 3) {
        this.studentByPartialName.set(`${parts[0]} ${parts[1]} ${parts[2]}`.toLowerCase(), studentId)
        this.studentByPartialName.set(`${parts[0]} ${parts[2]}`.toLowerCase(), studentId)
      }
      this.studentByPartialName.set(parts[parts.length - 1].toLowerCase(), studentId)
    }
  }

  findStudentByName(familyName, firstName) {
    const searchVariations = [
      `${familyName} ${firstName}`.toLowerCase(),
      `${firstName} ${familyName}`.toLowerCase(),
      firstName.toLowerCase()
    ]
    
    for (const variation of searchVariations) {
      if (this.studentByPartialName.has(variation)) {
        return this.studentByPartialName.get(variation)
      }
    }
    
    for (const [storedName, studentId] of this.studentByPartialName.entries()) {
      if (storedName.includes(familyName.toLowerCase()) && 
          storedName.includes(firstName.toLowerCase())) {
        return studentId
      }
    }
    
    return null
  }

  // Find the right time block for a lesson
  findTimeBlockForLesson(teacherId, day, time) {
    const timeBlocks = this.teacherTimeBlocks.get(teacherId)
    if (!timeBlocks) return null

    const lessonMinutes = this.timeToMinutes(time)
    
    for (const block of timeBlocks) {
      if (block.day === day) {
        const blockStart = this.timeToMinutes(block.startTime)
        const blockEnd = this.timeToMinutes(block.endTime)
        
        if (lessonMinutes >= blockStart && lessonMinutes < blockEnd) {
          return block
        }
      }
    }
    return null
  }

  timeToMinutes(time) {
    const [hours, mins] = time.split(':').map(Number)
    return hours * 60 + mins
  }

  minutesToTime(minutes) {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
  }

  // Link student to teacher WITH time block validation
  async linkStudentToTeacher(studentId, teacherId, scheduleInfo = null) {
    const studentCollection = this.db.collection('student')
    const teacherCollection = this.db.collection('teacher')

    // Get student info
    const student = await studentCollection.findOne({ _id: new ObjectId(studentId) })
    if (!student) return

    // Prepare student update
    const studentUpdate = {
      $addToSet: { 'enrollments.teacherIds': teacherId }
    }
    
    if (scheduleInfo) {
      // Find matching time block
      const timeBlock = this.findTimeBlockForLesson(teacherId, scheduleInfo.day, scheduleInfo.time)
      
      const endMinutes = this.timeToMinutes(scheduleInfo.time) + scheduleInfo.duration
      const endTime = this.minutesToTime(endMinutes)
      
      // Add teacher assignment
      const assignment = {
        teacherId: teacherId,
        day: scheduleInfo.day,
        time: scheduleInfo.time,
        duration: scheduleInfo.duration,
        isActive: true,
        startDate: new Date(),
        isRecurring: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      studentUpdate.$push = { 'enrollments.teacherAssignments': assignment }
      studentUpdate.$set = {
        'scheduleInfo.day': scheduleInfo.day,
        'scheduleInfo.startTime': scheduleInfo.time,
        'scheduleInfo.endTime': endTime,
        'scheduleInfo.duration': scheduleInfo.duration,
        'scheduleInfo.location': timeBlock?.location || scheduleInfo.room,
        'scheduleInfo.isActive': true,
        updatedAt: new Date()
      }

      // Update student
      await studentCollection.updateOne(
        { _id: new ObjectId(studentId) },
        studentUpdate
      )

      // Update teacher - add to studentIds AND schedule
      const scheduleEntry = {
        studentId: studentId,
        studentName: student.personalInfo.fullName,
        day: scheduleInfo.day,
        startTime: scheduleInfo.time,
        endTime: endTime,
        duration: scheduleInfo.duration,
        instrument: student.academicInfo?.instrumentProgress?.[0]?.instrumentName || 'כלי לא מוגדר',
        location: timeBlock?.location || scheduleInfo.room,
        isRecurring: true,
        recurringType: 'weekly',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      await teacherCollection.updateOne(
        { _id: new ObjectId(teacherId) },
        {
          $addToSet: { 'teaching.studentIds': studentId },
          $push: { 'teaching.schedule': scheduleEntry },
          $set: { updatedAt: new Date() }
        }
      )

      // Also add to time block's assignedLessons if found
      if (timeBlock) {
        await teacherCollection.updateOne(
          { 
            _id: new ObjectId(teacherId),
            'teaching.timeBlocks._id': timeBlock._id 
          },
          {
            $push: {
              'teaching.timeBlocks.$.assignedLessons': {
                studentId: studentId,
                studentName: student.personalInfo.fullName,
                startTime: scheduleInfo.time,
                endTime: endTime,
                duration: scheduleInfo.duration
              }
            }
          }
        )
      }

    } else {
      // Just basic linking without schedule
      await studentCollection.updateOne(
        { _id: new ObjectId(studentId) },
        studentUpdate
      )
      
      await teacherCollection.updateOne(
        { _id: new ObjectId(teacherId) },
        {
          $addToSet: { 'teaching.studentIds': studentId },
          $set: { updatedAt: new Date() }
        }
      )
    }
  }

  // Apply schedules from complete data
  async applySchedules(completeData) {
    console.log('\n--- Applying Schedules ---')
    
    for (const [teacherName, lessons] of Object.entries(completeData.schedules)) {
      const teacherId = this.teacherIdMap.get(teacherName)
      if (!teacherId) {
        console.log(`  ⚠ Teacher not found: ${teacherName}`)
        continue
      }
      
      if (!lessons || lessons.length === 0) {
        console.log(`  ⚠ No lessons for: ${teacherName}`)
        continue
      }
      
      console.log(`\n  Processing ${teacherName} (${lessons.length} lessons)...`)
      
      for (const lesson of lessons) {
        const studentId = this.findStudentByName(lesson.studentFamilyName, lesson.studentFirstName)
        
        if (studentId) {
          await this.linkStudentToTeacher(studentId, teacherId, {
            day: lesson.day,
            time: lesson.time,
            duration: lesson.duration,
            room: lesson.room
          })
          this.stats.schedulesCreated++
          console.log(`    ✓ ${lesson.studentFullName}: ${lesson.day} ${lesson.time}`)
        } else {
          this.stats.schedulesNotMatched++
          console.log(`    ⚠ Not matched: ${lesson.studentFullName}`)
        }
      }
    }
  }

  async run() {
    try {
      console.log('\n' + '='.repeat(60))
      console.log('  Complete Seed with Time Blocks')
      console.log('  Strings Department (מחלקת כלי קשת)')
      console.log('='.repeat(60) + '\n')

      await this.connect()
      await this.getOrCreateSchoolYear()

      // Load data files
      const seedDataPath = path.join(__dirname, 'seed_data.json')
      const completeDataPath = path.join(__dirname, 'teacher_complete_data.json')
      
      if (!fs.existsSync(seedDataPath)) {
        throw new Error(`Missing: ${seedDataPath}`)
      }
      
      const seedData = JSON.parse(fs.readFileSync(seedDataPath, 'utf-8'))
      
      // Load complete data (with time blocks)
      let completeData = { teachers: {}, schedules: {} }
      if (fs.existsSync(completeDataPath)) {
        completeData = JSON.parse(fs.readFileSync(completeDataPath, 'utf-8'))
        console.log('✓ Loaded teacher time blocks and schedules')
      } else {
        console.log('⚠ No teacher_complete_data.json found, proceeding without time blocks')
      }

      console.log(`\nData loaded: ${seedData.teachers.length} teachers, ${seedData.students.length} students`)

      // Step 1: Create teachers WITH time blocks
      console.log('\n--- Creating Teachers with Time Blocks ---')
      for (const teacher of seedData.teachers) {
        const timeBlocksData = completeData.teachers[teacher.fullName]?.timeBlocks || []
        await this.createTeacher(teacher, timeBlocksData)
      }

      // Step 2: Create students
      console.log('\n--- Creating Students ---')
      for (const student of seedData.students) {
        await this.createStudent(student)
      }

      // Step 3: Apply schedules (this will link students to teachers properly)
      if (Object.keys(completeData.schedules).length > 0) {
        await this.applySchedules(completeData)
      } else {
        // Fallback: basic linking without schedules
        console.log('\n--- Basic Student-Teacher Linking ---')
        for (const student of seedData.students) {
          const studentId = this.studentIdMap.get(student.personalInfo.fullName)
          const teacherId = this.teacherIdMap.get(student.teacherName)
          
          if (studentId && teacherId) {
            await this.linkStudentToTeacher(studentId, teacherId)
          }
        }
      }

      // Summary
      console.log('\n' + '='.repeat(60))
      console.log('  SEED COMPLETE')
      console.log('='.repeat(60))
      console.log(`  Teachers: ${this.stats.teachersCreated} created, ${this.stats.teachersSkipped} skipped`)
      console.log(`  Time Blocks: ${this.stats.timeBlocksCreated} created`)
      console.log(`  Students: ${this.stats.studentsCreated} created, ${this.stats.studentsSkipped} skipped`)
      console.log(`  Schedules: ${this.stats.schedulesCreated} created, ${this.stats.schedulesNotMatched} not matched`)
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
const seeder = new CompleteSeederWithTimeBlocks()
seeder.run()
