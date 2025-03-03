import { bagrutService } from './bagrut.service.js'

export const bagrutController = {
  getBagruts,
  getBagrutById,
  getBagrutByStudentId,
  addBagrut,
  updateBagrut,
  updatePresentation,
  updateMagenBagrut,
  addDocument,
  removeDocument,
  addProgramPiece,
  removeProgramPiece,
  addAccompanist,
  removeAccompanist
}

async function getBagruts(req, res, next) {
  try {
    const filterBy = {
      studentId: req.query.studentId,
      teacherId: req.query.teacherId,
      isActive: req.query.isActive,
      showInactive: req.query.showInactive === 'true'
    }

    const bagruts = await bagrutService.getBagruts(filterBy)
    res.json(bagruts)
  } catch (err) {
    next(err)
  }
}

async function getBagrutById(req, res, next) {
  try {
    const { id } = req.params
    const bagrut = await bagrutService.getBagrutById(id)

    const teacherId = req.teacher._id.toString()
    const isAdmin = req.teacher.roles.includes('מנהל')

    if (!isAdmin && bagrut.teacherId !== teacherId) {
      return res.status(403).json({ error: 'Not authorized to view this bagrut' })
    }

    res.json(bagrut)
  } catch (err) {
    next(err)
  }
}

async function getBagrutByStudentId(req, res, next) {
  try {
    const { studentId } = req.params
    const bagrut = await bagrutService.getBagrutByStudentId(studentId) 

    if (!bagrut) {
      return res.status(404).json({ error: `Bagrut for student ${studentId} not found` })
    }

    const teacherId = req.teacher._id.toString()
    const isAdmin = req.teacher.roles.includes('מנהל')

    if (!isAdmin && bagrut.teacherId !== teacherId) {
      return res.status(403).json({ error: 'Not authorized to view this bagrut' })  
    }

    res.json(bagrut)
  } catch (err) {
    next(err)
  }
}

async function addBagrut(req, res, next) {
  try {
    const bagrutToAdd = req.body

    const teacherId = req.teacher._id.toString()
    const isAdmin = req.teacher.roles.includes('מנהל')

    if (!isAdmin && bagrutToAdd.teacherId !== teacherId) {
      return res.status(403).json({ error: 'Not authorized to add bagrut for this teacher' })
    }

    const addBagrut = await bagrutService.addBagrut(bagrutToAdd)
    res.status(201).json(addBagrut)
  } catch (err) {
    next(err)
  }
}

async function updateBagrut(req, res, next) {
  try {
    const { id } = req.params
    const bagrutToUpdate = req.body

    const teacherId = req.teacher._id.toString()
    const isAdmin = req.teacher.roles.includes('מנהל')

    const existingBagrut = await bagrutService.getBagrutById(id)  

    if (!isAdmin && existingBagrut.teacherId !== teacherId) {
      return res.status(403).json({ error: 'Not authorized to update this bagrut' })
    }

    const updatedBagrut = await bagrutService.updateBagrut(id, bagrutToUpdate)
    res.json(updatedBagrut)
  } catch (err) {
    next(err)
  }
}

async function updatePresentation(req, res, next) {
  try {
    const { id, presentationIndex } = req.params
    const presentationData = req.body

    const teacherId = req.teacher._id.toString()
    const isAdmin = req.teacher.roles.includes('מנהל')

    const existingBagrut = await bagrutService.getBagrutById(id)

    if (!isAdmin && existingBagrut.teacherId !== teacherId) {
      return res.status(403).json({ error: 'Not authorized to update this bagrut' })
    }

    const updatedBagrut = await bagrutService.updatePresentation(
      id,
      parseInt(presentationIndex),
      presentationData,
      teacherId
    );
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
    const isAdmin = req.teacher.roles.includes('מנהל')

    const existingBagrut = await bagrutService.getBagrutById(id)

    if (!isAdmin && existingBagrut.teacherId !== teacherId) {
      return res.status(403).json({ error: 'Not authorized to update this bagrut' })
    }

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
    const documentData = req.body

    const teacherId = req.teacher._id.toString()
    const isAdmin = req.teacher.roles.includes('מנהל')

    const existingBagrut = await bagrutService.getBagrutById(id)

    if (!isAdmin && existingBagrut.teacherId !== teacherId) {
      return res.status(403).json({ error: 'Not authorized to update this bagrut' })
    }

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

    const teacherId = req.teacher._id.toString()
    const isAdmin = req.teacher.roles.includes('מנהל')

    const existingBagrut = await bagrutService.getBagrutById(id)

    if (!isAdmin && existingBagrut.teacherId !== teacherId) {
      return res.status(403).json({ error: 'Not authorized to update this bagrut' })
    }

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

    const teacherId = req.teacher._id.toString()
    const isAdmin = req.teacher.roles.includes('מנהל')

    const existingBagrut = await bagrutService.getBagrutById(id)

    if (!isAdmin && existingBagrut.teacherId !== teacherId) {
      return res.status(403).json({ error: 'Not authorized to update this bagrut' })
    }

    const updatedBagrut = await bagrutService.addProgramPiece(id, pieceData)
    res.json(updatedBagrut)
  } catch (err) {
    next(err)
  }
}

async function removeProgramPiece(req, res, next) {
  try {
    const { id, pieceId } = req.params

    const teacherId = req.teacher._id.toString()
    const isAdmin = req.teacher.roles.includes('מנהל')

    const existingBagrut = await bagrutService.getBagrutById(id)

    if (!isAdmin && existingBagrut.teacherId !== teacherId) {
      return res.status(403).json({ error: 'Not authorized to update this bagrut' })
    }

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

    const teacherId = req.teacher._id.toString()
    const isAdmin = req.teacher.roles.includes('מנהל')

    const existingBagrut = await bagrutService.getBagrutById(id)

    if (!isAdmin && existingBagrut.teacherId !== teacherId) {
      return res.status(403).json({ error: 'Not authorized to update this bagrut' })
    }

    const updatedBagrut = await bagrutService.addAccompanist(id, accompanistData)
    res.json(updatedBagrut)
  } catch (err) {
    next(err)
  }
}

async function removeAccompanist(req, res, next) {
  try {
    const { id, accompanistId } = req.params

    const teacherId = req.teacher._id.toString()
    const isAdmin = req.teacher.roles.includes('מנהל')

    const existingBagrut = await bagrutService.getBagrutById(id)

    if (!isAdmin && existingBagrut.teacherId !== teacherId) {
      return res.status(403).json({ error: 'Not authorized to update this bagrut' })
    }

    const updatedBagrut = await bagrutService.removeAccompanist(id, accompanistId)
    res.json(updatedBagrut)
  } catch (err) {
    next(err)
  }
}