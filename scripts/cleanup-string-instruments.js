/**
 * String Instruments Cleanup Script
 *
 * This script removes all teachers and students related to string instruments
 * (כינור - violin, צ'לו - cello) from the database.
 *
 * It performs cascade deletions following the existing patterns in the codebase,
 * cleaning up all related data including:
 * - Teacher records and their schedules
 * - Student records
 * - Orchestra memberships
 * - Rehearsal attendance (archived)
 * - Theory lesson enrollments
 * - Bagrut records (archived)
 * - Activity attendance (archived)
 *
 * IMPORTANT: Run with DRY_RUN=true first to preview what will be deleted!
 *
 * Usage:
 *   DRY_RUN=true node scripts/cleanup-string-instruments.js   # Preview only
 *   DRY_RUN=false node scripts/cleanup-string-instruments.js  # Actually delete
 */

import 'dotenv/config'
import { MongoClient, ObjectId } from 'mongodb'

// Configuration
const DRY_RUN = process.env.DRY_RUN !== 'false'  // Default to true for safety
const INSTRUMENTS_TO_REMOVE = ['נבל', 'ויולה']  // Harp and Viola

// Known string instrument teachers (from seed data)
const STRING_TEACHER_NAMES = [
  // נבל (Harp) teachers
  'סוחובוק זינה', 'זינה סוחובוק',
  // ויולה (Viola) teachers - Note: Marina Ziskind was already deleted with violin
  'זיסקינד מרינה', 'מרינה זיסקינד',
]

class StringInstrumentsCleanup {
  constructor() {
    this.client = null
    this.db = null
    this.stats = {
      studentsFound: 0,
      studentsDeleted: 0,
      teachersFound: 0,
      teachersDeleted: 0,
      orchestrasUpdated: 0,
      rehearsalsArchived: 0,
      theoryLessonsUpdated: 0,
      bagrutArchived: 0,
      attendanceArchived: 0,
      errors: []
    }
    this.deletedStudentIds = []
    this.deletedTeacherIds = []
  }

  async connect() {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI
    if (!uri) throw new Error('MongoDB URI not found in environment variables')

    this.client = new MongoClient(uri)
    await this.client.connect()
    this.db = this.client.db(process.env.MONGODB_NAME || 'Conservatory-DB')
    console.log('✓ Connected to MongoDB')
    console.log(`  Database: ${this.db.databaseName}`)
  }

  async disconnect() {
    if (this.client) {
      await this.client.close()
      console.log('✓ Disconnected from MongoDB')
    }
  }

  /**
   * Find all students with string instruments (כינור or צ'לו)
   */
  async findStringInstrumentStudents() {
    const students = await this.db.collection('student').find({
      $or: [
        { 'academicInfo.instrumentProgress.instrumentName': { $in: INSTRUMENTS_TO_REMOVE } },
        { 'academicInfo.instrument': { $in: INSTRUMENTS_TO_REMOVE } }
      ],
      deleted: { $ne: true }
    }).toArray()

    return students
  }

  /**
   * Find all teachers who teach string instruments
   */
  async findStringInstrumentTeachers() {
    // Method 1: Find by known teacher names
    const teachersByName = await this.db.collection('teacher').find({
      'personalInfo.fullName': {
        $in: STRING_TEACHER_NAMES.map(name => new RegExp(name.split(' ').join('.*'), 'i'))
      },
      deleted: { $ne: true }
    }).toArray()

    // Method 2: Find teachers who have string instrument students assigned
    const studentIds = this.deletedStudentIds.length > 0
      ? this.deletedStudentIds
      : (await this.findStringInstrumentStudents()).map(s => s._id.toString())

    const teachersByStudents = await this.db.collection('teacher').find({
      $or: [
        { 'teaching.studentIds': { $in: studentIds } },
        { 'teaching.schedule.studentId': { $in: studentIds.map(id => new ObjectId(id)) } }
      ],
      deleted: { $ne: true }
    }).toArray()

    // Combine and deduplicate
    const teacherMap = new Map()
    ;[...teachersByName, ...teachersByStudents].forEach(t => {
      teacherMap.set(t._id.toString(), t)
    })

    return Array.from(teacherMap.values())
  }

