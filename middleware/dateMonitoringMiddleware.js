/**
 * Date Monitoring Middleware
 * Integrates date operation monitoring into existing endpoints
 */

import dateMonitoringService from '../services/dateMonitoringService.js';
import { now } from '../utils/dateHelpers.js';

/**
 * Middleware to monitor date operations in API requests
 */
export const monitorDateOperations = (operationType = 'api_request') => {
  return (req, res, next) => {
    const startTime = now();
    const originalJson = res.json;

    // Track request metadata
    const requestMetadata = {
      method: req.method,
      path: req.path,
      query: req.query,
      hasDateParams: this._hasDateParameters(req),
      userAgent: req.get('User-Agent'),
      ip: req.ip
    };

    // Override res.json to capture response data
    res.json = function(data) {
      const endTime = now();
      const duration = endTime.diff(startTime, 'milliseconds');
      
      try {
        // Determine if operation was successful
        const isSuccess = res.statusCode >= 200 && res.statusCode < 300;
        const hasDateData = this._hasDateData(data);
        
        // Log the operation
        dateMonitoringService.logDateOperation(operationType, {
          ...requestMetadata,
          statusCode: res.statusCode,
          duration,
          isSuccess,
          hasDateData,
          responseSize: JSON.stringify(data).length,
          severity: isSuccess ? 'info' : 'error'
        });

        // Log specific date-related failures
        if (!isSuccess && hasDateData) {
          dateMonitoringService.logValidationFailure('api_response_error', {
            path: req.path,
            statusCode: res.statusCode,
            data: data
          });
        }

      } catch (error) {
        console.error('Error in date monitoring middleware:', error);
      }

      return originalJson.call(this, data);
    };

    next();
  };
};

/**
 * Middleware specifically for lesson creation/update operations
 */
export const monitorLessonOperations = (req, res, next) => {
  const originalJson = res.json;
  
  res.json = function(data) {
    try {
      const operationType = req.method === 'POST' ? 'lesson_creation' : 
                           req.method === 'PUT' ? 'lesson_update' : 
                           'lesson_operation';
      
      const lessonData = req.body;
      const hasConflicts = data && data.conflicts && data.conflicts.length > 0;
      
      dateMonitoringService.logDateOperation(operationType, {
        lessonType: req.path.includes('theory') ? 'theory' : 
                   req.path.includes('rehearsal') ? 'rehearsal' : 'unknown',
        hasDateField: !!(lessonData && lessonData.date),
        hasTimeFields: !!(lessonData && lessonData.startTime && lessonData.endTime),
        hasConflicts,
        statusCode: res.statusCode,
        severity: hasConflicts ? 'warning' : 'info'
      });

      if (hasConflicts) {
        dateMonitoringService.logConflictDetection('scheduling_conflict', {
          lessonType: req.path.includes('theory') ? 'theory' : 'rehearsal',
          conflicts: data.conflicts
        });
      }

    } catch (error) {
      console.error('Error in lesson monitoring middleware:', error);
    }

    return originalJson.call(this, data);
  };

  next();
};

/**
 * Middleware for bulk operations monitoring
 */
export const monitorBulkOperations = (req, res, next) => {
  const originalJson = res.json;
  
  res.json = function(data) {
    try {
      const bulkData = req.body;
      const createdCount = data && data.created ? data.created.length : 0;
      const skippedCount = data && data.skipped ? data.skipped.length : 0;
      
      dateMonitoringService.logDateOperation('bulk_creation', {
        operationType: 'bulk_lesson_creation',
        dateRange: bulkData ? {
          startDate: bulkData.startDate,
          endDate: bulkData.endDate,
          dayOfWeek: bulkData.dayOfWeek
        } : null,
        createdCount,
        skippedCount,
        totalAttempted: createdCount + skippedCount,
        successRate: createdCount + skippedCount > 0 ? 
          (createdCount / (createdCount + skippedCount) * 100).toFixed(2) : 0,
        statusCode: res.statusCode
      });

      // Log validation failures for skipped items
      if (skippedCount > 0) {
        dateMonitoringService.logValidationFailure('bulk_creation_skips', {
          skippedCount,
          skippedItems: data.skipped
        });
      }

    } catch (error) {
      console.error('Error in bulk monitoring middleware:', error);
    }

    return originalJson.call(this, data);
  };

  next();
};

