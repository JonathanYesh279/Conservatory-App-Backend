# Phase 3 API Documentation - Timezone-Aware Date Handling

## Overview

This documentation covers the Phase 3 enhancements to the conservatory app's API, focusing on timezone-aware date handling, response formatting, monitoring, and performance optimizations.

## Key Features

### 🕐 Timezone-Aware Date Handling
All date operations now use the Israel timezone (`Asia/Jerusalem`) by default, with proper UTC storage and timezone-aware display.

### 📊 Enhanced Response Formatting
API responses now include formatted date information with timezone awareness.

### 📈 Monitoring and Analytics
Comprehensive monitoring of date operations with performance metrics and health checks.

### ⚡ Performance Optimizations
Query optimization and intelligent caching for improved response times.

## API Endpoints

### Theory Lessons

#### GET /api/theory
Retrieve theory lessons with timezone-aware filtering.

**Query Parameters:**
- `fromDate` (string, optional): Start date in ISO format or DD/MM/YYYY
- `toDate` (string, optional): End date in ISO format or DD/MM/YYYY  
- `dayOfWeek` (number, optional): Day of week (0=Sunday, 6=Saturday)
- `teacherId` (string, optional): Filter by teacher
- `category` (string, optional): Filter by lesson category
- `location` (string, optional): Filter by location
- `includeFormatted` (boolean, optional): Include formatted date fields (default: true)
- `includeRelative` (boolean, optional): Include relative time (default: false)
- `includeQueryInfo` (boolean, optional): Include query metadata (default: false)
- `dateFormat` (string, optional): Date format (default: DD/MM/YYYY)
- `timezone` (string, optional): Response timezone (default: Asia/Jerusalem)

**Example Request:**
```http
GET /api/theory?fromDate=2025-08-01&toDate=2025-08-31&includeFormatted=true&includeRelative=true
```

**Example Response:**
```json
[
  {
    "_id": "64f7b8c123456789abcdef01",
    "category": "תיאוריה כללית",
    "teacherId": "64f7b8c123456789abcdef02",
    "date": "2025-08-15T16:00:00.000Z",
    "dayOfWeek": 4,
    "startTime": "19:00",
    "endTime": "20:30",
    "location": "חדר 101",
    "formatted": {
      "date": "15/08/2025",
      "dayName": "Thursday",
      "timeRange": "19:00-20:30",
      "dateTime": "15/08/2025 19:00",
      "relative": "in 12 days",
      "isToday": false,
      "isPast": false,
      "isFuture": true,
      "createdAt": "02/08/2025 14:30",
      "updatedAt": "02/08/2025 14:30"
    }
  }
]
```

**With Query Info:**
```http
GET /api/theory?fromDate=2025-08-01&toDate=2025-08-31&includeQueryInfo=true
```

```json
{
  "data": [...], // Lesson data
  "queryInfo": {
    "appliedFilters": {
      "fromDate": "01/08/2025",
      "toDate": "31/08/2025",
      "dateRange": "01/08/2025 - 31/08/2025"
    }
  },
  "meta": {
    "timezone": "Asia/Jerusalem",
    "formatOptions": {
      "dateFormat": "DD/MM/YYYY",
      "timeFormat": "HH:MM",
      "includeFormatted": true,
      "includeRelative": false
    }
  }
}
```

#### POST /api/theory
Create a new theory lesson with timezone-aware date handling.

**Request Body:**
```json
{
  "category": "תיאוריה כללית",
  "teacherId": "64f7b8c123456789abcdef02",
  "date": "2025-08-15", // Accepts multiple formats
  "startTime": "19:00",
  "endTime": "20:30",
  "location": "חדר 101",
  "schoolYearId": "64f7b8c123456789abcdef03",
  "studentIds": ["64f7b8c123456789abcdef04"],
  "forceCreate": false // Optional: override conflicts
}
```

**Date Format Support:**
- ISO 8601: `2025-08-15T19:00:00Z`
- ISO Date: `2025-08-15`
- DD/MM/YYYY: `15/08/2025`
- Relative: Will be interpreted in the app timezone

