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
    
    // Find all bagruts that need migration
    const bagrutsToMigrate = await collection.find({
      $or: [
        { presentations: { $size: 3 } },
        { gradingDetails: { $exists: false } },
        { finalGrade: { $exists: false } },
        { 'presentations.0.grade': { $exists: true } },  // Need to migrate presentations with grades to notes
        { 'presentations.1.grade': { $exists: true } },  // Need to migrate presentations with grades to notes
        { 'presentations.2.grade': { $exists: true } },   // Need to migrate presentations with grades to notes
        { 'presentations.0.recordingLinks': { $exists: false } },  // Need to add recordingLinks
        { 'presentations.1.recordingLinks': { $exists: false } },  // Need to add recordingLinks
        { 'presentations.2.recordingLinks': { $exists: false } },  // Need to add recordingLinks
        { 'presentations.3.detailedGrading': { $exists: false } },  // Need to add detailed grading
        { 'presentations.3.recordingLinks': { $exists: false } },  // Need to add recordingLinks
        { 'magenBagrut.detailedGrading': { $exists: false } },  // Need to add detailed grading to magenBagrut
        { 'magenBagrut.recordingLinks': { $exists: false } }  // Need to add recordingLinks to magenBagrut
      ]
    }).toArray()
    
    console.log(`Found ${bagrutsToMigrate.length} bagrut records to migrate`)
    
    let successCount = 0
    let errorCount = 0
    
    for (const bagrut of bagrutsToMigrate) {
      try {
        console.log(`Migrating bagrut ${bagrut._id} for student ${bagrut.studentId}`)
        
        const updates = {}
        
        // Update presentations to migrate grades to notes for presentations 0-2 and ensure 4 presentations
        if (!bagrut.presentations || bagrut.presentations.length < 4 || 
            bagrut.presentations[0]?.grade !== undefined || 
            bagrut.presentations[1]?.grade !== undefined || 
            bagrut.presentations[2]?.grade !== undefined) {
          const updatedPresentations = []
          
          // Update existing presentations with appropriate fields based on position
          const existingPresentations = bagrut.presentations || []
          
          // Handle presentations 0-2 (convert grade to notes)
          for (let i = 0; i < 3; i++) {
            const presentation = existingPresentations[i] || {
              completed: false,
              status: 'לא נבחן',
              date: null,
              review: null,
              reviewedBy: null
            }
            
            // For presentations 0-2, remove grade/gradeLevel and add notes + recordingLinks
            const { grade, gradeLevel, ...presentationWithoutGrades } = presentation
            updatedPresentations.push({
              ...presentationWithoutGrades,
              notes: presentation.notes || '',
              recordingLinks: presentation.recordingLinks || []
            })
          }
          
          // Handle presentation 3 (מגן בגרות) - keep grades and add detailed grading + recordingLinks
          if (existingPresentations.length >= 4) {
            const presentation3 = existingPresentations[3]
            updatedPresentations.push({
              ...presentation3,
              grade: presentation3.grade || null,
              gradeLevel: presentation3.gradeLevel || (presentation3.grade ? getGradeLevelFromScore(presentation3.grade) : null),
              recordingLinks: presentation3.recordingLinks || [],
              detailedGrading: presentation3.detailedGrading || {
                playingSkills: { grade: 'לא הוערך', points: null, maxPoints: 20, comments: 'אין הערות' },
                musicalUnderstanding: { grade: 'לא הוערך', points: null, maxPoints: 40, comments: 'אין הערות' },
                textKnowledge: { grade: 'לא הוערך', points: null, maxPoints: 30, comments: 'אין הערות' },
                playingByHeart: { grade: 'לא הוערך', points: null, maxPoints: 10, comments: 'אין הערות' }
              }
            })
          } else {
            // Add 4th presentation if it doesn't exist
            updatedPresentations.push({
              completed: false,
              status: 'לא נבחן',
              date: null,
              review: null,
              reviewedBy: null,
              grade: null,
              gradeLevel: null,
              recordingLinks: [],
              detailedGrading: {
                playingSkills: { grade: 'לא הוערך', points: null, maxPoints: 20, comments: 'אין הערות' },
                musicalUnderstanding: { grade: 'לא הוערך', points: null, maxPoints: 40, comments: 'אין הערות' },
                textKnowledge: { grade: 'לא הוערך', points: null, maxPoints: 30, comments: 'אין הערות' },
                playingByHeart: { grade: 'לא הוערך', points: null, maxPoints: 10, comments: 'אין הערות' }
              }
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
        
        // Update magenBagrut with grade fields, detailed grading, and recordingLinks if missing
        if (bagrut.magenBagrut) {
          updates['magenBagrut.grade'] = bagrut.magenBagrut.grade || null
          updates['magenBagrut.gradeLevel'] = bagrut.magenBagrut.gradeLevel || 
            (bagrut.magenBagrut.grade ? getGradeLevelFromScore(bagrut.magenBagrut.grade) : null)
          updates['magenBagrut.recordingLinks'] = bagrut.magenBagrut.recordingLinks || []
          updates['magenBagrut.detailedGrading'] = bagrut.magenBagrut.detailedGrading || {
            playingSkills: { grade: 'לא הוערך', points: null, maxPoints: 20, comments: 'אין הערות' },
            musicalUnderstanding: { grade: 'לא הוערך', points: null, maxPoints: 40, comments: 'אין הערות' },
            textKnowledge: { grade: 'לא הוערך', points: null, maxPoints: 30, comments: 'אין הערות' },
            playingByHeart: { grade: 'לא הוערך', points: null, maxPoints: 10, comments: 'אין הערות' }
          }
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