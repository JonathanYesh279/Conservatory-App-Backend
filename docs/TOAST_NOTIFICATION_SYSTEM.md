# Toast Notification System

This document describes the enhanced toast notification system implemented to improve error handling and user experience, specifically addressing issues where "Selected Lesson ID: None" and "Selected Lesson Category: None" messages were appearing.

## Overview

The toast notification system provides a standardized way to send user-friendly error messages, success notifications, and other feedback to the frontend. It replaces harsh error messages with contextual, actionable notifications.

## Key Features

- **Consistent API**: Standardized format for all notifications
- **Auto-dismissal**: Configurable duration with sensible defaults
- **Positioning**: Configurable position (default: bottom-left as requested)
- **Type-based styling**: Different styles for error, success, warning, and info
- **Enhanced error handling**: Specific handling for theory lesson errors

## Implementation

### Backend Usage

#### Middleware Integration

The toast notification system is integrated as middleware in the theory routes:

```javascript
import { addToastHelpers, errorWithToast, theoryLessonErrorHandler } from '../../middleware/toastNotificationMiddleware.js';

// Add to all routes
router.use(addToastHelpers);

// Add error handling at the end
router.use(theoryLessonErrorHandler);
router.use(errorWithToast);
```

#### Controller Usage

In controllers, you can now send responses with toast notifications:

```javascript
// Error with toast
return res.status(400).json({
  success: false,
  error: 'Theory lesson category is required',
  toast: {
    type: 'error',
    message: 'No lesson category selected. Please select a valid category to view lessons.',
    title: 'No Category Selected',
    duration: 3000,
    position: 'bottom-left'
  }
});

// Success with toast (using helper)
res.toast.success('Lesson updated successfully');
return res.jsonWithToast(updatedLesson);
```

### Frontend Integration

The frontend should listen for the `toast` property in API responses:

```javascript
// Example API call handling
const response = await fetch('/api/theory/lessons');
const data = await response.json();

if (data.toast) {
  showToast(data.toast);
}
```

### Toast Object Structure

```javascript
{
  type: 'error' | 'success' | 'warning' | 'info',
  message: 'User-friendly message',
  title: 'Optional title',
  duration: 3000, // milliseconds
  position: 'bottom-left',
  timestamp: '2024-01-01T12:00:00.000Z',
  dismissible: true,
  actions: null, // Optional action buttons
  metadata: { /* Additional context */ }
}
```

## Theory Lesson Specific Improvements

### Issues Addressed

1. **"Selected Lesson ID: None"** - Now handled with proper validation and user-friendly messages
2. **"Selected Lesson Category: None"** - Category validation with helpful feedback
3. **Null/undefined data display** - Data sanitization prevents display of invalid values

### Validation Service

The `TheoryLessonValidationService` provides comprehensive validation:

```javascript
import { TheoryLessonValidationService } from '../services/theoryLessonValidationService.js';

// Validate lesson data before sending to frontend
const validatedLesson = TheoryLessonValidationService.sanitizeForResponse(lesson);

// Check lesson completeness
const completeness = TheoryLessonValidationService.checkLessonCompleteness(lesson);
```

### Enhanced Error Handling

#### Specific Error Cases Handled

1. **Missing/Invalid Lesson ID**
   ```javascript
   if (!id || id === 'null' || id === 'undefined' || id === 'None') {
     return res.status(400).json({
       success: false,
       error: 'Valid theory lesson ID is required',
       toast: {
         type: 'error',
         message: 'No lesson selected. Please select a valid lesson to view details.',
         title: 'No Lesson Selected',
         duration: 3000,
         position: 'bottom-left'
       }
     });
   }
   ```

2. **Missing/Invalid Category**
   ```javascript
   if (!category || category === 'null' || category === 'undefined' || category === 'None') {
     return res.status(400).json({
       success: false,
       error: 'Theory lesson category is required',
       toast: {
         type: 'error',
         message: 'No lesson category selected. Please select a valid category to view lessons.',
         title: 'No Category Selected',
         duration: 3000,
         position: 'bottom-left'
       }
     });
   }
   ```

