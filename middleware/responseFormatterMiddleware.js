/**
 * Response Formatter Middleware
 * Automatically formats API responses with timezone-aware date formatting
 */

import responseFormatterService from '../services/responseFormatterService.js';

/**
 * Middleware to format lesson responses
 * @param {Object} options - Formatting options
 */
export const formatLessonResponse = (options = {}) => {
  return (req, res, next) => {
    const originalJson = res.json;
    
    res.json = function(data) {
      try {
        // Extract formatting preferences from query params
        const formatOptions = {
          includeFormatted: req.query.includeFormatted !== 'false',
          includeRelative: req.query.includeRelative === 'true',
          dateFormat: req.query.dateFormat || options.dateFormat || 'DD/MM/YYYY',
          timeFormat: req.query.timeFormat || options.timeFormat || 'HH:MM',
          timezone: req.query.timezone || options.timezone || process.env.APP_TIMEZONE || 'Asia/Jerusalem',
          ...options
        };

        // Format the data
        const formattedData = responseFormatterService.formatLessonResponse(data, formatOptions);
        
        // Add query information if requested
        if (req.query.includeQueryInfo === 'true') {
          const queryInfo = responseFormatterService.formatQueryInfo(req.query);
          const response = {
            data: formattedData,
            queryInfo: queryInfo,
            meta: {
              timezone: formatOptions.timezone,
              formatOptions: {
                dateFormat: formatOptions.dateFormat,
                timeFormat: formatOptions.timeFormat,
                includeFormatted: formatOptions.includeFormatted,
                includeRelative: formatOptions.includeRelative
              }
            }
          };
          return originalJson.call(this, response);
        }
        
        return originalJson.call(this, formattedData);
      } catch (error) {
        console.error('Error formatting lesson response:', error);
        // Fall back to original data if formatting fails
        return originalJson.call(this, data);
      }
    };
    
    next();
  };
};

/**
 * Middleware to format rehearsal responses
 * @param {Object} options - Formatting options
 */
export const formatRehearsalResponse = (options = {}) => {
  return (req, res, next) => {
    const originalJson = res.json;
    
    res.json = function(data) {
      try {
        const formatOptions = {
          includeFormatted: req.query.includeFormatted !== 'false',
          includeRelative: req.query.includeRelative === 'true',
          dateFormat: req.query.dateFormat || options.dateFormat || 'DD/MM/YYYY',
          timeFormat: req.query.timeFormat || options.timeFormat || 'HH:MM',
          timezone: req.query.timezone || options.timezone || process.env.APP_TIMEZONE || 'Asia/Jerusalem',
          ...options
        };

        const formattedData = responseFormatterService.formatRehearsalResponse(data, formatOptions);
        
        if (req.query.includeQueryInfo === 'true') {
          const queryInfo = responseFormatterService.formatQueryInfo(req.query);
          const response = {
            data: formattedData,
            queryInfo: queryInfo,
            meta: {
              timezone: formatOptions.timezone,
              formatOptions: {
                dateFormat: formatOptions.dateFormat,
                timeFormat: formatOptions.timeFormat,
                includeFormatted: formatOptions.includeFormatted,
                includeRelative: formatOptions.includeRelative
              }
            }
          };
          return originalJson.call(this, response);
        }
        
        return originalJson.call(this, formattedData);
      } catch (error) {
        console.error('Error formatting rehearsal response:', error);
        return originalJson.call(this, data);
      }
    };
    
    next();
  };
};

/**
 * Middleware to format attendance responses
 * @param {Object} options - Formatting options
 */
export const formatAttendanceResponse = (options = {}) => {
  return (req, res, next) => {
    const originalJson = res.json;
    
    res.json = function(data) {
      try {
        const formatOptions = {
          includeFormatted: req.query.includeFormatted !== 'false',
          includeRelative: req.query.includeRelative !== 'false', // Default true for attendance
          dateFormat: req.query.dateFormat || options.dateFormat || 'DD/MM/YYYY',
          timeFormat: req.query.timeFormat || options.timeFormat || 'HH:MM',
          timezone: req.query.timezone || options.timezone || process.env.APP_TIMEZONE || 'Asia/Jerusalem',
          ...options
        };

        const formattedData = responseFormatterService.formatAttendanceResponse(data, formatOptions);
        
        if (req.query.includeQueryInfo === 'true') {
          const queryInfo = responseFormatterService.formatQueryInfo(req.query);
          const response = {
            data: formattedData,
            queryInfo: queryInfo,
            meta: {
              timezone: formatOptions.timezone,
              formatOptions: {
                dateFormat: formatOptions.dateFormat,
                timeFormat: formatOptions.timeFormat,
                includeFormatted: formatOptions.includeFormatted,
                includeRelative: formatOptions.includeRelative
              }
            }
          };
          return originalJson.call(this, response);
        }
        
        return originalJson.call(this, formattedData);
      } catch (error) {
        console.error('Error formatting attendance response:', error);
        return originalJson.call(this, data);
      }
    };
    
    next();
  };
};

