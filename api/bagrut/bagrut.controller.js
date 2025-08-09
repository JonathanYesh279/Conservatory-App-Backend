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
      return res.status(400).json({ error: 'Invalid presentation index. Must be 0-3.' })
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
      return res.status(400).json({ error: 'No file information available' })
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
    const gradingDetails = req.body
    const teacherId = req.teacher._id.toString()

    // Validate grading details structure
    const requiredFields = ['technique', 'interpretation', 'musicality', 'overall']
    const missingFields = requiredFields.filter(field => !gradingDetails[field])
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        error: `Missing required grading fields: ${missingFields.join(', ')}` 
      })
    }

    // No need to check authorization - middleware already did it
    const updatedBagrut = await bagrutService.updateGradingDetails(
      id,
      gradingDetails,
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