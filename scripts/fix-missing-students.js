/**
 * Fix Missing Students for מרינה זיסקינד
 */

import 'dotenv/config'
import { MongoClient, ObjectId } from 'mongodb'

async function fixMissing() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI
  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(process.env.MONGODB_NAME || 'Conservatory-DB')

  const teacherId = '6968e2d7af3c756786155ff5'

  // Missing lessons to add (corrected names)
  const missingLessons = [
    // וינברג שרה -> שרה ויינברג
    { studentName: 'שרה ויינברג', day: 'ראשון', time: '14:15', duration: 45, room: '23' },
    { studentName: 'שרה ויינברג', day: 'חמישי', time: '14:15', duration: 45, room: '23' },
    // גולברג מארק -> מארק גולדברג (assuming same person, different spelling)
    { studentName: 'מארק גולדברג', day: 'ראשון', time: '15:00', duration: 45, room: '23' },
    { studentName: 'מארק גולדברג', day: 'רביעי', time: '18:00', duration: 45, room: '23' },
  ]

  console.log('Fixing missing students...\n')

  for (const lesson of missingLessons) {
    const student = await db.collection('student').findOne({
      'personalInfo.fullName': lesson.studentName
    })

    if (!student) {
      console.log('Still not found:', lesson.studentName)
      continue
    }

    const studentId = student._id.toString()
    const [hours, mins] = lesson.time.split(':').map(Number)
    const endMinutes = hours * 60 + mins + lesson.duration
    const endTime = String(Math.floor(endMinutes / 60)).padStart(2, '0') + ':' + String(endMinutes % 60).padStart(2, '0')
    const instrument = student.academicInfo?.instrumentProgress?.[0]?.instrumentName || 'כינור'

    console.log('Adding:', lesson.studentName, lesson.day, lesson.time + '-' + endTime)

    // Update student
    await db.collection('student').updateOne(
      { _id: student._id },
      {
        $push: {
          teacherAssignments: {
            teacherId: teacherId,
            day: lesson.day,
            time: lesson.time,
            duration: lesson.duration,
            location: lesson.room,
            isActive: true,
            isRecurring: true,
            startDate: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
          },
          'enrollments.teacherAssignments': {
            teacherId: teacherId,
            day: lesson.day,
            time: lesson.time,
            duration: lesson.duration,
            location: lesson.room,
            isActive: true,
            isRecurring: true,
            startDate: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
          }
        },
        $addToSet: { 'enrollments.teacherIds': teacherId }
      }
    )

    // Update teacher
    await db.collection('teacher').updateOne(
      { _id: new ObjectId(teacherId) },
      {
        $push: {
          'teaching.schedule': {
            _id: new ObjectId().toString(),
            studentId: studentId,
            studentName: lesson.studentName,
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
        },
        $addToSet: { 'teaching.studentIds': studentId }
      }
    )
  }

  console.log('\nDone!')
  await client.close()
}

fixMissing().catch(console.error)
