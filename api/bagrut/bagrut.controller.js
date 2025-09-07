// api/bagrut/bagrut.controller.js
import { bagrutService } from './bagrut.service.js'
import { deleteFile } from '../../services/fileStorage.service.js'

export const bagrutController = {
  getBagruts,
  getBagrutById,
  getBagrutByStudentId,
  addBagrut,
  updateBagrut,
  removeBagrut,
  updatePresentation,
  updateMagenBagrut,
  updateGradingDetails,
  calculateFinalGrade,
  completeBagrut,
  addDocument,
  removeDocument,
  addProgramPiece,
  updateProgram,
  removeProgramPiece,
  addAccompanist,
  removeAccompanist,
  updateDirectorEvaluation,
  setRecitalConfiguration,
}

async function getBagruts(req, res, next) {
  try {
    const filterBy = {
      studentId: req.query.studentId,
      teacherId: req.query.teacherId,
      isActive: req.query.isActive,
      showInactive: req.query.showInactive === 'true',
    }

    const bagruts = await bagrutService.getBagruts(filterBy)
    res.json(bagruts)
  } catch (err) {
    next(err)
  }
}

async function getBagrutById(req, res, next) {
  try {
    // Middleware already fetched the bagrut and attached it to req
    res.json(req.bagrut)
  } catch (err) {
    next(err)
  }
}

async function getBagrutByStudentId(req, res, next) {
  try {
    const { studentId } = req.params
    const bagrut = await bagrutService.getBagrutByStudentId(studentId)

    if (!bagrut) {
      return res
        .status(404)
        .json({ error: `Bagrut for student ${studentId} not found` })
    }

    res.json(bagrut)
  } catch (err) {
    next(err)
  }
}

async function addBagrut(req, res, next) {
  try {
    const bagrutToAdd = req.body
    const addedBagrut = await bagrutService.addBagrut(bagrutToAdd)
    res.status(201).json(addedBagrut)
  } catch (err) {
    next(err)
  }
}

async function updateBagrut(req, res, next) {
  try {
    const { id } = req.params
    const bagrutToUpdate = req.body

    // No need to check authorization - middleware already did it
    const updatedBagrut = await bagrutService.updateBagrut(id, bagrutToUpdate)
    res.json(updatedBagrut)
  } catch (err) {
    next(err)
  }
}

async function removeBagrut(req, res, next) {
  try {
    const { id } = req.params

    // No need to check authorization - middleware already did it
    const result = await bagrutService.removeBagrut(id)
    res.json(result)
  } catch (err) {
    next(err)
  }
}

async function updatePresentation(req, res, next) {
  try {
    const { id, presentationIndex } = req.params
    const presentationData = req.body
    const teacherId = req.teacher._id.toString()

    const index = parseInt(presentationIndex)
    if (isNaN(index) || index < 0 || index > 3) {
      return res.status(400).json({ 
        error: 'אינדקס מצגת לא תקין. חייב להיות בין 0-3',
        errorEn: 'Invalid presentation index. Must be 0-3.'
      })
    }

    // No need to check authorization - middleware already did it
    const updatedBagrut = await bagrutService.updatePresentation(
      id,
      index,
      presentationData,
      teacherId
    )
    res.json(updatedBagrut)
  } catch (err) {
    next(err)
  }
}

async function updateMagenBagrut(req, res, next) {
  try {
    const { id } = req.params
    const magenBagrutData = req.body
    const teacherId = req.teacher._id.toString()

    // No need to check authorization - middleware already did it
    const updatedBagrut = await bagrutService.updateMagenBagrut(
      id,
      magenBagrutData,
      teacherId
    )
    res.json(updatedBagrut)
  } catch (err) {
    next(err)
  }
}

