/**
 * Fetch all students and check for duplicates
 */

import 'dotenv/config'
import { MongoClient } from 'mongodb'

async function checkDuplicates() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI
  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(process.env.MONGODB_NAME || 'Conservatory-DB')

  console.log('======================================================================')
  console.log('  STUDENT DUPLICATE CHECK')
  console.log('======================================================================\n')

  // Fetch all students
  const students = await db.collection('student').find({}).toArray()
  console.log('Total students in database:', students.length)
  console.log('')

  // Check for duplicates by full name
  const byName = new Map()
  students.forEach(s => {
    const name = s.personalInfo?.fullName || 'Unknown'
    if (!byName.has(name)) {
      byName.set(name, [])
    }
    byName.get(name).push(s)
  })

  // Find duplicates
  const duplicatesByName = []
  byName.forEach((list, name) => {
    if (list.length > 1) {
      duplicatesByName.push({ name, count: list.length, students: list })
    }
  })

  if (duplicatesByName.length > 0) {
    console.log('DUPLICATES BY NAME:')
    console.log('-'.repeat(70))
    duplicatesByName.forEach(dup => {
      console.log(`\n"${dup.name}" appears ${dup.count} times:`)
      dup.students.forEach(s => {
        const phone = s.personalInfo?.phone || s.contactInfo?.phone || 'N/A'
        const email = s.personalInfo?.email || s.contactInfo?.email || 'N/A'
        const isActive = s.isActive !== false ? 'Active' : 'Inactive'
        console.log(`  - ID: ${s._id} | Phone: ${phone} | Email: ${email} | ${isActive}`)
      })
    })
    console.log('')
  } else {
    console.log('No duplicates found by name.')
    console.log('')
  }

  // Check for duplicates by phone
  const byPhone = new Map()
  students.forEach(s => {
    const phone = s.personalInfo?.phone || s.contactInfo?.phone
    if (phone && phone.length > 5) {
      const normalizedPhone = phone.replace(/[-\s]/g, '')
      if (!byPhone.has(normalizedPhone)) {
        byPhone.set(normalizedPhone, [])
      }
      byPhone.get(normalizedPhone).push(s)
    }
  })

  const duplicatesByPhone = []
  byPhone.forEach((list, phone) => {
    if (list.length > 1) {
      duplicatesByPhone.push({ phone, count: list.length, students: list })
    }
  })

  if (duplicatesByPhone.length > 0) {
    console.log('DUPLICATES BY PHONE:')
    console.log('-'.repeat(70))
    duplicatesByPhone.forEach(dup => {
      console.log(`\nPhone "${dup.phone}" shared by ${dup.count} students:`)
      dup.students.forEach(s => {
        const name = s.personalInfo?.fullName || 'Unknown'
        console.log(`  - ${name} (ID: ${s._id})`)
      })
    })
    console.log('')
  } else {
    console.log('No duplicates found by phone.')
    console.log('')
  }

  // Check for duplicates by email
  const byEmail = new Map()
  students.forEach(s => {
    const email = s.personalInfo?.email || s.contactInfo?.email
    if (email && email.includes('@')) {
      const normalizedEmail = email.toLowerCase().trim()
      if (!byEmail.has(normalizedEmail)) {
        byEmail.set(normalizedEmail, [])
      }
      byEmail.get(normalizedEmail).push(s)
    }
  })

  const duplicatesByEmail = []
  byEmail.forEach((list, email) => {
    if (list.length > 1) {
      duplicatesByEmail.push({ email, count: list.length, students: list })
    }
  })

  if (duplicatesByEmail.length > 0) {
    console.log('DUPLICATES BY EMAIL:')
    console.log('-'.repeat(70))
    duplicatesByEmail.forEach(dup => {
      console.log(`\nEmail "${dup.email}" shared by ${dup.count} students:`)
      dup.students.forEach(s => {
        const name = s.personalInfo?.fullName || 'Unknown'
        console.log(`  - ${name} (ID: ${s._id})`)
      })
    })
    console.log('')
  } else {
    console.log('No duplicates found by email.')
    console.log('')
  }

  // Summary
  console.log('======================================================================')
  console.log('  SUMMARY')
  console.log('======================================================================')
  console.log('Total students:', students.length)
  console.log('Duplicate names:', duplicatesByName.length)
  console.log('Shared phones:', duplicatesByPhone.length)
  console.log('Shared emails:', duplicatesByEmail.length)
  console.log('======================================================================')

  await client.close()
}

checkDuplicates().catch(console.error)
