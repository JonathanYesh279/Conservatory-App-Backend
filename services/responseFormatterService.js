/**
 * Response Formatter Service
 * Provides timezone-aware response formatting for API endpoints
 */

import { 
  formatDate, 
  formatDateTime, 
  createAppDate,
  now,
  isValidDate
} from '../utils/dateHelpers.js';
import { 
  formatTime, 
  getTimeRangeDescription 
} from '../utils/timeUtils.js';

class ResponseFormatterService {

  /**
   * Format lesson objects with timezone-aware date/time information
   * @param {Object|Array} data - Lesson data or array of lessons
   * @param {Object} options - Formatting options
   * @returns {Object|Array} Formatted data
   */
  formatLessonResponse(data, options = {}) {
    const {
      includeFormatted = true,
      includeRelative = false,
      dateFormat = 'DD/MM/YYYY',
      timeFormat = 'HH:MM',
      timezone = process.env.APP_TIMEZONE || 'Asia/Jerusalem'
    } = options;

    if (Array.isArray(data)) {
      return data.map(item => this._formatSingleLesson(item, { 
        includeFormatted, 
        includeRelative, 
        dateFormat, 
        timeFormat, 
        timezone 
      }));
    }

    return this._formatSingleLesson(data, { 
      includeFormatted, 
      includeRelative, 
      dateFormat, 
      timeFormat, 
      timezone 
    });
  }

  /**
   * Format attendance records with timezone-aware information
   * @param {Object|Array} data - Attendance data
   * @param {Object} options - Formatting options
   * @returns {Object|Array} Formatted data
   */
  formatAttendanceResponse(data, options = {}) {
    const {
      includeFormatted = true,
      includeRelative = true,
      dateFormat = 'DD/MM/YYYY',
      timeFormat = 'HH:MM',
      timezone = process.env.APP_TIMEZONE || 'Asia/Jerusalem'
    } = options;

    if (Array.isArray(data)) {
      return data.map(item => this._formatSingleAttendance(item, { 
        includeFormatted, 
        includeRelative, 
        dateFormat, 
        timeFormat, 
        timezone 
      }));
    }

    return this._formatSingleAttendance(data, { 
      includeFormatted, 
      includeRelative, 
      dateFormat, 
      timeFormat, 
      timezone 
    });
  }

  /**
   * Format rehearsal objects with timezone-aware information
   * @param {Object|Array} data - Rehearsal data
   * @param {Object} options - Formatting options
   * @returns {Object|Array} Formatted data
   */
  formatRehearsalResponse(data, options = {}) {
    const {
      includeFormatted = true,
      includeRelative = false,
      dateFormat = 'DD/MM/YYYY',
      timeFormat = 'HH:MM',
      timezone = process.env.APP_TIMEZONE || 'Asia/Jerusalem'
    } = options;

    if (Array.isArray(data)) {
      return data.map(item => this._formatSingleRehearsal(item, { 
        includeFormatted, 
        includeRelative, 
        dateFormat, 
        timeFormat, 
        timezone 
      }));
    }

    return this._formatSingleRehearsal(data, { 
      includeFormatted, 
      includeRelative, 
      dateFormat, 
      timeFormat, 
      timezone 
    });
  }

  /**
   * Format schedule data with timezone-aware information
   * @param {Object|Array} data - Schedule data
   * @param {Object} options - Formatting options
   * @returns {Object|Array} Formatted data
   */
  formatScheduleResponse(data, options = {}) {
    const {
      includeFormatted = true,
      includeRelative = false,
      dateFormat = 'DD/MM/YYYY',
      timeFormat = 'HH:MM',
      timezone = process.env.APP_TIMEZONE || 'Asia/Jerusalem'
    } = options;

    if (Array.isArray(data)) {
      return data.map(item => this._formatSingleSchedule(item, { 
        includeFormatted, 
        includeRelative, 
        dateFormat, 
        timeFormat, 
        timezone 
      }));
    }

    return this._formatSingleSchedule(data, { 
      includeFormatted, 
      includeRelative, 
      dateFormat, 
      timeFormat, 
      timezone 
    });
  }

