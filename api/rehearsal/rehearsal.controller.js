import { rehearsalService } from './rehearsal.service.js'

export const rehearsalController = {
  getRehearsals,
  getRehearsalById,
  getOrchestraRehearsals,
  addRehearsal,
  updateRehearsal,
  removeRehearsal,
  bulkCreateRehearsals,
  bulkDeleteRehearsalsByOrchestra,
  bulkDeleteRehearsalsByDateRange,
  bulkUpdateRehearsalsByOrchestra,
  updateAttendance,
}

async function getRehearsals(req, res, next) {
  try {
    const filterBy = {
      groupId: req.query.groupId,
      type: req.query.type,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
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
    const teacherId = req.loggedinUser?._id || req.teacher._id
    const isAdmin = req.loggedinUser?.roles?.includes('מנהל') || req.teacher.roles.includes('מנהל')

    // Add schoolYearId from request if not in body or empty
    if (!rehearsalToAdd.schoolYearId && req.schoolYear && req.schoolYear._id) {
      rehearsalToAdd.schoolYearId = req.schoolYear._id.toString();
      console.log('Setting schoolYearId in rehearsal data from middleware:', rehearsalToAdd.schoolYearId);
    }

    // Validate that we have schoolYearId
    if (!rehearsalToAdd.schoolYearId) {
      console.error('Missing schoolYearId in rehearsal data');
      return res.status(400).json({
        error: 'Missing schoolYearId in rehearsal data',
        rehearsalData: rehearsalToAdd,
        schoolYear: req.schoolYear || null,
      });
    }

    const addedRehearsal = await rehearsalService.addRehearsal(
      rehearsalToAdd,
      teacherId,
      isAdmin
    )
    res.status(201).json(addedRehearsal)  
  } catch (err) {
    if (err.message.includes('Not authorized')) {
      return res.status(403).json({ error: err.message })
    }

    next(err)
  }
}

async function updateRehearsal(req, res, next) {
  try {
    const { id } = req.params
    const rehearsalToUpdate = req.body
    const teacherId = req.loggedinUser?._id || req.teacher._id
    const isAdmin = req.loggedinUser?.roles?.includes('מנהל') || req.teacher.roles.includes('מנהל')

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
    const teacherId = req.loggedinUser?._id || req.teacher._id
    const isAdmin = req.loggedinUser?.roles?.includes('מנהל') || req.teacher.roles.includes('מנהל')

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

async function bulkCreateRehearsals(req, res) {
  try {
    const bulkData = req.body;

    // Add schoolYearId from request if not in body
    if (!bulkData.schoolYearId && req.schoolYear && req.schoolYear._id) {
      bulkData.schoolYearId = req.schoolYear._id.toString();
      console.log(
        'Setting schoolYearId in bulk data from middleware:',
        bulkData.schoolYearId
      );
    }

    console.log(
      'Bulk create data received:',
      JSON.stringify(bulkData, null, 2)
    );

    // Validate that we have schoolYearId
    if (!bulkData.schoolYearId) {
      console.error('Missing schoolYearId in bulk rehearsal data');
      return res.status(400).json({
        error: 'Missing schoolYearId in bulk rehearsal data',
        bulkData,
        schoolYear: req.schoolYear || null,
      });
    }

    // Ensure all other required fields are present
    const requiredFields = [
      'orchestraId',
      'startDate',
      'endDate',
      'dayOfWeek',
      'startTime',
      'endTime',
      'location',
    ];
    for (const field of requiredFields) {
      if (!bulkData[field] && bulkData[field] !== 0) {
        // Allow 0 for dayOfWeek
        console.error(
          `Missing required field: ${field} in bulk rehearsal data`
        );
        return res.status(400).json({
          error: `Missing required field: ${field} in bulk rehearsal data`,
        });
      }
    }

    // Ensure teacherId is properly passed
    const teacherId = req.loggedinUser?._id;
    if (!teacherId) {
      return res.status(401).json({
        error: 'Authentication required for bulk rehearsal creation',
      });
    }

    // Call the service function with the proper parameters
    const result = await rehearsalService.bulkCreateRehearsals(
      bulkData,
      teacherId,
      req.loggedinUser.roles.includes('מנהל')
    );

    res.json(result);
  } catch (err) {
    console.error(`Error in bulk create rehearsals: ${err}`);
    res
      .status(500)
      .json({ error: err.message || 'Failed to create rehearsals in bulk' });
  }
}

async function updateAttendance(req, res, next) {
  try {
    const { rehearsalId } = req.params
    const attendanceData = req.body
    const teacherId = req.loggedinUser?._id || req.teacher._id
    const isAdmin = req.loggedinUser?.roles?.includes('מנהל') || req.teacher.roles.includes('מנהל')

    const updateRehearsal = await rehearsalService.updateAttendance(
      rehearsalId,
      attendanceData,
      teacherId,
      isAdmin
    )
    res.json(updateRehearsal)
  } catch (err) {
    if (err.message === 'Not authorized to modify this rehearsal') {
      return res.status(403).json({ error: err.message })
    }

    next(err)
  }
}

async function bulkDeleteRehearsalsByOrchestra(req, res, next) {
  try {
    const { orchestraId } = req.params
    const userId = req.loggedinUser?._id || req.teacher._id
    const isAdmin = req.loggedinUser?.roles?.includes('מנהל') || req.teacher.roles.includes('מנהל')

    // Input validation
    if (!orchestraId) {
      return res.status(400).json({
        error: "Invalid orchestra ID",
        message: "Orchestra ID is required and must be a valid ObjectId"
      })
    }

    // Authorization check
    if (!isAdmin && !(req.loggedinUser?.roles?.includes('מנצח') || req.teacher.roles.includes('מנצח'))) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Insufficient permissions to delete rehearsals"
      })
    }

    const result = await rehearsalService.bulkDeleteRehearsalsByOrchestra(
      orchestraId,
      userId,
      isAdmin
    )

    res.status(200).json({
      deletedCount: result.deletedCount,
      message: `Successfully deleted ${result.deletedCount} rehearsals for orchestra`
    })
  } catch (err) {
    if (err.message.includes('Orchestra not found')) {
      return res.status(404).json({
        error: "Orchestra not found",
        message: "No orchestra found with the specified ID"
      })
    }

    if (err.message.includes('Not authorized')) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Insufficient permissions to delete rehearsals"
      })
    }

    if (err.message.includes('Invalid orchestra ID')) {
      return res.status(400).json({
        error: "Invalid orchestra ID",
        message: "Orchestra ID is required and must be a valid ObjectId"
      })
    }

    console.error('Error deleting rehearsals by orchestra:', err)
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to delete rehearsals"
    })
  }
}