  /**
   * Remove student from all teacher assignments and schedules
   */
  async removeStudentFromTeachers(studentId) {
    const studentIdStr = studentId.toString()
    const studentObjId = new ObjectId(studentId)

    // Remove from teaching.studentIds
    const result1 = await this.db.collection('teacher').updateMany(
      { 'teaching.studentIds': studentIdStr },
      {
        $pull: { 'teaching.studentIds': studentIdStr },
        $set: { 'cascadeMetadata.lastUpdated': new Date() }
      }
    )

    // Remove from teaching.schedule and mark slots as available
    const result2 = await this.db.collection('teacher').updateMany(
      { 'teaching.schedule.studentId': { $in: [studentIdStr, studentObjId] } },
      {
        $set: {
          'teaching.schedule.$[slot].studentId': null,
          'teaching.schedule.$[slot].studentName': null,
          'teaching.schedule.$[slot].status': 'available',
          'teaching.schedule.$[slot].updatedAt': new Date()
        }
      },
      {
        arrayFilters: [{
          $or: [
            { 'slot.studentId': studentIdStr },
            { 'slot.studentId': studentObjId }
          ]
        }]
      }
    )

    // Also clean up teaching.timeBlocks if it exists
    await this.db.collection('teacher').updateMany(
      { 'teaching.timeBlocks.studentId': { $in: [studentIdStr, studentObjId] } },
      {
        $set: {
          'teaching.timeBlocks.$[block].studentId': null,
          'teaching.timeBlocks.$[block].studentName': null,
          'teaching.timeBlocks.$[block].status': 'available',
          'teaching.timeBlocks.$[block].updatedAt': new Date()
        }
      },
      {
        arrayFilters: [{
          $or: [
            { 'block.studentId': studentIdStr },
            { 'block.studentId': studentObjId }
          ]
        }]
      }
    )

    return Math.max(result1.modifiedCount, result2.modifiedCount)
  }

  /**
   * Remove student from orchestra memberships
   */
  async removeStudentFromOrchestras(studentId) {
    const studentIdStr = studentId.toString()
    const studentObjId = new ObjectId(studentId)

    const result = await this.db.collection('orchestra').updateMany(
      { memberIds: { $in: [studentIdStr, studentObjId] } },
      {
        $pull: { memberIds: { $in: [studentIdStr, studentObjId] } },
        $set: { 'cascadeMetadata.lastUpdated': new Date() }
      }
    )

    return result.modifiedCount
  }

  /**
   * Archive student rehearsal attendance
   */
  async archiveStudentRehearsalAttendance(studentId) {
    const studentObjId = new ObjectId(studentId)

    const result = await this.db.collection('rehearsal').updateMany(
      { 'attendance.studentId': studentObjId },
      {
        $set: {
          'attendance.$[elem].archived': true,
          'attendance.$[elem].archivedAt': new Date(),
          'attendance.$[elem].archivedReason': 'string_instruments_cleanup'
        }
      },
      {
        arrayFilters: [{ 'elem.studentId': studentObjId }]
      }
    )

    return result.modifiedCount
  }

  /**
   * Remove student from theory lessons
   */
  async removeStudentFromTheoryLessons(studentId) {
    const studentIdStr = studentId.toString()
    const studentObjId = new ObjectId(studentId)

    const result = await this.db.collection('theory_lesson').updateMany(
      { studentIds: { $in: [studentIdStr, studentObjId] } },
      {
        $pull: { studentIds: { $in: [studentIdStr, studentObjId] } },
        $set: { 'cascadeMetadata.lastUpdated': new Date() }
      }
    )

    return result.modifiedCount
  }

  /**
   * Archive student bagrut records
   */
  async archiveStudentBagrut(studentId) {
    const studentObjId = new ObjectId(studentId)

    const result = await this.db.collection('bagrut').updateMany(
      { studentId: studentObjId },
      {
        $set: {
          isActive: false,
          archived: true,
          archivedAt: new Date(),
          archivedReason: 'string_instruments_cleanup'
        }
      }
    )

    return result.modifiedCount
  }

