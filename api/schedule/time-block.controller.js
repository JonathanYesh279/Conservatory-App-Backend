import { timeBlockService } from './time-block.service.js';
import {
  validateCreateTimeBlock,
  validateUpdateTimeBlock,
  validateLessonAssignment,
  validateAvailableSlotsQuery,
  validateOptimalSlot,
  validateTimeBlockFilters,
  validateScheduleStatsQuery,
} from './time-block.validation.js';

export const timeBlockController = {
  createTimeBlock,
  updateTimeBlock,
  deleteTimeBlock,
  getTeacherTimeBlocks,
  getAvailableSlots,
  assignLessonToBlock,
  removeLessonFromBlock,
  getTeacherScheduleWithBlocks,
  findOptimalSlot,
  getLessonScheduleOptions,
  getBlockUtilizationStats,
};

/**
 * Create a new time block for teacher
 * @route POST /api/schedule/teacher/:teacherId/time-block
 */
async function createTimeBlock(req, res) {
  try {
    const { teacherId } = req.params;
    
    // Validate request body
    const { error, value } = validateCreateTimeBlock(req.body);
    if (error) {
      return res.status(400).json({
        error: `Invalid time block data: ${error.message}`,
      });
    }

    // Verify permission
    if (!req.isAdmin && req.teacher._id.toString() !== teacherId) {
      return res.status(403).json({
        error: 'You are not authorized to create time blocks for this teacher',
      });
    }

    const result = await timeBlockService.createTimeBlock(teacherId, value);

    res.status(201).json(result);
  } catch (err) {
    console.error(`Error in createTimeBlock: ${err.message}`);
    
    if (err.message.includes('conflicts with existing schedule')) {
      return res.status(409).json({ error: err.message });
    }
    
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    
    res.status(500).json({ error: err.message });
  }
}

/**
 * Update an existing time block
 * @route PUT /api/schedule/teacher/:teacherId/time-block/:blockId
 */
async function updateTimeBlock(req, res) {
  try {
    const { teacherId, blockId } = req.params;
    
    // Validate request body
    const { error, value } = validateUpdateTimeBlock(req.body);
    if (error) {
      return res.status(400).json({
        error: `Invalid update data: ${error.message}`,
      });
    }

    // Verify permission
    if (!req.isAdmin && req.teacher._id.toString() !== teacherId) {
      return res.status(403).json({
        error: 'You are not authorized to update time blocks for this teacher',
      });
    }

    const result = await timeBlockService.updateTimeBlock(teacherId, blockId, value);

    res.status(200).json(result);
  } catch (err) {
    console.error(`Error in updateTimeBlock: ${err.message}`);
    
    if (err.message.includes('conflict')) {
      return res.status(409).json({ error: err.message });
    }
    
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    
    res.status(500).json({ error: err.message });
  }
}

/**
 * Delete a time block
 * @route DELETE /api/schedule/teacher/:teacherId/time-block/:blockId
 */
async function deleteTimeBlock(req, res) {
  try {
    const { teacherId, blockId } = req.params;

    // Verify permission
    if (!req.isAdmin && req.teacher._id.toString() !== teacherId) {
      return res.status(403).json({
        error: 'You are not authorized to delete time blocks for this teacher',
      });
    }

    const result = await timeBlockService.deleteTimeBlock(teacherId, blockId);

    res.status(200).json(result);
  } catch (err) {
    console.error(`Error in deleteTimeBlock: ${err.message}`);
    
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    
    res.status(500).json({ error: err.message });
  }
}

/**
 * Get all time blocks for a teacher
 * @route GET /api/schedule/teacher/:teacherId/time-blocks
 */
