# Date Handling Guide - Conservatory App

## Overview

This guide documents the new timezone-aware date handling system implemented in Phase 1 of the date handling improvements. All date operations now use the centralized `dateHelpers.js` utilities to ensure consistency and timezone accuracy.

## Core Principles

1. **UTC Storage**: All dates are stored in the database as UTC
2. **Timezone Awareness**: All display and business logic operates in the application timezone (Asia/Jerusalem)
3. **Centralized Utilities**: All date operations use the `dateHelpers.js` module
4. **Validation**: All date inputs are validated and normalized

## Configuration

### Environment Variables

```bash
# .env
APP_TIMEZONE=Asia/Jerusalem
```

### Default Timezone

The application defaults to `Asia/Jerusalem` timezone. This can be changed via the `APP_TIMEZONE` environment variable.

## Date Utilities (`utils/dateHelpers.js`)

### Core Functions

#### Creating Dates

```javascript
import { createAppDate, now, today } from '../utils/dateHelpers.js';

// Current date/time in app timezone
const currentDateTime = now();

// Today at start of day (for database queries)
const todayStart = today();

// Create date in app timezone
const lessonDate = createAppDate('2025-08-02');
const lessonDateTime = createAppDate('2025-08-02 14:30');
```

#### Database Operations

```javascript
import { toUTC, fromUTC } from '../utils/dateHelpers.js';

// Convert to UTC for database storage
const utcDate = toUTC(userInputDate);
await collection.insertOne({ date: utcDate });

// Convert from UTC when retrieving from database
const lesson = await collection.findOne({ _id: lessonId });
const displayDate = fromUTC(lesson.date);
```

#### Date Formatting

```javascript
import { formatDate, formatDateTime } from '../utils/dateHelpers.js';

// Format for display
const displayDate = formatDate(lesson.date, 'DD/MM/YYYY'); // "02/08/2025"
const displayDateTime = formatDateTime(lesson.date, 'DD/MM/YYYY HH:mm'); // "02/08/2025 14:30"
```

#### Date Validation

```javascript
import { isValidDate, validateDateRange } from '../utils/dateHelpers.js';

// Validate single date
if (!isValidDate(userInput)) {
  throw new Error('Invalid date format');
}

// Validate date range
const validation = validateDateRange(startDate, endDate);
if (!validation.valid) {
  throw new Error(validation.error);
}
```

#### Date Generation

```javascript
import { generateDatesForDayOfWeek } from '../utils/dateHelpers.js';

// Generate weekly recurring dates
const dates = generateDatesForDayOfWeek(
  '2025-08-02',  // Start date
  '2025-12-31',  // End date
  1,             // Monday (0 = Sunday, 6 = Saturday)
  ['2025-08-25'] // Exclude dates
);
```

## Validation Middleware (`middleware/dateValidation.js`)

### Basic Date Validation

```javascript
import { validateDates } from '../middleware/dateValidation.js';

// Validate specific date fields
router.post('/lessons', 
  validateDates(['date'], { 
    required: true, 
    allowPast: false,
    maxFutureDays: 365 
  }),
  createLesson
);
```

### Date Range Validation

```javascript
import { validateDateRange } from '../middleware/dateValidation.js';

// Validate date range
router.post('/bulk-lessons', 
  validateDateRange('startDate', 'endDate', { 
    required: true, 
    maxRangeDays: 180 
  }),
  createBulkLessons
);
```

### Lesson-Specific Validation

```javascript
import { 
  validateLessonDate, 
  validateBulkLessonDates,
  validateAttendanceDate 
} from '../middleware/dateValidation.js';

// Theory lesson validation
router.post('/theory-lessons', validateLessonDate, createTheoryLesson);

// Bulk creation validation
router.post('/theory-lessons/bulk', validateBulkLessonDates, createBulkTheoryLessons);

// Attendance validation
router.post('/attendance', validateAttendanceDate, markAttendance);
```

## Migration from Legacy Code

### Before (Legacy)

```javascript
// ❌ Direct Date object usage
const lessonDate = new Date(req.body.date);

// ❌ No timezone handling
const query = { date: new Date(date) };

// ❌ String comparison for dates
const shouldExclude = excludeDates.some(
  (excludeDate) => excludeDate.toDateString() === currentDate.toDateString()
);
```

### After (New System)

```javascript
// ✅ Timezone-aware date creation
import { createAppDate, toUTC, isSameDay } from '../utils/dateHelpers.js';

const lessonDate = createAppDate(req.body.date);

// ✅ UTC storage with timezone awareness
const query = { date: toUTC(createAppDate(date)) };

// ✅ Proper date comparison
const shouldExclude = excludeDates.some(
  (excludeDate) => isSameDay(excludeDate, currentDate)
);
```

## Best Practices

### 1. Always Use Date Helpers

```javascript
// ❌ Don't use direct Date constructors
const date = new Date();

// ✅ Use date helpers
import { now } from '../utils/dateHelpers.js';
const date = now();
```

### 2. Store UTC, Display Local