  /**
   * Archive student activity attendance
   */
  async archiveStudentAttendance(studentId) {
    const studentObjId = new ObjectId(studentId)

    const result = await this.db.collection('activity_attendance').updateMany(
      { studentId: studentObjId },
      {
        $set: {
          archived: true,
          archivedAt: new Date(),
          archivedReason: 'string_instruments_cleanup'
        }
      }
    )

    return result.modifiedCount
  }

  /**
   * Hard delete a student record
   */
  async deleteStudent(studentId) {
    const result = await this.db.collection('student').deleteOne({
      _id: new ObjectId(studentId)
    })

    return result.deletedCount
  }

  /**
   * Process a single student deletion with cascade cleanup
   */
  async processStudentDeletion(student) {
    const studentId = student._id
    const studentName = student.personalInfo?.fullName || 'Unknown'
    const instrument = student.academicInfo?.instrumentProgress?.[0]?.instrumentName ||
                       student.academicInfo?.instrument || 'Unknown'

    console.log(`\n  Processing student: ${studentName} (${instrument})`)

    if (DRY_RUN) {
      console.log(`    [DRY RUN] Would delete student and cascade cleanup`)
      this.stats.studentsDeleted++
      this.deletedStudentIds.push(studentId.toString())
      return
    }

    try {
      // 1. Remove from teachers
      const teacherCleanup = await this.removeStudentFromTeachers(studentId)
      if (teacherCleanup > 0) console.log(`    - Removed from ${teacherCleanup} teacher(s)`)

      // 2. Remove from orchestras
      const orchestraCleanup = await this.removeStudentFromOrchestras(studentId)
      if (orchestraCleanup > 0) {
        console.log(`    - Removed from ${orchestraCleanup} orchestra(s)`)
        this.stats.orchestrasUpdated += orchestraCleanup
      }

      // 3. Archive rehearsal attendance
      const rehearsalCleanup = await this.archiveStudentRehearsalAttendance(studentId)
      if (rehearsalCleanup > 0) {
        console.log(`    - Archived ${rehearsalCleanup} rehearsal record(s)`)
        this.stats.rehearsalsArchived += rehearsalCleanup
      }

      // 4. Remove from theory lessons
      const theoryCleanup = await this.removeStudentFromTheoryLessons(studentId)
      if (theoryCleanup > 0) {
        console.log(`    - Removed from ${theoryCleanup} theory lesson(s)`)
        this.stats.theoryLessonsUpdated += theoryCleanup
      }

      // 5. Archive bagrut records
      const bagrutCleanup = await this.archiveStudentBagrut(studentId)
      if (bagrutCleanup > 0) {
        console.log(`    - Archived ${bagrutCleanup} bagrut record(s)`)
        this.stats.bagrutArchived += bagrutCleanup
      }

      // 6. Archive activity attendance
      const attendanceCleanup = await this.archiveStudentAttendance(studentId)
      if (attendanceCleanup > 0) {
        console.log(`    - Archived ${attendanceCleanup} attendance record(s)`)
        this.stats.attendanceArchived += attendanceCleanup
      }

      // 7. Delete the student record
      const deleted = await this.deleteStudent(studentId)
      if (deleted > 0) {
        console.log(`    ✓ Student deleted`)
        this.stats.studentsDeleted++
        this.deletedStudentIds.push(studentId.toString())
      }

    } catch (error) {
      console.log(`    ✗ Error: ${error.message}`)
      this.stats.errors.push(`Student ${studentName}: ${error.message}`)
    }
  }

  /**
   * Remove teacher from all related data
   */
  async removeTeacherFromOrchestras(teacherId) {
    const teacherIdStr = teacherId.toString()
    const teacherObjId = new ObjectId(teacherId)

    // Remove as conductor
    const result = await this.db.collection('orchestra').updateMany(
      { conductorId: { $in: [teacherIdStr, teacherObjId] } },
      {
        $set: {
          conductorId: null,
          'cascadeMetadata.lastUpdated': new Date()
        }
      }
    )

    return result.modifiedCount
  }

