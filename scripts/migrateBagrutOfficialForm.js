// Migration script to update bagrut records for official Ministry of Education form requirements
// - Fix point allocations in detailed grading
// - Add new required fields: directorName, directorEvaluation, recitalUnits, recitalField  
// - Add pieceNumber to program pieces
// - Recalculate any existing grades with correct formula

import 'dotenv/config'
import { getCollection, initializeMongoDB } from '../services/mongoDB.service.js'

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

// Calculate grade using the corrected point allocations
function calculateTotalGradeFromDetailedGrading(detailedGrading) {
  if (!detailedGrading) return null
  
  const { playingSkills, musicalUnderstanding, textKnowledge, playingByHeart } = detailedGrading
  
  // Check if all categories have points assigned
  if (!playingSkills?.points && playingSkills?.points !== 0 ||
      !musicalUnderstanding?.points && musicalUnderstanding?.points !== 0 ||
      !textKnowledge?.points && textKnowledge?.points !== 0 ||
      !playingByHeart?.points && playingByHeart?.points !== 0) {
    return null
  }
  
  const totalPoints = playingSkills.points + musicalUnderstanding.points + textKnowledge.points + playingByHeart.points
  
  // Ensure total doesn't exceed 100
  return Math.min(totalPoints, 100)
}

// Calculate final grade including director's 10% evaluation
function calculateFinalGradeWithDirectorEvaluation(detailedGrading, directorEvaluation) {
  const baseGrade = calculateTotalGradeFromDetailedGrading(detailedGrading)
  
  if (baseGrade === null || !directorEvaluation?.points && directorEvaluation?.points !== 0) {
    return baseGrade // Return base grade if no director evaluation
  }
  
  // Base grade is 90% of final grade, director evaluation is 10%
  const finalGrade = Math.round((baseGrade * 0.9) + (directorEvaluation.points * 10))
  
  // Ensure final grade doesn't exceed 100
  return Math.min(finalGrade, 100)
}

