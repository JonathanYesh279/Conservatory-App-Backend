/**
 * Cleanup duplicate schedule entries
 */

import 'dotenv/config'
import { MongoClient } from 'mongodb'

async function cleanDuplicates() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI
  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(process.env.MONGODB_NAME || 'Conservatory-DB')

  const teacher = await db.collection('teacher').findOne(
    { 'personalInfo.fullName': 'מרינה זיסקינד' }
  )

  const schedule = teacher?.teaching?.schedule || []
  console.log('Total entries before cleanup:', schedule.length)

  // Find unique entries by studentId + day + startTime
  const seen = new Set()
  const unique = []
  const duplicates = []

  schedule.forEach(entry => {
    const key = entry.studentId + '|' + entry.day + '|' + entry.startTime
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(entry)
    } else {
      duplicates.push(entry)
    }
  })

  console.log('Unique entries:', unique.length)
  console.log('Duplicates to remove:', duplicates.length)

  if (duplicates.length > 0) {
    // Update with only unique entries
    await db.collection('teacher').updateOne(
      { _id: teacher._id },
      { $set: { 'teaching.schedule': unique } }
    )
    console.log('Cleaned up duplicates!')
  }

  await client.close()
}

cleanDuplicates().catch(console.error)
