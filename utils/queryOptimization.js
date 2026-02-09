/**
 * Query Optimization Utilities
 * Provides optimized query patterns for date-related operations
 */

import { 
  getStartOfDay, 
  getEndOfDay, 
  createAppDate, 
  isValidDate 
} from './dateHelpers.js';

/**
 * Create optimized date range query
 * @param {string|Date} startDate - Start date
 * @param {string|Date} endDate - End date
 * @returns {Object} MongoDB query object
 */
export function createDateRangeQuery(startDate, endDate) {
  if (!startDate && !endDate) {
    return {};
  }

  const query = {};
  
  if (startDate && isValidDate(startDate)) {
    query.$gte = getStartOfDay(startDate);
  }
  
  if (endDate && isValidDate(endDate)) {
    query.$lte = getEndOfDay(endDate);
  }
  
  return query;
}

/**
 * Create optimized single date query for a specific day
 * @param {string|Date} date - Target date
 * @returns {Object} MongoDB query object
 */
export function createSingleDateQuery(date) {
  if (!date || !isValidDate(date)) {
    return {};
  }
  
  return {
    $gte: getStartOfDay(date),
    $lte: getEndOfDay(date)
  };
}

/**
 * Create query for current week
 * @returns {Object} MongoDB query object
 */
export function createCurrentWeekQuery() {
  const now = createAppDate();
  const startOfWeek = now.startOf('week');
  const endOfWeek = now.endOf('week');
  
  return {
    $gte: startOfWeek.toDate(),
    $lte: endOfWeek.toDate()
  };
}

/**
 * Create query for current month
 * @returns {Object} MongoDB query object
 */
export function createCurrentMonthQuery() {
  const now = createAppDate();
  const startOfMonth = now.startOf('month');
  const endOfMonth = now.endOf('month');
  
  return {
    $gte: startOfMonth.toDate(),
    $lte: endOfMonth.toDate()
  };
}

/**
 * Create query for upcoming dates (next N days)
 * @param {number} days - Number of days to look ahead
 * @returns {Object} MongoDB query object
 */
export function createUpcomingQuery(days = 7) {
  const now = createAppDate();
  const futureDate = now.add(days, 'days');
  
  return {
    $gte: getStartOfDay(now.toDate()),
    $lte: getEndOfDay(futureDate.toDate())
  };
}

/**
 * Create optimized lesson filter query
 * @param {Object} filters - Filter parameters
 * @returns {Object} MongoDB query object
 */
export function createLessonFilterQuery(filters = {}) {
  const query = {};
  
  // Date range filtering
  if (filters.fromDate || filters.toDate) {
    const dateQuery = createDateRangeQuery(filters.fromDate, filters.toDate);
    if (Object.keys(dateQuery).length > 0) {
      query.date = dateQuery;
    }
  }
  
  // Single date filtering
  if (filters.date && !filters.fromDate && !filters.toDate) {
    const dateQuery = createSingleDateQuery(filters.date);
    if (Object.keys(dateQuery).length > 0) {
      query.date = dateQuery;
    }
  }
  
  // Day of week filtering
  if (filters.dayOfWeek !== undefined && filters.dayOfWeek !== null) {
    const dayOfWeek = parseInt(filters.dayOfWeek);
    if (dayOfWeek >= 0 && dayOfWeek <= 6) {
      query.dayOfWeek = dayOfWeek;
    }
  }
  
  // Teacher filtering
  if (filters.teacherId) {
    query.teacherId = filters.teacherId;
  }
  
  // Category filtering
  if (filters.category) {
    query.category = filters.category;
  }
  
  // Location filtering
  if (filters.location) {
    query.location = filters.location;
  }
  
  // School year filtering
  if (filters.schoolYearId) {
    query.schoolYearId = filters.schoolYearId;
  }
  
  // Student filtering (for lessons that have student arrays)
  if (filters.studentId) {
    query.studentIds = { $in: [filters.studentId] };
  }
  
  return query;
}

/**
 * Create optimized attendance filter query
 * @param {Object} filters - Filter parameters
 * @returns {Object} MongoDB query object
 */
export function createAttendanceFilterQuery(filters = {}) {
  const query = {};
  
  // Date range filtering
  if (filters.fromDate || filters.toDate) {
    const dateQuery = createDateRangeQuery(filters.fromDate, filters.toDate);
    if (Object.keys(dateQuery).length > 0) {
      query.date = dateQuery;
    }
  }
  
  // Student filtering
  if (filters.studentId) {
    query.studentId = filters.studentId;
  }
  
  // Teacher filtering
  if (filters.teacherId) {
    query.teacherId = filters.teacherId;
  }
  
  // Activity type filtering
  if (filters.activityType) {
    query.activityType = filters.activityType;
  }
  
  // Status filtering
  if (filters.status) {
    query.status = filters.status;
  }
  
  return query;
}

/**
 * Create aggregation pipeline for date-based statistics
 * @param {Object} options - Aggregation options
 * @returns {Array} MongoDB aggregation pipeline
 */