/**
 * Middleware to format schedule responses
 * @param {Object} options - Formatting options
 */
export const formatScheduleResponse = (options = {}) => {
  return (req, res, next) => {
    const originalJson = res.json;
    
    res.json = function(data) {
      try {
        const formatOptions = {
          includeFormatted: req.query.includeFormatted !== 'false',
          includeRelative: req.query.includeRelative === 'true',
          dateFormat: req.query.dateFormat || options.dateFormat || 'DD/MM/YYYY',
          timeFormat: req.query.timeFormat || options.timeFormat || 'HH:MM',
          timezone: req.query.timezone || options.timezone || process.env.APP_TIMEZONE || 'Asia/Jerusalem',
          ...options
        };

        const formattedData = responseFormatterService.formatScheduleResponse(data, formatOptions);
        
        if (req.query.includeQueryInfo === 'true') {
          const queryInfo = responseFormatterService.formatQueryInfo(req.query);
          const response = {
            data: formattedData,
            queryInfo: queryInfo,
            meta: {
              timezone: formatOptions.timezone,
              formatOptions: {
                dateFormat: formatOptions.dateFormat,
                timeFormat: formatOptions.timeFormat,
                includeFormatted: formatOptions.includeFormatted,
                includeRelative: formatOptions.includeRelative
              }
            }
          };
          return originalJson.call(this, response);
        }
        
        return originalJson.call(this, formattedData);
      } catch (error) {
        console.error('Error formatting schedule response:', error);
        return originalJson.call(this, data);
      }
    };
    
    next();
  };
};

/**
 * Generic middleware to format any response with timezone awareness
 * @param {Function} formatter - Formatter function from responseFormatterService
 * @param {Object} options - Formatting options
 */
export const formatGenericResponse = (formatter, options = {}) => {
  return (req, res, next) => {
    const originalJson = res.json;
    
    res.json = function(data) {
      try {
        const formatOptions = {
          includeFormatted: req.query.includeFormatted !== 'false',
          includeRelative: req.query.includeRelative === 'true',
          dateFormat: req.query.dateFormat || options.dateFormat || 'DD/MM/YYYY',
          timeFormat: req.query.timeFormat || options.timeFormat || 'HH:MM',
          timezone: req.query.timezone || options.timezone || process.env.APP_TIMEZONE || 'Asia/Jerusalem',
          ...options
        };

        const formattedData = formatter(data, formatOptions);
        
        if (req.query.includeQueryInfo === 'true') {
          const queryInfo = responseFormatterService.formatQueryInfo(req.query);
          const response = {
            data: formattedData,
            queryInfo: queryInfo,
            meta: {
              timezone: formatOptions.timezone,
              formatOptions: {
                dateFormat: formatOptions.dateFormat,
                timeFormat: formatOptions.timeFormat,
                includeFormatted: formatOptions.includeFormatted,
                includeRelative: formatOptions.includeRelative
              }
            }
          };
          return originalJson.call(this, response);
        }
        
        return originalJson.call(this, formattedData);
      } catch (error) {
        console.error('Error formatting response:', error);
        return originalJson.call(this, data);
      }
    };
    
    next();
  };
};

/**
 * Middleware to add timezone information to all responses
 */
export const addTimezoneInfo = (req, res, next) => {
  const originalJson = res.json;
  
  res.json = function(data) {
    try {
      const timezone = req.query.timezone || process.env.APP_TIMEZONE || 'Asia/Jerusalem';
      
      // Only add timezone info if it's not already present and data is an object
      if (typeof data === 'object' && data !== null && !data.timezone) {
        const enhancedData = {
          ...data,
          timezone: timezone,
          serverTime: new Date().toISOString()
        };
        return originalJson.call(this, enhancedData);
      }
      
      return originalJson.call(this, data);
    } catch (error) {
      console.error('Error adding timezone info:', error);
      return originalJson.call(this, data);
    }
  };
  
  next();
};