async function getTeacherTimeBlocks(req, res) {
  try {
    const { teacherId } = req.params;
    
    // Validate query parameters
    const { error, value } = validateTimeBlockFilters(req.query);
    if (error) {
      return res.status(400).json({
        error: `Invalid filter parameters: ${error.message}`,
      });
    }

    // Verify permission
    if (!req.isAdmin && req.teacher._id.toString() !== teacherId) {
      return res.status(403).json({
        error: 'You are not authorized to view time blocks for this teacher',
      });
    }

    const timeBlocks = await timeBlockService.getTeacherTimeBlocks(teacherId, value);

    res.status(200).json({
      success: true,
      timeBlocks,
      count: timeBlocks.length
    });
  } catch (err) {
    console.error(`Error in getTeacherTimeBlocks: ${err.message}`);
    
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    
    res.status(500).json({ error: err.message });
  }
}

/**
 * Get available lesson slots for specific duration
 * @route GET /api/schedule/teacher/:teacherId/available-slots
 */
async function getAvailableSlots(req, res) {
  try {
    const { teacherId } = req.params;
    
    // Validate query parameters
    const { error, value } = validateAvailableSlotsQuery(req.query);
    if (error) {
      return res.status(400).json({
        error: `Invalid query parameters: ${error.message}`,
      });
    }

    // Verify permission
    if (!req.isAdmin && req.teacher._id.toString() !== teacherId) {
      return res.status(403).json({
        error: 'You are not authorized to view available slots for this teacher',
      });
    }

    const { duration, ...preferences } = value;
    const availableSlots = await timeBlockService.calculateAvailableSlots(
      teacherId, 
      duration, 
      preferences
    );

    res.status(200).json({
      success: true,
      duration,
      availableSlots,
      count: availableSlots.length,
      preferences
    });
  } catch (err) {
    console.error(`Error in getAvailableSlots: ${err.message}`);
    
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    
    res.status(500).json({ error: err.message });
  }
}

/**
 * Assign lesson to time block
 * @route POST /api/schedule/assign-lesson
 */
async function assignLessonToBlock(req, res) {
  try {
    // Validate request body
    const { error, value } = validateLessonAssignment(req.body);
    if (error) {
      return res.status(400).json({
        error: `Invalid assignment data: ${error.message}`,
      });
    }

    // Verify permission
    if (!req.isAdmin && value.teacherId !== req.teacher._id.toString()) {
      return res.status(403).json({
        error: 'You are not authorized to assign lessons for this teacher',
      });
    }

    const result = await timeBlockService.assignLessonToBlock(value);

    res.status(200).json(result);
  } catch (err) {
    console.error(`Error in assignLessonToBlock: ${err.message}`);
    
    if (err.message.includes('conflict')) {
      return res.status(409).json({ error: err.message });
    }
    
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    
    if (err.message.includes('doesn\'t fit')) {
      return res.status(400).json({ error: err.message });
    }
    
    res.status(500).json({ error: err.message });
  }
}

/**
 * Remove lesson from time block
 * @route DELETE /api/schedule/lesson/:teacherId/:timeBlockId/:lessonId
 */
async function removeLessonFromBlock(req, res) {
  try {
    const { teacherId, timeBlockId, lessonId } = req.params;

    // Verify permission
    if (!req.isAdmin && teacherId !== req.teacher._id.toString()) {
      return res.status(403).json({
        error: 'You are not authorized to remove lessons for this teacher',
      });
    }

    const result = await timeBlockService.removeLessonFromBlock(
      teacherId, 
      timeBlockId, 
      lessonId
    );

    res.status(200).json(result);
  } catch (err) {
    console.error(`Error in removeLessonFromBlock: ${err.message}`);
    
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    
    res.status(500).json({ error: err.message });
  }
}

/**
 * Get teacher's complete schedule with time blocks
 * @route GET /api/schedule/teacher/:teacherId/schedule-with-blocks
 */
