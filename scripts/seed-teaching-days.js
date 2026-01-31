/**
 * Seed Teaching Days (ימי לימוד) Script
 *
 * This script analyzes the existing teacher schedules and creates
 * teaching.timeBlocks for each teacher based on their lesson times.
 *
 * For each teacher:
 * 1. Reads their students' teacherAssignments
 * 2. Groups lessons by day
 * 3. Creates timeBlocks covering their teaching hours
 * 4. Marks which time slots are taken vs available
 *
 * Usage:
 *   node scripts/seed-teaching-days.js --dry-run    # Preview changes
 *   node scripts/seed-teaching-days.js --apply      # Apply changes
 */

import 'dotenv/config'
import { MongoClient, ObjectId } from 'mongodb'

// String teachers to process
const STRING_TEACHER_NAMES = [
  'סבטלנה אברהם',
  'אנה ארונזון',
  'מרסל ברגמן',
  'סשה דולוב',
  'אלה סלטקין',
  'מרינה זיסקינד',
  'ורוניקה לוין',
  'אלונה קוטליאר',
  'אלסיה פלדמן',
  'לובה רבין'
]

class TeachingDaysSeeder {
  constructor(applyChanges = false) {
    this.applyChanges = applyChanges
    this.client = null
    this.db = null
    this.stats = {
      teachersProcessed: 0,
      timeBlocksCreated: 0,
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

  // Convert time string to minutes since midnight
  timeToMinutes(time) {
    const [hours, minutes] = time.split(':').map(Number)
    return hours * 60 + minutes
  }

  // Convert minutes since midnight to time string
  minutesToTime(minutes) {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
  }

  // Get all lessons for a teacher from student documents
  async getTeacherLessons(teacherId) {
    const students = await this.db.collection('student').find({
      'teacherAssignments.teacherId': teacherId.toString(),
      isActive: true
    }).toArray()

    const lessons = []
    for (const student of students) {
      const assignments = student.teacherAssignments || []
      for (const assignment of assignments) {
        if (assignment.teacherId === teacherId.toString()) {
          lessons.push({
            studentId: student._id.toString(),
            studentName: student.personalInfo?.fullName || 'Unknown',
            day: assignment.day,
            startTime: assignment.time,
            duration: assignment.duration,
            location: assignment.location || '',
            endTime: this.minutesToTime(this.timeToMinutes(assignment.time) + assignment.duration)
          })
        }
      }
    }

    return lessons
  }

  // Group lessons by day and calculate teaching hours
  analyzeSchedule(lessons) {
    const daySchedule = {}

    for (const lesson of lessons) {
      if (!daySchedule[lesson.day]) {
        daySchedule[lesson.day] = {
          lessons: [],
          minStart: Infinity,
          maxEnd: 0,
          locations: new Set()
        }
      }

      const startMins = this.timeToMinutes(lesson.startTime)
      const endMins = this.timeToMinutes(lesson.endTime)

      daySchedule[lesson.day].lessons.push(lesson)
      daySchedule[lesson.day].minStart = Math.min(daySchedule[lesson.day].minStart, startMins)
      daySchedule[lesson.day].maxEnd = Math.max(daySchedule[lesson.day].maxEnd, endMins)
      if (lesson.location) {
        daySchedule[lesson.day].locations.add(lesson.location)
      }
    }

    return daySchedule
  }

  // Create timeBlocks for a teacher based on their schedule
  createTimeBlocks(daySchedule, teacherInstrument) {
    const timeBlocks = []

    for (const [day, data] of Object.entries(daySchedule)) {
      // Round start time down to nearest 15 minutes and subtract 15 for buffer
      let blockStart = Math.floor(data.minStart / 15) * 15 - 15
      if (blockStart < 0) blockStart = 0

      // Round end time up to nearest 15 minutes and add 15 for buffer
      let blockEnd = Math.ceil(data.maxEnd / 15) * 15 + 15

      // Get the most common location for this day
      const location = data.locations.size > 0 ? [...data.locations][0] : ''

      // Calculate total duration
      const totalDuration = blockEnd - blockStart

      // Create the main time block for this day
      const timeBlock = {
        _id: new ObjectId(),
        day: day,
        startTime: this.minutesToTime(blockStart),
        endTime: this.minutesToTime(blockEnd),
        totalDuration: totalDuration,
        location: location,
        notes: null,
        isActive: true,
        recurring: {
          isRecurring: true,
          startDate: new Date(),
          endDate: null,
          excludeDates: []
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }

      timeBlocks.push(timeBlock)
    }

    return timeBlocks
  }

  async processTeacher(teacherName) {
    console.log(`\n  Processing: ${teacherName}`)

    // Find teacher
    const teacher = await this.db.collection('teacher').findOne({
      'personalInfo.fullName': teacherName
    })

    if (!teacher) {
      console.log(`    ⚠ Teacher not found`)
      this.stats.errors.push(`Teacher not found: ${teacherName}`)
      return
    }

    const teacherId = teacher._id.toString()
    const instrument = teacher.professionalInfo?.instrument || 'כינור'

    // Get all lessons for this teacher
    const lessons = await this.getTeacherLessons(teacher._id)

    if (lessons.length === 0) {
      console.log(`    ⚠ No lessons found`)
      return
    }

    console.log(`    Found ${lessons.length} lesson slots`)

    // Analyze schedule to get teaching days
    const daySchedule = this.analyzeSchedule(lessons)

    console.log(`    Teaching days: ${Object.keys(daySchedule).join(', ')}`)

    // Create timeBlocks
    const timeBlocks = this.createTimeBlocks(daySchedule, instrument)

    console.log(`    Creating ${timeBlocks.length} time blocks:`)

    for (const block of timeBlocks) {
      console.log(`      → ${block.day}: ${block.startTime} - ${block.endTime} (${block.totalDuration} min) @ ${block.location || 'TBD'}`)
    }

    if (this.applyChanges) {
      // Update teacher with new timeBlocks
      await this.db.collection('teacher').updateOne(
        { _id: teacher._id },
        {
          $set: {
            'teaching.timeBlocks': timeBlocks,
            updatedAt: new Date()
          }
        }
      )
      console.log(`    ✓ Updated teacher with ${timeBlocks.length} time blocks`)
    } else {
      console.log(`    [DRY RUN] Would create ${timeBlocks.length} time blocks`)
    }

    this.stats.teachersProcessed++
    this.stats.timeBlocksCreated += timeBlocks.length
  }

  async run() {
    try {
      console.log('\n' + '═'.repeat(70))
      console.log('  TEACHING DAYS (ימי לימוד) SEEDER')
      console.log('  Mode: ' + (this.applyChanges ? 'APPLY CHANGES' : 'DRY RUN'))
      console.log('═'.repeat(70))

      await this.connect()

      console.log('\n' + '='.repeat(60))
      console.log('Processing String Teachers')
      console.log('='.repeat(60))

      for (const teacherName of STRING_TEACHER_NAMES) {
        await this.processTeacher(teacherName)
      }

      // Final Summary
      console.log('\n' + '═'.repeat(70))
      console.log('  SEEDING COMPLETE')
      console.log('═'.repeat(70))
      console.log(`  Teachers processed: ${this.stats.teachersProcessed}`)
      console.log(`  Time blocks created: ${this.stats.timeBlocksCreated}`)

      if (this.stats.errors.length > 0) {
        console.log(`\n  Errors (${this.stats.errors.length}):`)
        this.stats.errors.forEach(e => console.log(`    - ${e}`))
      }

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
  console.log('  node scripts/seed-teaching-days.js --dry-run    # Preview changes')
  console.log('  node scripts/seed-teaching-days.js --apply      # Apply changes')
  console.log('')
  console.log('Running in dry-run mode by default...\n')
}

const seeder = new TeachingDaysSeeder(applyChanges)
seeder.run()
