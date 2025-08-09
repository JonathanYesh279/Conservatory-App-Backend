/**
 * Past Activities Routes
 * Admin endpoints for viewing past rehearsals, theory lessons, and private lessons
 */

import express from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { pastActivitiesController } from './past-activities.controller.js';
import { 
  validatePastActivitiesQuery,
  validatePastActivitiesByType 
} from '../../middleware/pastActivitiesValidation.js';
import { 
  formatLessonResponse, 
  formatAttendanceResponse 
} from '../../middleware/responseFormatterMiddleware.js';

const router = express.Router();

// All past activities endpoints require admin access
const adminAuth = requireAuth(['מנהל']);

/**
 * GET /api/admin/past-activities - Get all past activities with filtering
 * Query parameters:
 * - type: 'all', 'rehearsals', 'theory', 'private-lessons' (default: 'all')
 * - teacherId: Required for private-lessons type
 * - startDate: Optional start date filter (YYYY-MM-DD)
 * - endDate: Optional end date filter (defaults to yesterday)
 * - limit: Results per page (default: 100)
 * - page: Page number (default: 1)
 */
router.get('/', adminAuth, validatePastActivitiesQuery, pastActivitiesController.getPastActivities);

/**
 * GET /api/admin/past-activities/:type - Get past activities by specific type
 * Parameters:
 * - type: 'rehearsals', 'theory', 'private-lessons'
 * Query parameters:
 * - teacherId: Required for private-lessons, optional for others
 * - studentId: Optional filter by student
 * - orchestraId: Optional filter by orchestra (for rehearsals)
 * - category: Optional filter by category (for theory)
 * - startDate: Optional start date filter (YYYY-MM-DD)
 * - endDate: Optional end date filter (defaults to yesterday)
 * - limit: Results per page (default: 100)
 * - page: Page number (default: 1)
 */
router.get('/:type', adminAuth, validatePastActivitiesByType, pastActivitiesController.getPastActivitiesByType);

export default router;