**Response:**
```json
{
  "success": true,
  "message": "Theory lesson created successfully",
  "data": {
    "_id": "64f7b8c123456789abcdef01",
    // ... lesson data with formatted fields
  },
  "timezone": "Asia/Jerusalem",
  "timestamp": "02/08/2025 14:30"
}
```

#### POST /api/theory/bulk-create
Create multiple theory lessons for a date range.

**Request Body:**
```json
{
  "category": "תיאוריה כללית",
  "teacherId": "64f7b8c123456789abcdef02",
  "startDate": "2025-08-01",
  "endDate": "2025-08-31",
  "dayOfWeek": 4, // Thursday
  "startTime": "19:00",
  "endTime": "20:30",
  "location": "חדר 101",
  "schoolYearId": "64f7b8c123456789abcdef03",
  "studentIds": ["64f7b8c123456789abcdef04"],
  "excludeDates": ["2025-08-15"], // Optional: dates to skip
  "forceCreate": false
}
```

### Rehearsals

#### GET /api/rehearsal
Retrieve rehearsals with timezone-aware formatting.

Similar query parameters and response format as theory lessons.

### Schedule Management

#### GET /api/schedule/teacher/:teacherId/weekly
Get teacher's weekly schedule with timezone formatting.

**Query Parameters:**
- `week` (string, optional): Week start date (default: current week)
- `includeFormatted` (boolean, optional): Include formatted fields

### Attendance

#### PUT /api/theory/:id/attendance
Update attendance with timezone validation.

**Request Body:**
```json
{
  "date": "2025-08-15", // Lesson date for validation
  "attendance": {
    "present": ["studentId1", "studentId2"],
    "absent": ["studentId3"]
  }
}
```

## Admin Monitoring Endpoints

### GET /api/admin/date-monitoring/metrics
Get current monitoring metrics.

**Response:**
```json
{
  "success": true,
  "data": {
    "dateOperations": 1250,
    "validationFailures": 12,
    "timezoneConversions": 340,
    "conflictDetections": 8,
    "lastActivity": "2025-08-02T14:30:00Z",
    "uptime": 72,
    "alertCount": 3
  }
}
```

### GET /api/admin/date-monitoring/health-check
Run comprehensive health check.

**Query Parameters:**
- `includeConsistencyCheck` (boolean, optional): Include data consistency check

**Response:**
```json
{
  "success": true,
  "data": {
    "timestamp": "2025-08-02T14:30:00Z",
    "monitoring": {
      "dateOperations": 1250,
      "status": "healthy"
    },
    "database": {
      "overall": {
        "healthScore": "98.5",
        "totalRecords": 5000,
        "invalidRecords": 75
      },
      "collections": {
        "theoryLessons": {
          "total": 2000,
          "withInvalidDates": 25,
          "healthScore": "98.75"
        }
      }
    },
    "overall": {
      "status": "healthy",
      "score": 98.5,
      "recommendations": [
        {
          "type": "maintenance",
          "priority": "low",
          "message": "System health is good. Continue regular monitoring.",
          "action": "Schedule regular health checks"
        }
      ]
    }
  }
}
```

### GET /api/admin/date-monitoring/database-health
Get database health metrics focusing on date integrity.

### GET /api/admin/date-monitoring/alerts
Get monitoring alerts.

**Query Parameters:**
- `limit` (number, optional): Number of alerts to return (default: 50)
- `onlyUnacknowledged` (boolean, optional): Only unacknowledged alerts

### DELETE /api/admin/date-monitoring/cleanup
Clean up old monitoring data.

**Query Parameters:**
- `keepDays` (number, optional): Days of data to keep (default: 30)
- `keepAlerts` (number, optional): Number of alerts to keep (default: 100)

### GET /api/admin/date-monitoring/export
Export monitoring data.

**Query Parameters:**
- `format` (string, optional): Export format (json|csv, default: json)

## Error Handling

