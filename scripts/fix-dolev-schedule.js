/**
 * Fix schedule for אלכס דולוב (was looking for סשה דולוב)
 */

import 'dotenv/config'
import { MongoClient, ObjectId } from 'mongodb'

async function fixDolev() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI
  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(process.env.MONGODB_NAME || 'Conservatory-DB')

  // Find the teacher
  const teacher = await db.collection('teacher').findOne({
    'personalInfo.fullName': 'אלכס דולוב'
  })

  if (!teacher) {
    console.log('Teacher אלכס דולוב not found')
    await client.close()
    return
  }

  console.log('Found teacher:', teacher.personalInfo.fullName)
  const teacherId = teacher._id.toString()

  // Schedule for אלכס דולוב
  const lessons = [
    { day: 'שני', time: '13:15', familyName: 'שחר', firstName: 'זיו', duration: 30, room: 'סטודיו 1' },
    { day: 'שני', time: '13:45', familyName: 'פורת', firstName: 'לביא', duration: 30, room: 'סטודיו 1' },
    { day: 'שני', time: '15:15', familyName: 'גרפילד', firstName: 'נועם', duration: 30, room: 'סטודיו 1' },
    { day: 'שני', time: '17:30', familyName: 'מקובצקי', firstName: 'הלל', duration: 30, room: 'סטודיו 1' },
    { day: 'שני', time: '18:00', familyName: 'סויברט', firstName: 'ניאה', duration: 45, room: 'סטודיו 1' },
    { day: 'שני', time: '18:45', familyName: 'מילס', firstName: 'אביגיל', duration: 45, room: 'סטודיו 1' },
    { day: 'שישי', time: '12:30', familyName: 'שחר', firstName: 'זיו', duration: 30, room: '' },
    { day: 'שישי', time: '13:00', familyName: 'פורת', firstName: 'לביא', duration: 30, room: '' },
    { day: 'שישי', time: '13:30', familyName: 'גרפילד', firstName: 'נועם', duration: 30, room: '' },
    { day: 'שישי', time: '14:00', familyName: 'סויברט', firstName: 'ניאה', duration: 45, room: '' },
    { day: 'שישי', time: '14:45', familyName: 'מילס', firstName: 'אביגיל', duration: 45, room: '' },
    { day: 'שישי', time: '15:30', familyName: 'מקובצקי', firstName: 'הלל', duration: 30, room: '' },
  ]

  // Clear existing schedule
  await db.collection('teacher').updateOne(
    { _id: teacher._id },
    { $set: { 'teaching.schedule': [] } }
  )

  let created = 0
  let notFound = []

  for (const lesson of lessons) {
    // Find student with multiple patterns
    let student = await db.collection('student').findOne({
      'personalInfo.fullName': new RegExp(`${lesson.familyName}.*${lesson.firstName}`, 'i')
    })

    if (!student) {
      student = await db.collection('student').findOne({
        'personalInfo.fullName': new RegExp(`${lesson.firstName}.*${lesson.familyName}`, 'i')
      })
    }

    if (!student) {
      notFound.push(`${lesson.familyName} ${lesson.firstName}`)
      continue
    }

    const [hours, minutes] = lesson.time.split(':').map(Number)
    const totalMinutes = hours * 60 + minutes + lesson.duration
    const endTime = String(Math.floor(totalMinutes / 60)).padStart(2, '0') + ':' + String(totalMinutes % 60).padStart(2, '0')

    const scheduleEntry = {
      _id: new ObjectId().toString(),
      studentId: student._id.toString(),
      studentName: student.personalInfo.fullName,
      day: lesson.day,
      startTime: lesson.time,
      endTime: endTime,
      duration: lesson.duration,
      instrument: student.academicInfo?.instrumentProgress?.[0]?.instrumentName || 'צ\'לו',
      location: lesson.room,
      isRecurring: true,
      recurringType: 'weekly',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    }

    await db.collection('teacher').updateOne(
      { _id: teacher._id },
      {
        $push: { 'teaching.schedule': scheduleEntry },
        $addToSet: { 'teaching.studentIds': student._id.toString() }
      }
    )

    created++
  }

  console.log('Created', created, 'lessons for אלכס דולוב')
  if (notFound.length > 0) {
    console.log('Students not found:', notFound.join(', '))
  }

  await client.close()
}

fixDolev().catch(console.error)
