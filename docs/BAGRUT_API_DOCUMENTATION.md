# Bagrut API Documentation - Official Form Implementation

## Overview

This documentation covers the complete Bagrut (בגרות) API implementation, updated to align with the official Ministry of Education requirements. The system now features a 90/10 grading split with director evaluation, enhanced validation, and comprehensive Hebrew/English error handling.

## Table of Contents

1. [API Endpoints](#api-endpoints)
2. [Data Models](#data-models)
3. [Grading System](#grading-system)
4. [Validation Rules](#validation-rules)
5. [Error Handling](#error-handling)
6. [Examples](#examples)

## API Endpoints

### Core Bagrut Operations

#### GET /api/bagrut
**Description:** Retrieve all bagrut documents with filtering options

**Query Parameters:**
- `studentId` (string, optional): Filter by specific student
- `teacherId` (string, optional): Filter by teacher
- `isActive` (boolean, optional): Filter by active status
- `showInactive` (boolean, optional): Include inactive bagrut documents

**Response:**
```json
[
  {
    "_id": "64f7b8c123456789abcdef01",
    "studentId": "student123",
    "teacherId": "teacher456",
    "isActive": true,
    "conservatoryName": "קונסרבטוריון ירושלים",
    "schoolYear": "2025",
    "directorName": "לימור אקטע",
    "recitalUnits": 5,
    "recitalField": "קלאסי",
    "createdAt": "2025-08-01T10:00:00.000Z",
    "updatedAt": "2025-08-02T14:30:00.000Z"
  }
]
```

#### GET /api/bagrut/:id
**Description:** Get a specific bagrut document by ID

**Parameters:**
- `id` (string, required): Bagrut document ID

**Response:**
```json
{
  "_id": "64f7b8c123456789abcdef01",
  "studentId": "student123",
  "teacherId": "teacher456",
  "presentations": [
    {
      "completed": true,
      "status": "הוגש",
      "date": "2025-07-15T16:00:00.000Z",
      "reviewedBy": "teacher456",
      "notes": "מצגת מצוינת עם הבנה עמוקה של החומר"
    }
  ],
  "program": [
    {
      "_id": "64f7b8c123456789abcdef02",
      "pieceNumber": 1,
      "composer": "בטהובן",
      "pieceTitle": "סונטה לאור הירח",
      "movement": "הרגה ראשונה",
      "duration": "15:00",
      "youtubeLink": "https://youtube.com/watch?v=..."
    }
  ],
  "directorEvaluation": {
    "points": 8,
    "percentage": 10,
    "comments": "ביצוע מעולה עם טכניקה מתקדמת"
  },
  "finalGrade": 89,
  "finalGradeLevel": "מעולה",
  "isCompleted": false
}
```

#### POST /api/bagrut
**Description:** Create a new bagrut document

**Request Body:**
```json
{
  "studentId": "student123",
  "teacherId": "teacher456",
  "conservatoryName": "קונסרבטוריון ירושלים",
  "schoolYear": "2025",
  "recitalUnits": 5,
  "recitalField": "קלאסי"
}
```

#### PUT /api/bagrut/:id
**Description:** Update an existing bagrut document

### Presentation Management

#### PUT /api/bagrut/:id/presentation/:presentationIndex
**Description:** Update a specific presentation (0-3)

**Parameters:**
- `id` (string, required): Bagrut document ID
- `presentationIndex` (number, required): Presentation index (0-3)

**Request Body (Presentations 0-2):**
```json
{
  "completed": true,
  "status": "הוגש",
  "notes": "מצגת מצוינת עם הבנה עמוקה של החומר",
  "recordingLinks": [
    "https://youtube.com/watch?v=recording1"
  ]
}
```

**Request Body (Presentation 3 - Final Assessment):**
```json
{
  "completed": true,
  "status": "הוערך",
  "grade": 85,
  "gradeLevel": "טוב מאוד",
  "detailedGrading": {
    "playingSkills": {
      "grade": "מעולה",
      "points": 36,
      "maxPoints": 40,
      "comments": "טכניקה מתקדמת ובקרה מלאה"
    },
    "musicalUnderstanding": {
      "grade": "טוב מאוד",
      "points": 26,
      "maxPoints": 30,
      "comments": "הבנה טובה של המבנה המוזיקלי"
    },
    "textKnowledge": {
      "grade": "טוב",
      "points": 14,
      "maxPoints": 20,
      "comments": "הכרת הטקסט בסיסית"
    },
    "playingByHeart": {
      "grade": "מעולה",
      "points": 9,
      "maxPoints": 10,
      "comments": "זיכרון מוזיקלי מצוין"
    }
  }
}
```

### New Functionality - Director Evaluation

#### PUT /api/bagrut/:id/directorEvaluation
**Description:** Update director evaluation (10% of final grade)

**Parameters:**
- `id` (string, required): Bagrut document ID

**Request Body:**
```json
{
  "points": 8,
  "comments": "ביצוע מעולה עם יצירתיות וביטוי אישי"
}
```

**Response:**
```json
{
  "_id": "64f7b8c123456789abcdef01",
  "directorEvaluation": {
    "points": 8,
    "percentage": 10,
    "comments": "ביצוע מעולה עם יצירתיות וביטוי אישי"
  },
  "finalGrade": 89,
  "finalGradeLevel": "מעולה",
  "updatedAt": "2025-08-02T14:30:00.000Z"
}
```

**Validation:**
- `points`: Required, must be a number between 0-10
- `comments`: Optional string

**Error Responses:**
```json
{
  "error": "נקודות הערכת מנהל חייבות להיות בין 0 ל-10",
  "errorEn": "Director evaluation points must be between 0 and 10"
}
```

### New Functionality - Recital Configuration

#### PUT /api/bagrut/:id/recitalConfiguration
**Description:** Set recital units and field configuration

**Parameters:**
- `id` (string, required): Bagrut document ID

**Request Body:**
```json
{
  "units": 5,
  "field": "קלאסי"
}
```

**Validation:**
- `units`: Required, must be 3 or 5
- `field`: Required, must be one of ["קלאסי", "ג'אז", "שירה"]

**Response:**
```json
{
  "_id": "64f7b8c123456789abcdef01",
  "recitalUnits": 5,
  "recitalField": "קלאסי",
  "updatedAt": "2025-08-02T14:30:00.000Z"
}
```

### Updated Grading System

#### PUT /api/bagrut/:id/gradingDetails
**Description:** Update detailed grading with new point allocations

**Enhanced Validation:**
- `playingSkills`: Max 40 points (was 20)
- `musicalUnderstanding`: Max 30 points (was 40)  
- `textKnowledge`: Max 20 points (was 30)
- `playingByHeart`: Max 10 points (unchanged)

**Request Body:**
```json
{
  "technique": {
    "grade": 18,
    "maxPoints": 20,
    "comments": "טכניקה מצוינת"
  },
  "interpretation": {
    "grade": 25,
    "maxPoints": 30,
    "comments": "פרשנות מעמיקה ורגשית"
  },
  "musicality": {
    "grade": 35,
    "maxPoints": 40,
    "comments": "מוזיקליות גבוהה"
  },
  "overall": {
    "grade": 9,
    "maxPoints": 10,
    "comments": "ביצוע כללי מרשים"
  },
  "detailedGrading": {
    "playingSkills": {
      "points": 36,
      "maxPoints": 40,
      "comments": "כישורי נגינה מתקדמים"
    },
    "musicalUnderstanding": {
      "points": 26,
      "maxPoints": 30,
      "comments": "הבנה מוזיקלית טובה"
    },
    "textKnowledge": {
      "points": 16,
      "maxPoints": 20,
      "comments": "הכרת טקסט יסודית"
    },
    "playingByHeart": {
      "points": 9,
      "maxPoints": 10,
      "comments": "נגינה בעל פה מעולה"
    }
  }
}
```

#### PUT /api/bagrut/:id/calculateFinalGrade
**Description:** Calculate final grade with director evaluation (90/10 split)

**New Calculation Formula:**
```
Final Grade = (Performance Grade × 0.9) + (Director Evaluation Points)
```

### Program Management

#### POST /api/bagrut/:id/program
**Description:** Add a program piece

**Request Body:**
```json
{
  "pieceNumber": 1,
  "composer": "מוצרט",
  "pieceTitle": "קונצ'רטו לפסנתר מס' 21",
  "movement": "הרגה ראשונה",
  "duration": "12:30",
  "youtubeLink": "https://youtube.com/watch?v=..."
}
```

**Enhanced Validation:**
- `pieceNumber`: Required, must be 1-5
- `composer`: Required string
- `pieceTitle`: Required string
- `movement`: Optional string (new field)
- `duration`: Required string
- `youtubeLink`: Optional valid URI

#### PUT /api/bagrut/:id/program
**Description:** Update entire program (all 5 pieces)

#### DELETE /api/bagrut/:id/program/:pieceId
**Description:** Remove a specific program piece

### Document Management

#### POST /api/bagrut/:id/document
**Description:** Upload a document to the bagrut

#### DELETE /api/bagrut/:id/document/:documentId
**Description:** Remove a document from the bagrut

### Completion Process

#### PUT /api/bagrut/:id/complete
**Description:** Mark bagrut as completed

**Enhanced Validation:**
- Director evaluation must be completed (points 0-10)
- Recital units must be configured
- All 5 program pieces must be entered
- Final presentation must be graded

**Request Body:**
```json
{
  "teacherSignature": "רחל כהן - מורה לפסנתר"
}
```

## Data Models

### Bagrut Document Structure

```javascript
{
  "_id": ObjectId,
  "studentId": String, // Required
  "teacherId": String, // Required
  "conservatoryName": String, // Default: ""
  "schoolYear": String, // Default: current year
  "isActive": Boolean, // Default: true
  
  // New Official Form Fields
  "directorName": String, // Default: "לימור אקטע"
  "directorEvaluation": {
    "points": Number, // 0-10, nullable
    "percentage": Number, // Default: 10
    "comments": String // Default: ""
  },
  "recitalUnits": Number, // 3 or 5, required
  "recitalField": String, // "קלאסי" | "ג'אז" | "שירה", required
  
  // Presentations (4 total: 0-2 regular, 3 final assessment)
  "presentations": [
    {
      "completed": Boolean,
      "status": String,
      "date": Date,
      "reviewedBy": String,
      "notes": String, // For presentations 0-2
      "recordingLinks": [String],
      
      // Only for presentation 3 (final assessment)
      "grade": Number,
      "gradeLevel": String,
      "detailedGrading": {
        "playingSkills": {
          "grade": String,
          "points": Number, // Max 40
          "maxPoints": Number, // 40
          "comments": String
        },
        "musicalUnderstanding": {
          "grade": String,
          "points": Number, // Max 30
          "maxPoints": Number, // 30
          "comments": String
        },
        "textKnowledge": {
          "grade": String,
          "points": Number, // Max 20
          "maxPoints": Number, // 20
          "comments": String
        },
        "playingByHeart": {
          "grade": String,
          "points": Number, // Max 10
          "maxPoints": Number, // 10
          "comments": String
        }
      }
    }
  ],
  
  // Program (5 pieces required)
  "program": [
    {
      "_id": ObjectId,
      "pieceNumber": Number, // 1-5, required
      "composer": String, // Required
      "pieceTitle": String, // Required
      "movement": String, // Optional, new field
      "duration": String, // Required
      "youtubeLink": String // Optional, must be valid URI
    }
  ],
  
  // Final grading
  "finalGrade": Number, // Calculated with 90/10 split
  "finalGradeLevel": String, // Auto-derived from grade
  
  // Completion tracking
  "isCompleted": Boolean,
  "completionDate": Date,
  "teacherSignature": String,
  
  // Timestamps
  "createdAt": Date,
  "updatedAt": Date
}
```

## Grading System

### Grade Level Categories

The system uses 8 official grade level categories:

| Grade Range | Hebrew | English | Points |
|-------------|--------|---------|---------|
| 95-100 | מעולה מאוד | Excellent Plus | 95-100 |
| 90-94 | מעולה | Excellent | 90-94 |
| 85-89 | טוב מאוד | Very Good | 85-89 |
| 80-84 | טוב | Good | 80-84 |
| 75-79 | כמעט טוב | Nearly Good | 75-79 |
| 65-74 | מספיק | Sufficient | 65-74 |
| 55-64 | כמעט מספיק | Nearly Sufficient | 55-64 |
| 0-54 | לא מספיק | Insufficient | 0-54 |

### New Point Allocation System

**Detailed Grading (Presentation 3):**
- **Playing Skills (כישורי נגינה)**: 40 points (was 20)
- **Musical Understanding (הבנה מוזיקלית)**: 30 points (was 40)
- **Text Knowledge (ידיעת הטקסט)**: 20 points (was 30)
- **Playing by Heart (נגינה בעל פה)**: 10 points (unchanged)

**Total**: 100 points

### Final Grade Calculation (90/10 Split)

```javascript
function calculateFinalGradeWithDirector(performanceGrade, directorEvaluation) {
  if (!performanceGrade || !directorEvaluation?.points) return null;
  return (performanceGrade * 0.9) + (directorEvaluation.points);
}
```

**Example:**
- Performance Grade: 85 points
- Director Evaluation: 8 points
- **Final Grade**: (85 × 0.9) + 8 = 76.5 + 8 = **84.5 points**
- **Grade Level**: "טוב" (Good)

## Validation Rules

### Director Evaluation
```javascript
{
  points: {
    type: Number,
    required: true,
    min: 0,
    max: 10,
    validate: {
      validator: Number.isInteger,
      message: 'נקודות הערכת מנהל חייבות להיות מספר שלם'
    }
  },
  comments: {
    type: String,
    maxLength: 500,
    default: ''
  }
}
```

### Recital Configuration
```javascript
{
  recitalUnits: {
    type: Number,
    required: true,
    enum: [3, 5],
    message: 'יחידות רסיטל חייבות להיות 3 או 5'
  },
  recitalField: {
    type: String,
    required: true,
    enum: ['קלאסי', 'ג\'אז', 'שירה'],
    message: 'תחום רסיטל חייב להיות אחד מהאפשרויות המוגדרות'
  }
}
```

### Enhanced Program Piece Validation
```javascript
{
  pieceNumber: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
    message: 'מספר יצירה חייב להיות בין 1-5'
  },
  composer: {
    type: String,
    required: true,
    minLength: 1,
    message: 'שם המלחין נדרש'
  },
  pieceTitle: {
    type: String,
    required: true,
    minLength: 1,
    message: 'שם היצירה נדרש'
  },
  movement: {
    type: String,
    default: '',
    maxLength: 200
  },
  duration: {
    type: String,
    required: true,
    pattern: /^(\d{1,2}:)?\d{1,2}:\d{2}$/,
    message: 'פורמט זמן לא תקין (MM:SS או HH:MM:SS)'
  },
  youtubeLink: {
    type: String,
    validate: {
      validator: (url) => !url || isValidUrl(url),
      message: 'קישור YouTube לא תקין'
    }
  }
}
```

### Point Validation (New Limits)
```javascript
{
  playingSkills: {
    points: {
      type: Number,
      min: 0,
      max: 40, // Updated from 20
      message: 'כישורי נגינה: 0-40 נקודות'
    }
  },
  musicalUnderstanding: {
    points: {
      type: Number,
      min: 0,
      max: 30, // Updated from 40
      message: 'הבנה מוזיקלית: 0-30 נקודות'
    }
  },
  textKnowledge: {
    points: {
      type: Number,
      min: 0,
      max: 20, // Updated from 30
      message: 'ידיעת הטקסט: 0-20 נקודות'
    }
  },
  playingByHeart: {
    points: {
      type: Number,
      min: 0,
      max: 10, // Unchanged
      message: 'נגינה בעל פה: 0-10 נקודות'
    }
  }
}
```

## Error Handling

All API endpoints return bilingual error messages (Hebrew primary, English secondary) for better user experience.

### Validation Errors

```json
{
  "error": "נקודות הערכת מנהל חייבות להיות בין 0 ל-10",
  "errorEn": "Director evaluation points must be between 0 and 10",
  "field": "points",
  "received": 15,
  "expected": "0-10"
}
```

### Business Logic Errors

```json
{
  "error": "הערכת מנהל חייבת להיות מושלמת לפני סיום הבגרות - Director evaluation must be completed before finalizing bagrut",
  "code": "DIRECTOR_EVALUATION_REQUIRED",
  "requiredFields": ["directorEvaluation.points"]
}
```

### Point Allocation Errors

```json
{
  "error": "כישורי נגינה לא יכולים לעלות על 40 נקודות",
  "errorEn": "Playing skills cannot exceed 40 points",
  "field": "playingSkills.points",
  "maxAllowed": 40,
  "received": 45
}
```

## Examples

### Complete Bagrut Workflow

#### 1. Create New Bagrut
```javascript
const createBagrut = async (studentData) => {
  const response = await fetch('/api/bagrut', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      studentId: studentData.id,
      teacherId: 'teacher123',
      conservatoryName: 'קונסרבטוריון ירושלים',
      schoolYear: '2025',
      recitalUnits: 5,
      recitalField: 'קלאסי'
    })
  });
  
  return await response.json();
};
```

#### 2. Set Up Program (All 5 Pieces)
```javascript
const setupProgram = async (bagrutId, pieces) => {
  const response = await fetch(`/api/bagrut/${bagrutId}/program`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pieces.map((piece, index) => ({
      pieceNumber: index + 1,
      composer: piece.composer,
      pieceTitle: piece.title,
      movement: piece.movement || '',
      duration: piece.duration,
      youtubeLink: piece.link || null
    })))
  });
  
  return await response.json();
};
```

#### 3. Update Presentations (0-2)
```javascript
const updatePresentation = async (bagrutId, index, data) => {
  const response = await fetch(`/api/bagrut/${bagrutId}/presentation/${index}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      completed: true,
      status: 'הוגש',
      notes: data.notes,
      recordingLinks: data.links || []
    })
  });
  
  return await response.json();
};
```

#### 4. Final Assessment (Presentation 3)
```javascript
const submitFinalAssessment = async (bagrutId, grading) => {
  const response = await fetch(`/api/bagrut/${bagrutId}/presentation/3`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      completed: true,
      status: 'הוערך',
      detailedGrading: {
        playingSkills: {
          grade: 'מעולה',
          points: grading.playingSkills, // Max 40
          maxPoints: 40,
          comments: grading.playingSkillsComments
        },
        musicalUnderstanding: {
          grade: 'טוב מאוד',
          points: grading.musicalUnderstanding, // Max 30
          maxPoints: 30,
          comments: grading.musicalComments
        },
        textKnowledge: {
          grade: 'טוב',
          points: grading.textKnowledge, // Max 20
          maxPoints: 20,
          comments: grading.textComments
        },
        playingByHeart: {
          grade: 'מעולה',
          points: grading.playingByHeart, // Max 10
          maxPoints: 10,
          comments: grading.memoryComments
        }
      }
    })
  });
  
  return await response.json();
};
```

#### 5. Director Evaluation (New - 10% of Final Grade)
```javascript
const setDirectorEvaluation = async (bagrutId, evaluation) => {
  const response = await fetch(`/api/bagrut/${bagrutId}/directorEvaluation`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      points: evaluation.points, // 0-10
      comments: evaluation.comments
    })
  });
  
  return await response.json();
};
```

#### 6. Calculate Final Grade (90/10 Split)
```javascript
const calculateFinalGrade = async (bagrutId) => {
  const response = await fetch(`/api/bagrut/${bagrutId}/calculateFinalGrade`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' }
  });
  
  return await response.json();
};
```

#### 7. Complete Bagrut
```javascript
const completeBagrut = async (bagrutId, signature) => {
  const response = await fetch(`/api/bagrut/${bagrutId}/complete`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      teacherSignature: signature
    })
  });
  
  return await response.json();
};
```

### Frontend Integration Example

```javascript
class BagrutManager {
  constructor(apiBase) {
    this.api = apiBase;
  }

