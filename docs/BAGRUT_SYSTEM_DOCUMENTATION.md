# Bagrut System Documentation

## Overview

This document provides comprehensive system documentation for the updated Bagrut (בגרות) system, including data dictionary, business rules, system architecture, and technical specifications aligned with the official Ministry of Education requirements.

## Table of Contents

1. [Data Dictionary](#data-dictionary)
2. [Business Rules](#business-rules)
3. [System Architecture](#system-architecture)
4. [Database Schema](#database-schema)
5. [API Architecture](#api-architecture)
6. [Security Considerations](#security-considerations)
7. [Performance Specifications](#performance-specifications)
8. [Monitoring and Logging](#monitoring-and-logging)

## Data Dictionary

### Core Entities

#### Bagrut Document
| Field | Type | Description | Validation | Default | Notes |
|-------|------|-------------|------------|---------|-------|
| `_id` | ObjectId | Unique document identifier | MongoDB ObjectId | Auto-generated | Primary key |
| `studentId` | String | Student identifier | Required, valid ObjectId reference | - | References student collection |
| `teacherId` | String | Primary teacher identifier | Required, valid ObjectId reference | - | References teacher collection |
| `conservatoryName` | String | Name of conservatory | Max 200 chars | "" | Official institution name |
| `schoolYear` | String | Academic year | Format: YYYY | Current year | e.g., "2025" |
| `isActive` | Boolean | Document active status | - | true | Soft delete mechanism |
| `directorName` | String | Director's name | Max 100 chars | "לימור אקטע" | Ministry official |
| `recitalUnits` | Number | Recital unit count | Enum: [3, 5] | 5 | **Required for completion** |
| `recitalField` | String | Recital field category | Enum: ["קלאסי", "ג'אז", "שירה"] | "קלאסי" | **Required for completion** |
| `finalGrade` | Number | Final calculated grade | 0-100, calculated | null | **90/10 split with director** |
| `finalGradeLevel` | String | Hebrew grade level | Auto-derived from finalGrade | null | e.g., "מעולה", "טוב מאוד" |
| `isCompleted` | Boolean | Completion status | - | false | Requires all validations |
| `completionDate` | Date | Date of completion | ISO Date | null | Set when isCompleted=true |
| `teacherSignature` | String | Teacher's signature | Max 200 chars | "" | Required for completion |
| `createdAt` | Date | Creation timestamp | ISO Date | Auto-generated | - |
| `updatedAt` | Date | Last update timestamp | ISO Date | Auto-updated | - |

#### Director Evaluation (New)
| Field | Type | Description | Validation | Default | Notes |
|-------|------|-------------|------------|---------|-------|
| `points` | Number | Director's evaluation score | 0-10, integer, nullable | null | **10% of final grade** |
| `percentage` | Number | Weight in final grade | - | 10 | Fixed at 10% |
| `comments` | String | Director's comments | Max 500 chars | "" | Optional qualitative feedback |

#### Presentation Array (4 presentations: 0-3)
| Field | Type | Description | Validation | Default | Notes |
|-------|------|-------------|------------|---------|-------|
| `completed` | Boolean | Presentation completion status | - | false | - |
| `status` | String | Current status | Hebrew status terms | "לא התחיל" | e.g., "הוגש", "נבדק" |
| `date` | Date | Presentation date | ISO Date | null | - |
| `reviewedBy` | String | Reviewer teacher ID | Valid ObjectId reference | null | - |
| `notes` | String | Presentation notes | Max 1000 chars | "" | For presentations 0-2 |
| `recordingLinks` | Array[String] | Recording URLs | Valid URLs | [] | YouTube, Vimeo links |
| `grade` | Number | Presentation grade | 0-100 | null | **Only for presentation 3** |
| `gradeLevel` | String | Hebrew grade level | Auto-derived | null | **Only for presentation 3** |
| `detailedGrading` | Object | Detailed grading breakdown | See below | - | **Only for presentation 3** |

#### Detailed Grading (New Point System)
| Category | Field | Type | Max Points | Old Max | Description |
|----------|-------|------|------------|---------|-------------|
| `playingSkills` | `points` | Number | **40** | 20 | **+100% increase** |
| | `maxPoints` | Number | 40 | 20 | Fixed maximum |
| | `grade` | String | - | - | Hebrew qualitative grade |
| | `comments` | String | - | - | Max 300 chars |
| `musicalUnderstanding` | `points` | Number | **30** | 40 | **-25% decrease** |
| | `maxPoints` | Number | 30 | 40 | Fixed maximum |
| | `grade` | String | - | - | Hebrew qualitative grade |
| | `comments` | String | - | - | Max 300 chars |
| `textKnowledge` | `points` | Number | **20** | 30 | **-33% decrease** |
| | `maxPoints` | Number | 20 | 30 | Fixed maximum |
| | `grade` | String | - | - | Hebrew qualitative grade |
| | `comments` | String | - | - | Max 300 chars |
| `playingByHeart` | `points` | Number | **10** | 10 | **No change** |
| | `maxPoints` | Number | 10 | 10 | Fixed maximum |
| | `grade` | String | - | - | Hebrew qualitative grade |
| | `comments` | String | - | - | Max 300 chars |

#### Program Array (5 pieces required)
| Field | Type | Description | Validation | Default | Notes |
|-------|------|-------------|------------|---------|-------|
| `_id` | ObjectId | Piece identifier | Auto-generated | - | Unique per piece |
| `pieceNumber` | Number | Order in program | 1-5, required | - | **New field for ordering** |
| `composer` | String | Composer name | Required, max 200 chars | - | Hebrew/English accepted |
| `pieceTitle` | String | Title of piece | Required, max 300 chars | - | Hebrew/English accepted |
| `movement` | String | Movement specification | Max 200 chars | "" | **New optional field** |
| `duration` | String | Piece duration | Pattern: MM:SS or HH:MM:SS | - | e.g., "15:30" or "1:15:30" |
| `youtubeLink` | String | YouTube recording | Valid URL or null | null | Optional reference recording |

### System Constants

#### Grade Level Categories
| Hebrew | English | Range | Code |
|--------|---------|-------|------|
| מעולה מאוד | Excellent Plus | 95-100 | A+ |
| מעולה | Excellent | 90-94 | A |
| טוב מאוד | Very Good | 85-89 | B+ |
| טוב | Good | 80-84 | B |
| כמעט טוב | Nearly Good | 75-79 | C+ |
| מספיק | Sufficient | 65-74 | C |
| כמעט מספיק | Nearly Sufficient | 55-64 | D |
| לא מספיק | Insufficient | 0-54 | F |

#### Status Terms
| Hebrew | English | Context |
|--------|---------|---------|
| לא התחיל | Not Started | Initial state |
| בעיבוד | In Progress | Work in progress |
| הוגש | Submitted | Submitted for review |
| נבדק | Under Review | Being reviewed |
| אושר | Approved | Approved by reviewer |
| הושלם | Completed | Fully completed |
| נדחה | Rejected | Rejected/needs revision |
| דורש תיקון | Needs Revision | Requires corrections |

## Business Rules

### Grade Calculation Rules

#### 1. Final Grade Calculation (90/10 Split)
```
Final Grade = (Performance Grade × 0.9) + (Director Evaluation Points)

Where:
- Performance Grade: Sum of detailed grading categories (0-100)
- Director Evaluation Points: Director's score (0-10)

Example:
Performance Grade: 85 points
Director Evaluation: 8 points
Final Grade = (85 × 0.9) + 8 = 76.5 + 8 = 84.5 ≈ 85 points
```

#### 2. Performance Grade Calculation
```
Performance Grade = playingSkills.points + 
                   musicalUnderstanding.points + 
                   textKnowledge.points + 
                   playingByHeart.points

Maximum: 40 + 30 + 20 + 10 = 100 points
```

#### 3. Grade Level Assignment
- Automatically assigned based on final grade
- Uses 8-level system as defined by Ministry of Education
- Cannot be manually overridden

### Validation Rules

#### 1. Completion Requirements
A bagrut can only be marked as completed when:
- ✅ Director evaluation is set (points 0-10)
- ✅ Recital configuration is complete (units: 3 or 5, field: קלאסי/ג'אז/שירה)
- ✅ All 5 program pieces are entered
- ✅ Final presentation (index 3) is completed with detailed grading
- ✅ Teacher signature is provided

#### 2. Point Allocation Limits
- Playing Skills: 0-40 points (strict validation)
- Musical Understanding: 0-30 points (strict validation)
- Text Knowledge: 0-20 points (strict validation)
- Playing by Heart: 0-10 points (strict validation)
- Director Evaluation: 0-10 points (strict validation)

#### 3. Program Requirements
- Exactly 5 pieces required
- Each piece must have: pieceNumber (1-5), composer, pieceTitle, duration
- Duration must match pattern: /^(\d{1,2}:)?\d{1,2}:\d{2}$/
- YouTube links must be valid URLs if provided

### Workflow Rules

#### 1. Presentation Sequence
- Presentations 0-2: Regular presentations (no grading, notes only)
- Presentation 3: Final assessment (detailed grading required)
- Must complete in sequence (0→1→2→3)

#### 2. Director Evaluation Timing
- Can be set at any time after creation
- Required before completion
- Automatically triggers final grade recalculation

#### 3. Grade Recalculation Triggers
- When detailed grading is updated
- When director evaluation is updated
- Automatic, no manual intervention needed

## System Architecture

### High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Database      │
│                 │    │                 │    │                 │
│ • React/Vue     │◄──►│ • Express.js    │◄──►│ • MongoDB       │
│ • Form Handling │    │ • REST API      │    │ • GridFS        │
│ • Validation    │    │ • Authentication│    │ • Indexes       │
│ • State Mgmt    │    │ • Authorization │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                               │
                               ▼
                    ┌─────────────────┐
                    │   Services      │
                    │                 │
                    │ • File Storage  │
                    │ • Email Notify  │
                    │ • Grade Calc    │
                    │ • Validation    │
                    └─────────────────┘
```

### Component Architecture

#### API Layer
```
/api/bagrut/
├── bagrut.controller.js     # Request handlers
├── bagrut.service.js        # Business logic
├── bagrut.validation.js     # Data validation & calculations
├── bagrut.route.js          # Route definitions
└── __tests__/               # Test suite
    ├── bagrut.controller.test.js
    ├── bagrut.service.test.js
    └── bagrut.validation.test.js
```

#### Service Dependencies
- **MongoDB Service**: Database connection and operations
- **File Storage Service**: Document and recording uploads
- **Authentication Service**: User verification and authorization
- **Email Service**: Notifications and completion alerts

### Data Flow Architecture

```
User Request
    ↓
Middleware Chain
    ├── Authentication (requireAuth)
    ├── Authorization (authorizeBagrutAccess)
    └── Validation (Joi schemas)
    ↓
Controller Layer
    ├── Request parsing
    ├── Business validation
    └── Response formatting
    ↓
Service Layer
    ├── Business logic
    ├── Grade calculations
    └── Data transformations
    ↓
Database Layer
    ├── MongoDB operations
    ├── Transaction handling
    └── Index optimization
    ↓
Response
```

## Database Schema

### MongoDB Collection: `bagrut`

#### Indexes
```javascript
// Compound indexes for performance
db.bagrut.createIndex({ "studentId": 1, "isActive": 1 });
db.bagrut.createIndex({ "teacherId": 1, "schoolYear": 1 });
db.bagrut.createIndex({ "isCompleted": 1, "completionDate": 1 });
db.bagrut.createIndex({ "recitalField": 1, "recitalUnits": 1 });

// Text search index
db.bagrut.createIndex({ 
  "conservatoryName": "text", 
  "directorName": "text" 
});

// Sparse indexes for nullable fields
db.bagrut.createIndex({ "finalGrade": 1 }, { sparse: true });
db.bagrut.createIndex({ "completionDate": 1 }, { sparse: true });
```

#### Schema Validation
```javascript
const bagrutSchema = {
  $jsonSchema: {
    bsonType: "object",
    required: ["studentId", "teacherId", "recitalUnits", "recitalField"],
    properties: {
      studentId: { bsonType: "string" },
      teacherId: { bsonType: "string" },
      recitalUnits: { 
        bsonType: "int",
        enum: [3, 5]
      },
      recitalField: {
        bsonType: "string",
        enum: ["קלאסי", "ג'אז", "שירה"]
      },
      directorEvaluation: {
        bsonType: "object",
        properties: {
          points: { 
            bsonType: ["int", "null"],
            minimum: 0,
            maximum: 10
          },
          percentage: { 
            bsonType: "int",
            minimum: 10,
            maximum: 10
          },
          comments: { bsonType: "string" }
        }
      },
      presentations: {
        bsonType: "array",
        maxItems: 4,
        items: {
          bsonType: "object",
          properties: {
            detailedGrading: {
              bsonType: "object",
              properties: {
                playingSkills: {
                  bsonType: "object",
                  properties: {
                    points: { bsonType: "int", minimum: 0, maximum: 40 },
                    maxPoints: { bsonType: "int", minimum: 40, maximum: 40 }
                  }
                },
                musicalUnderstanding: {
                  bsonType: "object",
                  properties: {
                    points: { bsonType: "int", minimum: 0, maximum: 30 },
                    maxPoints: { bsonType: "int", minimum: 30, maximum: 30 }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};
```

### Data Relationships

#### Entity Relationship Diagram
```
Student (1) ──────► (1) Bagrut ◄────── (1) Teacher
    │                   │                   │
    │                   │                   │
    ▼                   ▼                   ▼
[Profile Data]    [Presentations]    [Credentials]
[Contact Info]    [Program Pieces]   [Permissions]
[Enrollment]      [Documents]        [Schedule]
                  [Final Grade]
                       │
                       ▼
                [Director Evaluation]
                [Grade Calculation]
```

#### Reference Integrity
- `studentId` → References `students` collection
- `teacherId` → References `teachers` collection
- `presentations[].reviewedBy` → References `teachers` collection
- Soft deletes used (isActive flag) to maintain referential integrity

## API Architecture

### RESTful Endpoint Design

#### Resource Hierarchy
```
/api/bagrut                           # Collection operations
├── GET /                             # List bagruts (filtered)
├── POST /                            # Create new bagrut
├── /{id}                            # Individual bagrut operations
│   ├── GET /                        # Get bagrut details
│   ├── PUT /                        # Update bagrut
│   ├── DELETE /                     # Delete bagrut
│   └── /directorEvaluation          # NEW: Director evaluation
│       └── PUT /                    # Update director evaluation
│   └── /recitalConfiguration        # NEW: Recital config
│       └── PUT /                    # Set recital configuration
│   └── /gradingDetails              # Enhanced: Updated validation
│       └── PUT /                    # Update detailed grading
│   └── /calculateFinalGrade         # Enhanced: 90/10 calculation
│       └── PUT /                    # Recalculate with director eval
│   └── /complete                    # Enhanced: New requirements
│       └── PUT /                    # Complete with validations
│   └── /presentation/{index}        # Presentation management
│       └── PUT /                    # Update specific presentation
│   └── /program                     # Program management
│       ├── GET /                    # Get program
│       ├── PUT /                    # Update entire program
│       └── POST /                   # Add program piece
│   └── /document/{id}               # Document management
│       ├── POST /                   # Upload document
│       └── DELETE /                 # Remove document
```

#### HTTP Status Codes
- `200 OK`: Successful GET/PUT operations
- `201 Created`: Successful POST operations
- `400 Bad Request`: Validation errors, business rule violations
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Authorization failed
- `404 Not Found`: Resource not found
- `409 Conflict`: Duplicate resource, state conflict
- `422 Unprocessable Entity`: Semantic validation errors
- `500 Internal Server Error`: Unexpected server errors

### Authentication & Authorization

#### Authentication Middleware
```javascript
requireAuth(['מנהל', 'מורה'])
```
- JWT-based authentication
- Role-based access control
- Hebrew role names for cultural appropriateness

#### Authorization Rules
- **Managers (מנהל)**: Full access to all bagruts
- **Teachers (מורה)**: Access only to their assigned bagruts
- **Students**: Read-only access to their own bagrut

#### Authorization Middleware
```javascript
authorizeBagrutAccess
```
- Validates user can access specific bagrut
- Checks teacher assignment or admin privileges
- Prevents unauthorized cross-access

## Security Considerations

### Data Protection

#### Input Validation
- **Joi Schema Validation**: All inputs validated against strict schemas
- **SQL Injection Prevention**: MongoDB parameterized queries only
- **XSS Prevention**: Input sanitization and output encoding
- **File Upload Security**: Type validation, size limits, virus scanning

#### Authentication Security
- **JWT Tokens**: Stateless authentication with expiration
- **Password Hashing**: bcrypt with salt rounds
- **Rate Limiting**: API endpoint throttling
- **Session Management**: Secure token storage and rotation

#### Authorization Security
- **Role-Based Access**: Granular permission system
- **Resource-Level Authorization**: Per-bagrut access control
- **Audit Logging**: All access attempts logged
- **Principle of Least Privilege**: Minimal necessary permissions

### Data Integrity

#### Validation Layers
1. **Client-Side**: Immediate user feedback
2. **API Gateway**: Request validation
3. **Business Logic**: Domain rule enforcement
4. **Database**: Schema constraints

#### Backup and Recovery
- **Automated Backups**: Daily full backups
- **Point-in-Time Recovery**: Transaction log backups
- **Migration Safety**: Backup before schema changes
- **Disaster Recovery**: Cross-region backup replication

## Performance Specifications

### Response Time Requirements
- **List Operations**: < 500ms for up to 100 results
- **Individual Operations**: < 200ms for single bagrut
- **Grade Calculations**: < 100ms for complex calculations
- **File Uploads**: < 2s for 10MB files

### Scalability Targets
- **Concurrent Users**: 100 simultaneous users
- **Data Volume**: 10,000 bagrut documents
- **API Throughput**: 1,000 requests per minute
- **Storage Growth**: 100MB per month

### Optimization Strategies

#### Database Optimization
- **Compound Indexes**: Optimized for common query patterns
- **Query Optimization**: Aggregation pipeline efficiency
- **Connection Pooling**: Efficient database connections
- **Read Replicas**: Distribute read load

#### API Optimization
- **Response Caching**: 5-minute cache for read operations
- **Compression**: Gzip compression for large responses
- **Pagination**: Limit result sets to manageable sizes
- **Field Selection**: Return only requested fields

#### Frontend Optimization
- **Client-Side Caching**: Cache bagrut data locally
- **Lazy Loading**: Load sections on demand
- **Batch Operations**: Combine multiple API calls
- **Progressive Enhancement**: Graceful degradation

## Monitoring and Logging

### Application Monitoring

#### Key Performance Indicators (KPIs)
- **Response Time**: P50, P95, P99 percentiles
- **Error Rate**: 4xx and 5xx error percentages
- **Throughput**: Requests per minute by endpoint
- **Availability**: Uptime percentage (target: 99.9%)

#### Business Metrics
- **Completion Rate**: Percentage of bagruts completed
- **Grade Distribution**: Statistical analysis of grades
- **User Activity**: Active users per day/week/month
- **Director Evaluation Coverage**: Percentage with evaluations

### Logging Strategy

#### Log Levels
- **ERROR**: System errors, exceptions, failures
- **WARN**: Business rule violations, validation failures
- **INFO**: User actions, state changes, completions
- **DEBUG**: Detailed execution flow (development only)

#### Log Structure
```json
{
  "timestamp": "2025-08-29T14:30:00.000Z",
  "level": "INFO",
  "service": "bagrut-api",
  "operation": "updateDirectorEvaluation",
  "bagrutId": "64f7b8c123456789abcdef01",
  "userId": "teacher123",
  "duration": 150,
  "status": "success",
  "metadata": {
    "previousPoints": 7,
    "newPoints": 8,
    "gradeChange": true
  }
}
```

#### Security Logging
- **Authentication Attempts**: Success/failure with details
- **Authorization Violations**: Unauthorized access attempts
- **Data Modifications**: All changes to bagrut data
- **Admin Actions**: Administrative operations

### Alerting System

#### Alert Conditions
- **High Error Rate**: >5% errors in 5-minute window
- **Slow Response Time**: P95 > 1000ms for 5 minutes
- **Failed Authentication**: >10 failures from same IP
- **Database Issues**: Connection failures, timeout errors
- **Business Rule Violations**: Grade calculation errors

#### Alert Channels
- **Email**: Immediate alerts to operations team
- **Slack**: Real-time notifications to development channel
- **SMS**: Critical alerts for on-call engineers
- **Dashboard**: Visual monitoring for continuous oversight

### Health Checks

#### System Health Endpoints
- `/api/health`: Basic application health
- `/api/health/database`: Database connectivity
- `/api/health/dependencies`: External service status
- `/api/admin/date-monitoring/health-check`: Comprehensive validation

#### Health Check Response
```json
{
  "status": "healthy",
  "timestamp": "2025-08-29T14:30:00.000Z",
  "uptime": 86400,
  "version": "2.1.0",
  "database": {
    "status": "connected",
    "responseTime": 15
  },
  "services": {
    "fileStorage": "healthy",
    "emailService": "healthy"
  },
  "metrics": {
    "activeConnections": 25,
    "memoryUsage": "68%",
    "cpuUsage": "12%"
  }
}
```

This comprehensive system documentation provides a complete reference for the updated Bagrut system architecture, ensuring maintainability, scalability, and compliance with Ministry of Education requirements.