  /**
   * Remove teacher from theory lessons
   */
  async removeTeacherFromTheoryLessons(teacherId) {
    const teacherIdStr = teacherId.toString()
    const teacherObjId = new ObjectId(teacherId)

    const result = await this.db.collection('theory_lesson').updateMany(
      { teacherId: { $in: [teacherIdStr, teacherObjId] } },
      {
        $set: {
          teacherId: null,
          'cascadeMetadata.lastUpdated': new Date()
        }
      }
    )

    return result.modifiedCount
  }

  /**
   * Remove teacher references from remaining students (if any)
   */
  async removeTeacherFromStudents(teacherId) {
    const teacherIdStr = teacherId.toString()
    const teacherObjId = new ObjectId(teacherId)

    const result = await this.db.collection('student').updateMany(
      {
        $or: [
          { 'enrollments.teacherIds': teacherIdStr },
          { 'enrollments.teacherIds': teacherObjId },
          { 'enrollments.teacherAssignments.teacherId': teacherIdStr },
          { 'enrollments.teacherAssignments.teacherId': teacherObjId },
          { 'scheduleInfo.lessonSchedule.teacherId': teacherIdStr },
          { 'scheduleInfo.lessonSchedule.teacherId': teacherObjId }
        ]
      },
      {
        $pull: {
          'enrollments.teacherIds': { $in: [teacherIdStr, teacherObjId] },
          'enrollments.teacherAssignments': { teacherId: { $in: [teacherIdStr, teacherObjId] } },
          'scheduleInfo.lessonSchedule': { teacherId: { $in: [teacherIdStr, teacherObjId] } }
        },
        $set: { updatedAt: new Date() }
      }
    )

    return result.modifiedCount
  }

  /**
   * Hard delete a teacher record
   */
  async deleteTeacher(teacherId) {
    const result = await this.db.collection('teacher').deleteOne({
      _id: new ObjectId(teacherId)
    })

    return result.deletedCount
  }

  /**
   * Process a single teacher deletion with cascade cleanup
   */
  async processTeacherDeletion(teacher) {
    const teacherId = teacher._id
    const teacherName = teacher.personalInfo?.fullName || 'Unknown'

    console.log(`\n  Processing teacher: ${teacherName}`)

    if (DRY_RUN) {
      console.log(`    [DRY RUN] Would delete teacher and cascade cleanup`)
      this.stats.teachersDeleted++
      this.deletedTeacherIds.push(teacherId.toString())
      return
    }

    try {
      // 1. Remove from orchestras (as conductor)
      const orchestraCleanup = await this.removeTeacherFromOrchestras(teacherId)
      if (orchestraCleanup > 0) console.log(`    - Removed from ${orchestraCleanup} orchestra(s) as conductor`)

      // 2. Remove from theory lessons
      const theoryCleanup = await this.removeTeacherFromTheoryLessons(teacherId)
      if (theoryCleanup > 0) console.log(`    - Removed from ${theoryCleanup} theory lesson(s)`)

      // 3. Remove references from remaining students
      const studentCleanup = await this.removeTeacherFromStudents(teacherId)
      if (studentCleanup > 0) console.log(`    - Removed from ${studentCleanup} student(s)`)

      // 4. Delete the teacher record
      const deleted = await this.deleteTeacher(teacherId)
      if (deleted > 0) {
        console.log(`    ✓ Teacher deleted`)
        this.stats.teachersDeleted++
        this.deletedTeacherIds.push(teacherId.toString())
      }

    } catch (error) {
      console.log(`    ✗ Error: ${error.message}`)
      this.stats.errors.push(`Teacher ${teacherName}: ${error.message}`)
    }
  }

