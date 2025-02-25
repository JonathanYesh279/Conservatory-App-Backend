import { rehearsalService } from './rehearsal.service.js'

export const rehearsalController = {
  getRehearsals,
  getRehearsalById,
  getOrchestraRehearsals,
  addRehearsal,
  updateRehearsal,
  removeRehearsal,
  bulkCreateRehearsals
}

async function getRehearsals(req, res, next) {
  try {
    const filterBy = {
      groupId: req.query.groupId,
      type: req.query.type,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      isActive: req.query.isActive,
      showInactive: req.query.showInactive === 'true'
    }

    const rehearsals = await rehearsalService.getRehearsals(filterBy)
    res.json(rehearsals)  
  } catch (err) {
    next(err)
  }
}

async function getRehearsalById(req, res, next) {
  try {
    const { id } = req.params
    const rehearsal = await rehearsalService.getRehearsalById(id)
    res.json(rehearsal)
  } catch (err) {
    next(err)
  }
}

async function getOrchestraRehearsals(req, res, next) {
  try {
    const { orchestraId } = req.params

    const filterBy = {
      type: req.query.type,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      isActive: req.query.isActive,
      showInactive: req.query.showInactive === 'true'
    }

    const rehearsals = await rehearsalService.getOrchestraRehearsals(orchestraId, filterBy)
    res.json(rehearsals)
  } catch (err) {
    next(err)
  }
}

async function addRehearsal(req, res, next) {
  try {
    const rehearsalToAdd = req.body
    const addedRehearsal = await rehearsalService.addRehearsal(rehearsalToAdd)
    res.status(201).json(addedRehearsal)  
  } catch (err) {
    next(err)
  }
}

async function updateRehearsal(req, res, next) {
  try {
    const { id } = req.params
    const rehearsalToUpdate = req.body
    const teacherId = req.teacher._id
    const isAdmin = req.teacher.roles.includes('מנהל')

    const updatedRehearsal = await rehearsalService.updateRehearsal(
      id,
      rehearsalToUpdate,
      teacherId,
      isAdmin
    )

    res.json(updatedRehearsal)
  } catch (err) {
    if (err.message === 'Not authorized to modify this rehearsal') {
      return res.status(403).json({ error: err.message })
    }

    next(err)
  }
}

async function removeRehearsal(req, res, next) {
  try {
    const { id } = req.params
    const teacherId = req.teacher._id
    const isAdmin = req.teacher.roles.includes('מנהל')

    const removedRehearsal = await rehearsalService.removeRehearsal(
      id,
      teacherId,
      isAdmin
    )

    res.json(removedRehearsal)
  } catch (err) {
    if (err.message === 'Not authorized to modify this rehearsal') {
      return res.status(403).json({ error: err.message })
    }

    next(err)
  }
}

async function bulkCreateRehearsals(req, res, next) {
  try {
    const result = await rehearsalService.bulkCreateRehearsals(req.body)
    res.status(201).json(result)
  } catch (err) {
    next(err)
  }
}
