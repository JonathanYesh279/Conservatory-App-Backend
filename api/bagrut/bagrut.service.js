import { getCollection } from '../../services/mongoDB.service.js'
import { validateBagrut, getGradeLevelFromScore, validateGradeConsistency, calculateFinalGradeFromDetails, calculateTotalGradeFromDetailedGrading, validateBagrutCompletion } from './bagrut.validation.js'
import { ObjectId } from 'mongodb'

// Helper function to safely create ObjectId
function createObjectId(id) {
  if (!id) return null
  
  // If it's already an ObjectId, return it
  if (id instanceof ObjectId) return id
  
  // If it's a string, validate and convert
  if (typeof id === 'string') {
    if (id.length !== 24) {
      throw new Error(`Invalid ObjectId length: ${id}. Expected 24 characters.`)
    }
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      throw new Error(`Invalid ObjectId format: ${id}. Must be a valid hex string.`)
    }
    return ObjectId.createFromHexString(id)
  }
  
  throw new Error(`Invalid ObjectId type: ${typeof id}`)
}

export const bagrutService = {
  getBagruts,
  getBagrutById,
  getBagrutByStudentId,
  addBagrut,
  updateBagrut,
  removeBagrut,
  updatePresentation,
  updateMagenBagrut,
  updateGradingDetails,
  calculateAndUpdateFinalGrade,
  completeBagrut,
  addDocument,
  removeDocument,
  addProgramPiece,
  updateProgram,
  removeProgramPiece, 
  addAccompanist,
  removeAccompanist
}

async function getBagruts(filterBy = {}) {
  try {
    const collection = await getCollection('bagrut')
    const criteria = _buildCriteria(filterBy)

    const bagrut = await collection.find(criteria).toArray()

    return bagrut
  } catch (err) {
    console.error(`Error in bagrutService.getBagruts: ${err}`)
    throw new Error(`Error in bagrutService.getBagruts: ${err}`)
  }
}

async function getBagrutById(bagrutId) {
  try {
    const collection = await getCollection('bagrut')
    const bagrut = await collection.findOne({
      _id: createObjectId(bagrutId)
    })

    if (!bagrut) throw new Error(`Bagrut with id ${bagrutId} not found`)
    return bagrut
  } catch (err) {
    console.error(`Error in bagrutService.getBagrutById: ${err}`)
    throw new Error(`Error in bagrutService.getBagrutById: ${err}`)
  }
}

async function getBagrutByStudentId(studentId) {
  try {
    const collection = await getCollection('bagrut')
    const bagrut = await collection.findOne({
      studentId,
      isActive: true
    })

    return bagrut
  } catch (err) {
    console.error(`Error in bagrutService.getBagrutByStudentId: ${err}`)
    throw new Error(`Error in bagrutService.getBagrutByStudentId: ${err}`)
  }
}

async function addBagrut(bagrutToAdd) {
  try {
    const { error, value } = validateBagrut(bagrutToAdd)
    if (error) throw new Error(error)
    
    value.createdAt = new Date()
    value.updatedAt = new Date()

    const collection = await getCollection('bagrut')

    const existingBagrut = await collection.findOne({
      studentId: value.studentId,
      isActive: true
    })

    if (existingBagrut) {
      throw new Error(`Bagrut for student ${value.studentId} already exists`)
    }
    
    const result = await collection.insertOne(value)

    // Update student with bagrut reference
    const { studentService } = await import('../student/student.service.js')
    await studentService.setBagrutId(value.studentId, result.insertedId.toString())

    return { _id: result.insertedId, ...value }
  } catch (err) {
    console.error(`Error in bagrutService.addBagrut: ${err}`)
    throw new Error(`Error in bagrutService.addBagrut: ${err}`)
  }
}

async function updateBagrut(bagrutId, bagrutToUpdate) {
  try {
    const { error, value } = validateBagrut(bagrutToUpdate)
    if (error) throw new Error(`Validation error: ${error.message}`)
    
    value.updatedAt = new Date()

    const collection = await getCollection('bagrut')
    const result = await collection.updateOne(
      { _id: createObjectId(bagrutId) },
      { $set: value },
      { returnDocument: 'after' }
    )

    if (!result) throw new Error(`Bagrut with id ${bagrutId} not found`)
    return result
  } catch (err) {
    console.error(`Error in bagrutService.updateBagrut: ${err}`)
    throw new Error(`Error in bagrutService.updateBagrut: ${err}`)
  }
}