async function getTeacherScheduleWithBlocks(req, res) {
  try {
    const { teacherId } = req.params;
    
    // Validate query parameters
    const { error, value } = validateScheduleStatsQuery(req.query);
    if (error) {
      return res.status(400).json({
        error: `Invalid query parameters: ${error.message}`,
      });
    }

    // Verify permission
    if (!req.isAdmin && req.teacher._id.toString() !== teacherId) {
      return res.status(403).json({
        error: 'You are not authorized to view this teacher\'s complete schedule',
      });
    }

    const schedule = await timeBlockService.getTeacherScheduleWithBlocks(teacherId, value);

    res.status(200).json(schedule);
  } catch (err) {
    console.error(`Error in getTeacherScheduleWithBlocks: ${err.message}`);
    
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    
    res.status(500).json({ error: err.message });
  }
}

/**
 * Find optimal lesson slot for student
 * @route POST /api/schedule/teacher/:teacherId/find-optimal-slot
 */
async function findOptimalSlot(req, res) {
  try {
    const { teacherId } = req.params;
    
    // Validate request body
    const { error, value } = validateOptimalSlot(req.body);
    if (error) {
      return res.status(400).json({
        error: `Invalid slot finder data: ${error.message}`,
      });
    }

    // Verify permission
    if (!req.isAdmin && teacherId !== req.teacher._id.toString()) {
      return res.status(403).json({
        error: 'You are not authorized to find slots for this teacher',
      });
    }

    const { duration, preferences } = value;
    const result = await timeBlockService.findOptimalSlot(teacherId, duration, preferences);

    res.status(200).json(result);
  } catch (err) {
    console.error(`Error in findOptimalSlot: ${err.message}`);
    
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    
    res.status(500).json({ error: err.message });
  }
}

/**
 * Get lesson schedule options for multiple teachers
 * @route POST /api/schedule/lesson-options
 */