/**
 * Middleware for attendance operations monitoring
 */
export const monitorAttendanceOperations = (req, res, next) => {
  const originalJson = res.json;
  
  res.json = function(data) {
    try {
      const attendanceData = req.body;
      const isUpdate = req.method === 'PUT';
      
      dateMonitoringService.logDateOperation('attendance_operation', {
        operationType: isUpdate ? 'attendance_update' : 'attendance_view',
        hasDate: !!(attendanceData && attendanceData.date),
        hasAttendanceData: !!(attendanceData && attendanceData.attendance),
        statusCode: res.statusCode,
        path: req.path
      });

    } catch (error) {
      console.error('Error in attendance monitoring middleware:', error);
    }

    return originalJson.call(this, data);
  };

  next();
};

/**
 * Middleware to monitor validation errors
 */
export const monitorValidationErrors = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    try {
      // Check if this is a validation error response
      if (res.statusCode >= 400 && res.statusCode < 500) {
        let errorData;
        try {
          errorData = typeof data === 'string' ? JSON.parse(data) : data;
        } catch (e) {
          errorData = { message: data };
        }

        // Check if error is date-related
        const isDateError = _isDateRelatedError(errorData, req);
        
        if (isDateError) {
          dateMonitoringService.logValidationFailure('date_validation_error', {
            path: req.path,
            method: req.method,
            statusCode: res.statusCode,
            errorData,
            body: req.body
          });
        }
      }
    } catch (error) {
      console.error('Error in validation monitoring middleware:', error);
    }

    return originalSend.call(this, data);
  };

  next();
};

/**
 * Helper function to check if request has date parameters
 * @private
 */
function _hasDateParameters(req) {
  const dateParams = ['date', 'startDate', 'endDate', 'fromDate', 'toDate', 'lessonDate'];
  
  // Check query parameters
  for (const param of dateParams) {
    if (req.query[param]) return true;
  }
  
  // Check body parameters
  if (req.body) {
    for (const param of dateParams) {
      if (req.body[param]) return true;
    }
  }
  
  return false;
}

/**
 * Helper function to check if response data contains date information
 * @private
 */
function _hasDateData(data) {
  if (!data || typeof data !== 'object') return false;
  
  const dateFields = ['date', 'createdAt', 'updatedAt', 'lessonDate', 'markedAt'];
  
  // Check if data is an array
  if (Array.isArray(data)) {
    return data.some(item => _hasDateData(item));
  }
  
  // Check direct properties
  for (const field of dateFields) {
    if (data[field]) return true;
  }
  
  // Check nested data property
  if (data.data) {
    return _hasDateData(data.data);
  }
  
  return false;
}

/**
 * Helper function to check if error is date-related
 * @private
 */
function _isDateRelatedError(errorData, req) {
  if (!errorData) return false;
  
  const dateKeywords = ['date', 'time', 'timezone', 'validation', 'format'];
  const errorMessage = (errorData.message || errorData.error || '').toLowerCase();
  
  // Check error message for date-related keywords
  const hasDateKeywords = dateKeywords.some(keyword => errorMessage.includes(keyword));
  
  // Check if request path is date-related
  const isDateEndpoint = req.path.includes('lesson') || 
                         req.path.includes('rehearsal') || 
                         req.path.includes('attendance') ||
                         req.path.includes('schedule');
  
  // Check if validation errors mention date fields
  const hasDateValidationErrors = errorData.validationErrors && 
    Array.isArray(errorData.validationErrors) &&
    errorData.validationErrors.some(error => 
      typeof error === 'object' && 
      error.field && 
      ['date', 'startDate', 'endDate', 'startTime', 'endTime'].includes(error.field)
    );
  
  return hasDateKeywords || (isDateEndpoint && hasDateValidationErrors);
}