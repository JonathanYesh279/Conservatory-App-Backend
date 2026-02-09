# Conservatory App — Complete Database Schema Documentation

**Generated:** February 2026
**Database:** MongoDB (native driver, no Mongoose)
**Architecture:** Single database, feature-based collections

---

## Table of Contents

1. [Collection Overview](#collection-overview)
2. [Core Collections](#core-collections)
   - [student](#1-student)
   - [teacher](#2-teacher)
   - [orchestra](#3-orchestra)
   - [rehearsal](#4-rehearsal)
   - [theory_lesson](#5-theory_lesson)
   - [bagrut](#6-bagrut)
   - [school_year](#7-school_year)
   - [activity_attendance](#8-activity_attendance)
3. [Audit & System Collections](#audit--system-collections)
   - [deletion_audit](#9-deletion_audit)
   - [deletion_snapshots](#10-deletion_snapshots)
   - [security_log](#11-security_log)
   - [migration_backups](#12-migration_backups)
   - [integrityAuditLog](#13-integrityauditlog)
   - [integrityStatus](#14-integritystatus)
4. [Cross-Collection Relationships](#cross-collection-relationships)
5. [Data Duplication Map](#data-duplication-map)
6. [Indexes](#indexes)
7. [Collection Naming Inconsistencies](#collection-naming-inconsistencies)

---

## Collection Overview

| # | Collection Name | Purpose | Estimated Size |
|---|----------------|---------|---------------|
| 1 | `student` | Student records | ~100-200 docs |
| 2 | `teacher` | Teacher records + auth credentials | ~50-113 docs |
| 3 | `orchestra` | Orchestra/ensemble groups | ~10-30 docs |
| 4 | `rehearsal` | Scheduled rehearsal sessions | ~100-500 docs |
| 5 | `theory_lesson` | Theory class sessions | ~100-500 docs |
| 6 | `bagrut` | Bagrut (final exam) records | ~50-100 docs |
| 7 | `school_year` | Academic year definitions | ~2-5 docs |
| 8 | `activity_attendance` | Unified attendance records | ~1000+ docs |
| 9 | `deletion_audit` | Cascade deletion audit trail | Variable |
| 10 | `deletion_snapshots` | Pre-deletion snapshots for rollback | Variable |
| 11 | `security_log` | Auth security events | Variable |
| 12 | `migration_backups` | Data migration backups | Variable |
| 13 | `integrityAuditLog` | Data integrity check results | Variable |
| 14 | `integrityStatus` | Integrity check status tracking | Variable |

---

## Core Collections

### 1. `student`

**Source files:** `api/student/student.validation.js`, `api/student/student.service.js`

```
student {
  _id:                ObjectId           // Auto-generated

  personalInfo: {
    fullName:         string             // REQUIRED
    phone:            string | null      // Pattern: /^05\d{8}$/
    age:              number | null      // Range: 0-99
    address:          string | null
    parentName:       string | null
    parentPhone:      string | null      // Pattern: /^05\d{8}$/
    parentEmail:      string | null      // Email format
    studentEmail:     string | null      // Email format
  }

  academicInfo: {
    class:            string             // REQUIRED on create
                                         // Valid: א,ב,ג,ד,ה,ו,ז,ח,ט,י,יא,יב,אחר

    instrumentProgress: [                // REQUIRED, min 1 item
      {
        instrumentName:  string          // REQUIRED — from VALID_INSTRUMENTS
        isPrimary:       boolean         // Default: false (at least one must be true)
        currentStage:    number          // REQUIRED, range: 1-8
        lastStageUpdate: Date | null     // Set by updateStudentStageLevel()
        tests: {
          stageTest: {
            status:       string         // Default: 'לא נבחן'
                                         // Valid: לא נבחן, עבר/ה, לא עבר/ה,
                                         //        עבר/ה בהצטיינות, עבר/ה בהצטיינות יתרה
            lastTestDate: Date | null
            nextTestDate: Date | null
            notes:        string | null
          }
          technicalTest: {
            status:       string         // Same enum as stageTest
            lastTestDate: Date | null
            nextTestDate: Date | null
            notes:        string | null
          }
        }
      }
    ]

    tests: {
      bagrutId:       string | null      // Default: null — links to bagrut._id
    }
  }

  enrollments: {
    orchestraIds:     [string]           // Default: [] — orchestra._id references
    ensembleIds:      [string]           // Default: [] — reserved for future use
    theoryLessonIds:  [string]           // Default: [] — theory_lesson._id references
    schoolYears: [                       // Default: []
      {
        schoolYearId: string             // REQUIRED
        isActive:     boolean            // Default: true
      }
    ]
  }

  teacherIds:         [string]           // Default: [] — LEGACY backward compat
                                         // Maintained bidirectionally with teacher.teaching.studentIds

  teacherAssignments: [                  // Default: [] — PRIMARY source of truth
    {
      teacherId:      string             // REQUIRED
      scheduleSlotId: string | null      // Deprecated, kept for compat
      day:            string             // REQUIRED — Hebrew day name
                                         // Valid: ראשון,שני,שלישי,רביעי,חמישי,שישי
      time:           string             // REQUIRED — HH:MM format
      duration:       number             // REQUIRED — 30 | 45 | 60
      location:       string | null      // Default: null
      startDate:      Date               // Default: current date
      endDate:        Date | null        // Default: null
      isActive:       boolean            // Default: true
      notes:          string | null      // Default: null
      isRecurring:    boolean            // Default: false
      scheduleInfo:   object | null      // Default: null (flexible schema)
      createdAt:      Date
      updatedAt:      Date
      // Added during teacher sync:
      timeBlockId:    string | undefined
      lessonId:       string | undefined
    }
  ]

  isActive:           boolean            // Default: true (soft delete)
  createdAt:          Date
  updatedAt:          Date
}
```

**Valid Instruments:**
חלילית, חליל צד, אבוב, בסון, סקסופון, קלרינט, חצוצרה, קרן יער, טרומבון, טובה/בריטון, שירה, כינור, ויולה, צ'לו, קונטרבס, פסנתר, גיטרה, גיטרה בס, תופים

---

### 2. `teacher`

**Source files:** `api/teacher/teacher.validation.js`, `api/teacher/teacher.service.js`, `api/schedule/time-block.service.js`

```
teacher {
  _id:                ObjectId           // Auto-generated

  personalInfo: {
    fullName:         string             // REQUIRED
    phone:            string             // REQUIRED — Pattern: /^05\d{8}$/
    email:            string             // REQUIRED — must match credentials.email
    address:          string             // REQUIRED
  }

  roles:              [string]           // REQUIRED, min 1
                                         // Valid: מורה, מנצח, מדריך הרכב,
                                         //        מנהל, מורה תאוריה, מגמה

  professionalInfo: {
    instrument:       string             // REQUIRED (unless role is only מורה תאוריה)
    isActive:         boolean            // Default: true
  }

  teaching: {
    studentIds:       [string]           // Default: [] — student._id references
                                         // Maintained bidirectionally with student.teacherIds

    schedule:         [object]           // DEPRECATED — fully removed from active code
                                         // Accepted in validation for backward compat only

    timeBlocks: [                        // ACTIVE scheduling system
      {
        _id:            ObjectId
        day:            string           // Valid: ראשון,שני,שלישי,רביעי,חמישי,שישי
        startTime:      string           // HH:MM format
        endTime:        string           // HH:MM format (calculated from start + duration)
        duration:       number           // Range: 15-480 minutes
        totalDuration:  number           // Calculated, in minutes
        isAvailable:    boolean          // Default: true
        location:       string | null
        notes:          string | null

        studentId:      string | null    // Legacy single-student field
        studentName:    string | null
        instrument:     string | null

        recurring: {
          isRecurring:   boolean         // Default: true
          startDate:     Date | null
          endDate:       Date | null
          excludeDates:  [Date]          // Default: []
        }

        assignedLessons: [               // Nested lessons within this block
          {
            _id:             ObjectId
            studentId:       string      // REQUIRED
            lessonStartTime: string      // HH:MM
            lessonEndTime:   string      // HH:MM
            duration:        number      // Minutes
            assignmentDate:  Date
            isActive:        boolean     // Default: true
            endDate:         Date | null // Set when deactivated
            notes:           string | null
            createdAt:       Date
            updatedAt:       Date
          }
        ]

        isActive:       boolean          // Default: true
        createdAt:      Date
        updatedAt:      Date
      }
    ]
  }

  conducting: {
    orchestraIds:     [string]           // Default: [] — orchestra._id references
  }

  ensemblesIds:       [string]           // Default: [] — ensemble references

  schoolYears: [
    {
      schoolYearId:   string             // REQUIRED
      isActive:       boolean            // Default: true
    }
  ]

  credentials: {
    email:               string          // REQUIRED — must match personalInfo.email
    password:            string | null   // bcrypt hash
    invitationToken:     string | null   // 32-byte hex string
    invitationExpiry:    Date | null     // Token expiry (7 days from creation)
    isInvitationAccepted: boolean        // Default: false
    invitationMode:      string          // 'EMAIL' | 'DEFAULT_PASSWORD'
    invitedAt:           Date | null
    invitedBy:           string | null   // Admin teacher._id
    passwordSetAt:       Date | null
    requiresPasswordChange: boolean | null
  }

  isActive:           boolean            // Default: true (soft delete)
  createdAt:          Date
  updatedAt:          Date
  metadata: {                            // Optional — used by cascade deletion
    lastModifiedBy:   string | null
  }
}
```

---

### 3. `orchestra`

**Source files:** `api/orchestra/orchestra.validation.js`, `api/orchestra/orchestra.service.js`

```
orchestra {
  _id:                ObjectId           // Auto-generated
  name:               string             // REQUIRED — orchestra/ensemble name
  type:               string             // REQUIRED — Valid: 'הרכב' (ensemble), 'תזמורת' (orchestra)
  conductorId:        string             // REQUIRED — teacher._id reference
  memberIds:          [string]           // Default: [] — student._id references
  rehearsalIds:       [string]           // Default: [] — rehearsal._id references
  schoolYearId:       string             // REQUIRED — school_year._id reference
  location:           string             // Default: 'חדר 1' — from 39 predefined Hebrew room names
  isActive:           boolean            // Default: true (soft delete)
  lastModified:       Date               // Set by service on update

  // Populated fields (from $lookup, NOT stored):
  // members:   [{student document}]     — via $lookup on memberIds
  // conductor: {teacher document}       — via $lookup on conductorId
}
```

**Valid Locations (39 rooms):**
חדר 1 through חדר 20, אולם, אולם קטן, אולם גדול, חדר מחשבים, חדר הקלטות, חדר תופים, חדר נשיפה, ספרייה, מסדרון, חצר, גינה, מגרש, and more.

---

### 4. `rehearsal`

**Source files:** `api/rehearsal/rehearsal.validation.js`, `api/rehearsal/rehearsal.service.js`

```
rehearsal {
  _id:                ObjectId           // Auto-generated
  groupId:            string             // REQUIRED — orchestra._id reference
  type:               string             // REQUIRED — Valid: 'תזמורת', 'הרכב'
  date:               Date               // REQUIRED — stored as UTC ISO 8601
  dayOfWeek:          number             // REQUIRED — 0 (Sunday) to 6 (Saturday)
  startTime:          string             // REQUIRED — HH:MM format
  endTime:            string             // REQUIRED — HH:MM format (must be > startTime)
  location:           string             // REQUIRED

  attendance: {
    present:          [string]           // Default: [] — student._id references
    absent:           [string]           // Default: [] — student._id references
  }

  notes:              string             // Default: ''
  schoolYearId:       string             // REQUIRED
  isActive:           boolean            // Default: true (soft delete)
  createdAt:          Date
  updatedAt:          Date
}
```

---

### 5. `theory_lesson`

**Source files:** `api/theory/theory.validation.js`, `api/theory/theory.service.js`

```
theory_lesson {
  _id:                ObjectId           // Auto-generated
  category:           string             // REQUIRED — from 14 predefined Hebrew categories
  teacherId:          string             // REQUIRED — teacher._id reference
  date:               Date               // REQUIRED — stored as UTC ISO 8601
  dayOfWeek:          number             // REQUIRED — 0-6
  startTime:          string             // REQUIRED — HH:MM
  endTime:            string             // REQUIRED — HH:MM (must be > startTime)
  location:           string             // REQUIRED — from 39 predefined rooms
  studentIds:         [string]           // Default: [] — student._id references (24-char hex validated)

  attendance: {
    present:          [string]           // Default: [] — student._id references
    absent:           [string]           // Default: []
  }

  notes:              string             // Default: '' (allows null)
  syllabus:           string             // Default: '' (allows null)
  homework:           string             // Default: '' (allows null)
  schoolYearId:       string             // REQUIRED
  isActive:           boolean            // Default: true
  createdAt:          Date
  updatedAt:          Date
}
```

**Valid Categories (14):**
תלמידים חדשים ב-ד, מתחילים, and 12 other Hebrew category names defined in validation.

---

### 6. `bagrut`

**Source files:** `api/bagrut/bagrut.validation.js`, `api/bagrut/bagrut.service.js`

```
bagrut {
  _id:                ObjectId           // Auto-generated
  studentId:          string             // REQUIRED — student._id reference
  teacherId:          string             // REQUIRED — teacher._id reference

  program: [                             // Default: [] — recital program pieces
    {
      pieceNumber:    number             // 1-5, REQUIRED
      pieceTitle:     string | null
      composer:       string | null
      duration:       string | null
      movement:       string | null
      youtubeLink:    string | null      // URI format
    }
  ]

  directorName:       string             // Default: 'לימור אקטע'
  directorEvaluation: {
    points:           number | null      // 0-10
    percentage:       number             // Default: 10
    comments:         string | null
  }

  recitalUnits:       number             // Valid: 3 | 5, Default: 5
  recitalField:       string             // Default: 'קלאסי'
                                         // Valid: קלאסי, ג'אז, שירה, מוסיקה ישראלית, מוסיקה עולמית

  accompaniment: {
    type:             string             // Default: 'נגן מלווה'
                                         // Valid: 'נגן מלווה', 'הרכב'
    accompanists: [
      {
        _id:          ObjectId           // Auto-generated
        name:         string             // REQUIRED
        instrument:   string             // REQUIRED
        phone:        string | null      // Pattern: /^05\d{8}$/
      }
    ]
  }

  presentations: [                       // Max 4 items with specific defaults
    // [0-2]: Notes-based presentations
    {
      completed:      boolean            // Default: false
      status:         string             // Default: 'לא נבחן'
                                         // Valid: עבר/ה, לא עבר/ה, לא נבחן
      date:           Date | null
      review:         string | null
      reviewedBy:     string | null
      lastUpdatedBy:  string | null
      notes:          string | null
      recordingLinks: [string]           // URIs, Default: []
    }
    // [3]: Grade-based presentation
    {
      // ...same as above, plus:
      grade:          number | null      // 0-100
      gradeLevel:     string | null      // מעולה, טוב מאוד, טוב, מספיק, מספיק בקושי, לא עבר/ה
      detailedGrading: {
        playingSkills:        { grade, points (0-40), maxPoints: 40, comments }
        musicalUnderstanding: { grade, points (0-30), maxPoints: 30, comments }
        textKnowledge:        { grade, points (0-20), maxPoints: 20, comments }
        playingByHeart:       { grade, points (0-10), maxPoints: 10, comments }
      }
      pieceGradings: [
        {
          pieceNumber:          number   // 1-5
          pieceTitle:           string
          composer:             string
          playingSkills:        number | null  // 0-40
          musicalUnderstanding: number | null  // 0-30
          textKnowledge:        number | null  // 0-20
          playingByHeart:       boolean        // Default: false
          comments:             string
        }
      ]
    }
  ]

  magenBagrut: {                         // Same structure as presentations[3]
    completed, status, date, review, reviewedBy, lastUpdatedBy,
    grade, gradeLevel, recordingLinks, detailedGrading, pieceGradings
  }

  documents: [                           // Default: []
    {
      _id:            ObjectId
      title:          string             // REQUIRED
      fileUrl:        string             // REQUIRED
      fileKey:        string | null
      uploadDate:     Date               // Default: now
      uploadedBy:     string             // REQUIRED — teacher._id
    }
  ]

  conservatoryName:   string | null
  finalGrade:         number | null      // 0-100
  finalGradeLevel:    string | null      // Grade level enum
  teacherSignature:   string | null
  completionDate:     Date | null
  isCompleted:        boolean            // Default: false
  testDate:           Date | null
  notes:              string | null
  isActive:           boolean            // Default: true
  createdAt:          Date
  updatedAt:          Date
}
```

**Grade Level Scale:**
| Level | Hebrew | Range |
|-------|--------|-------|
| Excellent | מעולה | 95-100 |
| Very Good | טוב מאוד | 90-94 |
| Good | טוב | 75-89 |
| Sufficient | מספיק | 55-74 |
| Barely Sufficient | מספיק בקושי | 45-54 |
| Failed | לא עבר/ה | 0-44 |

---

### 7. `school_year`

**Source files:** `api/school-year/school-year.validation.js`, `api/school-year/school-year.service.js`

```
school_year {
  _id:                ObjectId           // Auto-generated
  name:               string             // REQUIRED — e.g. "2025-2026"
  startDate:          Date               // REQUIRED — typically August 20
  endDate:            Date               // REQUIRED — typically August 1 next year
  isCurrent:          boolean            // Default: false
                                         // CONSTRAINT: Only ONE can be true at a time
                                         // Setting isCurrent=true auto-unsets all others
  isActive:           boolean            // Default: true
  createdAt:          Date
  updatedAt:          Date
}
```

**Special Behavior:**
- `setCurrentSchoolYear()` performs `updateMany({ isCurrent: true }, { $set: { isCurrent: false } })` before setting the new one — **HIGH RISK for multi-tenant** since it affects ALL records globally.

---

### 8. `activity_attendance`

**Source files:** `api/schedule/attendance.service.js`, `api/analytics/attendance.service.js`, `migrations/add-private-lesson-attendance.js`

```
activity_attendance {
  _id:                ObjectId           // Auto-generated
  studentId:          string             // REQUIRED — student._id reference
  teacherId:          string             // REQUIRED — teacher._id reference
  activityType:       string             // REQUIRED
                                         // Valid: 'שיעור פרטי' (private lesson),
                                         //        'תאוריה' (theory),
                                         //        'חזרות' (rehearsal),
                                         //        'תזמורת' (orchestra)
  groupId:            string | null      // Group identifier (teacher ID for private lessons)
  sessionId:          string | null      // Unique session ID (schedule slot for private lessons)
  date:               Date               // REQUIRED — cannot be in the future
  status:             string             // REQUIRED
                                         // Valid: 'pending', 'הגיע/ה' (attended),
                                         //        'לא הגיע/ה' (absent), 'cancelled'
  notes:              string | null      // Max 500 characters
  markedBy:           string | null      // teacher._id who marked attendance
  markedAt:           Date | null        // Timestamp of marking
  metadata:           object | null      // Flexible — additional lesson metadata
  createdAt:          Date
  updatedAt:          Date
}
```

---

## Audit & System Collections

### 9. `deletion_audit`

**Source files:** `services/cascadeDeletion.service.js`, `services/cascadeSystemInitializer.js`

Written when cascade deletion occurs. Each record tracks one deletion or restoration event.

```
deletion_audit {
  _id:                ObjectId
  entityType:         string             // 'student' (currently only type)
  entityId:           ObjectId           // student._id that was deleted
  entityName:         string             // Student's full name
  action:             string             // 'soft_delete' | 'restore'
  deletedBy:          string             // teacher._id who performed deletion
  deletedAt:          Date               // Timestamp of deletion
  reason:             string | null      // Optional reason
  isActive:           boolean            // Default: true

  affectedCollections: {                 // Summary of cascade effects
    teachers: {
      count:          number
      ids:            [ObjectId]
    }
    orchestras: {
      count:          number
      ids:            [ObjectId]
    }
    rehearsals: {
      count:          number
    }
    theoryLessons: {
      count:          number
    }
    bagrut: {
      count:          number
    }
    activityAttendance: {
      count:          number
    }
  }

  details: {                             // Detailed operation results
    studentUpdate:         object
    teacherStudentIds:     object
    teacherTimeBlocks:     object
    orchestraMemberships:  object
    rehearsalAttendance:   object
    theoryLessonStudents:  object
    bagrutRecords:         object
    attendanceRecords:     object
  }

  restoredAt:         Date | null        // Set when restored
  restoredBy:         string | null      // teacher._id who restored
  restoreDetails:     object | null      // Details of restoration operations
}
```

### 10. `deletion_snapshots`

**Source files:** `api/admin/cascade-deletion.service.js`

Pre-deletion snapshots for rollback capability.

```
deletion_snapshots {
  _id:                ObjectId
  entityType:         string             // 'student'
  entityId:           ObjectId
  snapshot:           object             // Full document before deletion
  relatedData:        object             // Related documents from other collections
  createdAt:          Date
}
```

### 11. `security_log`

**Source files:** `api/auth/auth.service.js`

Logs security-relevant authentication events.

```
security_log {
  _id:                ObjectId
  event:              string             // e.g. 'login_success', 'login_failure',
                                         //      'token_refresh', 'password_change'
  userId:             string | null      // teacher._id (null if login failed)
  email:              string             // Email attempted
  ip:                 string | null      // Client IP address
  userAgent:          string | null      // Browser/client identifier
  timestamp:          Date
  details:            object | null      // Additional event-specific data
}
```

### 12. `migration_backups`

**Source files:** `api/schedule/migrate-to-time-blocks.js`

Stores backup data before migration operations.

```
migration_backups {
  _id:                ObjectId
  migrationType:      string             // e.g. 'schedule-to-timeblocks'
  teacherId:          ObjectId
  originalData:       object             // Pre-migration document state
  createdAt:          Date
}
```

### 13. `integrityAuditLog`

**Source files:** `api/admin/data-integrity.service.js`

Records results of data integrity checks.

```
integrityAuditLog {
  _id:                ObjectId
  checkType:          string             // Type of integrity check performed
  timestamp:          Date
  results:            object             // Check results and findings
  fixesApplied:       boolean            // Whether auto-fixes were applied
  details:            object             // Detailed findings
}
```

### 14. `integrityStatus`

**Source files:** `api/admin/data-integrity.service.js`

Tracks the current state of integrity checks.

```
integrityStatus {
  _id:                ObjectId
  lastCheckDate:      Date
  status:             string             // 'healthy', 'issues_found', 'running'
  issueCount:         number
  summary:            object
}
```

---

## Cross-Collection Relationships

```
                    ┌──────────────────────────┐
                    │        school_year        │
                    │   (isCurrent = true)      │
                    └────────────┬─────────────┘
                                 │ schoolYearId
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
          ▼                      ▼                      ▼
   ┌─────────────┐      ┌──────────────┐       ┌──────────────┐
   │   student    │      │   orchestra   │       │   teacher    │
   │              │      │              │       │              │
   │ teacherIds ──┼──────┼──────────────┼───────┤─ studentIds  │
   │ teacherAssign│      │ memberIds ───┼───────┤              │
   │ ments ───────┼──────┼──────────────┼───────┤─ timeBlocks  │
   │              │      │ conductorId ─┼───────┤              │
   │ enrollments. │      │ rehearsalIds │       │ conducting.  │
   │  orchestraIds├──────┤              │       │  orchestraIds│
   │  theoryLesson│      └──────┬───────┘       └──────┬───────┘
   │  Ids ────────┼─────┐       │                      │
   └──────┬───────┘     │       │                      │
          │             │       │                      │
          │             ▼       ▼                      │
          │      ┌──────────────┐                      │
          │      │  theory_lesson│◄─────────────────────┘
          │      │  .studentIds  │   (teacherId)
          │      │  .teacherId   │
          │      └───────────────┘
          │
          │      ┌───────────────┐
          │      │   rehearsal    │
          │      │  .groupId ────┼──── orchestra._id
          │      │  .attendance  │
          │      └───────────────┘
          │
          │      ┌───────────────┐
          ├─────►│    bagrut     │
          │      │  .studentId   │
          │      │  .teacherId ──┼──── teacher._id
          │      └───────────────┘
          │
          ▼
   ┌────────────────────┐
   │ activity_attendance │
   │  .studentId         │
   │  .teacherId         │
   │  .sessionId         │
   │  .groupId           │
   └────────────────────┘
```

### Relationship Details

| From | Field | To | Cardinality |
|------|-------|----|-------------|
| student.teacherIds | → | teacher._id | Many-to-Many |
| student.teacherAssignments[].teacherId | → | teacher._id | Many-to-Many |
| student.enrollments.orchestraIds | → | orchestra._id | Many-to-Many |
| student.enrollments.theoryLessonIds | → | theory_lesson._id | Many-to-Many |
| student.enrollments.schoolYears[].schoolYearId | → | school_year._id | Many-to-Many |
| student.academicInfo.tests.bagrutId | → | bagrut._id | One-to-One |
| teacher.teaching.studentIds | → | student._id | Many-to-Many |
| teacher.teaching.timeBlocks[].assignedLessons[].studentId | → | student._id | Nested |
| teacher.conducting.orchestraIds | → | orchestra._id | One-to-Many |
| orchestra.conductorId | → | teacher._id | Many-to-One |
| orchestra.memberIds | → | student._id | Many-to-Many |
| orchestra.rehearsalIds | → | rehearsal._id | One-to-Many |
| rehearsal.groupId | → | orchestra._id | Many-to-One |
| theory_lesson.teacherId | → | teacher._id | Many-to-One |
| theory_lesson.studentIds | → | student._id | Many-to-Many |
| bagrut.studentId | → | student._id | Many-to-One |
| bagrut.teacherId | → | teacher._id | Many-to-One |
| activity_attendance.studentId | → | student._id | Many-to-One |
| activity_attendance.teacherId | → | teacher._id | Many-to-One |

---

## Data Duplication Map

Student-Teacher enrollment is stored in **4 places** (critical for consistency):

| # | Location | Field | Direction |
|---|----------|-------|-----------|
| 1 | `teacher.teaching.studentIds` | [student._id] | Teacher → Students |
| 2 | `teacher.teaching.timeBlocks[].assignedLessons[]` | { studentId } | Teacher → Student (nested) |
| 3 | `student.teacherIds` | [teacher._id] | Student → Teachers (LEGACY) |
| 4 | `student.teacherAssignments[]` | { teacherId, ... } | Student → Teachers (SOURCE OF TRUTH) |

**Source of Truth:** `student.teacherAssignments` is the authoritative record.

Orchestra membership is stored in **2 places:**

| # | Location | Field |
|---|----------|-------|
| 1 | `orchestra.memberIds` | [student._id] |
| 2 | `student.enrollments.orchestraIds` | [orchestra._id] |

Theory enrollment is stored in **2 places:**

| # | Location | Field |
|---|----------|-------|
| 1 | `theory_lesson.studentIds` | [student._id] |
| 2 | `student.enrollments.theoryLessonIds` | [theory_lesson._id] |

---

## Indexes

### Defined in code (`migrations/add-private-lesson-attendance.js`):

**`activity_attendance` collection:**
```
{ studentId: 1, activityType: 1, date: -1 }        // student_activity_date
{ teacherId: 1, activityType: 1, date: -1 }        // teacher_activity_date
{ sessionId: 1, studentId: 1, date: 1 }            // session_lookup (UNIQUE)
{ groupId: 1, activityType: 1, date: -1 }          // group_activity_date
{ status: 1, date: -1 }                             // status_date
{ date: -1 }                                        // date_desc
```

### Defined in `services/cascadeSystemInitializer.js`:

**`deletion_audit` collection:**
```
{ entityId: 1 }
{ deletedAt: -1 }
{ entityType: 1, isActive: 1 }
```

### Implicit unique indexes:

**`teacher` collection:**
```
{ 'credentials.email': 1 }                          // UNIQUE — one email per teacher
```

---

## Collection Naming Inconsistencies

**KNOWN BUGS** — Some files use incorrect plural collection names:

| File | Uses | Should Be |
|------|------|-----------|
| `api/admin/cascade-deletion.service.js` | `students` (3x) | `student` |
| `api/admin/cascade-deletion.controller.js` | `students` (2x) | `student` |
| `api/admin/data-integrity.service.js` | `students` (2x) | `student` |
| `api/admin/data-integrity.service.js` | `orchestras` (1x) | `orchestra` |

**Audit collection name variants** (should be unified):

| Canonical Name | Variants Found |
|---------------|----------------|
| `deletion_audit` | `deletionAuditLog` (cascade-deletion.service.js), `audit_logs` (services/cascadeDeletionService.js) |
| `deletion_snapshots` | `deletionSnapshots` (cascade-deletion.service.js, cascade-deletion.controller.js) |

**Questionable collections** (referenced but may not exist):

| Collection | File | Notes |
|-----------|------|-------|
| `privateLessons` | data-integrity.service.js | Only in orphan detection, likely doesn't exist |
| `privateAttendance` | data-integrity.service.js | Only in orphan detection, likely doesn't exist |