async function addDocument(req, res, next) {
  try {
    const { id } = req.params
    const teacherId = req.teacher._id.toString()

    if (!req.processedFile) {
      return res.status(400).json({ 
        error: 'אין מידע זמין על הקובץ',
        errorEn: 'No file information available'
      })
    }

    const documentData = {
      title: req.body.title || req.processedFile.originalname,
      fileUrl: req.processedFile.url,
      fileKey: req.processedFile.key || null,
      uploadDate: new Date(),
      uploadedBy: teacherId,
    }

    // No need to check authorization - middleware already did it
    const updatedBagrut = await bagrutService.addDocument(
      id,
      documentData,
      teacherId
    )
    res.json(updatedBagrut)
  } catch (err) {
    next(err)
  }
}

async function removeDocument(req, res, next) {
  try {
    const { id, documentId } = req.params

    // Find the document to delete its file
    const document = req.bagrut.documents.find(
      doc => doc._id.toString() === documentId
    )

    if (document && document.fileUrl) {
      try {
        // Use the imported deleteFile function
        await deleteFile(document.fileUrl)
      } catch (deleteError) {
        console.warn(`Error deleting file: ${deleteError.message}`)
      }
    }

    // No need to check authorization - middleware already did it
    const updatedBagrut = await bagrutService.removeDocument(id, documentId)
    res.json(updatedBagrut)
  } catch (err) {
    next(err)
  }
}

async function addProgramPiece(req, res, next) {
  try {
    const { id } = req.params
    const pieceData = req.body

    // No need to check authorization - middleware already did it
    const updatedBagrut = await bagrutService.addProgramPiece(id, pieceData)
    res.json(updatedBagrut)
  } catch (err) {
    next(err)
  }
}

async function updateProgram(req, res, next) {
  try {
    const { id } = req.params
    const { program } = req.body

    // No need to check authorization - middleware already did it
    const updatedBagrut = await bagrutService.updateProgram(id, program)
    res.json(updatedBagrut)
  } catch (err) {
    next(err)
  }
}

async function removeProgramPiece(req, res, next) {
  try {
    const { id, pieceId } = req.params

    // No need to check authorization - middleware already did it
    const updatedBagrut = await bagrutService.removeProgramPiece(id, pieceId)
    res.json(updatedBagrut)
  } catch (err) {
    next(err)
  }
}

async function addAccompanist(req, res, next) {
  try {
    const { id } = req.params
    const accompanistData = req.body

    // No need to check authorization - middleware already did it
    const updatedBagrut = await bagrutService.addAccompanist(
      id,
      accompanistData
    )
    res.json(updatedBagrut)
  } catch (err) {
    next(err)
  }
}

async function removeAccompanist(req, res, next) {
  try {
    const { id, accompanistId } = req.params

    // No need to check authorization - middleware already did it
    const updatedBagrut = await bagrutService.removeAccompanist(
      id,
      accompanistId
    )
    res.json(updatedBagrut)
  } catch (err) {
    next(err)
  }
}

async function updateGradingDetails(req, res, next) {
  try {
    const { id } = req.params
    const detailedGrading = req.body
    const teacherId = req.teacher._id.toString()

    // Validate detailed grading structure
    const requiredFields = ['playingSkills', 'musicalUnderstanding', 'textKnowledge', 'playingByHeart']
    const missingFields = requiredFields.filter(field => !detailedGrading[field])
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        error: `שדות הערכה חסרים: ${missingFields.join(', ')}`,
        errorEn: `Missing required grading fields: ${missingFields.join(', ')}` 
      })
    }

    // Validate point maximums for detailed grading
    const { playingSkills, musicalUnderstanding, textKnowledge, playingByHeart } = detailedGrading

    if (playingSkills?.points && playingSkills.points > 40) {
      return res.status(400).json({ 
        error: 'כישורי נגינה לא יכולים לעלות על 40 נקודות',
        errorEn: 'Playing skills cannot exceed 40 points'
        })
      }

    if (musicalUnderstanding?.points && musicalUnderstanding.points > 30) {
      return res.status(400).json({ 
        error: 'הבנה מוזיקלית לא יכולה לעלות על 30 נקודות',
        errorEn: 'Musical understanding cannot exceed 30 points'
      })
    }

    if (textKnowledge?.points && textKnowledge.points > 20) {
      return res.status(400).json({ 
        error: 'ידיעת הטקסט לא יכולה לעלות על 20 נקודות',
        errorEn: 'Text knowledge cannot exceed 20 points'
      })
    }

    if (playingByHeart?.points && playingByHeart.points > 10) {
      return res.status(400).json({ 
        error: 'נגינה בעל פה לא יכולה לעלות על 10 נקודות',
        errorEn: 'Playing by heart cannot exceed 10 points'
      })
    }

    // No need to check authorization - middleware already did it
    const updatedBagrut = await bagrutService.updateGradingDetails(
      id,
      detailedGrading,
      teacherId
    )
    res.json(updatedBagrut)
  } catch (err) {
    next(err)
  }
}

