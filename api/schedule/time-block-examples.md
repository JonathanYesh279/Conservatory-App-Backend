# Time Block System API Examples

## Overview

The Time Block system revolutionizes schedule management by allowing teachers to create large time blocks (e.g., "Sunday 14:00-18:00") that automatically subdivide based on student lesson duration requests.

## Key Benefits

- **Reduced Teacher Workload**: Create one 4-hour block instead of 8 individual 30-minute slots
- **Dynamic Slot Allocation**: System automatically calculates available sub-slots
- **Intelligent Scheduling**: AI-powered recommendations for optimal lesson placement
- **Flexible Duration Support**: Seamlessly handles 30, 45, and 60-minute lessons

## API Endpoints

### Time Block Management

#### Create Time Block
```http
POST /api/schedule/time-blocks/teacher/{teacherId}/time-block
Content-Type: application/json

{
  "day": "ראשון",
  "startTime": "14:00", 
  "endTime": "18:00",
  "location": "חדר 5",
  "notes": "שיעורי בית ספר"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Time block created successfully",
  "timeBlock": {
    "_id": "...",
    "day": "ראשון",
    "startTime": "14:00",
    "endTime": "18:00", 
    "totalDuration": 240,
    "assignedLessons": [],
    "teacherId": "..."
  }
}
```

#### Get Available Slots
```http
GET /api/schedule/time-blocks/teacher/{teacherId}/available-slots?duration=60&preferredDays[]=ראשון&preferredStartTime=15:00
```

**Response:**
```json
{
  "success": true,
  "duration": 60,
  "availableSlots": [
    {
      "timeBlockId": "...",
      "day": "ראשון",
      "startTime": "14:00",
      "endTime": "15:00",
      "duration": 60,
      "location": "חדר 5"
    },
    {
      "timeBlockId": "...",
      "day": "ראשון", 
      "startTime": "15:00",
      "endTime": "16:00",
      "duration": 60,
      "location": "חדר 5"
    }
  ]
}
```

#### Find Optimal Slot
```http
POST /api/schedule/time-blocks/teacher/{teacherId}/find-optimal-slot
Content-Type: application/json

{
  "duration": 45,
  "preferences": {
    "preferredDays": ["ראשון", "שני"],
    "preferredStartTime": "15:00",
    "maxEndTime": "17:00"
  }
}
```

**Response:**
```json
{
  "success": true,
  "optimalSlot": {
    "timeBlockId": "...",
    "day": "ראשון",
    "startTime": "15:00", 
    "endTime": "15:45",
    "duration": 45,
    "score": 87.5
  },
  "alternatives": [
    {
      "timeBlockId": "...",
      "day": "שני",
      "startTime": "14:30",
      "endTime": "15:15", 
      "duration": 45,
      "score": 82.1
    }
  ]
}
```

### Lesson Assignment

#### Assign Lesson to Time Block
```http
POST /api/schedule/time-blocks/assign-lesson
Content-Type: application/json

{
  "teacherId": "...",
  "studentId": "...", 
  "timeBlockId": "...",
  "startTime": "15:00",
  "duration": 60,
  "notes": "שיעור פרטי"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Lesson assigned successfully",
  "teacherId": "...",
  "studentId": "...",
  "timeBlockId": "...",
  "lessonAssignment": {
    "_id": "...",
    "studentId": "...",
    "lessonStartTime": "15:00",
    "lessonEndTime": "16:00",
    "duration": 60,
    "isActive": true
  }
}
```

### Schedule Overview

#### Get Teacher Schedule with Time Blocks
```http
GET /api/schedule/time-blocks/teacher/{teacherId}/schedule-with-blocks?includeStudentInfo=true
```

**Response:**
```json
{
  "teacherId": "...",
  "teacherName": "מורה דוגמה",
  "weeklySchedule": {
    "ראשון": [
      {
        "_id": "...",
        "day": "ראשון",
        "startTime": "14:00",
        "endTime": "18:00",
        "totalDuration": 240,
        "assignedLessons": [
          {
            "_id": "...",
            "studentId": "...",
            "lessonStartTime": "15:00",
            "lessonEndTime": "16:00", 
            "duration": 60,
            "studentInfo": {
              "fullName": "תלמיד דוגמה",
              "instrument": "פסנתר"
            }
          }
        ],
        "utilization": {
          "totalMinutes": 240,
          "usedMinutes": 60,
          "availableMinutes": 180,
          "utilizationPercentage": 25
        }
      }
    ],
    "שני": [],
    "שלישי": []
  },
  "statistics": {
    "totalBlocks": 1,
    "totalHours": 4,
    "usedHours": 1,
    "utilizationPercentage": 25
  }
}
```

