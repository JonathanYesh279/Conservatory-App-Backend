# 🚀 Frontend Implementation Guide: Timezone-Aware Date Handling System

## 📋 Table of Contents

1. [Overview of Changes](#overview-of-changes)
2. [API Response Changes](#api-response-changes)
3. [Migration Strategy](#migration-strategy)
4. [Implementation Guide](#implementation-guide)
5. [Error Handling Changes](#error-handling-changes)
6. [Performance Optimizations](#performance-optimizations)
7. [Testing Strategy](#testing-strategy)
8. [Timeline & Rollout Plan](#timeline--rollout-plan)

---

## 🔄 Overview of Changes

### What Changed?
The backend has been completely refactored to handle dates with **timezone awareness**, **enhanced responses**, **monitoring**, and **performance optimizations**. This affects **EVERY** date-related operation in your frontend application.

### Why This Matters for Frontend?
- **Before**: You received raw dates and had to handle timezone conversion yourself
- **After**: Backend provides timezone-aware, formatted dates with rich metadata
- **Impact**: Simplified frontend code, better UX, consistent date handling

### Backward Compatibility
✅ **GOOD NEWS**: All existing API calls will continue to work  
✅ **NO BREAKING CHANGES**: Your current frontend won't break  
🚀 **ENHANCED EXPERIENCE**: New features available via query parameters  

---

## 📊 API Response Changes

### 🔍 Theory Lessons API Changes

#### **BEFORE (Old Response)**
```javascript
// GET /api/theory
[
  {
    "_id": "64f7b8c123456789abcdef01",
    "category": "תיאוריה כללית",
    "teacherId": "64f7b8c123456789abcdef02",
    "date": "2025-08-15T16:00:00.000Z",  // Raw UTC date
    "dayOfWeek": 4,
    "startTime": "19:00",
    "endTime": "20:30",
    "location": "חדר 101",
    "createdAt": "2025-08-02T11:30:00.000Z",
    "updatedAt": "2025-08-02T11:30:00.000Z"
  }
]
```

#### **AFTER (New Enhanced Response)**
```javascript
// GET /api/theory?includeFormatted=true&includeRelative=true
[
  {
    "_id": "64f7b8c123456789abcdef01",
    "category": "תיאוריה כללית", 
    "teacherId": "64f7b8c123456789abcdef02",
    "date": "2025-08-15T16:00:00.000Z",  // Still raw UTC (backward compatible)
    "dayOfWeek": 4,
    "startTime": "19:00",
    "endTime": "20:30", 
    "location": "חדר 101",
    "createdAt": "2025-08-02T11:30:00.000Z",
    "updatedAt": "2025-08-02T11:30:00.000Z",
    
    // 🆕 NEW: Rich formatted data
    "formatted": {
      "date": "15/08/2025",           // Human-readable date
      "dayName": "Thursday",          // Day name in current locale
      "timeRange": "19:00-20:30",     // Formatted time range
      "dateTime": "15/08/2025 19:00", // Combined date-time
      "relative": "in 12 days",       // Relative time
      "isToday": false,               // Boolean helpers
      "isPast": false,
      "isFuture": true,
      "createdAt": "02/08/2025 14:30", // Formatted timestamps
      "updatedAt": "02/08/2025 14:30"
    }
  }
]
```

#### **AFTER (With Query Metadata)**
```javascript
// GET /api/theory?includeQueryInfo=true&fromDate=2025-08-01&toDate=2025-08-31
{
  "data": [...], // Lesson data array
  "queryInfo": {
    "appliedFilters": {
      "fromDate": "01/08/2025",      // Formatted filter dates
      "toDate": "31/08/2025",
      "dateRange": "01/08/2025 - 31/08/2025"
    }
  },
  "meta": {
    "timezone": "Asia/Jerusalem",     // Active timezone
    "formatOptions": {
      "dateFormat": "DD/MM/YYYY",
      "timeFormat": "HH:MM",
      "includeFormatted": true,
      "includeRelative": false
    }
  }
}
```

### 🎭 Rehearsal API Changes

#### **BEFORE**
```javascript
// GET /api/rehearsal/orchestra/123
[
  {
    "_id": "64f7b8c123456789abcdef05",
    "orchestraId": "123",
    "date": "2025-08-20T17:30:00.000Z",
    "startTime": "20:30",
    "endTime": "22:00",
    "location": "אולם הקונצרטים"
  }
]
```

#### **AFTER**
```javascript
// GET /api/rehearsal/orchestra/123?includeFormatted=true&includeRelative=true
[
  {
    "_id": "64f7b8c123456789abcdef05", 
    "orchestraId": "123",
    "date": "2025-08-20T17:30:00.000Z",
    "startTime": "20:30",
    "endTime": "22:00",
    "location": "אולם הקונצרטים",
    
    // 🆕 NEW: Enhanced formatting
    "formatted": {
      "date": "20/08/2025",
      "dayName": "Wednesday", 
      "timeRange": "20:30-22:00",
      "relative": "in 17 days",
      "isToday": false,
      "isPast": false,
      "isFuture": true
    }
  }
]
```

### 📅 Schedule API Changes

#### **BEFORE**
```javascript
// GET /api/schedule/teacher/123/weekly
{
  "teacherId": "123",
  "teaching": {
    "schedule": [
      {
        "_id": "slot1",
        "dayOfWeek": 1,
        "startTime": "16:00",
        "endTime": "17:00",
        "studentId": "student123",
        "attendance": {
          "lessonDate": "2025-08-18T13:00:00.000Z",
          "markedAt": "2025-08-18T14:00:00.000Z"
        }
      }
    ]
  }
}
```

#### **AFTER**
```javascript
// GET /api/schedule/teacher/123/weekly?includeFormatted=true&includeRelative=true
{
  "teacherId": "123",
  "teaching": {
    "schedule": [
      {
        "_id": "slot1",
        "dayOfWeek": 1,
        "startTime": "16:00", 
        "endTime": "17:00",
        "studentId": "student123",
        "attendance": {
          "lessonDate": "2025-08-18T13:00:00.000Z",
          "markedAt": "2025-08-18T14:00:00.000Z"
        },
        
        // 🆕 NEW: Formatted schedule data
        "formatted": {
          "lessonDate": "18/08/2025",
          "dayName": "Monday",
          "relative": "next Monday",
          "isToday": false,
          "markedAt": "18/08/2025 17:00"
        }
      }
    ]
  },
  
  // 🆕 NEW: Overall formatted timestamps
  "formatted": {
    "createdAt": "02/08/2025 14:30",
    "updatedAt": "02/08/2025 14:30"
  }
}
```

### 🚨 Error Response Changes

#### **BEFORE**
```javascript
// Error response
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid date format"
}
```

#### **AFTER**
```javascript
// Enhanced error response with timezone context
{
  "success": false,
  "error": "VALIDATION_ERROR", 
  "details": [
    {
      "field": "date",
      "message": "Invalid date format. Expected DD/MM/YYYY or ISO format",
      "receivedValue": "2025/08/32",
      "expectedFormats": ["DD/MM/YYYY", "YYYY-MM-DD", "ISO 8601"]
    }
  ],
  "timestamp": "02/08/2025 14:30",  // 🆕 NEW: Formatted timestamp
  "timezone": "Asia/Jerusalem"      // 🆕 NEW: Timezone context
}
```

---

## 🔄 Migration Strategy

### Phase 1: Preparation (Week 1)
**Goal**: Understand changes and prepare migration plan

**Tasks**:
1. **Audit Current Date Usage**: Identify all places where you handle dates
2. **Review API Calls**: List all date-related API endpoints you use
3. **Plan Component Updates**: Identify components that need updates
4. **Setup Testing**: Prepare test scenarios for date handling

**Code Audit Checklist**:
```javascript
// Find all these patterns in your codebase:
- new Date(apiResponse.date)
- moment(apiResponse.date)  
- dayjs(apiResponse.date)
- Date parsing and formatting
- Timezone conversion logic
- Relative time calculations
- Date display components
```

### Phase 2: Gradual Migration (Weeks 2-3)
**Goal**: Start using enhanced responses without breaking existing functionality

**Tasks**:
1. **Update API Service Layer**: Add query parameters to API calls
2. **Create Date Utility Functions**: Centralize date handling logic
3. **Update Components Gradually**: One feature area at a time
4. **Test Each Migration**: Ensure no regressions

### Phase 3: Optimization (Week 4)
**Goal**: Leverage all new features and optimize performance

**Tasks**:
1. **Implement Caching**: Use performance optimizations
2. **Add Monitoring**: Implement error tracking
3. **Polish UX**: Use relative times and enhanced formatting
4. **Full Testing**: Comprehensive testing across all scenarios

---

## 🛠 Implementation Guide

### 1. **Update Your API Service Layer**

#### **BEFORE: Basic API calls**
```javascript
// services/theoryService.js - OLD
export const getTheoryLessons = async (filters = {}) => {
  const queryParams = new URLSearchParams(filters);
  const response = await fetch(`/api/theory?${queryParams}`);
  return response.json();
};

export const getTheoryLessonById = async (id) => {
  const response = await fetch(`/api/theory/${id}`);
  return response.json();
};
```

#### **AFTER: Enhanced API calls with formatting**
```javascript
// services/theoryService.js - NEW
export const getTheoryLessons = async (filters = {}, options = {}) => {
  const {
    includeFormatted = true,
    includeRelative = false,
    includeQueryInfo = false,
    dateFormat = 'DD/MM/YYYY',
    timezone = 'Asia/Jerusalem'
  } = options;
  
  const queryParams = new URLSearchParams({
    ...filters,
    includeFormatted,
    includeRelative, 
    includeQueryInfo,
    dateFormat,
    timezone
  });
  
  const response = await fetch(`/api/theory?${queryParams}`);
  
  if (!response.ok) {
    // Enhanced error handling
    const error = await response.json();
    throw new EnhancedAPIError(error);
  }
  
  return response.json();
};

export const getTheoryLessonById = async (id, options = {}) => {
  const {
    includeFormatted = true,
    includeRelative = true  // More useful for single lesson view
  } = options;
  
  const queryParams = new URLSearchParams({
    includeFormatted,
    includeRelative
  });
  
  const response = await fetch(`/api/theory/${id}?${queryParams}`);
  return response.json();
};

// 🆕 NEW: Enhanced error class
class EnhancedAPIError extends Error {
  constructor(errorResponse) {
    super(errorResponse.details?.[0]?.message || errorResponse.message);
    this.response = errorResponse;
    this.timestamp = errorResponse.timestamp;
    this.timezone = errorResponse.timezone;
    this.details = errorResponse.details || [];
  }
}
```

### 2. **Create Centralized Date Utilities**

```javascript
// utils/dateHelpers.js - NEW Frontend Date Utilities
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);

const APP_TIMEZONE = 'Asia/Jerusalem';

export class DateHelper {
  
  /**
   * Use enhanced API response when available, fallback to manual processing
   */
  static formatLesson(lesson) {
    // 🆕 NEW: Use enhanced response if available
    if (lesson.formatted) {
      return {
        displayDate: lesson.formatted.date,
        displayTime: lesson.formatted.timeRange,
        dayName: lesson.formatted.dayName,
        relative: lesson.formatted.relative,
        isToday: lesson.formatted.isToday,
        isPast: lesson.formatted.isPast,
        isFuture: lesson.formatted.isFuture,
        // Keep raw data for other operations
        rawDate: lesson.date,
        rawStartTime: lesson.startTime,
        rawEndTime: lesson.endTime
      };
    }
    
    // FALLBACK: Manual processing for backward compatibility
    const lessonDate = dayjs.utc(lesson.date).tz(APP_TIMEZONE);
    return {
      displayDate: lessonDate.format('DD/MM/YYYY'),
      displayTime: `${lesson.startTime}-${lesson.endTime}`,
      dayName: lessonDate.format('dddd'),
      relative: lessonDate.fromNow(),
      isToday: lessonDate.isSame(dayjs(), 'day'),
      isPast: lessonDate.isBefore(dayjs()),
      isFuture: lessonDate.isAfter(dayjs()),
      rawDate: lesson.date,
      rawStartTime: lesson.startTime,
      rawEndTime: lesson.endTime
    };
  }
  
  /**
   * Format date for API requests
   */
  static formatForAPI(date) {
    if (!date) return null;
    
    // Handle various input formats
    if (typeof date === 'string') {
      // Check if it's already in correct format
      if (date.match(/^\d{4}-\d{2}-\d{2}$/)) return date;
      if (date.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
        const [day, month, year] = date.split('/');
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }
    
    return dayjs(date).format('YYYY-MM-DD');
  }
  
  /**
   * Validate date input
   */
  static validateDate(date) {
    if (!date) return { valid: false, error: 'Date is required' };
    
    const parsed = dayjs(date);
    if (!parsed.isValid()) {
      return { 
        valid: false, 
        error: 'Invalid date format. Please use DD/MM/YYYY or select from calendar' 
      };
    }
    
    return { valid: true };
  }
  
  /**
   * Get date range for common filters
   */
  static getDateRanges() {
    const now = dayjs().tz(APP_TIMEZONE);
    
    return {
      today: {
        fromDate: now.format('YYYY-MM-DD'),
        toDate: now.format('YYYY-MM-DD')
      },
      thisWeek: {
        fromDate: now.startOf('week').format('YYYY-MM-DD'),
        toDate: now.endOf('week').format('YYYY-MM-DD')
      },
      thisMonth: {
        fromDate: now.startOf('month').format('YYYY-MM-DD'), 
        toDate: now.endOf('month').format('YYYY-MM-DD')
      },
      next7Days: {
        fromDate: now.format('YYYY-MM-DD'),
        toDate: now.add(7, 'days').format('YYYY-MM-DD')
      }
    };
  }
}
```

### 3. **Update React Components**

#### **BEFORE: Manual Date Handling**
```jsx
// components/LessonCard.jsx - OLD
import React from 'react';
import dayjs from 'dayjs';

const LessonCard = ({ lesson }) => {
  // Manual date processing
  const lessonDate = dayjs.utc(lesson.date).tz('Asia/Jerusalem');
  const displayDate = lessonDate.format('DD/MM/YYYY');
  const displayTime = `${lesson.startTime}-${lesson.endTime}`;
  const isToday = lessonDate.isSame(dayjs(), 'day');
  const dayName = lessonDate.format('dddd');
  
  return (
    <div className={`lesson-card ${isToday ? 'today' : ''}`}>
      <h3>{lesson.category}</h3>
      <div className="date-info">
        <span className="date">{displayDate}</span>
        <span className="day">{dayName}</span>
        <span className="time">{displayTime}</span>
      </div>
      <div className="location">{lesson.location}</div>
    </div>
  );
};
```

#### **AFTER: Using Enhanced Responses**
```jsx
// components/LessonCard.jsx - NEW
import React from 'react';
import { DateHelper } from '../utils/dateHelpers';

const LessonCard = ({ lesson }) => {
  // Use enhanced response data with fallback
  const dateInfo = DateHelper.formatLesson(lesson);
  
  return (
    <div className={`lesson-card ${dateInfo.isToday ? 'today' : ''} ${dateInfo.isPast ? 'past' : ''}`}>
      <h3>{lesson.category}</h3>
      
      {/* Enhanced date display */}
      <div className="date-info">
        <span className="date">{dateInfo.displayDate}</span>
        <span className="day">{dateInfo.dayName}</span>
        <span className="time">{dateInfo.displayTime}</span>
        
        {/* 🆕 NEW: Relative time if available */}
        {dateInfo.relative && (
          <span className="relative-time">{dateInfo.relative}</span>
        )}
        
        {/* 🆕 NEW: Visual indicators */}
        {dateInfo.isToday && <span className="badge today">Today</span>}
        {dateInfo.isPast && <span className="badge past">Past</span>}
      </div>
      
      <div className="location">{lesson.location}</div>
    </div>
  );
};

export default LessonCard;
```

### 4. **Update List Components with Filtering**

#### **BEFORE: Basic Lesson List**
```jsx
// components/LessonList.jsx - OLD
import React, { useState, useEffect } from 'react';
import { getTheoryLessons } from '../services/theoryService';

const LessonList = () => {
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({});
  
  useEffect(() => {
    const loadLessons = async () => {
      try {
        setLoading(true);
        const data = await getTheoryLessons(filters);
        setLessons(data);
      } catch (error) {
        console.error('Failed to load lessons:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadLessons();
  }, [filters]);
  
  return (
    <div>
      {lessons.map(lesson => (
        <LessonCard key={lesson._id} lesson={lesson} />
      ))}
    </div>
  );
};
```

#### **AFTER: Enhanced List with Rich Filtering**
```jsx
// components/LessonList.jsx - NEW  
import React, { useState, useEffect, useMemo } from 'react';
import { getTheoryLessons } from '../services/theoryService';
import { DateHelper } from '../utils/dateHelpers';

const LessonList = () => {
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({});
  const [queryInfo, setQueryInfo] = useState(null);
  const [error, setError] = useState(null);
  
  // 🆕 NEW: Enhanced API options
  const apiOptions = useMemo(() => ({
    includeFormatted: true,
    includeRelative: true,
    includeQueryInfo: true,
    dateFormat: 'DD/MM/YYYY'
  }), []);
  
  useEffect(() => {
    const loadLessons = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // 🆕 NEW: Enhanced API call
        const response = await getTheoryLessons(filters, apiOptions);
        
        // Handle different response formats
        if (response.data) {
          // Response with metadata
          setLessons(response.data);
          setQueryInfo(response.queryInfo);
        } else {
          // Direct array response (backward compatibility)
          setLessons(response);
        }
        
      } catch (error) {
        console.error('Failed to load lessons:', error);
        setError(error);
      } finally {
        setLoading(false);
      }
    };
    
    loadLessons();
  }, [filters, apiOptions]);
  
  // 🆕 NEW: Quick filter buttons
  const quickFilters = DateHelper.getDateRanges();
  
  const handleQuickFilter = (rangeName) => {
    setFilters({
      ...filters,
      ...quickFilters[rangeName]
    });
  };
  
  if (loading) {
    return <div className="loading">Loading lessons...</div>;
  }
  
  if (error) {
    return (
      <div className="error">
        <h3>Error loading lessons</h3>
        <p>{error.message}</p>
        {error.details && (
          <ul>
            {error.details.map((detail, index) => (
              <li key={index}>{detail.message}</li>
            ))}
          </ul>
        )}
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }
  
  return (
    <div className="lesson-list">
      {/* 🆕 NEW: Quick filter buttons */}
      <div className="quick-filters">
        <button onClick={() => handleQuickFilter('today')}>Today</button>
        <button onClick={() => handleQuickFilter('thisWeek')}>This Week</button>
        <button onClick={() => handleQuickFilter('thisMonth')}>This Month</button>
        <button onClick={() => handleQuickFilter('next7Days')}>Next 7 Days</button>
      </div>
      
      {/* 🆕 NEW: Query info display */}
      {queryInfo && (
        <div className="query-info">
          <p>Showing lessons for: {queryInfo.appliedFilters.dateRange}</p>
        </div>
      )}
      
      {/* Lesson list */}
      <div className="lessons">
        {lessons.map(lesson => (
          <LessonCard key={lesson._id} lesson={lesson} />
        ))}
      </div>
      
      {lessons.length === 0 && (
        <div className="no-lessons">
          <p>No lessons found for the selected criteria.</p>
        </div>
      )}
    </div>
  );
};

export default LessonList;
```

### 5. **Form Components with Enhanced Validation**

#### **BEFORE: Basic Form**
```jsx
// components/LessonForm.jsx - OLD
import React, { useState } from 'react';

const LessonForm = ({ onSubmit }) => {
  const [formData, setFormData] = useState({
    date: '',
    startTime: '',
    endTime: '',
    category: '',
    location: ''
  });
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await onSubmit(formData);
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <input 
        type="date" 
        value={formData.date}
        onChange={(e) => setFormData({...formData, date: e.target.value})}
        required
      />
      {/* Other fields... */}
      <button type="submit">Create Lesson</button>
    </form>
  );
};
```

#### **AFTER: Enhanced Form with Validation**
```jsx
// components/LessonForm.jsx - NEW
import React, { useState } from 'react';
import { DateHelper } from '../utils/dateHelpers';

const LessonForm = ({ onSubmit }) => {
  const [formData, setFormData] = useState({
    date: '',
    startTime: '',
    endTime: '',
    category: '',
    location: ''
  });
  
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 🆕 NEW: Enhanced validation
  const validateForm = () => {
    const newErrors = {};
    
    // Date validation
    const dateValidation = DateHelper.validateDate(formData.date);
    if (!dateValidation.valid) {
      newErrors.date = dateValidation.error;
    }
    
    // Time validation
    if (!formData.startTime) {
      newErrors.startTime = 'Start time is required';
    }
    if (!formData.endTime) {
      newErrors.endTime = 'End time is required';
    }
    if (formData.startTime && formData.endTime && formData.startTime >= formData.endTime) {
      newErrors.endTime = 'End time must be after start time';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      // 🆕 NEW: Format date for API
      const apiData = {
        ...formData,
        date: DateHelper.formatForAPI(formData.date)
      };
      
      await onSubmit(apiData);
      
      // Reset form on success
      setFormData({
        date: '',
        startTime: '',
        endTime: '',
        category: '',
        location: ''
      });
      
    } catch (error) {
      // 🆕 NEW: Enhanced error handling
      if (error.response && error.response.details) {
        const apiErrors = {};
        error.response.details.forEach(detail => {
          apiErrors[detail.field] = detail.message;
        });
        setErrors(apiErrors);
      } else {
        setErrors({ general: error.message });
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      {/* 🆕 NEW: Enhanced error display */}
      {errors.general && (
        <div className="error-banner">
          {errors.general}
        </div>
      )}
      
      <div className="form-group">
        <label htmlFor="date">Lesson Date</label>
        <input 
          id="date"
          type="date" 
          value={formData.date}
          onChange={(e) => setFormData({...formData, date: e.target.value})}
          className={errors.date ? 'error' : ''}
          required
        />
        {errors.date && <span className="error-text">{errors.date}</span>}
      </div>
      
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="startTime">Start Time</label>
          <input 
            id="startTime"
            type="time" 
            value={formData.startTime}
            onChange={(e) => setFormData({...formData, startTime: e.target.value})}
            className={errors.startTime ? 'error' : ''}
            required
          />
          {errors.startTime && <span className="error-text">{errors.startTime}</span>}
        </div>
        
        <div className="form-group">
          <label htmlFor="endTime">End Time</label>
          <input 
            id="endTime"
            type="time" 
            value={formData.endTime}
            onChange={(e) => setFormData({...formData, endTime: e.target.value})}
            className={errors.endTime ? 'error' : ''}
            required
          />
          {errors.endTime && <span className="error-text">{errors.endTime}</span>}
        </div>
      </div>
      
      {/* Other fields with similar error handling... */}
      
      <button 
        type="submit" 
        disabled={isSubmitting}
        className="submit-button"
      >
        {isSubmitting ? 'Creating...' : 'Create Lesson'}
      </button>
    </form>
  );
};

export default LessonForm;
```

### 6. **Calendar Integration**

#### **NEW: Enhanced Calendar Component**
```jsx
// components/Calendar.jsx - NEW
import React, { useState, useEffect } from 'react';
import { getTheoryLessons } from '../services/theoryService';
import { DateHelper } from '../utils/dateHelpers';

const Calendar = () => {
  const [lessons, setLessons] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    const loadMonthLessons = async () => {
      setLoading(true);
      try {
        const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
        
        const response = await getTheoryLessons({
          fromDate: DateHelper.formatForAPI(startOfMonth),
          toDate: DateHelper.formatForAPI(endOfMonth)
        }, {
          includeFormatted: true,
          includeRelative: true
        });
        
        setLessons(response.data || response);
      } catch (error) {
        console.error('Failed to load calendar lessons:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadMonthLessons();
  }, [currentMonth]);
  
  // Group lessons by date for calendar display
  const lessonsByDate = lessons.reduce((acc, lesson) => {
    const dateKey = lesson.formatted?.date || DateHelper.formatLesson(lesson).displayDate;
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(lesson);
    return acc;
  }, {});
  
  return (
    <div className="calendar">
      <div className="calendar-header">
        <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))}>
          Previous
        </button>
        <h2>{currentMonth.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })}</h2>
        <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))}>
          Next
        </button>
      </div>
      
      {loading && <div className="loading">Loading...</div>}
      
      <div className="calendar-grid">
        {/* Calendar implementation using lessonsByDate */}
        {/* Each day shows lessons with enhanced formatting */}
      </div>
    </div>
  );
};

export default Calendar;
```

---

## 🚨 Error Handling Changes

### New Error Types You Need to Handle

#### **1. Enhanced Validation Errors**
```javascript
// NEW error structure you'll receive
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "details": [
    {
      "field": "date",
      "message": "Invalid date format. Expected DD/MM/YYYY or ISO format",
      "receivedValue": "invalid-date",
      "expectedFormats": ["DD/MM/YYYY", "YYYY-MM-DD", "ISO 8601"]
    },
    {
      "field": "startTime", 
      "message": "Start time must be in HH:MM format",
      "receivedValue": "25:00"
    }
  ],
  "timestamp": "02/08/2025 14:30",
  "timezone": "Asia/Jerusalem"
}
```

**How to handle in React:**
```jsx
const handleAPIError = (error) => {
  if (error.response && error.response.details) {
    // Field-specific errors
    const fieldErrors = {};
    error.response.details.forEach(detail => {
      fieldErrors[detail.field] = detail.message;
    });
    setFieldErrors(fieldErrors);
  } else {
    // General error
    setGeneralError(error.message);
  }
};
```

#### **2. Conflict Detection Errors**
```javascript
// NEW conflict error structure
{
  "success": false,
  "error": "CONFLICT_DETECTED",
  "conflicts": {
    "room": [
      {
        "type": "room",
        "description": "Room חדר 101 is already booked",
        "conflictingLesson": {
          "id": "64f7b8c123456789abcdef05",
          "time": "19:00-20:30",
          "teacher": "Teacher Name",
          "date": "15/08/2025"
        }
      }
    ],
    "teacher": [
      {
        "type": "teacher", 
        "description": "Teacher has another lesson at this time",
        "conflictingLesson": {
          "id": "64f7b8c123456789abcdef06",
          "time": "19:00-20:30",
          "location": "חדר 102",
          "date": "15/08/2025"
        }
      }
    ]
  },
  "message": "Use forceCreate=true to override these conflicts",
  "canOverride": true
}
```

**How to handle conflicts:**
```jsx
const ConflictDialog = ({ conflicts, onResolve, onCancel }) => {
  return (
    <div className="conflict-dialog">
      <h3>Scheduling Conflicts Detected</h3>
      
      {conflicts.room.length > 0 && (
        <div className="conflict-section">
          <h4>Room Conflicts:</h4>
          {conflicts.room.map((conflict, index) => (
            <div key={index} className="conflict-item">
              <p>{conflict.description}</p>
              <p>Conflicting lesson: {conflict.conflictingLesson.time} - {conflict.conflictingLesson.teacher}</p>
            </div>
          ))}
        </div>
      )}
      
      {conflicts.teacher.length > 0 && (
        <div className="conflict-section">
          <h4>Teacher Conflicts:</h4>
          {conflicts.teacher.map((conflict, index) => (
            <div key={index} className="conflict-item">
              <p>{conflict.description}</p>
              <p>Conflicting lesson: {conflict.conflictingLesson.time} at {conflict.conflictingLesson.location}</p>
            </div>
          ))}
        </div>
      )}
      
      <div className="conflict-actions">
        <button onClick={() => onResolve(true)}>Override Conflicts</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
};

// Usage in form
const handleFormSubmit = async (formData) => {
  try {
    await createLesson(formData);
  } catch (error) {
    if (error.response && error.response.error === 'CONFLICT_DETECTED') {
      setConflicts(error.response.conflicts);
      setShowConflictDialog(true);
    }
  }
};

const handleConflictResolve = async (override) => {
  if (override) {
    try {
      await createLesson({ ...formData, forceCreate: true });
      setShowConflictDialog(false);
    } catch (error) {
      // Handle other errors
    }
  }
};
```

---

## ⚡ Performance Optimizations

### 1. **Leverage API Caching**

The backend now has intelligent caching. You can optimize your frontend to work with this:

```javascript
// services/apiCache.js - NEW
class APICache {
  constructor() {
    this.cache = new Map();
    this.timestamps = new Map();
  }
  
  // Cache API responses client-side
  set(key, data, ttl = 5 * 60 * 1000) { // 5 minutes default
    this.cache.set(key, data);
    this.timestamps.set(key, Date.now() + ttl);
  }
  
  get(key) {
    if (!this.cache.has(key)) return null;
    
    const expiry = this.timestamps.get(key);
    if (Date.now() > expiry) {
      this.cache.delete(key);
      this.timestamps.delete(key);
      return null;
    }
    
    return this.cache.get(key);
  }
  
  invalidateByDate(date) {
    // Invalidate cache entries that might be affected by date changes
    const dateStr = DateHelper.formatForAPI(date);
    for (const [key] of this.cache) {
      if (key.includes(dateStr) || key.includes('fromDate') || key.includes('toDate')) {
        this.cache.delete(key);
        this.timestamps.delete(key);
      }
    }
  }
}

const apiCache = new APICache();

// Enhanced API service with caching
export const getTheoryLessonsWithCache = async (filters, options) => {
  const cacheKey = JSON.stringify({ filters, options });
  
  // Check cache first
  const cached = apiCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  
  // Make API call
  const data = await getTheoryLessons(filters, options);
  
  // Cache the result
  apiCache.set(cacheKey, data);
  
  return data;
};
```

### 2. **Optimize Component Rendering**

```jsx
// Use React.memo for expensive date calculations
const LessonCard = React.memo(({ lesson }) => {
  const dateInfo = useMemo(() => DateHelper.formatLesson(lesson), [lesson]);
  
  return (
    <div className={`lesson-card ${dateInfo.isToday ? 'today' : ''}`}>
      {/* Component content */}
    </div>
  );
});

// Use useMemo for expensive filtering
const LessonList = () => {
  const [lessons, setLessons] = useState([]);
  const [filters, setFilters] = useState({});
  
  const filteredLessons = useMemo(() => {
    if (!filters.search) return lessons;
    
    return lessons.filter(lesson => {
      const searchTerm = filters.search.toLowerCase();
      return (
        lesson.category.toLowerCase().includes(searchTerm) ||
        lesson.location.toLowerCase().includes(searchTerm) ||
        (lesson.formatted?.dayName || '').toLowerCase().includes(searchTerm)
      );
    });
  }, [lessons, filters.search]);
  
  return (
    <div>
      {filteredLessons.map(lesson => (
        <LessonCard key={lesson._id} lesson={lesson} />
      ))}
    </div>
  );
};
```

### 3. **Implement Request Debouncing**

```javascript
// utils/debounce.js
export const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => clearTimeout(handler);
  }, [value, delay]);
  
  return debouncedValue;
};

// Usage in search component
const SearchComponent = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  
  useEffect(() => {
    if (debouncedSearchTerm) {
      // Make API call
      searchLessons(debouncedSearchTerm);
    }
  }, [debouncedSearchTerm]);
  
  return (
    <input 
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      placeholder="Search lessons..."
    />
  );
};
```

---

## 🧪 Testing Strategy

### 1. **Date Handling Tests**

```javascript
// tests/dateHelpers.test.js
import { DateHelper } from '../src/utils/dateHelpers';

describe('DateHelper', () => {
  describe('formatLesson', () => {
    test('should use enhanced response when available', () => {
      const lesson = {
        date: '2025-08-15T16:00:00.000Z',
        startTime: '19:00',
        endTime: '20:30',
        formatted: {
          date: '15/08/2025',
          dayName: 'Thursday',
          timeRange: '19:00-20:30',
          relative: 'in 12 days',
          isToday: false
        }
      };
      
      const result = DateHelper.formatLesson(lesson);
      
      expect(result.displayDate).toBe('15/08/2025');
      expect(result.dayName).toBe('Thursday');
      expect(result.displayTime).toBe('19:00-20:30');
      expect(result.relative).toBe('in 12 days');
      expect(result.isToday).toBe(false);
    });
    
    test('should fallback to manual processing for legacy responses', () => {
      const lesson = {
        date: '2025-08-15T16:00:00.000Z',
        startTime: '19:00', 
        endTime: '20:30'
        // No formatted field
      };
      
      const result = DateHelper.formatLesson(lesson);
      
      expect(result.displayDate).toMatch(/\d{2}\/\d{2}\/\d{4}/);
      expect(result.displayTime).toBe('19:00-20:30');
      expect(typeof result.isToday).toBe('boolean');
    });
  });
  
  describe('formatForAPI', () => {
    test('should format DD/MM/YYYY to YYYY-MM-DD', () => {
      expect(DateHelper.formatForAPI('15/08/2025')).toBe('2025-08-15');
    });
    
    test('should handle ISO dates', () => {
      expect(DateHelper.formatForAPI('2025-08-15')).toBe('2025-08-15');
    });
  });
});
```

### 2. **Component Tests**

```javascript
// tests/LessonCard.test.jsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import LessonCard from '../src/components/LessonCard';

describe('LessonCard', () => {
  test('should display enhanced response data', () => {
    const lesson = {
      _id: '123',
      category: 'תיאוריה כללית',
      location: 'חדר 101',
      date: '2025-08-15T16:00:00.000Z',
      startTime: '19:00',
      endTime: '20:30',
      formatted: {
        date: '15/08/2025',
        dayName: 'Thursday',
        timeRange: '19:00-20:30',
        relative: 'in 12 days',
        isToday: false,
        isPast: false
      }
    };
    
    render(<LessonCard lesson={lesson} />);
    
    expect(screen.getByText('15/08/2025')).toBeInTheDocument();
    expect(screen.getByText('Thursday')).toBeInTheDocument();
    expect(screen.getByText('19:00-20:30')).toBeInTheDocument();
    expect(screen.getByText('in 12 days')).toBeInTheDocument();
    expect(screen.getByText('תיאוריה כללית')).toBeInTheDocument();
  });
  
  test('should handle legacy response format', () => {
    const lesson = {
      _id: '123',
      category: 'תיאוריה כללית',
      location: 'חדר 101',
      date: '2025-08-15T16:00:00.000Z',
      startTime: '19:00',
      endTime: '20:30'
      // No formatted field
    };
    
    render(<LessonCard lesson={lesson} />);
    
    expect(screen.getByText(/\d{2}\/\d{2}\/\d{4}/)).toBeInTheDocument();
    expect(screen.getByText('19:00-20:30')).toBeInTheDocument();
  });
});
```

### 3. **API Integration Tests**

```javascript
// tests/api.integration.test.js
import { getTheoryLessons } from '../src/services/theoryService';

describe('Theory Service Integration', () => {
  test('should handle enhanced response format', async () => {
    const response = await getTheoryLessons({
      fromDate: '2025-08-01',
      toDate: '2025-08-31'
    }, {
      includeFormatted: true,
      includeRelative: true,
      includeQueryInfo: true
    });
    
    expect(response).toHaveProperty('data');
    expect(response).toHaveProperty('queryInfo');
    expect(response).toHaveProperty('meta');
    
    if (response.data.length > 0) {
      const lesson = response.data[0];
      expect(lesson).toHaveProperty('formatted');
      expect(lesson.formatted).toHaveProperty('date');
      expect(lesson.formatted).toHaveProperty('dayName');
      expect(lesson.formatted).toHaveProperty('timeRange');
    }
  });
  
  test('should handle errors gracefully', async () => {
    try {
      await getTheoryLessons({
        fromDate: 'invalid-date'
      });
    } catch (error) {
      expect(error).toHaveProperty('response');
      expect(error.response).toHaveProperty('details');
      expect(error.response.details).toBeInstanceOf(Array);
    }
  });
});
```

---

## ⏰ Timeline & Rollout Plan

### Week 1: Preparation & Setup
**Monday-Tuesday**: 
- [ ] Audit existing date handling code
- [ ] Setup development environment
- [ ] Create DateHelper utility class
- [ ] Update API service layer

**Wednesday-Thursday**:
- [ ] Create enhanced error handling
- [ ] Setup testing infrastructure
- [ ] Begin component updates (start with LessonCard)

**Friday**:
- [ ] Test basic enhanced responses
- [ ] Code review and adjustments

### Week 2: Core Component Migration
**Monday-Tuesday**:
- [ ] Update LessonList component
- [ ] Update LessonForm component
- [ ] Implement conflict resolution UI

**Wednesday-Thursday**:
- [ ] Update Schedule components
- [ ] Update Rehearsal components
- [ ] Test all updated components

**Friday**:
- [ ] Integration testing
- [ ] Performance testing
- [ ] Bug fixes

### Week 3: Advanced Features
**Monday-Tuesday**:
- [ ] Implement Calendar component
- [ ] Add performance optimizations
- [ ] Client-side caching

**Wednesday-Thursday**:
- [ ] Implement search and filtering
- [ ] Add loading states and animations
- [ ] Error boundary components

**Friday**:
- [ ] Full feature testing
- [ ] User acceptance testing
- [ ] Performance optimization

### Week 4: Polish & Production
**Monday-Tuesday**:
- [ ] Final bug fixes
- [ ] Performance tuning
- [ ] Accessibility improvements

**Wednesday-Thursday**:
- [ ] Production deployment preparation
- [ ] Monitoring setup
- [ ] Documentation finalization

**Friday**:
- [ ] Production deployment
- [ ] Monitor and hotfix if needed

---

## 📚 Additional Resources

### **API Endpoints Reference**
All enhanced endpoints with query parameters:

```javascript
// Theory Lessons
GET /api/theory?includeFormatted=true&includeRelative=true&includeQueryInfo=true
GET /api/theory/:id?includeFormatted=true&includeRelative=true
POST /api/theory (enhanced error responses)
PUT /api/theory/:id (enhanced error responses)

// Rehearsals  
GET /api/rehearsal?includeFormatted=true&includeRelative=true
GET /api/rehearsal/orchestra/:id?includeFormatted=true

// Schedule
GET /api/schedule/teacher/:id/weekly?includeFormatted=true
GET /api/schedule/student/:id?includeFormatted=true

// Attendance
PUT /api/theory/:id/attendance (enhanced validation)
PUT /api/rehearsal/:id/attendance (enhanced validation)
```

### **Monitoring & Health Checks (Admin)**
For debugging and monitoring:

```javascript
// Health check endpoints (admin only)
GET /api/admin/date-monitoring/health-check
GET /api/admin/date-monitoring/metrics
GET /api/admin/date-monitoring/database-health
```

### **Common Query Parameters**
```javascript
{
  includeFormatted: true,    // Add formatted date fields
  includeRelative: true,     // Add relative time (e.g., "in 5 days")
  includeQueryInfo: true,    // Add query metadata
  dateFormat: 'DD/MM/YYYY',  // Date format preference
  timezone: 'Asia/Jerusalem', // Timezone (usually not needed)
  
  // Filtering (existing parameters still work)
  fromDate: '2025-08-01',
  toDate: '2025-08-31',
  dayOfWeek: 4,
  teacherId: 'teacher123',
  category: 'תיאוריה כללית'
}
```

---

## 🎯 Success Criteria

### Phase 1 Success (Week 1)
- [ ] DateHelper utility class implemented and tested
- [ ] API service layer updated with enhanced calls
- [ ] Basic component (LessonCard) updated and working
- [ ] Error handling framework in place

### Phase 2 Success (Week 2)  
- [ ] All major components updated (List, Form, Schedule)
- [ ] Conflict resolution UI working
- [ ] Enhanced error handling implemented
- [ ] Performance optimizations in place

### Phase 3 Success (Week 3)
- [ ] Calendar component implemented
- [ ] Search and filtering working with enhanced responses
- [ ] Client-side caching implemented
- [ ] All features working together seamlessly

### Phase 4 Success (Week 4)
- [ ] Production deployment successful
- [ ] No critical bugs in production
- [ ] Performance metrics meet targets
- [ ] User feedback positive

---

## ⚠️ Important Notes

### **Critical Success Factors**
1. **Test thoroughly**: Each component update should be tested in isolation
2. **Maintain backward compatibility**: Always provide fallbacks for legacy responses
3. **Handle errors gracefully**: Enhanced error handling is crucial for good UX
4. **Performance monitoring**: Use browser dev tools to monitor performance
5. **User feedback**: Get user feedback early and often

### **Common Pitfalls to Avoid**
1. **Don't break existing functionality**: Always provide fallbacks
2. **Don't ignore caching**: Leverage the new caching system
3. **Don't skip error handling**: Enhanced errors provide valuable UX
4. **Don't ignore performance**: Use React.memo and useMemo appropriately
5. **Don't forget accessibility**: Enhanced formatting should improve accessibility

### **Support & Troubleshooting**
- Use admin monitoring endpoints to debug issues
- Check browser console for enhanced error details
- Test with various date formats and edge cases
- Monitor API response times and cache hit rates

---

This comprehensive guide should give your frontend team everything they need to successfully implement the enhanced date handling system. The migration is designed to be gradual and safe, with full backward compatibility throughout the process.