### Date Validation Errors

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "details": [
    {
      "field": "date",
      "message": "Invalid date format. Expected DD/MM/YYYY or ISO format"
    }
  ],
  "timestamp": "02/08/2025 14:30",
  "timezone": "Asia/Jerusalem"
}
```

### Conflict Detection

```json
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
          "teacher": "Teacher Name"
        }
      }
    ],
    "teacher": []
  },
  "message": "Use forceCreate=true to override these conflicts"
}
```

## Performance Features

### Query Optimization

The API automatically optimizes queries based on:
- Date range complexity
- Filter combinations
- Historical vs. current data access patterns

### Intelligent Caching

- **Cache Duration**: 5 minutes for current data, up to 1 hour for historical data
- **Cache Invalidation**: Automatic invalidation when data changes
- **Cache Keys**: Based on query parameters and user context

### Query Parameters for Performance

- `limit` (number): Limit number of results
- `page` (number): Page number for pagination
- `sortField` (string): Field to sort by (default: date)
- `sortOrder` (number): Sort direction (1=ASC, -1=DESC)

## Best Practices

### Date Handling

1. **Always use timezone-aware dates**: The API handles timezone conversion automatically
2. **Prefer relative date filtering**: Use `fromDate`/`toDate` for ranges
3. **Validate dates client-side**: Use the same validation patterns as the API

```javascript
// Good
const fromDate = '2025-08-01';
const toDate = '2025-08-31';

// Also good  
const fromDate = '01/08/2025';
const toDate = '31/08/2025';
```

### Performance Optimization

1. **Use date ranges appropriately**: Avoid overly broad date ranges
2. **Include only needed fields**: Use query parameters to control response size
3. **Cache responses client-side**: Respect cache headers
4. **Monitor query complexity**: Use admin endpoints to monitor performance

### Error Handling

1. **Handle timezone validation**: Account for timezone-related validation errors
2. **Implement conflict resolution**: Provide UI for conflict override decisions
3. **Monitor for alerts**: Check monitoring endpoints regularly

## Migration Notes

### From Phase 2

Phase 3 maintains full backward compatibility with Phase 2 implementations while adding:

- Enhanced response formatting (opt-in)
- Monitoring capabilities
- Performance optimizations
- Extended error information

### Breaking Changes

**None** - All changes are additive and backward compatible.

### New Dependencies

- Response formatting middleware (automatic)
- Query optimization utilities (automatic)
- Monitoring services (admin-only)

## Examples

### Complete Lesson Management Workflow

```javascript
// 1. Create a theory lesson
const createResponse = await fetch('/api/theory', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    category: 'תיאוריה כללית',
    teacherId: 'teacher123',
    date: '2025-08-15',
    startTime: '19:00',
    endTime: '20:30',
    location: 'חדר 101'
  })
});

// 2. Query lessons with formatting
const lessonsResponse = await fetch('/api/theory?fromDate=2025-08-01&toDate=2025-08-31&includeFormatted=true&includeRelative=true');
const lessons = await lessonsResponse.json();

// 3. Update attendance
const attendanceResponse = await fetch(`/api/theory/${lessonId}/attendance`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    date: '2025-08-15',
    attendance: {
      present: ['student1', 'student2'],
      absent: ['student3']
    }
  })
});

// 4. Monitor system health (admin)
const healthResponse = await fetch('/api/admin/date-monitoring/health-check?includeConsistencyCheck=true');
const health = await healthResponse.json();
```

### Bulk Operations

```javascript
// Create multiple lessons for a semester
const bulkResponse = await fetch('/api/theory/bulk-create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    category: 'תיאוריה כללית',
    teacherId: 'teacher123',
    startDate: '2025-08-01',
    endDate: '2025-12-31',
    dayOfWeek: 4, // Thursday
    startTime: '19:00',
    endTime: '20:30',
    location: 'חדר 101',
    excludeDates: [
      '2025-10-10', // Holiday
      '2025-11-15'  // Break
    ]
  })
});
```

## Support

For questions or issues with the timezone-aware date handling system:

1. Check the monitoring endpoints for system health
2. Review error responses for detailed validation information  
3. Use the admin monitoring tools for performance analysis
4. Consult the Phase 1 and Phase 2 documentation for underlying concepts

## Changelog

### Phase 3.0.0
- ✅ Enhanced API response formatting with timezone awareness
- ✅ Comprehensive monitoring and alerting system
- ✅ Query optimization and intelligent caching
- ✅ Performance metrics and health checks
- ✅ Extended error handling and validation
- ✅ Backward-compatible implementation