export function createDateStatsPipeline(options = {}) {
  const {
    groupBy = 'month', // 'day', 'week', 'month', 'year'
    dateField = 'date',
    startDate,
    endDate,
    additionalFilters = {}
  } = options;
  
  const pipeline = [];
  
  // Match stage - filter by date range and additional filters
  const matchStage = { ...additionalFilters };
  
  if (startDate || endDate) {
    const dateQuery = createDateRangeQuery(startDate, endDate);
    if (Object.keys(dateQuery).length > 0) {
      matchStage[dateField] = dateQuery;
    }
  }
  
  if (Object.keys(matchStage).length > 0) {
    pipeline.push({ $match: matchStage });
  }
  
  // Group stage - group by specified time period
  const groupStage = {
    $group: {
      _id: null,
      count: { $sum: 1 }
    }
  };
  
  switch (groupBy) {
    case 'day':
      groupStage.$group._id = {
        year: { $year: `$${dateField}` },
        month: { $month: `$${dateField}` },
        day: { $dayOfMonth: `$${dateField}` }
      };
      break;
    case 'week':
      groupStage.$group._id = {
        year: { $year: `$${dateField}` },
        week: { $week: `$${dateField}` }
      };
      break;
    case 'month':
      groupStage.$group._id = {
        year: { $year: `$${dateField}` },
        month: { $month: `$${dateField}` }
      };
      break;
    case 'year':
      groupStage.$group._id = {
        year: { $year: `$${dateField}` }
      };
      break;
    case 'dayOfWeek':
      groupStage.$group._id = { $dayOfWeek: `$${dateField}` };
      break;
  }
  
  pipeline.push(groupStage);
  
  // Sort stage - sort by date
  pipeline.push({ $sort: { '_id': 1 } });
  
  return pipeline;
}

/**
 * Create efficient pagination query
 * @param {Object} options - Pagination options
 * @returns {Object} Pagination query object
 */
export function createPaginationQuery(options = {}) {
  const {
    page = 1,
    limit = 20,
    sortField = 'date',
    sortOrder = -1 // -1 for descending, 1 for ascending
  } = options;
  
  const skip = (page - 1) * limit;
  
  return {
    pagination: {
      skip,
      limit
    },
    sort: {
      [sortField]: sortOrder
    }
  };
}

/**
 * Create conflict detection query
 * @param {Object} lessonData - Lesson data to check
 * @param {string} excludeId - ID to exclude from conflict check
 * @returns {Object} MongoDB query object
 */
export function createConflictQuery(lessonData, excludeId = null) {
  const query = {};
  
  // Date range conflict check
  if (lessonData.date) {
    const dateQuery = createSingleDateQuery(lessonData.date);
    if (Object.keys(dateQuery).length > 0) {
      query.date = dateQuery;
    }
  }
  
  // Time overlap check (handled at application level)
  // Location conflict
  if (lessonData.location) {
    query.location = lessonData.location;
  }
  
  // Teacher conflict
  if (lessonData.teacherId) {
    query.teacherId = lessonData.teacherId;
  }
  
  // Exclude current lesson from conflict check
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  
  return query;
}

/**
 * Suggest database indexes for optimal query performance
 * @returns {Array} Array of index suggestions
 */
export function suggestOptimalIndexes() {
  return [
    {
      collection: 'theory_lesson',
      indexes: [
        { date: 1, location: 1 }, // Date-location compound index
        { date: 1, teacherId: 1 }, // Date-teacher compound index
        { teacherId: 1, date: 1 }, // Teacher-date compound index
        { schoolYearId: 1, date: 1 }, // School year-date compound index
        { dayOfWeek: 1, date: 1 }, // Day of week-date compound index
        { category: 1, date: 1 }, // Category-date compound index
        { 'studentIds': 1, date: 1 } // Student-date compound index
      ]
    },
    {
      collection: 'rehearsal',
      indexes: [
        { date: 1, location: 1 },
        { date: 1, orchestraId: 1 },
        { orchestraId: 1, date: 1 },
        { dayOfWeek: 1, date: 1 }
      ]
    },
    {
      collection: 'activity_attendance',
      indexes: [
        { date: 1, studentId: 1 },
        { studentId: 1, date: 1 },
        { teacherId: 1, date: 1 },
        { activityType: 1, date: 1 },
        { status: 1, date: 1 }
      ]
    },
    {
      collection: 'teacher',
      indexes: [
        { 'teaching.timeBlocks.assignedLessons.studentId': 1 },
        { 'teaching.timeBlocks.day': 1 }
      ]
    }
  ];
}

/**
 * Cache key generator for query results
 * @param {string} queryType - Type of query
 * @param {Object} params - Query parameters
 * @returns {string} Cache key
 */
export function generateCacheKey(queryType, params = {}) {
  const normalizedParams = Object.keys(params)
    .sort()
    .reduce((result, key) => {
      result[key] = params[key];
      return result;
    }, {});
  
  const paramsString = JSON.stringify(normalizedParams);
  return `${queryType}:${Buffer.from(paramsString).toString('base64')}`;
}

/**
 * Estimate query complexity score
 * @param {Object} query - MongoDB query object
 * @returns {number} Complexity score (1-10)
 */
export function estimateQueryComplexity(query) {
  let complexity = 1;
  
  // Count the number of fields being queried
  const fieldCount = Object.keys(query).length;
  complexity += fieldCount * 0.5;
  
  // Check for range queries
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'object' && value !== null) {
      if (value.$gte || value.$lte || value.$gt || value.$lt) {
        complexity += 1; // Range queries are more expensive
      }
      if (value.$in && Array.isArray(value.$in)) {
        complexity += value.$in.length * 0.1; // IN queries scale with array size
      }
      if (value.$regex) {
        complexity += 2; // Regex queries are expensive
      }
    }
  }
  
  return Math.min(Math.round(complexity), 10);
}