  /**
   * Format a paginated response with timezone-aware data
   * @param {Object} paginatedData - Paginated response object
   * @param {Function} formatter - Formatter function for data items
   * @param {Object} options - Formatting options
   * @returns {Object} Formatted paginated response
   */
  formatPaginatedResponse(paginatedData, formatter, options = {}) {
    return {
      ...paginatedData,
      data: formatter(paginatedData.data, options),
      meta: {
        ...paginatedData.meta,
        generatedAt: formatDateTime(now()),
        timezone: options.timezone || process.env.APP_TIMEZONE || 'Asia/Jerusalem'
      }
    };
  }

  /**
   * Format error responses with timezone information
   * @param {Object} error - Error object
   * @param {Object} options - Formatting options
   * @returns {Object} Formatted error response
   */
  formatErrorResponse(error, options = {}) {
    const {
      includeTimestamp = true,
      timezone = process.env.APP_TIMEZONE || 'Asia/Jerusalem'
    } = options;

    const response = {
      ...error,
      success: false
    };

    if (includeTimestamp) {
      response.timestamp = formatDateTime(now());
      response.timezone = timezone;
    }

    return response;
  }

  /**
   * Format success responses with timezone information
   * @param {Object} data - Response data
   * @param {Object} options - Formatting options
   * @returns {Object} Formatted success response
   */
  formatSuccessResponse(data, options = {}) {
    const {
      includeTimestamp = true,
      message = 'Success',
      timezone = process.env.APP_TIMEZONE || 'Asia/Jerusalem'
    } = options;

    const response = {
      success: true,
      message,
      data
    };

    if (includeTimestamp) {
      response.timestamp = formatDateTime(now());
      response.timezone = timezone;
    }

    return response;
  }

  /**
   * Format single lesson object
   * @private
   */
  _formatSingleLesson(lesson, options) {
    if (!lesson) return lesson;

    const formatted = { ...lesson };

    if (options.includeFormatted && lesson.date) {
      const lessonDate = createAppDate(lesson.date);
      
      formatted.formatted = {
        date: formatDate(lessonDate, options.dateFormat),
        dayName: createAppDate(lessonDate).format('dddd'),
        timeRange: lesson.startTime && lesson.endTime 
          ? getTimeRangeDescription(lesson.startTime, lesson.endTime)
          : null,
        dateTime: lesson.startTime 
          ? formatDateTime(lessonDate.hour(lesson.startTime.split(':')[0]).minute(lesson.startTime.split(':')[1]))
          : formatDate(lessonDate, options.dateFormat)
      };

      if (options.includeRelative) {
        formatted.formatted.relative = lessonDate.fromNow();
        formatted.formatted.isToday = lessonDate.isSame(now(), 'day');
        formatted.formatted.isPast = lessonDate.isBefore(now());
        formatted.formatted.isFuture = lessonDate.isAfter(now());
      }
    }

    // Format timestamps
    if (options.includeFormatted) {
      if (lesson.createdAt) {
        formatted.formatted = formatted.formatted || {};
        formatted.formatted.createdAt = formatDateTime(createAppDate(lesson.createdAt));
      }
      if (lesson.updatedAt) {
        formatted.formatted = formatted.formatted || {};
        formatted.formatted.updatedAt = formatDateTime(createAppDate(lesson.updatedAt));
      }
    }

    return formatted;
  }

  /**
   * Format single attendance record
   * @private
   */
  _formatSingleAttendance(attendance, options) {
    if (!attendance) return attendance;

    const formatted = { ...attendance };

    if (options.includeFormatted) {
      if (attendance.date) {
        const attendanceDate = createAppDate(attendance.date);
        
        formatted.formatted = {
          date: formatDate(attendanceDate, options.dateFormat),
          dayName: createAppDate(attendanceDate).format('dddd')
        };

        if (options.includeRelative) {
          formatted.formatted.relative = attendanceDate.fromNow();
          formatted.formatted.isToday = attendanceDate.isSame(now(), 'day');
        }
      }

      if (attendance.markedAt) {
        const markedDate = createAppDate(attendance.markedAt);
        formatted.formatted = formatted.formatted || {};
        formatted.formatted.markedAt = formatDateTime(markedDate);
        
        if (options.includeRelative) {
          formatted.formatted.markedAtRelative = markedDate.fromNow();
        }
      }

      if (attendance.createdAt) {
        formatted.formatted = formatted.formatted || {};
        formatted.formatted.createdAt = formatDateTime(createAppDate(attendance.createdAt));
      }
    }

    return formatted;
  }