  /**
   * Create audit record for the cleanup operation
   */
  async createAuditRecord() {
    if (DRY_RUN) return null

    const auditRecord = {
      operationType: 'string_instruments_bulk_cleanup',
      instrumentsRemoved: INSTRUMENTS_TO_REMOVE,
      studentsDeleted: this.deletedStudentIds,
      teachersDeleted: this.deletedTeacherIds,
      statistics: this.stats,
      timestamp: new Date(),
      reason: 'Database cleanup for string instruments re-seeding'
    }

    const result = await this.db.collection('deletion_audit').insertOne(auditRecord)
    return result.insertedId
  }

  /**
   * Main execution
   */
  async run() {
    try {
      console.log('\n' + '='.repeat(70))
      console.log('  STRING INSTRUMENTS CLEANUP SCRIPT')
      console.log('='.repeat(70))
      console.log(`\n  Mode: ${DRY_RUN ? 'DRY RUN (no changes will be made)' : 'LIVE (changes will be permanent!)'}`)
      console.log(`  Instruments to remove: ${INSTRUMENTS_TO_REMOVE.join(', ')}`)
      console.log('')

      await this.connect()

      // Phase 1: Find and delete students
      console.log('\n' + '-'.repeat(50))
      console.log('  PHASE 1: Processing Students')
      console.log('-'.repeat(50))

      const students = await this.findStringInstrumentStudents()
      this.stats.studentsFound = students.length
      console.log(`\n  Found ${students.length} students with string instruments`)

      for (const student of students) {
        await this.processStudentDeletion(student)
      }

      // Phase 2: Find and delete teachers
      console.log('\n' + '-'.repeat(50))
      console.log('  PHASE 2: Processing Teachers')
      console.log('-'.repeat(50))

      const teachers = await this.findStringInstrumentTeachers()
      this.stats.teachersFound = teachers.length
      console.log(`\n  Found ${teachers.length} teachers for string instruments`)

      for (const teacher of teachers) {
        await this.processTeacherDeletion(teacher)
      }

      // Create audit record
      if (!DRY_RUN) {
        const auditId = await this.createAuditRecord()
        console.log(`\n  Audit record created: ${auditId}`)
      }

      // Summary
      console.log('\n' + '='.repeat(70))
      console.log('  CLEANUP SUMMARY')
      console.log('='.repeat(70))
      console.log(`\n  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
      console.log('')
      console.log('  Students:')
      console.log(`    Found: ${this.stats.studentsFound}`)
      console.log(`    ${DRY_RUN ? 'Would delete' : 'Deleted'}: ${this.stats.studentsDeleted}`)
      console.log('')
      console.log('  Teachers:')
      console.log(`    Found: ${this.stats.teachersFound}`)
      console.log(`    ${DRY_RUN ? 'Would delete' : 'Deleted'}: ${this.stats.teachersDeleted}`)

      if (!DRY_RUN) {
        console.log('')
        console.log('  Cascade cleanup:')
        console.log(`    Orchestras updated: ${this.stats.orchestrasUpdated}`)
        console.log(`    Rehearsals archived: ${this.stats.rehearsalsArchived}`)
        console.log(`    Theory lessons updated: ${this.stats.theoryLessonsUpdated}`)
        console.log(`    Bagrut records archived: ${this.stats.bagrutArchived}`)
        console.log(`    Attendance archived: ${this.stats.attendanceArchived}`)
      }

      if (this.stats.errors.length > 0) {
        console.log('')
        console.log('  Errors:')
        this.stats.errors.forEach(e => console.log(`    - ${e}`))
      }

      console.log('')
      console.log('='.repeat(70))

      if (DRY_RUN) {
        console.log('\n  ⚠️  This was a DRY RUN. No changes were made.')
        console.log('  To actually delete, run with: DRY_RUN=false node scripts/cleanup-string-instruments.js')
      } else {
        console.log('\n  ✓ Cleanup completed successfully!')
        console.log('  You can now run the string instruments seed script.')
      }

      console.log('')

    } catch (error) {
      console.error('\n  ✗ Fatal error:', error)
      process.exit(1)
    } finally {
      await this.disconnect()
    }
  }
}

// Run the cleanup
const cleanup = new StringInstrumentsCleanup()
cleanup.run()
