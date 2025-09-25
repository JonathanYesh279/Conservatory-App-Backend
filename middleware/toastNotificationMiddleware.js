/**
 * Toast Notification Middleware
 *
 * This middleware provides a standardized way to send toast notifications
 * to the frontend. It formats error and success messages in a consistent
 * format that can be consumed by the frontend toast system.
 */

const TOAST_TYPES = {
  ERROR: 'error',
  SUCCESS: 'success',
  WARNING: 'warning',
  INFO: 'info'
};

const TOAST_POSITIONS = {
  TOP_LEFT: 'top-left',
  TOP_RIGHT: 'top-right',
  BOTTOM_LEFT: 'bottom-left',
  BOTTOM_RIGHT: 'bottom-right'
};

/**
 * Create a standardized toast notification object
 * @param {string} type - Type of toast (error, success, warning, info)
 * @param {string} message - The main message to display
 * @param {object} options - Additional options for the toast
 * @returns {object} Formatted toast notification object
 */
function createToast(type, message, options = {}) {
  return {
    type,
    message,
    title: options.title || null,
    duration: options.duration || (type === TOAST_TYPES.ERROR ? 5000 : 3000),
    position: options.position || TOAST_POSITIONS.BOTTOM_LEFT,
    timestamp: new Date().toISOString(),
    dismissible: options.dismissible !== false,
    actions: options.actions || null,
    metadata: options.metadata || null
  };
}

/**
 * Middleware to add toast notification helpers to the response object
 */
export function addToastHelpers(req, res, next) {
  // Add toast helper methods to the response object
  res.toast = {
    error: (message, options = {}) => {
      const toast = createToast(TOAST_TYPES.ERROR, message, options);
      res.locals.toast = toast;
      return toast;
    },

    success: (message, options = {}) => {
      const toast = createToast(TOAST_TYPES.SUCCESS, message, options);
      res.locals.toast = toast;
      return toast;
    },

    warning: (message, options = {}) => {
      const toast = createToast(TOAST_TYPES.WARNING, message, options);
      res.locals.toast = toast;
      return toast;
    },

    info: (message, options = {}) => {
      const toast = createToast(TOAST_TYPES.INFO, message, options);
      res.locals.toast = toast;
      return toast;
    }
  };

  // Add method to send JSON response with toast
  res.jsonWithToast = function(data, statusCode = 200) {
    const response = {
      success: statusCode < 400,
      data: data || null,
      timestamp: new Date().toISOString()
    };

    // Add toast if one was created
    if (res.locals.toast) {
      response.toast = res.locals.toast;
    }

    return res.status(statusCode).json(response);
  };

  next();
}

/**
 * Enhanced error handler that provides toast notifications
 */
export function errorWithToast(err, req, res, next) {
  console.error('Error caught by toast middleware:', err);

  // Default error response
  let statusCode = 500;
  let message = 'An unexpected error occurred';
  let details = null;

  // Handle different types of errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    details = err.details || err.message;
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format provided';
  } else if (err.message) {
    message = err.message;

    // Set appropriate status codes based on error message content
    if (err.message.includes('not found')) {
      statusCode = 404;
    } else if (err.message.includes('Validation error') || err.message.includes('required')) {
      statusCode = 400;
    } else if (err.message.includes('Unauthorized') || err.message.includes('permission')) {
      statusCode = 403;
    }
  }

  // Create error toast
  const toast = createToast(TOAST_TYPES.ERROR, message, {
    title: 'Error',
    duration: 5000,
    metadata: {
      errorType: err.name,
      endpoint: req.originalUrl,
      method: req.method,
      details: details
    }
  });

  // Send error response with toast
  res.status(statusCode).json({
    success: false,
    error: message,
    details: details,
    toast: toast,
    timestamp: new Date().toISOString()
  });
}

/**
 * Middleware to handle theory lesson specific errors
 */
export function theoryLessonErrorHandler(err, req, res, next) {
  console.error('Theory lesson error:', err);

  // Handle specific theory lesson errors
  if (err.message.includes('Theory lesson') && err.message.includes('not found')) {
    const toast = res.toast.error('The requested theory lesson could not be found', {
      title: 'Lesson Not Found',
      metadata: {
        lessonId: req.params.id,
        action: req.method
      }
    });

    return res.jsonWithToast(null, 404);
  }

  if (err.message.includes('Selected Lesson ID') || err.message.includes('Selected Lesson Category')) {
    const toast = res.toast.error('No lesson is currently selected. Please select a lesson to continue.', {
      title: 'No Lesson Selected',
      metadata: {
        context: 'lesson_selection'
      }
    });

    return res.jsonWithToast(null, 400);
  }

  // Pass to general error handler
  next(err);
}

export { TOAST_TYPES, TOAST_POSITIONS, createToast };