  /**
   * Format single rehearsal object
   * @private
   */
  _formatSingleRehearsal(rehearsal, options) {
    if (!rehearsal) return rehearsal;

    const formatted = { ...rehearsal };

    if (options.includeFormatted && rehearsal.date) {
      const rehearsalDate = createAppDate(rehearsal.date);
      
      formatted.formatted = {
        date: formatDate(rehearsalDate, options.dateFormat),
        dayName: createAppDate(rehearsalDate).format('dddd'),
        timeRange: rehearsal.startTime && rehearsal.endTime 
          ? getTimeRangeDescription(rehearsal.startTime, rehearsal.endTime)
          : null
      };

      if (options.includeRelative) {
        formatted.formatted.relative = rehearsalDate.fromNow();
        formatted.formatted.isToday = rehearsalDate.isSame(now(), 'day');
        formatted.formatted.isPast = rehearsalDate.isBefore(now());
        formatted.formatted.isFuture = rehearsalDate.isAfter(now());
      }
    }

    // Format timestamps
    if (options.includeFormatted) {
      if (rehearsal.createdAt) {
        formatted.formatted = formatted.formatted || {};
        formatted.formatted.createdAt = formatDateTime(createAppDate(rehearsal.createdAt));
      }
      if (rehearsal.updatedAt) {
        formatted.formatted = formatted.formatted || {};
        formatted.formatted.updatedAt = formatDateTime(createAppDate(rehearsal.updatedAt));
      }
    }

    return formatted;
  }

  /**
   * Format single schedule object
   * @private
   */
  _formatSingleSchedule(schedule, options) {
    if (!schedule) return schedule;

    const formatted = { ...schedule };

    if (options.includeFormatted) {
      // Format timeBlocks if they exist
      if (schedule.teaching && schedule.teaching.timeBlocks) {
        formatted.teaching = {
          ...(formatted.teaching || schedule.teaching),
          timeBlocks: schedule.teaching.timeBlocks.map(block => {
            const formattedBlock = { ...block };
            if (block.assignedLessons) {
              formattedBlock.assignedLessons = block.assignedLessons.map(lesson => {
                const formattedLesson = { ...lesson };
                if (lesson.createdAt) {
                  formattedLesson.formatted = {
                    createdAt: formatDateTime(createAppDate(lesson.createdAt))
                  };
                }
                return formattedLesson;
              });
            }
            return formattedBlock;
          })
        };
      }

      // Format timestamps
      if (schedule.createdAt) {
        formatted.formatted = formatted.formatted || {};
        formatted.formatted.createdAt = formatDateTime(createAppDate(schedule.createdAt));
      }
      if (schedule.updatedAt) {
        formatted.formatted = formatted.formatted || {};
        formatted.formatted.updatedAt = formatDateTime(createAppDate(schedule.updatedAt));
      }
    }

    return formatted;
  }

  /**
   * Format date range queries for responses
   * @param {Object} query - Query parameters
   * @returns {Object} Formatted query info
   */
  formatQueryInfo(query) {
    const info = {
      appliedFilters: {}
    };

    if (query.fromDate && isValidDate(query.fromDate)) {
      info.appliedFilters.fromDate = formatDate(createAppDate(query.fromDate), 'DD/MM/YYYY');
    }

    if (query.toDate && isValidDate(query.toDate)) {
      info.appliedFilters.toDate = formatDate(createAppDate(query.toDate), 'DD/MM/YYYY');
    }

    if (query.fromDate && query.toDate && isValidDate(query.fromDate) && isValidDate(query.toDate)) {
      const startDate = createAppDate(query.fromDate);
      const endDate = createAppDate(query.toDate);
      info.appliedFilters.dateRange = `${formatDate(startDate, 'DD/MM/YYYY')} - ${formatDate(endDate, 'DD/MM/YYYY')}`;
    }

    if (query.dayOfWeek !== undefined) {
      const dayOfWeek = parseInt(query.dayOfWeek);
      if (dayOfWeek >= 0 && dayOfWeek <= 6) {
        info.appliedFilters.dayOfWeek = createAppDate().day(dayOfWeek).format('dddd');
      }
    }

    return info;
  }
}

export default new ResponseFormatterService();