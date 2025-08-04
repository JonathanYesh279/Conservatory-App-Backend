# Private Lesson Attendance System - Frontend Integration Guide

## Overview

This guide explains how the private lesson attendance system works in the backend and provides all the necessary information for frontend integration. The system tracks attendance for private music lessons and provides comprehensive analytics.

## System Architecture

The attendance system consists of two main data storage approaches:
1. **Primary Storage**: Attendance data stored within teacher schedule slots
2. **Analytics Storage**: Synchronized data in the `activity_attendance` collection for reporting and analytics

## Database Document Structures

### 1. Teacher Schedule Slot (Primary Storage)

Location: `teacher.teaching.schedule[].attendance`

```javascript
{
  "_id": "schedule_slot_id",
  "day": "Sunday",
  "startTime": "09:00",
  "endTime": "09:45",
  "duration": 45,
  "studentId": "student_id_here",
  "location": "Room 1",
  "attendance": {
    "status": "הגיע/ה",           // 'הגיע/ה' | 'לא הגיע/ה' | 'cancelled' | 'pending'
    "markedAt": "2024-01-15T10:00:00.000Z",
    "markedBy": "teacher:teacher_id_here",
    "notes": "Student was 5 minutes late",
    "lessonCompleted": true,      // true if attended, false if cancelled, null if missed
    "lessonDate": "2024-01-15T09:00:00.000Z"
  },
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-15T10:00:00.000Z"
}
```

### 2. Activity Attendance (Analytics Storage)

Collection: `activity_attendance`

```javascript
{
  "_id": "unique_activity_id",
  "studentId": "student_id_here",
  "teacherId": "teacher_id_here",
  "activityType": "שיעור פרטי",
  "groupId": "teacher_id_here",        // For private lessons, same as teacherId
  "sessionId": "schedule_slot_id",     // Links back to the schedule slot
  "date": "2024-01-15T09:00:00.000Z",
  "status": "הגיע/ה",                  // Same values as schedule slot
  "notes": "Student was 5 minutes late",
  "markedBy": "teacher:teacher_id_here",
  "markedAt": "2024-01-15T10:00:00.000Z",
  "metadata": {
    "day": "Sunday",
    "startTime": "09:00",
    "endTime": "09:45",
    "duration": 45,
    "location": "Room 1",
    "instrument": "Piano"
  },
  "createdAt": "2024-01-15T10:00:00.000Z",
  "updatedAt": "2024-01-15T10:00:00.000Z"
}
```

## Attendance Status Values

| Status | Hebrew | Description |
|--------|--------|-------------|
| `הגיע/ה` | הגיע/ה | Student attended the lesson |
| `לא הגיע/ה` | לא הגיע/ה | Student missed the lesson |
| `cancelled` | בוטל | Lesson was cancelled |
| `pending` | ממתין | Attendance not yet marked |

## API Endpoints

### Authentication
All endpoints require authentication via Bearer token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

### 1. Mark Lesson Attendance

**Endpoint**: `PUT /api/lessons/:lessonId/attendance`

**Description**: Mark attendance for a specific lesson (schedule slot)

**Parameters**:
- `lessonId`: Schedule slot ID (24-character hex string)

**Request Body**:
```javascript
{
  "status": "הגיע/ה",                    // Required
  "notes": "Student was 5 minutes late", // Optional, max 500 chars
  "lessonDate": "2024-01-15T09:00:00.000Z" // Optional, defaults to current date
}
```

**Response** (200 OK):
```javascript
{
  "success": true,
  "message": "Attendance marked successfully",
  "scheduleSlotId": "507f1f77bcf86cd799439011",
  "attendance": {
    "status": "הגיע/ה",
    "markedAt": "2024-01-15T10:00:00.000Z",
    "markedBy": "teacher:507f1f77bcf86cd799439012",
    "notes": "Student was 5 minutes late",
    "lessonCompleted": true,
    "lessonDate": "2024-01-15T09:00:00.000Z"
  }
}
```

**Permissions**:
- Teachers can only mark attendance for their own lessons
- Admins can mark attendance for any lesson

### 2. Get Lesson Attendance

**Endpoint**: `GET /api/lessons/:lessonId/attendance`

**Description**: Get attendance data for a specific lesson

**Response** (200 OK):
```javascript
{
  "scheduleSlotId": "507f1f77bcf86cd799439011",
  "studentId": "507f1f77bcf86cd799439013",
  "teacherId": "507f1f77bcf86cd799439012",
  "attendance": {
    "status": "הגיע/ה",
    "markedAt": "2024-01-15T10:00:00.000Z",
    "markedBy": "teacher:507f1f77bcf86cd799439012",
    "notes": "Student was 5 minutes late",
    "lessonCompleted": true,
    "lessonDate": "2024-01-15T09:00:00.000Z"
  },
  "slotInfo": {
    "day": "Sunday",
    "startTime": "09:00",
    "endTime": "09:45",
    "duration": 45
  }
}
```