async function calculateFinalGrade(req, res, next) {
  try {
    const { id } = req.params

    // No need to check authorization - middleware already did it
    const updatedBagrut = await bagrutService.calculateAndUpdateFinalGrade(id)
    res.json(updatedBagrut)
  } catch (err) {
    next(err)
  }
}

async function completeBagrut(req, res, next) {
  try {
    const { id } = req.params
    const { teacherSignature } = req.body
    const teacherId = req.teacher._id.toString()

    // No need to check authorization - middleware already did it
    const updatedBagrut = await bagrutService.completeBagrut(
      id,
      teacherId,
      teacherSignature
    )
    res.json(updatedBagrut)
  } catch (err) {
    next(err)
  }
}

async function updateDirectorEvaluation(req, res, next) {
  try {
    const { id } = req.params
    const { points, comments } = req.body

    // Validate points range
    if (points === undefined || points === null) {
      return res.status(400).json({ 
        error: 'נקודות הערכת מנהל נדרשות',
        errorEn: 'Director evaluation points are required'
      })
    }

    if (typeof points !== 'number' || points < 0 || points > 10) {
      return res.status(400).json({ 
        error: 'נקודות הערכת מנהל חייבות להיות בין 0 ל-10',
        errorEn: 'Director evaluation points must be between 0 and 10'
      })
    }

    // No need to check authorization - middleware already did it
    const updatedBagrut = await bagrutService.updateDirectorEvaluation(id, {
      points,
      comments: comments || ''
    })
    
    res.json(updatedBagrut)
  } catch (err) {
    next(err)
  }
}

async function setRecitalConfiguration(req, res, next) {
  try {
    const { id } = req.params
    const { units, field } = req.body

    // Validate units
    if (units === undefined || units === null) {
      return res.status(400).json({ 
        error: 'יחידות רסיטל נדרשות',
        errorEn: 'Recital units are required'
      })
    }

    if (units !== 3 && units !== 5) {
      return res.status(400).json({ 
        error: 'יחידות רסיטל חייבות להיות 3 או 5',
        errorEn: 'Recital units must be either 3 or 5'
      })
    }

    // Validate field
    if (!field) {
      return res.status(400).json({ 
        error: 'תחום רסיטל נדרש',
        errorEn: 'Recital field is required'
      })
    }

    const validFields = ['קלאסי', 'ג\'אז', 'שירה']
    if (!validFields.includes(field)) {
      return res.status(400).json({ 
        error: `תחום רסיטל חייב להיות אחד מהבאים: ${validFields.join(', ')}`,
        errorEn: `Recital field must be one of: ${validFields.join(', ')}`
      })
    }

    // No need to check authorization - middleware already did it
    const updatedBagrut = await bagrutService.setRecitalConfiguration(id, units, field)
    
    res.json(updatedBagrut)
  } catch (err) {
    next(err)
  }
}