async function bulkDeleteRehearsalsByDateRange(req, res, next) {
  try {
    const { orchestraId } = req.params
    const { startDate, endDate } = req.body
    const userId = req.loggedinUser?._id || req.teacher._id
    const isAdmin = req.loggedinUser?.roles?.includes('מנהל') || req.teacher.roles.includes('מנהל')

    // Input validation
    if (!orchestraId) {
      return res.status(400).json({
        error: "Invalid orchestra ID",
        message: "Orchestra ID is required and must be a valid ObjectId"
      })
    }

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: "Missing required fields",
        message: "Start date and end date are required"
      })
    }

    // Authorization check
    if (!isAdmin && !(req.loggedinUser?.roles?.includes('מנצח') || req.teacher.roles.includes('מנצח'))) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Insufficient permissions to delete rehearsals"
      })
    }

    const result = await rehearsalService.bulkDeleteRehearsalsByDateRange(
      orchestraId,
      startDate,
      endDate,
      userId,
      isAdmin
    )

    res.status(200).json({
      deletedCount: result.deletedCount,
      dateRange: result.dateRange,
      message: result.message
    })
  } catch (err) {
    if (err.message.includes('Orchestra not found')) {
      return res.status(404).json({
        error: "Orchestra not found",
        message: "No orchestra found with the specified ID"
      })
    }

    if (err.message.includes('Not authorized')) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Insufficient permissions to delete rehearsals"
      })
    }

    if (err.message.includes('Invalid orchestra ID') || err.message.includes('Invalid start or end date')) {
      return res.status(400).json({
        error: "Invalid input",
        message: err.message
      })
    }

    if (err.message.includes('Start date must be before')) {
      return res.status(400).json({
        error: "Invalid date range",
        message: err.message
      })
    }

    console.error('Error deleting rehearsals by date range:', err)
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to delete rehearsals by date range"
    })
  }
}

async function bulkUpdateRehearsalsByOrchestra(req, res, next) {
  try {
    const { orchestraId } = req.params
    const updateData = req.body
    const userId = req.loggedinUser?._id || req.teacher._id
    const isAdmin = req.loggedinUser?.roles?.includes('מנהל') || req.teacher.roles.includes('מנהל')

    // Input validation
    if (!orchestraId) {
      return res.status(400).json({
        error: "Invalid orchestra ID",
        message: "Orchestra ID is required and must be a valid ObjectId"
      })
    }

    // Authorization check
    if (!isAdmin && !(req.loggedinUser?.roles?.includes('מנצח') || req.teacher.roles.includes('מנצח'))) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Insufficient permissions to update rehearsals"
      })
    }

    // Validate update fields
    const forbiddenFields = ['_id', 'createdAt', 'updatedAt', 'groupId', 'date', 'schoolYearId'];
    const updateKeys = Object.keys(updateData);
    const hasForbiddenField = updateKeys.some(key => forbiddenFields.includes(key));

    if (hasForbiddenField) {
      return res.status(400).json({
        error: "Invalid update data",
        message: `Cannot update these fields: ${forbiddenFields.join(', ')}`
      })
    }

    const result = await rehearsalService.bulkUpdateRehearsalsByOrchestra(
      orchestraId,
      updateData,
      userId,
      isAdmin
    )

    res.status(200).json({
      updatedCount: result.updatedCount,
      message: `Successfully updated ${result.updatedCount} rehearsals for orchestra`
    })
  } catch (err) {
    if (err.message.includes('Orchestra not found')) {
      return res.status(404).json({
        error: "Orchestra not found",
        message: "No orchestra found with the specified ID"
      })
    }

    if (err.message.includes('Not authorized')) {
      return res.status(403).json({
        error: "Forbidden",
        message: "You can only update rehearsals for orchestras you conduct"
      })
    }

    if (err.message.includes('Invalid orchestra ID')) {
      return res.status(400).json({
        error: "Invalid orchestra ID",
        message: "Orchestra ID is required and must be a valid ObjectId"
      })
    }

    if (err.message.includes('Cannot update these fields')) {
      return res.status(400).json({
        error: "Invalid update data",
        message: err.message
      })
    }

    if (err.message.includes('time format')) {
      return res.status(400).json({
        error: "Invalid time format",
        message: err.message
      })
    }

    console.error('Error updating rehearsals by orchestra:', err)
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to update rehearsals"
    })
  }
}