async function migrateBagrutOfficialForm() {
  try {
    console.log('Starting Bagrut migration for official Ministry of Education form...')
    console.log('This migration will:')
    console.log('1. Fix point allocations: playingSkills(20→40), musicalUnderstanding(40→30), textKnowledge(30→20)')
    console.log('2. Add new fields: directorName, directorEvaluation, recitalUnits, recitalField')
    console.log('3. Add pieceNumber to program pieces')
    console.log('4. Recalculate grades with corrected formula including director evaluation')
    console.log()
    
    await initializeMongoDB()
    const collection = await getCollection('bagrut')
    
    // Find all bagrut documents that need migration
    const bagrutsToMigrate = await collection.find({}).toArray()
    
    console.log(`Found ${bagrutsToMigrate.length} bagrut records to migrate`)
    
    // Create backup before migration
    const backupCollection = await getCollection('bagrut_backup_' + Date.now())
    if (bagrutsToMigrate.length > 0) {
      console.log('Creating backup of existing data...')
      await backupCollection.insertMany(bagrutsToMigrate)
      console.log('Backup created successfully')
    }
    
    let successCount = 0
    let errorCount = 0
    let gradingUpdated = 0
    let fieldsAdded = 0
    let programUpdated = 0
    
    for (const bagrut of bagrutsToMigrate) {
      try {
        console.log(`Migrating bagrut ${bagrut._id} for student ${bagrut.studentId}`)
        
        const updates = {}
        let hasChanges = false
        
        // 1. Add new required fields if missing
        if (!bagrut.hasOwnProperty('directorName')) {
          updates.directorName = 'לימור אקטע'
          hasChanges = true
          fieldsAdded++
        }
        
        if (!bagrut.hasOwnProperty('directorEvaluation')) {
          updates.directorEvaluation = {
            points: null,
            percentage: 10,
            comments: ''
          }
          hasChanges = true
          fieldsAdded++
        }
        
        if (!bagrut.hasOwnProperty('recitalUnits')) {
          updates.recitalUnits = 3
          hasChanges = true
          fieldsAdded++
        }
        
        if (!bagrut.hasOwnProperty('recitalField')) {
          updates.recitalField = 'קלאסי'
          hasChanges = true
          fieldsAdded++
        }
        
        // 2. Update program pieces to include pieceNumber
        if (bagrut.program && bagrut.program.length > 0) {
          let programNeedsUpdate = false
          const updatedProgram = bagrut.program.map((piece, index) => {
            if (!piece.hasOwnProperty('pieceNumber')) {
              programNeedsUpdate = true
              return {
                ...piece,
                pieceNumber: index + 1
              }
            }
            return piece
          })
          
          if (programNeedsUpdate) {
            updates.program = updatedProgram
            hasChanges = true
            programUpdated++
          }
        }
        
        // 3. Fix detailed grading point allocations in presentations[3] and magenBagrut
        let gradingNeedsUpdate = false
        
        // Check presentation[3] detailed grading
        if (bagrut.presentations && bagrut.presentations[3] && bagrut.presentations[3].detailedGrading) {
          const dg = bagrut.presentations[3].detailedGrading
          if (dg.playingSkills?.maxPoints === 20 || 
              dg.musicalUnderstanding?.maxPoints === 40 || 
              dg.textKnowledge?.maxPoints === 30) {
            
            updates['presentations.3.detailedGrading'] = {
              playingSkills: {
                grade: dg.playingSkills?.grade || 'לא הוערך',
                points: dg.playingSkills?.points || null,
                maxPoints: 40,
                comments: dg.playingSkills?.comments || 'אין הערות'
              },
              musicalUnderstanding: {
                grade: dg.musicalUnderstanding?.grade || 'לא הוערך',
                points: dg.musicalUnderstanding?.points || null,
                maxPoints: 30,
                comments: dg.musicalUnderstanding?.comments || 'אין הערות'
              },
              textKnowledge: {
                grade: dg.textKnowledge?.grade || 'לא הוערך',
                points: dg.textKnowledge?.points || null,
                maxPoints: 20,
                comments: dg.textKnowledge?.comments || 'אין הערות'
              },
              playingByHeart: {
                grade: dg.playingByHeart?.grade || 'לא הוערך',
                points: dg.playingByHeart?.points || null,
                maxPoints: 10,
                comments: dg.playingByHeart?.comments || 'אין הערות'
              }
            }
            
            // Recalculate grade with corrected values
            const newGrade = calculateTotalGradeFromDetailedGrading(updates['presentations.3.detailedGrading'])
            if (newGrade !== null) {
              updates['presentations.3.grade'] = newGrade
              updates['presentations.3.gradeLevel'] = getGradeLevelFromScore(newGrade)
            }
            
            gradingNeedsUpdate = true
            hasChanges = true
          }
        }
        
        // Check magenBagrut detailed grading
        if (bagrut.magenBagrut && bagrut.magenBagrut.detailedGrading) {
          const dg = bagrut.magenBagrut.detailedGrading
          if (dg.playingSkills?.maxPoints === 20 || 
              dg.musicalUnderstanding?.maxPoints === 40 || 
              dg.textKnowledge?.maxPoints === 30) {
            
            updates['magenBagrut.detailedGrading'] = {
              playingSkills: {
                grade: dg.playingSkills?.grade || 'לא הוערך',
                points: dg.playingSkills?.points || null,
                maxPoints: 40,
                comments: dg.playingSkills?.comments || 'אין הערות'
              },
              musicalUnderstanding: {
                grade: dg.musicalUnderstanding?.grade || 'לא הוערך',
                points: dg.musicalUnderstanding?.points || null,
                maxPoints: 30,
                comments: dg.musicalUnderstanding?.comments || 'אין הערות'
              },
              textKnowledge: {
                grade: dg.textKnowledge?.grade || 'לא הוערך',
                points: dg.textKnowledge?.points || null,
                maxPoints: 20,
                comments: dg.textKnowledge?.comments || 'אין הערות'
              },
              playingByHeart: {
                grade: dg.playingByHeart?.grade || 'לא הוערך',
                points: dg.playingByHeart?.points || null,
                maxPoints: 10,
                comments: dg.playingByHeart?.comments || 'אין הערות'
              }
            }
            
            // Recalculate grade with corrected values and director evaluation
            const newBaseGrade = calculateTotalGradeFromDetailedGrading(updates['magenBagrut.detailedGrading'])
            const directorEval = bagrut.directorEvaluation || updates.directorEvaluation
            const finalGrade = calculateFinalGradeWithDirectorEvaluation(
              updates['magenBagrut.detailedGrading'], 
              directorEval
            )
            
            if (finalGrade !== null) {
              updates['magenBagrut.grade'] = finalGrade
              updates['magenBagrut.gradeLevel'] = getGradeLevelFromScore(finalGrade)
              updates.finalGrade = finalGrade
              updates.finalGradeLevel = getGradeLevelFromScore(finalGrade)
            }
            
            gradingNeedsUpdate = true
            hasChanges = true
          }
        }
        
        if (gradingNeedsUpdate) {
          gradingUpdated++
        }
        
        // Update timestamp
        if (hasChanges) {
          updates.updatedAt = new Date()
          
          await collection.updateOne(
            { _id: bagrut._id },
            { $set: updates }
          )
          
          successCount++
          console.log(`✅ Successfully migrated bagrut ${bagrut._id}`)
        } else {
          console.log(`⚪ No changes needed for bagrut ${bagrut._id}`)
        }
        
      } catch (error) {
        errorCount++
        console.error(`❌ Error migrating bagrut ${bagrut._id}:`, error.message)
      }
    }
    
    console.log('\n=== Migration Summary ===')
    console.log(`Total records processed: ${bagrutsToMigrate.length}`)
    console.log(`Successfully migrated: ${successCount}`)
    console.log(`Records with grading updates: ${gradingUpdated}`)
    console.log(`Records with new fields added: ${fieldsAdded}`)
    console.log(`Records with program updates: ${programUpdated}`)
    console.log(`Errors encountered: ${errorCount}`)
    
    if (errorCount === 0) {
      console.log('🎉 Migration completed successfully!')
      console.log('📁 Backup collection created: bagrut_backup_' + Date.now())
    } else {
      console.log('⚠️  Migration completed with some errors. Please check the logs above.')
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

// Run migration if this file is executed directly
if (process.argv[1].includes('migrateBagrutOfficialForm.js')) {
  migrateBagrutOfficialForm()
    .then(() => {
      console.log('Migration script completed')
      process.exit(0)
    })
    .catch((error) => {
      console.error('Migration script failed:', error)
      process.exit(1)
    })
}

export { migrateBagrutOfficialForm }