async function removeBagrut(bagrutId) {
  try {
    const collection = await getCollection('bagrut')
    
    // First get the bagrut to find the student ID
    const bagrut = await collection.findOne({ _id: createObjectId(bagrutId) })
    
    if (!bagrut) {
      throw new Error(`Bagrut with id ${bagrutId} not found`)
    }
    
    // Remove the bagrut document
    const result = await collection.deleteOne({ _id: createObjectId(bagrutId) })
    
    if (result.deletedCount === 0) {
      throw new Error(`Failed to delete bagrut with id ${bagrutId}`)
    }
    
    // Remove bagrut reference from student
    const { studentService } = await import('../student/student.service.js')
    await studentService.removeBagrutId(bagrut.studentId)
    
    return { success: true, deletedBagrut: bagrut }
  } catch (err) {
    console.error(`Error in bagrutService.removeBagrut: ${err}`)
    throw new Error(`Error in bagrutService.removeBagrut: ${err}`)
  }
}

async function updatePresentation(bagrutId, presentationIndex, presentationData, teacherId) {
  try {
    if (presentationIndex < 0 || presentationIndex > 3) {
      throw new Error(`Invalid presentation index: ${presentationIndex}. Must be 0-3.`)
    }

    const collection = await getCollection('bagrut')
    await _migrateBagrutTo4Presentations(collection, bagrutId)

    // Only validate grades for presentation 3 (מגן בגרות)
    if (presentationIndex === 3) {
      // Handle detailed grading if provided
      if (presentationData.detailedGrading) {
        const calculatedGrade = calculateTotalGradeFromDetailedGrading(presentationData.detailedGrading)
        if (calculatedGrade !== null) {
          presentationData.grade = calculatedGrade
          presentationData.gradeLevel = getGradeLevelFromScore(calculatedGrade)
        }
      } else if (presentationData.grade !== null && presentationData.grade !== undefined) {
        const autoGradeLevel = getGradeLevelFromScore(presentationData.grade)
        if (!presentationData.gradeLevel) {
          presentationData.gradeLevel = autoGradeLevel
        } else if (!validateGradeConsistency(presentationData.grade, presentationData.gradeLevel)) {
          throw new Error(`Grade ${presentationData.grade} does not match grade level ${presentationData.gradeLevel}`)
        }
      }
    } else {
      // For presentations 0-2, remove any grade/gradeLevel fields and ensure notes field exists
      delete presentationData.grade
      delete presentationData.gradeLevel
      if (!presentationData.notes) {
        presentationData.notes = ''
      }
    }

    // Ensure date is properly set - either provided date or current date
    presentationData.date = presentationData.date ? new Date(presentationData.date) : new Date()
    presentationData.reviewedBy = teacherId

    const updateField = `presentations.${presentationIndex}`

    const result = await collection.findOneAndUpdate(
      { _id: createObjectId(bagrutId) },
      {
        $set: {
          [updateField]: presentationData,
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    )

    if (!result) throw new Error(`Bagrut with id ${bagrutId} not found`)
    return result
  } catch (err) {
    console.error(`Error in bagrutService.updatePresentation: ${err}`)
    throw new Error(`Error in bagrutService.updatePresentation: ${err}`)
  }
}

async function updateMagenBagrut(bagrutId, magenBagrutData, teacherId) {
  try {
    // Handle detailed grading if provided
    if (magenBagrutData.detailedGrading) {
      const calculatedGrade = calculateTotalGradeFromDetailedGrading(magenBagrutData.detailedGrading)
      if (calculatedGrade !== null) {
        magenBagrutData.grade = calculatedGrade
        magenBagrutData.gradeLevel = getGradeLevelFromScore(calculatedGrade)
      }
    } else if (magenBagrutData.grade !== null && magenBagrutData.grade !== undefined) {
      const autoGradeLevel = getGradeLevelFromScore(magenBagrutData.grade)
      if (!magenBagrutData.gradeLevel) {
        magenBagrutData.gradeLevel = autoGradeLevel
      } else if (!validateGradeConsistency(magenBagrutData.grade, magenBagrutData.gradeLevel)) {
        throw new Error(`Grade ${magenBagrutData.grade} does not match grade level ${magenBagrutData.gradeLevel}`)
      }
    }

    // Ensure date is properly set - either provided date or current date
    magenBagrutData.date = magenBagrutData.date ? new Date(magenBagrutData.date) : new Date()
    magenBagrutData.reviewedBy = teacherId

    const collection = await getCollection('bagrut')
    const result = await collection.findOneAndUpdate(
      { _id: createObjectId(bagrutId) },
      {
        $set: {
          magenBagrut: magenBagrutData,
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    )

    if (!result) throw new Error(`Bagrut with id ${bagrutId} not found`)
    return result
  } catch (err) {
    console.error(`Error in bagrutService.updateMagenBagrut: ${err}`)
    throw new Error(`Error in bagrutService.updateMagenBagrut: ${err}`)
  }
}

async function addDocument(bagrutId, documentData, teacherId) {
  try {
    documentData.uploadDate = new Date()
    documentData.uploadedBy = teacherId

    const collection = await getCollection('bagrut')
    const result = await collection.findOneAndUpdate(
      { _id: createObjectId(bagrutId) },
      {
        $push: { documents: documentData },
        $set: { updatedAt: new Date() }
      },
      { returnDocument: 'after' }
    )

    if (!result) throw new Error(`Bagrut with id ${bagrutId} not found`)
    return result
  } catch (err) {
    console.error(`Error in bagrutService.addDocument: ${err}`)
    throw new Error(`Error in bagrutService.addDocument: ${err}`)
  }
}

async function removeDocument(bagrutId, documentId) {
  try {
    const collection = await getCollection('bagrut')
    const result = await collection.findOneAndUpdate(
      { _id: createObjectId(bagrutId) },
      {
        $pull: { documents: { _id: createObjectId(documentId) } },
        $set: { updatedAt: new Date() }
      },
      { returnDocument: 'after' }
    )

    if (!result) throw new Error(`Bagrut with id ${bagrutId} not found`)
    return result
  } catch (err) {
    console.error(`Error in bagrutService.removeDocument: ${err}`)
    throw new Error(`Error in bagrutService.removeDocument: ${err}`)
  }
}

async function addProgramPiece(bagrutId, pieceData) {
  try {
    const collection = await getCollection('bagrut')
    const result = await collection.findOneAndUpdate(
      { _id: createObjectId(bagrutId) },
      {
        $push: { program: pieceData },
        $set: { updatedAt: new Date() }
      },
      { returnDocument: 'after' }
    )

    if (!result) throw new Error(`Bagrut with id ${bagrutId} not found`)
    return result
  } catch (err) {
    console.error(`Error in bagrutService.addProgramPiece: ${err}`)
    throw new Error(`Error in bagrutService.addProgramPiece: ${err}`)
  }
}

async function updateProgram(bagrutId, programArray) {
  try {
    const collection = await getCollection('bagrut')
    const result = await collection.findOneAndUpdate(
      { _id: createObjectId(bagrutId) },
      {
        $set: { 
          program: programArray,
          updatedAt: new Date() 
        }
      },
      { returnDocument: 'after' }
    )

    if (!result) throw new Error(`Bagrut with id ${bagrutId} not found`)
    return result
  } catch (err) {
    console.error(`Error in bagrutService.updateProgram: ${err}`)
    throw new Error(`Error in bagrutService.updateProgram: ${err}`)
  }
}

async function removeProgramPiece(bagrutId, pieceId) {
  try {
    const collection = await getCollection('bagrut')
    const result = await collection.findOneAndUpdate(
      { _id: createObjectId(bagrutId) },
      {
        $pull: { program: { _id: createObjectId(pieceId) } },
        $set: { updatedAt: new Date() }
      },
      { returnDocument: 'after' }
    )

    if (!result) throw new Error(`Bagrut with id ${bagrutId} not found`)
    return result
  } catch (err) {
    console.error(`Error in bagrutService.removeProgramPiece: ${err}`)
    throw new Error(`Error in bagrutService.removeProgramPiece: ${err}`)
  }
}

async function addAccompanist(bagrutId, accompanistData) {
  try {
    const collection = await getCollection('bagrut')
    const result = await collection.findOneAndUpdate(
      { _id: createObjectId(bagrutId) },
      {
        $push: { 'accompaniment.accompanists': accompanistData },
        $set: { updatedAt: new Date() }
      },
      { returnDocument: 'after' }
    )

    if (!result) throw new Error(`Bagrut with id ${bagrutId} not found`)
    return result
  } catch (err) {
    console.error(`Error in bagrutService.addAccompanist: ${err}`)
    throw new Error(`Error in bagrutService.addAccompanist: ${err}`)
  }
}

async function removeAccompanist(bagrutId, accompanistId) {
  try {
    const collection = await getCollection('bagrut')
    const result = await collection.findOneAndUpdate(
      { _id: createObjectId(bagrutId) },
      {
        $pull: { 'accompaniment.accompanists': { _id: createObjectId(accompanistId) } },
        $set: { updatedAt: new Date() }
      },
      { returnDocument: 'after' }
    )

    if (!result) throw new Error(`Bagrut with id ${bagrutId} not found`)
    return result
  } catch (err) {
    console.error(`Error in bagrutService.removeAccompanist: ${err}`)
    throw new Error(`Error in bagrutService.removeAccompanist: ${err}`)
  }
}

async function updateGradingDetails(bagrutId, gradingDetails, teacherId) {
  try {
    const collection = await getCollection('bagrut')
    await _migrateBagrutTo4Presentations(collection, bagrutId)
    const bagrut = await collection.findOne({ _id: createObjectId(bagrutId) })
    
    if (!bagrut) throw new Error(`Bagrut with id ${bagrutId} not found`)

    const calculatedGrade = calculateFinalGradeFromDetails(gradingDetails)
    let finalGradeLevel = null
    
    if (calculatedGrade !== null) {
      finalGradeLevel = getGradeLevelFromScore(calculatedGrade)
    }

    const result = await collection.findOneAndUpdate(
      { _id: createObjectId(bagrutId) },
      {
        $set: {
          gradingDetails,
          'presentations.3.grade': calculatedGrade,
          'presentations.3.gradeLevel': finalGradeLevel,
          'presentations.3.reviewedBy': teacherId,
          'presentations.3.date': new Date(),
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    )

    return result
  } catch (err) {
    console.error(`Error in bagrutService.updateGradingDetails: ${err}`)
    throw new Error(`Error in bagrutService.updateGradingDetails: ${err}`)
  }
}

async function calculateAndUpdateFinalGrade(bagrutId) {
  try {
    const collection = await getCollection('bagrut')
    await _migrateBagrutTo4Presentations(collection, bagrutId)
    
    const bagrut = await collection.findOne({ _id: createObjectId(bagrutId) })
    
    if (!bagrut) throw new Error(`Bagrut with id ${bagrutId} not found`)

    const finalGrade = calculateFinalGradeFromDetails(bagrut.gradingDetails || {})
    const finalGradeLevel = finalGrade ? getGradeLevelFromScore(finalGrade) : null

    const result = await collection.findOneAndUpdate(
      { _id: createObjectId(bagrutId) },
      {
        $set: {
          finalGrade,
          finalGradeLevel,
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    )

    return result
  } catch (err) {
    console.error(`Error in bagrutService.calculateAndUpdateFinalGrade: ${err}`)
    throw new Error(`Error in bagrutService.calculateAndUpdateFinalGrade: ${err}`)
  }
}

async function completeBagrut(bagrutId, teacherId, teacherSignature) {
  try {
    const collection = await getCollection('bagrut')
    await _migrateBagrutTo4Presentations(collection, bagrutId)
    
    const bagrut = await collection.findOne({ _id: createObjectId(bagrutId) })
    
    if (!bagrut) throw new Error(`Bagrut with id ${bagrutId} not found`)
    
    const updatedBagrut = await collection.findOne({ _id: createObjectId(bagrutId) })
    const validationErrors = validateBagrutCompletion(updatedBagrut)
    
    if (validationErrors.length > 0) {
      throw new Error(`Cannot complete Bagrut: ${validationErrors.join(', ')}`)
    }

    const result = await collection.findOneAndUpdate(
      { _id: createObjectId(bagrutId) },
      {
        $set: {
          isCompleted: true,
          completionDate: new Date(),
          teacherSignature: teacherSignature || '',
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    )

    return result
  } catch (err) {
    console.error(`Error in bagrutService.completeBagrut: ${err}`)
    throw new Error(`Error in bagrutService.completeBagrut: ${err}`)
  }
}

async function _migrateBagrutTo4Presentations(collection, bagrutId) {
  try {
    // Use safe ObjectId conversion
    let objectId
    try {
      objectId = createObjectId(bagrutId)
    } catch (error) {
      console.warn(`Invalid bagrutId for migration: ${bagrutId} - ${error.message}`)
      return
    }
    
    const bagrut = await collection.findOne({ _id: objectId })
    
    if (bagrut && bagrut.presentations && bagrut.presentations.length === 3) {
      console.log(`Migrating bagrut ${bagrutId} from 3 to 4 presentations`)
      
      const fourthPresentation = {
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
      }
      
      const updatedPresentations = bagrut.presentations.map((p, index) => {
        if (index < 3) {
          // For presentations 0-2, remove grade/gradeLevel and add notes + recordingLinks
          const { grade, gradeLevel, ...presentationWithoutGrades } = p
          return {
            ...presentationWithoutGrades,
            notes: p.notes || '',
            recordingLinks: p.recordingLinks || []
          }
        } else {
          // For presentation 3, keep grade/gradeLevel and add detailedGrading + recordingLinks if missing
          return {
            ...p,
            grade: p.grade || null,
            gradeLevel: p.gradeLevel || null,
            recordingLinks: p.recordingLinks || [],
            detailedGrading: p.detailedGrading || {
              playingSkills: { grade: 'לא הוערך', points: null, maxPoints: 20, comments: 'אין הערות' },
              musicalUnderstanding: { grade: 'לא הוערך', points: null, maxPoints: 40, comments: 'אין הערות' },
              textKnowledge: { grade: 'לא הוערך', points: null, maxPoints: 30, comments: 'אין הערות' },
              playingByHeart: { grade: 'לא הוערך', points: null, maxPoints: 10, comments: 'אין הערות' }
            }
          }
        }
      })
      updatedPresentations.push(fourthPresentation)
      
      const defaultGradingDetails = {
        technique: { grade: null, maxPoints: 20, comments: '' },
        interpretation: { grade: null, maxPoints: 30, comments: '' },
        musicality: { grade: null, maxPoints: 40, comments: '' },
        overall: { grade: null, maxPoints: 10, comments: '' }
      }
      
      await collection.updateOne(
        { _id: objectId },
        {
          $set: {
            presentations: updatedPresentations,
            gradingDetails: bagrut.gradingDetails || defaultGradingDetails,
            conservatoryName: bagrut.conservatoryName || '',
            finalGrade: bagrut.finalGrade || null,
            finalGradeLevel: bagrut.finalGradeLevel || null,
            teacherSignature: bagrut.teacherSignature || '',
            completionDate: bagrut.completionDate || null,
            isCompleted: bagrut.isCompleted || false,
            'magenBagrut.grade': bagrut.magenBagrut.grade || null,
            'magenBagrut.gradeLevel': bagrut.magenBagrut.gradeLevel || null,
            'magenBagrut.recordingLinks': bagrut.magenBagrut.recordingLinks || [],
            'magenBagrut.detailedGrading': bagrut.magenBagrut.detailedGrading || {
              playingSkills: { grade: 'לא הוערך', points: null, maxPoints: 20, comments: 'אין הערות' },
              musicalUnderstanding: { grade: 'לא הוערך', points: null, maxPoints: 40, comments: 'אין הערות' },
              textKnowledge: { grade: 'לא הוערך', points: null, maxPoints: 30, comments: 'אין הערות' },
              playingByHeart: { grade: 'לא הוערך', points: null, maxPoints: 10, comments: 'אין הערות' }
            },
            updatedAt: new Date()
          }
        }
      )
      
      console.log(`Successfully migrated bagrut ${bagrutId}`)
    }
  } catch (err) {
    console.error(`Error migrating bagrut ${bagrutId}: ${err}`)
  }
}

function _buildCriteria(filterBy) {
  const criteria = {}

  if (filterBy.studentId) {
    criteria.studentId = filterBy.studentId
  }

  if (filterBy.teacherId) {
    criteria.teacherId = filterBy.teacherId
  }

  if (filterBy.showInactive) {
    if (filterBy.isActive !== undefined) {
      criteria.isActive = filterBy.isActive
    }
  } else {
    criteria.isActive = true
  }

  return criteria
}