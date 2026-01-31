/**
 * Cleanup duplicate students created by the sync script
 * - Identifies students created today (by sync script)
 * - Checks if older version exists with similar name
 * - Deletes the duplicate and updates teacher references
 */

import 'dotenv/config'
import { MongoClient, ObjectId } from 'mongodb'

// Normalize Hebrew name for comparison
function normalizeName(name) {
  if (!name) return ''
  return name
    .trim()
    .replace(/\s+/g, ' ')           // normalize spaces
    .replace(/־/g, '-')              // normalize dashes
    .replace(/׳/g, "'")              // normalize geresh
    .replace(/״/g, '"')              // normalize gershayim
    .toLowerCase()
}

// Check if two names are similar (same person, different order/format)
function namesMatch(name1, name2) {
  const n1 = normalizeName(name1)
  const n2 = normalizeName(name2)

  if (n1 === n2) return true

  // Try reversing word order
  const words1 = n1.split(' ').filter(w => w.length > 0)
  const words2 = n2.split(' ').filter(w => w.length > 0)

  // Check if same words in different order
  if (words1.length === words2.length && words1.length >= 2) {
    const sorted1 = [...words1].sort().join(' ')
    const sorted2 = [...words2].sort().join(' ')
    if (sorted1 === sorted2) return true
  }

  // Check if one contains all words of the other
  const allWords1InWords2 = words1.every(w => words2.some(w2 => w2.includes(w) || w.includes(w2)))
  const allWords2InWords1 = words2.every(w => words1.some(w1 => w1.includes(w) || w.includes(w1)))

  if (allWords1InWords2 && allWords2InWords1) return true

  return false
}

async function cleanupDuplicates() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI
  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(process.env.MONGODB_NAME || 'Conservatory-DB')

  console.log('======================================================================')
  console.log('  DUPLICATE STUDENT CLEANUP')
  console.log('======================================================================\n')

  // Get all students
  const allStudents = await db.collection('student').find({}).toArray()
  console.log('Total students before cleanup:', allStudents.length)

  // Find students created by sync script (created in last 24 hours with specific pattern)
  const now = new Date()
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  // Group students by normalized name parts
  const studentsByName = new Map()

  allStudents.forEach(student => {
    const name = student.personalInfo?.fullName || ''
    const words = normalizeName(name).split(' ').filter(w => w.length > 1).sort()
    const key = words.join('|')

    if (!studentsByName.has(key)) {
      studentsByName.set(key, [])
    }
    studentsByName.get(key).push(student)
  })

  // Find duplicates - groups with more than one student
  const duplicateGroups = []
  studentsByName.forEach((students, key) => {
    if (students.length > 1) {
      duplicateGroups.push({ key, students })
    }
  })

  console.log('Found', duplicateGroups.length, 'potential duplicate groups\n')

  // For each group, keep the oldest record and delete the rest
  let deletedCount = 0
  let updatedTeachers = 0
  const deletedIds = []

  for (const group of duplicateGroups) {
    // Sort by creation date - oldest first
    const sorted = group.students.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0)
      const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0)
      return dateA - dateB
    })

    const original = sorted[0]
    const duplicates = sorted.slice(1)

    if (duplicates.length === 0) continue

    console.log(`\nGroup: "${original.personalInfo?.fullName}"`)
    console.log(`  Keeping: ${original._id} (${original.createdAt || 'no date'})`)

    for (const dup of duplicates) {
      console.log(`  Deleting: ${dup._id} (${dup.personalInfo?.fullName})`)

      const dupId = dup._id.toString()
      const origId = original._id.toString()

      // Update teacher schedules - replace duplicate ID with original ID
      const teacherUpdateResult = await db.collection('teacher').updateMany(
        { 'teaching.schedule.studentId': dupId },
        {
          $set: {
            'teaching.schedule.$[elem].studentId': origId,
            'teaching.schedule.$[elem].studentName': original.personalInfo?.fullName
          }
        },
        { arrayFilters: [{ 'elem.studentId': dupId }] }
      )

      if (teacherUpdateResult.modifiedCount > 0) {
        console.log(`    Updated ${teacherUpdateResult.modifiedCount} teacher schedule(s)`)
        updatedTeachers += teacherUpdateResult.modifiedCount
      }

      // Update teacher studentIds array
      await db.collection('teacher').updateMany(
        { 'teaching.studentIds': dupId },
        {
          $pull: { 'teaching.studentIds': dupId },
        }
      )
      await db.collection('teacher').updateMany(
        { 'teaching.schedule.studentId': origId },
        {
          $addToSet: { 'teaching.studentIds': origId }
        }
      )

      // Delete the duplicate student
      await db.collection('student').deleteOne({ _id: dup._id })
      deletedCount++
      deletedIds.push(dupId)
    }
  }

  // Also clean up any orphaned schedule entries
  const teachers = await db.collection('teacher').find({
    'teaching.schedule': { $exists: true, $ne: [] }
  }).toArray()

  for (const teacher of teachers) {
    const schedule = teacher.teaching?.schedule || []
    const validSchedule = []
    let removed = 0

    for (const entry of schedule) {
      // Check if student exists
      const studentExists = await db.collection('student').findOne({
        _id: new ObjectId(entry.studentId)
      })

      if (studentExists) {
        validSchedule.push(entry)
      } else {
        removed++
      }
    }

    if (removed > 0) {
      await db.collection('teacher').updateOne(
        { _id: teacher._id },
        { $set: { 'teaching.schedule': validSchedule } }
      )
      console.log(`Removed ${removed} orphaned schedule entries from ${teacher.personalInfo?.fullName}`)
    }
  }

  // Final count
  const finalCount = await db.collection('student').countDocuments({})

  console.log('\n======================================================================')
  console.log('  CLEANUP COMPLETE')
  console.log('======================================================================')
  console.log('Students deleted:', deletedCount)
  console.log('Teacher schedules updated:', updatedTeachers)
  console.log('Students remaining:', finalCount)
  console.log('======================================================================')

  await client.close()
}

cleanupDuplicates().catch(console.error)