3. **Data Validation Errors**
   - Invalid ID formats
   - Missing required fields
   - Invalid time formats
   - Invalid date formats

## Configuration

### Toast Types

- `TOAST_TYPES.ERROR`: For error messages (5 second duration)
- `TOAST_TYPES.SUCCESS`: For success messages (3 second duration)
- `TOAST_TYPES.WARNING`: For warnings (3 second duration)
- `TOAST_TYPES.INFO`: For informational messages (3 second duration)

### Positions

- `TOAST_POSITIONS.BOTTOM_LEFT`: Default position as requested
- `TOAST_POSITIONS.BOTTOM_RIGHT`: Alternative positioning
- `TOAST_POSITIONS.TOP_LEFT`: Top positioning
- `TOAST_POSITIONS.TOP_RIGHT`: Top right positioning

## Frontend Implementation Recommendations

### CSS Styling

```css
.toast {
  position: fixed;
  z-index: 1000;
  min-width: 300px;
  max-width: 500px;
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: all 0.3s ease;
}

.toast.bottom-left {
  bottom: 20px;
  left: 20px;
}

.toast.error {
  background-color: #fee;
  border-left: 4px solid #dc3545;
  color: #721c24;
}

.toast.success {
  background-color: #d4edda;
  border-left: 4px solid #28a745;
  color: #155724;
}

.toast.warning {
  background-color: #fff3cd;
  border-left: 4px solid #ffc107;
  color: #856404;
}

.toast.info {
  background-color: #cce7ff;
  border-left: 4px solid #007bff;
  color: #004085;
}
```

### JavaScript Implementation

```javascript
function showToast(toastData) {
  const toastElement = document.createElement('div');
  toastElement.className = `toast ${toastData.type} ${toastData.position}`;

  toastElement.innerHTML = `
    ${toastData.title ? `<div class="toast-title">${toastData.title}</div>` : ''}
    <div class="toast-message">${toastData.message}</div>
    ${toastData.dismissible ? '<button class="toast-close">&times;</button>' : ''}
  `;

  document.body.appendChild(toastElement);

  // Auto dismiss
  if (toastData.duration > 0) {
    setTimeout(() => {
      toastElement.remove();
    }, toastData.duration);
  }

  // Manual dismiss
  if (toastData.dismissible) {
    toastElement.querySelector('.toast-close').addEventListener('click', () => {
      toastElement.remove();
    });
  }
}
```

## Testing

Run the test suite to validate the error handling:

```bash
npm test test/theory-lesson-error-handling.test.js
```

## Benefits

1. **Improved UX**: No more confusing "None" values displayed to users
2. **Consistent Error Handling**: All errors follow the same format
3. **Actionable Messages**: Users receive clear guidance on how to resolve issues
4. **Better Debugging**: Metadata in toasts helps developers troubleshoot
5. **Flexible Configuration**: Customizable duration, position, and styling

## Migration Guide

### For Existing Controllers

1. Import the validation service:
   ```javascript
   import { TheoryLessonValidationService } from '../../services/theoryLessonValidationService.js';
   ```

2. Add validation before sending responses:
   ```javascript
   const validatedData = TheoryLessonValidationService.sanitizeForResponse(data);
   ```

3. Replace generic error responses with toast-enabled responses:
   ```javascript
   // Old way
   return res.status(400).json({ error: 'Invalid data' });

   // New way
   return res.status(400).json({
     success: false,
     error: 'Invalid data',
     toast: {
       type: 'error',
       message: 'User-friendly explanation of the error',
       title: 'Error Title',
       duration: 3000,
       position: 'bottom-left'
     }
   });
   ```

### For Frontend Components

1. Update API call handlers to check for toast data
2. Implement the toast display component
3. Add CSS styling for different toast types
4. Test with various error scenarios

This system ensures that users never see confusing "None" values and instead receive helpful, actionable feedback about any issues with their lesson selections or data.