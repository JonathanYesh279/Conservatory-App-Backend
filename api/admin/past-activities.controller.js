import { pastActivitiesService } from './past-activities.service.js';
import { sendErrorResponse, sendSuccessResponse } from '../../utils/errorResponses.js';

export const pastActivitiesController = {
  getPastActivities,
  getPastActivitiesByType
};

/**
 * Get all past activities (lessons, rehearsals, theory) with filtering
 * @route GET /api/admin/past-activities
 * @query {string} type - Activity type: 'all', 'rehearsals', 'theory', 'private-lessons'
 * @query {string} teacherId - Filter private lessons by teacher (required for private-lessons type)
 * @query {string} startDate - Start date for filtering (optional)
 * @query {string} endDate - End date for filtering (defaults to yesterday)
 * @query {number} limit - Limit results (default: 100)
 * @query {number} page - Page number for pagination (default: 1)
 */
async function getPastActivities(req, res, next) {
  try {
    const filterBy = {
      type: req.query.type || 'all',
      teacherId: req.query.teacherId,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      limit: parseInt(req.query.limit) || 100,
      page: parseInt(req.query.page) || 1
    };

    // Validate required parameters for private lessons
    if (filterBy.type === 'private-lessons' && !filterBy.teacherId) {
      return sendErrorResponse(res, 400, 'teacherId is required when filtering private lessons');
    }

    const result = await pastActivitiesService.getPastActivities(filterBy);
    
    res.json({
      success: true,
      data: result.activities,
      pagination: {
        currentPage: result.currentPage,
        totalPages: result.totalPages,
        totalCount: result.totalCount,
        hasNextPage: result.hasNextPage,
        hasPreviousPage: result.hasPreviousPage
      },
      summary: result.summary
    });
  } catch (err) {
    console.error(`Error in getPastActivities controller: ${err.message}`);
    next(err);
  }
}

/**
 * Get past activities by specific type with enhanced filtering
 * @route GET /api/admin/past-activities/:type
 * @param {string} type - Activity type: 'rehearsals', 'theory', 'private-lessons'
 */
async function getPastActivitiesByType(req, res, next) {
  try {
    const { type } = req.params;
    
    const filterBy = {
      type,
      teacherId: req.query.teacherId,
      studentId: req.query.studentId,
      orchestraId: req.query.orchestraId,
      category: req.query.category,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      limit: parseInt(req.query.limit) || 100,
      page: parseInt(req.query.page) || 1
    };

    // Validate supported types
    const supportedTypes = ['rehearsals', 'theory', 'private-lessons'];
    if (!supportedTypes.includes(type)) {
      return sendErrorResponse(res, 400, `Unsupported activity type. Supported types: ${supportedTypes.join(', ')}`);
    }

    // Validate required parameters for private lessons
    if (type === 'private-lessons' && !filterBy.teacherId) {
      return sendErrorResponse(res, 400, 'teacherId is required when filtering private lessons');
    }

    const result = await pastActivitiesService.getPastActivitiesByType(filterBy);
    
    res.json({
      success: true,
      type,
      data: result.activities,
      pagination: {
        currentPage: result.currentPage,
        totalPages: result.totalPages,
        totalCount: result.totalCount,
        hasNextPage: result.hasNextPage,
        hasPreviousPage: result.hasPreviousPage
      },
      summary: result.summary
    });
  } catch (err) {
    console.error(`Error in getPastActivitiesByType controller: ${err.message}`);
    next(err);
  }
}