```javascript
// ✅ Store in UTC
const lesson = {
  date: toUTC(userInputDate),
  startTime: '14:30',
  endTime: '15:15'
};

// ✅ Display in app timezone
const displayDate = formatDate(lesson.date, 'DD/MM/YYYY');
```

### 3. Validate All Date Inputs

```javascript
// ✅ Always validate before processing
if (!isValidDate(userInput)) {
  return res.status(400).json({ error: 'Invalid date format' });
}
```

### 4. Use Middleware for Route Validation

```javascript
// ✅ Use validation middleware
router.post('/lessons', validateLessonDate, createLesson);

// ❌ Don't validate in controller
const createLesson = (req, res) => {
  if (!isValidDate(req.body.date)) { // This should be in middleware
    return res.status(400).json({ error: 'Invalid date' });
  }
};
```

## Common Patterns

### Lesson Scheduling

```javascript
import { 
  createAppDate, 
  toUTC, 
  generateDatesForDayOfWeek,
  validateDateRange 
} from '../utils/dateHelpers.js';

// Single lesson
const createLesson = async (lessonData) => {
  const lesson = {
    ...lessonData,
    date: toUTC(createAppDate(lessonData.date)),
    createdAt: toUTC(now()),
    updatedAt: toUTC(now())
  };
  
  return await collection.insertOne(lesson);
};

// Bulk lesson creation
const createBulkLessons = async (bulkData) => {
  const { startDate, endDate, dayOfWeek, excludeDates } = bulkData;
  
  const dates = generateDatesForDayOfWeek(startDate, endDate, dayOfWeek, excludeDates);
  
  const lessons = dates.map(date => ({
    ...bulkData,
    date: date, // Already in UTC from generateDatesForDayOfWeek
    createdAt: toUTC(now()),
    updatedAt: toUTC(now())
  }));
  
  return await collection.insertMany(lessons);
};
```

### Date Queries

```javascript
import { getStartOfDay, getEndOfDay } from '../utils/dateHelpers.js';

// Query lessons for a specific date
const getLessonsForDate = async (dateString) => {
  const startOfDay = getStartOfDay(dateString);
  const endOfDay = getEndOfDay(dateString);
  
  return await collection.find({
    date: {
      $gte: startOfDay,
      $lte: endOfDay
    }
  }).toArray();
};
```

### Conflict Detection

```javascript
import { toUTC, createAppDate, isSameDay } from '../utils/dateHelpers.js';

const checkConflicts = async (lessonData) => {
  const lessonDate = createAppDate(lessonData.date);
  
  const query = {
    date: toUTC(lessonDate),
    location: lessonData.location
  };
  
  const existingLessons = await collection.find(query).toArray();
  
  return existingLessons.filter(lesson => {
    // Use timezone-aware date comparison
    return isSameDay(lesson.date, lessonDate) &&
           doTimesOverlap(lessonData.startTime, lessonData.endTime, 
                         lesson.startTime, lesson.endTime);
  });
};
```

## Testing

### Date Helper Tests

```javascript
import { 
  createAppDate, 
  toUTC, 
  formatDate,
  generateDatesForDayOfWeek 
} from '../utils/dateHelpers.js';

describe('Date Helpers', () => {
  test('should create date in app timezone', () => {
    const date = createAppDate('2025-08-02');
    expect(date.format('YYYY-MM-DD')).toBe('2025-08-02');
    expect(date.tz()).toBe('Asia/Jerusalem');
  });
  
  test('should convert to UTC for storage', () => {
    const appDate = createAppDate('2025-08-02 14:30');
    const utcDate = toUTC(appDate);
    expect(utcDate).toBeInstanceOf(Date);
  });
  
  test('should generate weekly dates correctly', () => {
    const dates = generateDatesForDayOfWeek(
      '2025-08-04', // Monday
      '2025-08-25', // Monday
      1, // Monday
      []
    );
    expect(dates).toHaveLength(4); // 4 Mondays in range
  });
});
```

## Troubleshooting

### Common Issues

1. **Timezone Mismatch**: Ensure `APP_TIMEZONE` is set correctly
2. **Date Format Errors**: Use `isValidDate()` to validate inputs
3. **UTC Conversion**: Always use `toUTC()` before database storage
4. **Display Issues**: Use `formatDate()` or `formatDateTime()` for display

### Debug Tips

```javascript
import { createAppDate, toUTC, formatDateTime } from '../utils/dateHelpers.js';

// Debug date handling
const debugDate = (input, label = 'Date') => {
  const appDate = createAppDate(input);
  const utcDate = toUTC(appDate);
  
  console.log(`${label}:`);
  console.log(`  Input: ${input}`);
  console.log(`  App TZ: ${formatDateTime(appDate)}`);
  console.log(`  UTC: ${utcDate.toISOString()}`);
};

debugDate('2025-08-02 14:30', 'Lesson Date');
```

This comprehensive date handling system ensures accuracy, consistency, and timezone awareness across the entire conservatory application.