// Migration script to update existing bagrut records from 3 to 4 presentations
// and add new grading fields

import { getCollection } from '../services/mongoDB.service.js'
import { connectToDatabase, closeDatabaseConnection } from '../services/mongoDB.service.js'

const GRADE_LEVELS = {
  'מעולה': { min: 95, max: 100 },
  'טוב מאוד': { min: 90, max: 94 },
  'טוב': { min: 75, max: 89 },
  'מספיק': { min: 55, max: 74 },
  'מספיק בקושי': { min: 45, max: 54 },
  'לא עבר/ה': { min: 0, max: 44 }
}

function getGradeLevelFromScore(score) {
  if (score === null || score === undefined) return null
  
  for (const [level, range] of Object.entries(GRADE_LEVELS)) {
    if (score >= range.min && score <= range.max) {
      return level
    }
  }
  return 'לא עבר/ה'
}

async function migrateBagrut() {
  try {
    console.log('Starting Bagrut migration to 4 presentations...')
    
    await connectToDatabase()
    const collection = await getCollection('bagrut')
    
    // Find all bagruts that need migration (have 3 presentations)
    const bagrutsToMigrate = await collection.find({
      $or: [
        { presentations: { $size: 3 } },
        { gradingDetails: { $exists: false } },
        { finalGrade: { $exists: false } },
        { 'presentations.0.grade': { $exists: false } }
      ]
    }).toArray()
    
    console.log(`Found ${bagrutsToMigrate.length} bagrut records to migrate`)
    
    let successCount = 0
    let errorCount = 0
    
    for (const bagrut of bagrutsToMigrate) {
      try {
        console.log(`Migrating bagrut ${bagrut._id} for student ${bagrut.studentId}`)
        
        const updates = {}
        
        // Update presentations to include grade fields and ensure 4 presentations
        if (!bagrut.presentations || bagrut.presentations.length < 4) {
          const updatedPresentations = []
          
          // Update existing presentations with grade fields
          const existingPresentations = bagrut.presentations || []
          for (let i = 0; i < 3; i++) {
            const presentation = existingPresentations[i] || {
              completed: false,
              status: 'לא נבחן',
              date: null,
              review: null,
              reviewedBy: null
            }
            
            updatedPresentations.push({
              ...presentation,
              grade: presentation.grade || null,
              gradeLevel: presentation.gradeLevel || (presentation.grade ? getGradeLevelFromScore(presentation.grade) : null)
            })
          }
          
          // Add 4th presentation if it doesn't exist
          if (existingPresentations.length < 4) {
            updatedPresentations.push({
              completed: false,
              status: 'לא נבחן',
              date: null,
              review: null,
              reviewedBy: null,
              grade: null,
              gradeLevel: null
            })
          }
          
          updates.presentations = updatedPresentations
        }
        
        // Add grading details if missing
        if (!bagrut.gradingDetails) {
          updates.gradingDetails = {
            technique: { grade: null, maxPoints: 20, comments: '' },
            interpretation: { grade: null, maxPoints: 30, comments: '' },
            musicality: { grade: null, maxPoints: 40, comments: '' },
            overall: { grade: null, maxPoints: 10, comments: '' }
          }
        }
        
        // Update magenBagrut with grade fields if missing
        if (bagrut.magenBagrut) {
          updates['magenBagrut.grade'] = bagrut.magenBagrut.grade || null
          updates['magenBagrut.gradeLevel'] = bagrut.magenBagrut.gradeLevel || 
            (bagrut.magenBagrut.grade ? getGradeLevelFromScore(bagrut.magenBagrut.grade) : null)
        }
        
        // Add new fields if missing
        if (!bagrut.hasOwnProperty('conservatoryName')) {
          updates.conservatoryName = ''
        }
        if (!bagrut.hasOwnProperty('finalGrade')) {
          updates.finalGrade = null
        }
        if (!bagrut.hasOwnProperty('finalGradeLevel')) {
          updates.finalGradeLevel = null
        }
        if (!bagrut.hasOwnProperty('teacherSignature')) {
          updates.teacherSignature = ''
        }
        if (!bagrut.hasOwnProperty('completionDate')) {
          updates.completionDate = null
        }
        if (!bagrut.hasOwnProperty('isCompleted')) {
          updates.isCompleted = false
        }
        
        // Add movement field to program pieces if missing
        if (bagrut.program && bagrut.program.length > 0) {
          const updatedProgram = bagrut.program.map(piece => ({
            ...piece,
            movement: piece.movement || ''
          }))
          updates.program = updatedProgram
        }
        
        updates.updatedAt = new Date()
        
        await collection.updateOne(
          { _id: bagrut._id },
          { $set: updates }
        )
        
        successCount++
        console.log(`✅ Successfully migrated bagrut ${bagrut._id}`)
        
      } catch (error) {
        errorCount++
        console.error(`❌ Error migrating bagrut ${bagrut._id}:`, error.message)
      }
    }
    
    console.log('\n=== Migration Summary ===')
    console.log(`Total records processed: ${bagrutsToMigrate.length}`)
    console.log(`Successfully migrated: ${successCount}`)
    console.log(`Errors encountered: ${errorCount}`)
    
    if (errorCount === 0) {
      console.log('🎉 Migration completed successfully!')
    } else {
      console.log('⚠️  Migration completed with some errors. Please check the logs above.')
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await closeDatabaseConnection()
  }
}

// Run migration if this file is executed directly
if (process.argv[1].includes('migrateBagrutTo4Presentations.js')) {
  migrateBagrut()
    .then(() => {
      console.log('Migration script completed')
      process.exit(0)
    })
    .catch((error) => {
      console.error('Migration script failed:', error)
      process.exit(1)
    })
}

export { migrateBagrut }