### 3. Get Student Private Lesson Statistics

**Endpoint**: `GET /api/students/:studentId/private-lesson-attendance`

**Description**: Get attendance statistics for a student's private lessons

**Query Parameters**:
- `teacherId` (optional): Filter by specific teacher

**Response** (200 OK):
```javascript
{
  "studentId": "507f1f77bcf86cd799439013",
  "teacherId": "507f1f77bcf86cd799439012", // null if not filtered
  "totalLessons": 20,
  "attendedLessons": 18,
  "missedLessons": 1,
  "cancelledLessons": 1,
  "attendanceRate": 90.00,
  "recentAttendance": [
    // Last 10 attendance records from activity_attendance collection
    {
      "_id": "...",
      "date": "2024-01-15T09:00:00.000Z",
      "status": "הגיע/ה",
      "notes": "Student was 5 minutes late"
    }
    // ... more records
  ]
}
```

### 4. Get Student Attendance History

**Endpoint**: `GET /api/students/:studentId/attendance-history`

**Description**: Get detailed attendance history for a student

**Query Parameters**:
- `teacherId` (optional): Filter by teacher
- `startDate` (optional): Start date filter (ISO string)
- `endDate` (optional): End date filter (ISO string)
- `limit` (optional): Limit results (default: 50, max: 1000)

**Response** (200 OK):
```javascript
{
  "studentId": "507f1f77bcf86cd799439013",
  "options": {
    "teacherId": "507f1f77bcf86cd799439012",
    "startDate": "2024-01-01T00:00:00.000Z",
    "endDate": "2024-01-31T23:59:59.000Z",
    "limit": 50
  },
  "history": [
    {
      "_id": "...",
      "studentId": "507f1f77bcf86cd799439013",
      "teacherId": "507f1f77bcf86cd799439012",
      "activityType": "שיעור פרטי",
      "sessionId": "507f1f77bcf86cd799439011",
      "date": "2024-01-15T09:00:00.000Z",
      "status": "הגיע/ה",
      "notes": "Student was 5 minutes late",
      "markedBy": "teacher:507f1f77bcf86cd799439012",
      "markedAt": "2024-01-15T10:00:00.000Z",
      "metadata": {
        "day": "Sunday",
        "startTime": "09:00",
        "endTime": "09:45",
        "duration": 45,
        "location": "Room 1",
        "instrument": "Piano"
      }
    }
    // ... more records
  ]
}
```

### 5. Get Teacher Attendance Overview

**Endpoint**: `GET /api/teachers/:teacherId/lesson-attendance-summary`

**Description**: Get attendance overview for a teacher's private lessons

**Query Parameters**:
- `startDate` (optional): Start date filter
- `endDate` (optional): End date filter

**Response** (200 OK):
```javascript
{
  "teacherId": "507f1f77bcf86cd799439012",
  "dateRange": {
    "startDate": "2024-01-01",
    "endDate": "2024-01-31"
  },
  "overallStats": {
    "totalLessons": 100,
    "attendedLessons": 85,
    "missedLessons": 10,
    "cancelledLessons": 5,
    "attendanceRate": 85.00
  },
  "studentStats": {
    "507f1f77bcf86cd799439013": {
      "studentName": "John Doe",
      "totalLessons": 8,
      "attendedLessons": 7,
      "missedLessons": 1,
      "attendanceRate": "87.50"
    }
    // ... more students
  },
  "recentActivity": [
    // Last 20 attendance records
  ]
}
```

### 6. Bulk Attendance Operations

**Endpoint**: `POST /api/teachers/:teacherId/bulk-attendance`

**Description**: Get attendance data for multiple lessons at once

**Request Body**:
```javascript
{
  "scheduleSlotIds": [
    "507f1f77bcf86cd799439011",
    "507f1f77bcf86cd799439014",
    "507f1f77bcf86cd799439015"
  ]
}
```

**Response** (200 OK):
```javascript
{
  "teacherId": "507f1f77bcf86cd799439012",
  "attendanceData": {
    "507f1f77bcf86cd799439011": {
      "scheduleSlotId": "507f1f77bcf86cd799439011",
      "studentId": "507f1f77bcf86cd799439013",
      "attendance": {
        "status": "הגיע/ה",
        "markedAt": "2024-01-15T10:00:00.000Z",
        // ... full attendance object
      },
      "slotInfo": {
        "day": "Sunday",
        "startTime": "09:00",
        "endTime": "09:45"
      }
    }
    // ... more attendance data
  }
}
```

### 7. Bulk Mark Attendance

**Endpoint**: `POST /api/teachers/:teacherId/bulk-mark-attendance`

**Description**: Mark attendance for multiple lessons at once