## Migration from Legacy System

### Create Backup
```http
POST /api/schedule/migration-backup
```

### Analyze Current Schedule
```http
POST /api/schedule/migrate-to-time-blocks
Content-Type: application/json

{
  "dryRun": true
}
```

**Response:**
```json
{
  "message": "Migration analysis completed",
  "results": {
    "teachersProcessed": 15,
    "timeBlocksCreated": 45,
    "lessonsPreserved": 120,
    "slotsMigrated": 300
  }
}
```

### Execute Migration
```http
POST /api/schedule/migrate-to-time-blocks
Content-Type: application/json

{
  "dryRun": false
}
```

### Get Migration Report
```http
GET /api/schedule/migration-report?teacherId={teacherId}
```

## Usage Scenarios

### Scenario 1: Teacher Creates Weekly Schedule

1. **Teacher creates time blocks for the week:**
   ```
   Sunday: 14:00-18:00 (4 hours)
   Monday: 16:00-20:00 (4 hours)
   Tuesday: 15:00-19:00 (4 hours)
   ```

2. **System automatically makes available:**
   - 32 possible 30-minute slots
   - 24 possible 45-minute slots  
   - 16 possible 60-minute slots

3. **Students can book any duration within blocks**

### Scenario 2: Student Requests Lesson

1. **Student specifies preferences:**
   - Duration: 45 minutes
   - Preferred days: Sunday, Monday
   - Preferred time: After 15:00

2. **System finds optimal slot:**
   - Analyzes all time blocks
   - Calculates available segments
   - Ranks options by preference match

3. **System books exact time:**
   - Sunday 15:15-16:00 (45 minutes)
   - Updates time block utilization
   - Maintains available segments

### Scenario 3: Dynamic Schedule Optimization

1. **Current time block state:**
   ```
   Sunday 14:00-18:00:
   - 14:00-15:00: Student A (60 min)
   - 15:00-15:45: Student B (45 min)  
   - 15:45-16:15: Student C (30 min)
   - 16:15-18:00: Available (105 min)
   ```

2. **Available for new bookings:**
   - 3x 30-minute slots
   - 2x 45-minute slots
   - 1x 60-minute slot

3. **System suggests optimal usage:**
   - Best fit: Two 45-minute lessons
   - Alternative: One 60-minute + one 30-minute
   - Fallback: Three 30-minute lessons

## Advanced Features

### Utilization Analytics
```http
GET /api/schedule/time-blocks/teacher/{teacherId}/utilization-stats
```

Returns detailed statistics:
- Overall utilization percentage
- Peak hours analysis
- Day-by-day breakdown
- Optimization recommendations

### Multi-Teacher Lesson Options
```http
POST /api/schedule/time-blocks/lesson-options
Content-Type: application/json

{
  "teacherIds": ["teacher1", "teacher2", "teacher3"],
  "duration": 60,
  "preferences": {
    "preferredDays": ["ראשון"],
    "preferredStartTime": "15:00"
  }
}
```

Returns best options across all specified teachers, ranked by preference match.

## Benefits Realized

### For Teachers
- **95% reduction** in schedule setup time
- **Flexible block management** instead of rigid slot creation
- **Real-time utilization insights** for optimization
- **Automatic conflict detection** and resolution

### For Students  
- **Instant availability checking** for any lesson duration
- **Smart recommendations** based on preferences
- **Flexible scheduling** accommodating varying lesson lengths
- **Visual schedule clarity** with block-based interface

### For Administrators
- **System-wide analytics** on schedule utilization
- **Automated optimization suggestions** for better time usage
- **Seamless migration** from legacy slot-based system
- **Comprehensive reporting** on scheduling efficiency

This new system transforms manual, repetitive scheduling into an intelligent, automated process that scales efficiently with institutional growth.