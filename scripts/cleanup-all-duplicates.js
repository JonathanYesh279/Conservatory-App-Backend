/**
 * Cleanup duplicate schedule entries for all strings teachers
 */

import 'dotenv/config'
import { MongoClient } from 'mongodb'

async function cleanupAllTeachers() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI
  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(process.env.MONGODB_NAME || 'Conservatory-DB')

  console.log('Cleaning up duplicate schedule entries...')
  console.log('')

  const teacherNames = [
    'מרינה זיסקינד',
    'סבטלנה אברהם',
    'אנה ארונזון',
    'מרסל ברגמן',
    'אלכס דולוב',
    'אלה סלטקין',
    'ורוניקה לוין',
    'אלסיה פלדמן',
    'אלונה קוטליאר',
    'לובה רבין'
  ]

  for (const name of teacherNames) {
    const teacher = await db.collection('teacher').findOne({
      'personalInfo.fullName': name
    })

    if (!teacher) continue

    const schedule = teacher.teaching?.schedule || []
    if (schedule.length === 0) continue

    // Find unique entries by studentId + day + startTime
    const seen = new Set()
    const unique = []
    let duplicates = 0

    schedule.forEach(entry => {
      const key = entry.studentId + '|' + entry.day + '|' + entry.startTime
      if (!seen.has(key)) {
        seen.add(key)
        unique.push(entry)
      } else {
        duplicates++
      }
    })

    if (duplicates > 0) {
      await db.collection('teacher').updateOne(
        { _id: teacher._id },
        { $set: { 'teaching.schedule': unique } }
      )
      console.log(name + ': removed ' + duplicates + ' duplicates (now ' + unique.length + ' lessons)')
    }
  }

  console.log('')
  console.log('Cleanup complete!')
  await client.close()
}

cleanupAllTeachers().catch(console.error)