**Request Body**:
```javascript
{
  "attendanceRecords": [
    {
      "scheduleSlotId": "507f1f77bcf86cd799439011",
      "attendanceData": {
        "status": "הגיע/ה",
        "notes": "On time",
        "lessonDate": "2024-01-15T09:00:00.000Z"
      }
    },
    {
      "scheduleSlotId": "507f1f77bcf86cd799439014",
      "attendanceData": {
        "status": "לא הגיע/ה",
        "notes": "No show"
      }
    }
  ]
}
```

**Response** (200 OK):
```javascript
{
  "message": "Bulk attendance marking completed",
  "successful": 2,
  "failed": 0,
  "results": [
    {
      "scheduleSlotId": "507f1f77bcf86cd799439011",
      "success": true,
      "result": {
        "success": true,
        "message": "Attendance marked successfully",
        // ... full result
      }
    }
    // ... more results
  ],
  "errors": []
}
```

## Analytics Endpoints

The system also includes analytics endpoints under `/api/analytics/` for advanced reporting:

- `GET /api/analytics/students/:studentId/attendance` - Comprehensive student analytics
- `GET /api/analytics/teachers/:teacherId/attendance` - Teacher analytics
- `GET /api/analytics/attendance/overall` - System-wide attendance reports
- `GET /api/analytics/attendance/trends` - Attendance trends analysis
- `POST /api/analytics/attendance/compare` - Attendance comparisons
- `POST /api/analytics/attendance/export` - Export attendance reports

## Error Handling

### Common Error Responses

**400 Bad Request**:
```javascript
{
  "error": "Invalid attendance data: Status must be one of: pending, הגיע/ה, לא הגיע/ה, cancelled"
}
```

**401 Unauthorized**:
```javascript
{
  "error": "Access token is missing or invalid"
}
```

**403 Forbidden**:
```javascript
{
  "error": "You are not authorized to mark attendance for this lesson"
}
```

**404 Not Found**:
```javascript
{
  "error": "Schedule slot with id 507f1f77bcf86cd799439011 not found"
}
```

**500 Internal Server Error**:
```javascript
{
  "error": "Error marking lesson attendance: Database connection failed"
}
```

## Frontend Implementation Tips

### 1. Attendance Status Display

Create a helper function to display status in Hebrew:

```javascript
const getAttendanceStatusDisplay = (status) => {
  const statusMap = {
    'הגיע/ה': { text: 'הגיע/ה', color: 'green', icon: '✓' },
    'לא הגיע/ה': { text: 'לא הגיע/ה', color: 'red', icon: '✗' },
    'cancelled': { text: 'בוטל', color: 'orange', icon: '⚠' },
    'pending': { text: 'ממתין', color: 'gray', icon: '⏳' }
  };
  return statusMap[status] || statusMap['pending'];
};
```

### 2. Date Handling

Always send dates in ISO format:

```javascript
const lessonDate = new Date().toISOString();
```

### 3. Bulk Operations

Use bulk operations for teacher dashboards to minimize API calls:

```javascript
// Get attendance for multiple lessons
const scheduleSlotIds = lessons.map(lesson => lesson._id);
const bulkAttendance = await api.post(`/api/teachers/${teacherId}/bulk-attendance`, {
  scheduleSlotIds
});
```

### 4. Permission Handling

Check user permissions before showing UI elements:

```javascript
const canMarkAttendance = (lesson, user) => {
  return user.role === 'admin' || 
         (user.role === 'teacher' && lesson.teacherId === user._id);
};
```

### 5. Real-time Updates

Consider implementing real-time updates for attendance changes if multiple users might be marking attendance simultaneously.

### 6. Validation

Implement client-side validation matching the backend validation:

```javascript
const validateAttendanceData = (data) => {
  const validStatuses = ['pending', 'הגיע/ה', 'לא הגיע/ה', 'cancelled'];
  
  if (!validStatuses.includes(data.status)) {
    return { valid: false, error: 'Invalid status' };
  }
  
  if (data.notes && data.notes.length > 500) {
    return { valid: false, error: 'Notes too long' };
  }
  
  return { valid: true };
};
```

## Testing

### Sample Test Data

Use this sample data for testing:

```javascript
// Mark attendance
const attendanceData = {
  status: 'הגיע/ה',
  notes: 'Student arrived on time and was well prepared',
  lessonDate: '2024-01-15T09:00:00.000Z'
};

// Bulk mark attendance
const bulkData = {
  attendanceRecords: [
    {
      scheduleSlotId: '507f1f77bcf86cd799439011',
      attendanceData: {
        status: 'הגיע/ה',
        notes: 'Great lesson'
      }
    },
    {
      scheduleSlotId: '507f1f77bcf86cd799439014',
      attendanceData: {
        status: 'לא הגיע/ה',
        notes: 'No show, no notification'
      }
    }
  ]
};
```

## Support

For questions or issues with the attendance system, please:

1. Check this documentation first
2. Review the API endpoint validation rules
3. Test with the provided sample data
4. Contact the backend team with specific error messages and request details

---

**Last Updated**: 2024-01-15  
**Version**: 1.0  
**Backend Team**: Conservatory Management System