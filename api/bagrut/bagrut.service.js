import { getCollection } from '../../services/mongoDB.service.js'
import { validateBagrut, getGradeLevelFromScore, validateGradeConsistency, calculateTotalGradeFromDetailedGrading, calculateFinalGradeWithDirectorEvaluation, validateBagrutCompletion } from './bagrut.validation.js'
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
  removeAccompanist,
  updateDirectorEvaluation,
  setRecitalConfiguration
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
    if (presentationIndex < 0 || presentationIndex > 2) {
      throw new Error(`Invalid presentation index: ${presentationIndex}. Must be 0-2.`)
    }

    const collection = await getCollection('bagrut')

    // For presentations 0-2, remove any grade/gradeLevel fields and ensure notes field exists
    delete presentationData.grade
    delete presentationData.gradeLevel
    if (!presentationData.notes) {
      presentationData.notes = ''
    }

    // Ensure date is properly set - either provided date or current date
    presentationData.date = presentationData.date ? new Date(presentationData.date) : new Date()
    
    // Preserve the reviewedBy field from frontend (examiner names) - only set teacherId if not provided
    if (!presentationData.reviewedBy) {
      presentationData.reviewedBy = teacherId
    }
    
    // Add a separate field to track who made the update (for audit purposes)
    presentationData.lastUpdatedBy = teacherId

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
    
    // Preserve the reviewedBy field from frontend (examiner names) - only set teacherId if not provided
    if (!magenBagrutData.reviewedBy) {
      magenBagrutData.reviewedBy = teacherId
    }
    
    // Add a separate field to track who made the update (for audit purposes)
    magenBagrutData.lastUpdatedBy = teacherId

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

async function updateGradingDetails(bagrutId, detailedGrading, teacherId) {
  try {
    const collection = await getCollection('bagrut')
    const bagrut = await collection.findOne({ _id: createObjectId(bagrutId) })
    
    if (!bagrut) throw new Error(`Bagrut with id ${bagrutId} not found`)

    const calculatedGrade = calculateTotalGradeFromDetailedGrading(detailedGrading)
    let finalGradeLevel = null
    
    if (calculatedGrade !== null) {
      finalGradeLevel = getGradeLevelFromScore(calculatedGrade)
    }

    const result = await collection.findOneAndUpdate(
      { _id: createObjectId(bagrutId) },
      {
        $set: {
          'magenBagrut.detailedGrading': detailedGrading,
          'magenBagrut.grade': calculatedGrade,
          'magenBagrut.gradeLevel': finalGradeLevel,
          'magenBagrut.lastUpdatedBy': teacherId,
          'magenBagrut.date': new Date(),
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
    
    const bagrut = await collection.findOne({ _id: createObjectId(bagrutId) })
    
    if (!bagrut) throw new Error(`Bagrut with id ${bagrutId} not found`)

    // Calculate final grade including director evaluation
    const finalGrade = calculateFinalGradeWithDirectorEvaluation(
      bagrut.magenBagrut?.detailedGrading || {}, 
      bagrut.directorEvaluation
    )
    
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
    
    const bagrut = await collection.findOne({ _id: createObjectId(bagrutId) })
    
    if (!bagrut) throw new Error(`Bagrut with id ${bagrutId} not found`)
    
    // Validate director evaluation is set
    if (!bagrut.directorEvaluation?.points && bagrut.directorEvaluation?.points !== 0) {
      throw new Error('הערכת מנהל חייבת להיות מושלמת לפני סיום הבגרות - Director evaluation must be completed before finalizing bagrut')
    }
    
    // Validate recital units is set
    if (!bagrut.recitalUnits) {
      throw new Error('יחידות רסיטל חייבות להיות מוגדרות לפני השלמת הבגרות - Recital units must be set before completing bagrut')
    }
    
    // Ensure all 5 pieces are entered (even if some are blank)
    if (!bagrut.program || bagrut.program.length !== 5) {
      throw new Error('כל 5 יצירות התוכנית חייבות להיות מוזנות לפני השלמת הבגרות - All 5 program pieces must be entered before completing bagrut')
    }
    
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

async function updateDirectorEvaluation(bagrutId, evaluation) {
  try {
    const collection = await getCollection('bagrut')
    
    const bagrut = await collection.findOne({ _id: createObjectId(bagrutId) })
    
    if (!bagrut) throw new Error(`Bagrut with id ${bagrutId} not found`)

    // Validate evaluation points
    if (evaluation.points < 0 || evaluation.points > 10) {
      throw new Error('Director evaluation points must be between 0 and 10')
    }

    const result = await collection.findOneAndUpdate(
      { _id: createObjectId(bagrutId) },
      {
        $set: {
          directorEvaluation: {
            points: evaluation.points,
            percentage: 10,
            comments: evaluation.comments || ''
          },
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    )

    // Recalculate final grade including director evaluation
    const updatedBagrut = await calculateAndUpdateFinalGrade(bagrutId)
    
    return updatedBagrut
  } catch (err) {
    console.error(`Error in bagrutService.updateDirectorEvaluation: ${err}`)
    throw new Error(`Error in bagrutService.updateDirectorEvaluation: ${err}`)
  }
}

async function setRecitalConfiguration(bagrutId, units, field) {
  try {
    const collection = await getCollection('bagrut')
    
    const bagrut = await collection.findOne({ _id: createObjectId(bagrutId) })
    
    if (!bagrut) throw new Error(`Bagrut with id ${bagrutId} not found`)

    // Validate units
    if (units !== 3 && units !== 5) {
      throw new Error('Recital units must be either 3 or 5')
    }

    // Validate field
    const validFields = ['קלאסי', 'ג\'אז', 'שירה']
    if (!validFields.includes(field)) {
      throw new Error(`Recital field must be one of: ${validFields.join(', ')}`)
    }

    const result = await collection.findOneAndUpdate(
      { _id: createObjectId(bagrutId) },
      {
        $set: {
          recitalUnits: units,
          recitalField: field,
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    )

    return result
  } catch (err) {
    console.error(`Error in bagrutService.setRecitalConfiguration: ${err}`)
    throw new Error(`Error in bagrutService.setRecitalConfiguration: ${err}`)
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