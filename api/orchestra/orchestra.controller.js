import { orchestraService } from './orchestra.service.js'

export const orchestraController = {
  getOrchestras,
  getOrchestraById,
  addOrchestra,
  updateOrchestra,
  removeOrchestra,
  addMember,
  removeMember,
  updateRehearsalAttendance,
  getRehearsalAttendance,
  getStudentAttendanceStats
}

async function getOrchestras(req, res, next) {
  try {
    const filterBy = {
      name: req.query.name,
      type: req.query.type,
      conductorId: req.query.conductorId,
      memberIds: req.query.memberIds,
      isActive: req.query.isActive,
      showInActive: req.query.showInactive === 'true',
      ids: req.query.ids // Add support for batch fetching by IDs
    }
    const orchestras = await orchestraService.getOrchestras(filterBy)
    res.json(orchestras)
  } catch (err) {
    next(err)
  }
}

async function getOrchestraById(req, res, next) {
  try {
    const { id } = req.params
    const orchestra = await orchestraService.getOrchestraById(id)
    res.json(orchestra)
  } catch (err) {
    next(err)
  }
}

async function addOrchestra(req, res, next) {
  try {
    const orchestraToAdd = req.body
    const addedOrchestra = await orchestraService.addOrchestra(orchestraToAdd)
    res.status(201).json(addedOrchestra)
  } catch (err) {
    next(err)
  }
}

async function updateOrchestra(req, res, next) {
  try {
    const { id } = req.params
    const orchestraToUpdate = req.body
    const teacherId = req.teacher._id
    const isAdmin = req.teacher.roles.includes('מנהל')
    const userRoles = req.teacher.roles || []

    const updatedOrchestra = await orchestraService.updateOrchestra(
      id,
      orchestraToUpdate,
      teacherId,
      isAdmin,
      userRoles
    )
    res.json(updatedOrchestra)
  } catch (err) {
    if (err.message === 'Not authorized to modify this orchestra') {
      return res.status(403).json({ error: err.message })
    }

    next(err)
  }
}

async function removeOrchestra(req, res, next) {
  try {
    const { id } = req.params 
    const teacherId = req.teacher._id
    const isAdmin = req.teacher.roles.includes('מנהל')
    const userRoles = req.teacher.roles || []

    const removedOrchestra = await orchestraService.removeOrchestra(
      id,
      teacherId,
      isAdmin,
      userRoles
    )
    res.json(removedOrchestra)
  } catch (err) {
    if (err.message === 'Not authorized to modify this orchestra') {
      return res.status(403).json({ error: err.message })
    }

    next(err)
  }
} 

async function addMember(req, res, next) { 
  try {
    console.log('=== ADD MEMBER CONTROLLER DEBUG ===')
    console.log('Request params:', req.params)
    console.log('Request body:', req.body)
    console.log('req.teacher exists:', !!req.teacher)
    console.log('req.teacher full object:', req.teacher)
    
    const { id: orchestraId } = req.params
    const { studentId } = req.body
    
    if (!req.teacher) {
      console.error('❌ No req.teacher found in addMember controller')
      return res.status(401).json({ error: 'Authentication required - no teacher in request' })
    }
    
    if (!req.teacher._id) {
      console.error('❌ req.teacher exists but has no _id:', req.teacher)
      return res.status(401).json({ error: 'Invalid teacher object - missing _id' })
    }
    
    const teacherId = req.teacher._id
    const isAdmin = req.teacher.roles && req.teacher.roles.includes('מנהל')
    const userRoles = req.teacher.roles || []
    
    console.log('Extracted data:', {
      orchestraId,
      studentId,
      teacherId,
      isAdmin,
      userRoles
    })

    const updatedOrchestra = await orchestraService.addMember(
      orchestraId,
      studentId,
      teacherId,
      isAdmin,
      userRoles
    )
    
    console.log('✅ Successfully added member')
    res.json(updatedOrchestra)
  } catch (err) {
    console.error('❌ Error in addMember controller:', err)
    
    if (err.message === 'Not authorized to modify this orchestra') {
      return res.status(403).json({ error: err.message })
    }

    next(err)
  }
}

async function removeMember(req, res, next) {
  try {
    const { id: orchestraId, studentId } = req.params
    const teacherId = req.teacher._id
    const isAdmin = req.teacher.roles.includes('מנהל')
    const userRoles = req.teacher.roles || []

    const updatedOrchestra = await orchestraService.removeMember(
      orchestraId,
      studentId,
      teacherId,
      isAdmin,
      userRoles
    )
    res.json(updatedOrchestra)
  } catch (err) {
    if (err.message === 'Not authorized to modify this orchestra') {
      return res.status(403).json({ error: err.message })
    }

    next(err)
  }
}

async function updateRehearsalAttendance(req, res, next) {
  try {
    const { rehearsalId } = req.params
    const attendance = req.body
    const teacherId = req.teacher._id
    const isAdmin = req.teacher.roles.includes('מנהל')
    const userRoles = req.teacher.roles || []

    const updatedRehearsal = await orchestraService.updateRehearsalAttendance(
      rehearsalId,
      attendance,
      teacherId,
      isAdmin,
      userRoles
    )
    res.json(updatedRehearsal)
  } catch (err) {
    if (err.message === 'Not authorized to modify this orchestra') {
      return res.status(403).json({ error: err.message })
    }
    
    next(err)
  }
}

async function getRehearsalAttendance(req, res, next) {
  try {
    const { rehearsalId } = req.params
    const attendance = await orchestraService.getRehearsalAttendance(rehearsalId)
    res.json(attendance)
  } catch (err) {
    next(err)
  }
}

async function getStudentAttendanceStats(req, res, next) {
  try {
    const { orchestraId, studentId } = req.params
    const stats = await orchestraService.getStudentAttendanceStats(orchestraId, studentId)
    res.json(stats)
  } catch(err) {
    next(err)
  }
}