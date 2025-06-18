import { scheduleService } from './schedule.service.js';

export const scheduleController = {
  getTeacherWeeklySchedule,
  getAvailableSlots,
  createScheduleSlot,
  assignStudentToSlot,
  removeStudentFromSlot,
  updateScheduleSlot,
  getStudentSchedule,
};

/**
 * Get teacher's complete weekly schedule
 * @route GET /api/schedule/teacher/:teacherId/weekly
 */
async function getTeacherWeeklySchedule(req, res) {
  try {
    const { teacherId } = req.params;
    const includeStudentInfo = req.query.includeStudentInfo === 'true';
    
    // Verify permission if not admin (teachers can only view their own schedule)
    if (!req.isAdmin && req.teacher._id.toString() !== teacherId) {
      return res.status(403).json({
        error: 'You are not authorized to view this teacher\'s schedule',
      });
    }

    const schedule = await scheduleService.getTeacherWeeklySchedule(teacherId, {
      includeStudentInfo,
    });

    res.status(200).json(schedule);
  } catch (err) {
    console.error(`Error in getTeacherWeeklySchedule: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Get only available slots for assignment
 * @route GET /api/schedule/teacher/:teacherId/available
 */
async function getAvailableSlots(req, res) {
  try {
    const { teacherId } = req.params;
    const filters = {
      day: req.query.day,
      minDuration: req.query.minDuration ? parseInt(req.query.minDuration) : undefined,
      startTimeAfter: req.query.startTimeAfter,
      startTimeBefore: req.query.startTimeBefore,
      location: req.query.location,
    };

    // Remove undefined filters
    Object.keys(filters).forEach(key => {
      if (filters[key] === undefined) delete filters[key];
    });

    // Verify permission if not admin (teachers can only view their own available slots)
    if (!req.isAdmin && req.teacher._id.toString() !== teacherId) {
      return res.status(403).json({
        error: 'You are not authorized to view this teacher\'s available slots',
      });
    }

    const availableSlots = await scheduleService.getAvailableSlots(teacherId, filters);

    res.status(200).json(availableSlots);
  } catch (err) {
    console.error(`Error in getAvailableSlots: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Create new schedule slot
 * @route POST /api/schedule/teacher/:teacherId/slot
 */
async function createScheduleSlot(req, res) {
  try {
    const { teacherId } = req.params;
    const slotData = req.body;

    // Add school year context if available
    if (req.schoolYear && !slotData.schoolYearId) {
      slotData.schoolYearId = req.schoolYear._id.toString();
    }

    // Verify permission if not admin (teachers can only create slots for themselves)
    if (!req.isAdmin && req.teacher._id.toString() !== teacherId) {
      return res.status(403).json({
        error: 'You are not authorized to create slots for this teacher',
      });
    }

    const newSlot = await scheduleService.createScheduleSlot(teacherId, slotData);

    res.status(201).json(newSlot);
  } catch (err) {
    console.error(`Error in createScheduleSlot: ${err.message}`);
    
    // Check for validation errors
    if (err.message.includes('Invalid schedule data')) {
      return res.status(400).json({ error: err.message });
    }
    
    // Check for conflict errors
    if (err.message.includes('conflicts with an existing slot')) {
      return res.status(409).json({ error: err.message });
    }
    
    res.status(500).json({ error: err.message });
  }
}

/**
 * Assign student to specific slot
 * @route POST /api/schedule/assign
 */
async function assignStudentToSlot(req, res) {
  try {
    const assignmentData = req.body;

    // Verify permission if not admin
    // Teachers can only assign students to their own schedule
    if (!req.isAdmin && assignmentData.teacherId !== req.teacher._id.toString()) {
      return res.status(403).json({
        error: 'You are not authorized to assign students to this teacher\'s schedule',
      });
    }

    const result = await scheduleService.assignStudentToSlot(assignmentData);

    res.status(200).json(result);
  } catch (err) {
    console.error(`Error in assignStudentToSlot: ${err.message}`);
    
    // Check for validation errors
    if (err.message.includes('Invalid assignment data')) {
      return res.status(400).json({ error: err.message });
    }
    
    // Check for conflict errors
    if (err.message.includes('already has another lesson')) {
      return res.status(409).json({ error: err.message });
    }
    
    // Check for not found errors
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    
    res.status(500).json({ error: err.message });
  }
}

/**
 * Remove student from slot
 * @route DELETE /api/schedule/assign/:scheduleSlotId
 */
async function removeStudentFromSlot(req, res) {
  try {
    const { scheduleSlotId } = req.params;

    // First get the slot to check permissions
    const slot = await scheduleService.getScheduleSlotById(scheduleSlotId);

    // Verify permission if not admin
    // Teachers can only remove students from their own schedule
    if (!req.isAdmin && slot.teacherId !== req.teacher._id.toString()) {
      return res.status(403).json({
        error: 'You are not authorized to remove students from this schedule',
      });
    }

    const result = await scheduleService.removeStudentFromSlot(scheduleSlotId);

    res.status(200).json(result);
  } catch (err) {
    console.error(`Error in removeStudentFromSlot: ${err.message}`);
    
    // Check for not found errors
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    
    // Check for other specific errors
    if (err.message.includes('No student assigned')) {
      return res.status(400).json({ error: err.message });
    }
    
    res.status(500).json({ error: err.message });
  }
}

/**
 * Update slot details
 * @route PUT /api/schedule/slot/:scheduleSlotId
 */
async function updateScheduleSlot(req, res) {
  try {
    const { scheduleSlotId } = req.params;
    const updateData = req.body;

    // First get the slot to check permissions
    const slot = await scheduleService.getScheduleSlotById(scheduleSlotId);

    // Verify permission if not admin
    // Teachers can only update their own schedule
    if (!req.isAdmin && slot.teacherId !== req.teacher._id.toString()) {
      return res.status(403).json({
        error: 'You are not authorized to update this schedule slot',
      });
    }

    const result = await scheduleService.updateScheduleSlot(scheduleSlotId, updateData);

    res.status(200).json(result);
  } catch (err) {
    console.error(`Error in updateScheduleSlot: ${err.message}`);
    
    // Check for validation errors
    if (err.message.includes('Invalid update data')) {
      return res.status(400).json({ error: err.message });
    }
    
    // Check for conflict errors
    if (err.message.includes('conflicts with an existing slot')) {
      return res.status(409).json({ error: err.message });
    }
    
    // Check for not found errors
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    
    res.status(500).json({ error: err.message });
  }
}

/**
 * Get student's complete schedule across teachers
 * @route GET /api/schedule/student/:studentId
 */
async function getStudentSchedule(req, res) {
  try {
    const { studentId } = req.params;

    // Verify permission if not admin
    // Teachers can only view schedules of their own students
    if (!req.isAdmin) {
      const hasAccess = req.teacher.teaching.studentIds.includes(studentId);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'You are not authorized to view this student\'s schedule',
        });
      }
    }

    const schedule = await scheduleService.getStudentSchedule(studentId);

    res.status(200).json(schedule);
  } catch (err) {
    console.error(`Error in getStudentSchedule: ${err.message}`);
    
    // Check for not found errors
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    
    res.status(500).json({ error: err.message });
  }
}