async function getLessonScheduleOptions(req, res) {
  try {
    const { teacherIds, duration, preferences = {} } = req.body;

    // Basic validation
    if (!teacherIds || !Array.isArray(teacherIds) || teacherIds.length === 0) {
      return res.status(400).json({
        error: 'teacherIds array is required',
      });
    }

    if (!duration || ![30, 45, 60].includes(duration)) {
      return res.status(400).json({
        error: 'duration must be 30, 45, or 60 minutes',
      });
    }

    // Get options for each teacher
    const teacherOptions = await Promise.all(
      teacherIds.map(async (teacherId) => {
        try {
          const options = await timeBlockService.findOptimalSlot(teacherId, duration, preferences);
          return {
            teacherId,
            ...options
          };
        } catch (error) {
          return {
            teacherId,
            success: false,
            error: error.message
          };
        }
      })
    );

    // Filter successful results and sort by score
    const successfulOptions = teacherOptions
      .filter(option => option.success)
      .sort((a, b) => (b.optimalSlot?.score || 0) - (a.optimalSlot?.score || 0));

    res.status(200).json({
      success: true,
      duration,
      preferences,
      options: successfulOptions,
      totalTeachers: teacherIds.length,
      availableTeachers: successfulOptions.length
    });
  } catch (err) {
    console.error(`Error in getLessonScheduleOptions: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Get block utilization statistics
 * @route GET /api/schedule/teacher/:teacherId/utilization-stats
 */
async function getBlockUtilizationStats(req, res) {
  try {
    const { teacherId } = req.params;

    // Verify permission
    if (!req.isAdmin && req.teacher._id.toString() !== teacherId) {
      return res.status(403).json({
        error: 'You are not authorized to view utilization stats for this teacher',
      });
    }

    const timeBlocks = await timeBlockService.getTeacherTimeBlocks(teacherId, {
      includeAvailableSlots: true,
      activeOnly: true
    });

    // Calculate detailed utilization statistics
    const stats = {
      overview: {
        totalBlocks: timeBlocks.length,
        totalHours: 0,
        usedHours: 0,
        availableHours: 0,
        overallUtilization: 0
      },
      byDay: {},
      utilizationDistribution: {
        underUtilized: 0, // < 50%
        moderatelyUtilized: 0, // 50-80%
        wellUtilized: 0, // > 80%
      },
      peakHours: {},
      recommendations: []
    };

    const VALID_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];
    
    // Initialize daily stats
    VALID_DAYS.forEach(day => {
      stats.byDay[day] = {
        blocks: 0,
        totalMinutes: 0,
        usedMinutes: 0,
        utilization: 0
      };
    });

    // Process each time block
    timeBlocks.forEach(block => {
      const totalMinutes = block.totalDuration || 0;
      const usedMinutes = block.assignedLessons
        ?.filter(lesson => lesson.isActive)
        ?.reduce((sum, lesson) => sum + lesson.duration, 0) || 0;
      
      const utilization = totalMinutes > 0 ? (usedMinutes / totalMinutes) * 100 : 0;

      // Overall stats
      stats.overview.totalHours += totalMinutes / 60;
      stats.overview.usedHours += usedMinutes / 60;

      // Daily stats
      if (stats.byDay[block.day]) {
        stats.byDay[block.day].blocks++;
        stats.byDay[block.day].totalMinutes += totalMinutes;
        stats.byDay[block.day].usedMinutes += usedMinutes;
      }

      // Utilization distribution
      if (utilization < 50) {
        stats.utilizationDistribution.underUtilized++;
      } else if (utilization < 80) {
        stats.utilizationDistribution.moderatelyUtilized++;
      } else {
        stats.utilizationDistribution.wellUtilized++;
      }

      // Peak hours analysis
      const startHour = parseInt(block.startTime.split(':')[0]);
      const endHour = parseInt(block.endTime.split(':')[0]);
      for (let hour = startHour; hour < endHour; hour++) {
        if (!stats.peakHours[hour]) {
          stats.peakHours[hour] = { blocks: 0, utilization: 0 };
        }
        stats.peakHours[hour].blocks++;
        stats.peakHours[hour].utilization += utilization;
      }
    });

    // Calculate derived stats
    stats.overview.availableHours = stats.overview.totalHours - stats.overview.usedHours;
    stats.overview.overallUtilization = stats.overview.totalHours > 0 
      ? (stats.overview.usedHours / stats.overview.totalHours) * 100 
      : 0;

    // Calculate daily utilization percentages
    Object.keys(stats.byDay).forEach(day => {
      const dayData = stats.byDay[day];
      dayData.utilization = dayData.totalMinutes > 0 
        ? (dayData.usedMinutes / dayData.totalMinutes) * 100 
        : 0;
    });

    // Calculate peak hours averages
    Object.keys(stats.peakHours).forEach(hour => {
      const hourData = stats.peakHours[hour];
      hourData.utilization = hourData.blocks > 0 
        ? hourData.utilization / hourData.blocks 
        : 0;
    });

    // Generate recommendations
    if (stats.overview.overallUtilization < 60) {
      stats.recommendations.push({
        type: 'LOW_UTILIZATION',
        message: 'Overall utilization is low. Consider consolidating time blocks or reducing total available hours.',
        priority: 'high'
      });
    }

    const underUtilizedDays = Object.entries(stats.byDay)
      .filter(([_, data]) => data.blocks > 0 && data.utilization < 40)
      .map(([day, _]) => day);

    if (underUtilizedDays.length > 0) {
      stats.recommendations.push({
        type: 'UNDERUTILIZED_DAYS',
        message: `Days with low utilization: ${underUtilizedDays.join(', ')}. Consider reducing blocks on these days.`,
        priority: 'medium'
      });
    }

    // Round numbers for better display
    stats.overview.totalHours = Math.round(stats.overview.totalHours * 100) / 100;
    stats.overview.usedHours = Math.round(stats.overview.usedHours * 100) / 100;
    stats.overview.availableHours = Math.round(stats.overview.availableHours * 100) / 100;
    stats.overview.overallUtilization = Math.round(stats.overview.overallUtilization * 100) / 100;

    res.status(200).json({
      success: true,
      teacherId,
      stats,
      generatedAt: new Date()
    });
  } catch (err) {
    console.error(`Error in getBlockUtilizationStats: ${err.message}`);
    
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    
    res.status(500).json({ error: err.message });
  }
}