  async createCompleteWorkflow(studentData, programData, assessmentData) {
    try {
      // 1. Create bagrut
      const bagrut = await this.createBagrut(studentData);
      const bagrutId = bagrut._id;

      // 2. Set up program
      await this.setupProgram(bagrutId, programData);

      // 3. Update presentations 0-2
      for (let i = 0; i < 3; i++) {
        if (assessmentData.presentations[i]) {
          await this.updatePresentation(bagrutId, i, assessmentData.presentations[i]);
        }
      }

      // 4. Final assessment
      if (assessmentData.finalAssessment) {
        await this.submitFinalAssessment(bagrutId, assessmentData.finalAssessment);
      }

      // 5. Director evaluation (required for completion)
      if (assessmentData.directorEvaluation) {
        await this.setDirectorEvaluation(bagrutId, assessmentData.directorEvaluation);
      }

      // 6. Calculate final grade
      const gradedBagrut = await this.calculateFinalGrade(bagrutId);

      // 7. Complete if all requirements met
      if (this.validateCompletionRequirements(gradedBagrut)) {
        return await this.completeBagrut(bagrutId, assessmentData.teacherSignature);
      }

      return gradedBagrut;

    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  validateCompletionRequirements(bagrut) {
    const requirements = [
      bagrut.directorEvaluation?.points !== null && bagrut.directorEvaluation?.points !== undefined,
      bagrut.recitalUnits && [3, 5].includes(bagrut.recitalUnits),
      bagrut.program && bagrut.program.length === 5,
      bagrut.presentations && bagrut.presentations[3]?.completed
    ];

    return requirements.every(req => req === true);
  }

  handleError(error) {
    // Display Hebrew error message if available, fallback to English
    const message = error.error || error.errorEn || error.message;
    console.error('Bagrut API Error:', message);
    
    // Show user-friendly message
    this.showUserMessage(message);
  }
}
```

## Migration from Previous Version

### Key Changes
1. **Point Allocations**: Updated to 40/30/20/10 distribution
2. **Director Evaluation**: New required field for final grade calculation
3. **Recital Configuration**: Units and field now required
4. **90/10 Grade Split**: Performance grade (90%) + Director evaluation (10%)
5. **Enhanced Validation**: Stricter validation with Hebrew error messages

### Migration Steps
1. Run the migration script: `node scripts/migrateBagrutOfficialForm.js`
2. Update frontend forms to include new fields
3. Implement director evaluation workflow
4. Update grade calculation display logic
5. Test with existing data

### Breaking Changes
- **Completion validation** now requires director evaluation
- **Point limits** changed for grading categories
- **Final grade calculation** includes director evaluation

### Backward Compatibility
- Existing bagrut documents are automatically migrated
- Old API endpoints remain functional
- New fields have sensible defaults

For detailed migration instructions, see [BAGRUT_MIGRATION_GUIDE.md](./BAGRUT_MIGRATION_GUIDE.md).