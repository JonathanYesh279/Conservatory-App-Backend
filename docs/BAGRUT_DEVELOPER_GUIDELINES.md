# Bagrut System Developer Guidelines

## Overview

This document provides comprehensive guidelines for developers working with the updated Bagrut system. It covers the 90/10 grading split, grade level categories, calculation methods, Hebrew terminology, and best practices for implementation.

## Table of Contents

1. [Grading System Architecture](#grading-system-architecture)
2. [Grade Level Categories](#grade-level-categories)
3. [Calculation Examples](#calculation-examples)
4. [Hebrew Terminology Reference](#hebrew-terminology-reference)
5. [Development Best Practices](#development-best-practices)
6. [API Integration Patterns](#api-integration-patterns)
7. [Validation Guidelines](#validation-guidelines)
8. [Error Handling Standards](#error-handling-standards)

## Grading System Architecture

### 90/10 Split Explained

The new Bagrut system implements a **90/10 weighted grading system**:

- **90%**: Performance Grade from detailed assessment
- **10%**: Director Evaluation (0-10 points)

This split ensures that the detailed performance assessment carries the primary weight while incorporating valuable director insight.

### Implementation Structure

```javascript
// Core calculation function
function calculateFinalGradeWithDirector(performanceGrade, directorEvaluation) {
  if (!performanceGrade || !directorEvaluation?.points && directorEvaluation?.points !== 0) {
    return null; // Cannot calculate without both components
  }
  
  // Performance grade contributes 90%
  const performanceContribution = performanceGrade * 0.9;
  
  // Director evaluation contributes the remaining 10%
  const directorContribution = directorEvaluation.points;
  
  // Final grade is sum of both contributions
  return Math.round(performanceContribution + directorContribution);
}
```

### Grade Component Breakdown

```
Final Grade (100%) = Performance Grade (90%) + Director Points (10%)

Where:
- Performance Grade = Sum of detailed grading categories (0-100)
- Director Points = Director evaluation score (0-10)

Example:
Performance: 85 points
Director: 8 points
Final: (85 × 0.9) + 8 = 76.5 + 8 = 84.5 ≈ 85
```

## Grade Level Categories

The system uses **8 official grade level categories** as defined by the Ministry of Education:

### Grade Level Mapping

```javascript
const GRADE_LEVELS = {
  EXCELLENT_PLUS: {
    hebrew: 'מעולה מאוד',
    english: 'Excellent Plus',
    range: [95, 100],
    code: 'A+'
  },
  EXCELLENT: {
    hebrew: 'מעולה',
    english: 'Excellent',
    range: [90, 94],
    code: 'A'
  },
  VERY_GOOD: {
    hebrew: 'טוב מאוד',
    english: 'Very Good',
    range: [85, 89],
    code: 'B+'
  },
  GOOD: {
    hebrew: 'טוב',
    english: 'Good',
    range: [80, 84],
    code: 'B'
  },
  NEARLY_GOOD: {
    hebrew: 'כמעט טוב',
    english: 'Nearly Good',
    range: [75, 79],
    code: 'C+'
  },
  SUFFICIENT: {
    hebrew: 'מספיק',
    english: 'Sufficient',
    range: [65, 74],
    code: 'C'
  },
  NEARLY_SUFFICIENT: {
    hebrew: 'כמעט מספיק',
    english: 'Nearly Sufficient',
    range: [55, 64],
    code: 'D'
  },
  INSUFFICIENT: {
    hebrew: 'לא מספיק',
    english: 'Insufficient',
    range: [0, 54],
    code: 'F'
  }
};
```

### Grade Level Calculation Function

```javascript
function getGradeLevelFromScore(score) {
  if (!score && score !== 0) return null;
  
  const numScore = Number(score);
  if (isNaN(numScore)) return null;
  
  // Find matching grade level
  for (const [key, level] of Object.entries(GRADE_LEVELS)) {
    const [min, max] = level.range;
    if (numScore >= min && numScore <= max) {
      return level.hebrew; // Return Hebrew by default
    }
  }
  
  return GRADE_LEVELS.INSUFFICIENT.hebrew; // Fallback
}

// Usage examples
console.log(getGradeLevelFromScore(95)); // "מעולה מאוד"
console.log(getGradeLevelFromScore(87)); // "טוב מאוד"
console.log(getGradeLevelFromScore(72)); // "מספיק"
```

### Grade Level Utilities

```javascript
// Get grade level with both Hebrew and English
function getGradeLevelDetails(score) {
  const numScore = Number(score);
  if (isNaN(numScore)) return null;
  
  for (const [key, level] of Object.entries(GRADE_LEVELS)) {
    const [min, max] = level.range;
    if (numScore >= min && numScore <= max) {
      return {
        hebrew: level.hebrew,
        english: level.english,
        code: level.code,
        range: level.range,
        score: numScore
      };
    }
  }
  
  return GRADE_LEVELS.INSUFFICIENT;
}

// Check if grade meets minimum passing requirement
function isPassingGrade(score) {
  return Number(score) >= 55; // "כמעט מספיק" or higher
}

// Get color coding for UI display
function getGradeColor(score) {
  const numScore = Number(score);
  if (numScore >= 90) return '#2E7D32'; // Dark green
  if (numScore >= 85) return '#388E3C'; // Green
  if (numScore >= 80) return '#689F38'; // Light green
  if (numScore >= 75) return '#AFB42B'; // Yellow-green
  if (numScore >= 65) return '#FF8F00'; // Orange
  if (numScore >= 55) return '#F57C00'; // Dark orange
  return '#D32F2F'; // Red
}
```

## Calculation Examples

### Example 1: High Achiever
```javascript
const example1 = {
  detailedGrading: {
    playingSkills: { points: 38, maxPoints: 40 },      // 95%
    musicalUnderstanding: { points: 28, maxPoints: 30 }, // 93.3%
    textKnowledge: { points: 19, maxPoints: 20 },        // 95%
    playingByHeart: { points: 10, maxPoints: 10 }        // 100%
  },
  directorEvaluation: { points: 9 }
};

// Step 1: Calculate performance grade
const performanceGrade = 38 + 28 + 19 + 10; // = 95

// Step 2: Apply 90/10 split
const finalGrade = (95 * 0.9) + 9; // = 85.5 + 9 = 94.5 ≈ 95

// Step 3: Determine grade level
const gradeLevel = getGradeLevelFromScore(95); // "מעולה מאוד"

console.log(`Performance: ${performanceGrade}/100`);
console.log(`Director: ${9}/10`);
console.log(`Final: ${95} (${gradeLevel})`);
```

### Example 2: Average Performer
```javascript
const example2 = {
  detailedGrading: {
    playingSkills: { points: 30, maxPoints: 40 },      // 75%
    musicalUnderstanding: { points: 22, maxPoints: 30 }, // 73.3%
    textKnowledge: { points: 15, maxPoints: 20 },        // 75%
    playingByHeart: { points: 7, maxPoints: 10 }         // 70%
  },
  directorEvaluation: { points: 7 }
};

// Step 1: Calculate performance grade
const performanceGrade = 30 + 22 + 15 + 7; // = 74

// Step 2: Apply 90/10 split
const finalGrade = (74 * 0.9) + 7; // = 66.6 + 7 = 73.6 ≈ 74

// Step 3: Determine grade level
const gradeLevel = getGradeLevelFromScore(74); // "מספיק"

console.log(`Performance: ${performanceGrade}/100`);
console.log(`Director: ${7}/10`);
console.log(`Final: ${74} (${gradeLevel})`);
```

### Example 3: Director Evaluation Impact
```javascript
// Same performance, different director scores
const basePerformance = 80;

// Scenario A: Low director score
const scenarioA = (80 * 0.9) + 5; // = 72 + 5 = 77 ("כמעט טוב")

// Scenario B: High director score
const scenarioB = (80 * 0.9) + 10; // = 72 + 10 = 82 ("טוב")

// Director evaluation can shift grade level by up to 5 points
console.log(`Same performance (80), different outcomes:`);
console.log(`Director 5/10: Final ${77} (${getGradeLevelFromScore(77)})`);
console.log(`Director 10/10: Final ${82} (${getGradeLevelFromScore(82)})`);
```

## Hebrew Terminology Reference

### Core Terms

```javascript
const HEBREW_TERMS = {
  // Document structure
  bagrut: 'בגרות',
  student: 'תלמיד/ה',
  teacher: 'מורה',
  director: 'מנהל/ת',
  conservatory: 'קונסרבטוריון',
  
  // Grade components
  performanceGrade: 'ציון ביצוע',
  directorEvaluation: 'הערכת מנהל',
  finalGrade: 'ציון סופי',
  gradeLevel: 'רמת ציון',
  
  // Detailed grading categories
  playingSkills: 'כישורי נגינה',
  musicalUnderstanding: 'הבנה מוזיקלית',
  textKnowledge: 'ידיעת הטקסט',
  playingByHeart: 'נגינה בעל פה',
  
  // Program elements
  program: 'תוכנית',
  piece: 'יצירה',
  composer: 'מלחין',
  pieceTitle: 'שם היצירה',
  movement: 'הרגה',
  duration: 'משך',
  
  // Recital configuration
  recitalUnits: 'יחידות רסיטל',
  recitalField: 'תחום רסיטל',
  classical: 'קלאסי',
  jazz: 'ג\'אז',
  vocal: 'שירה',
  
  // Assessment terms
  presentation: 'מצגת',
  assessment: 'הערכה',
  evaluation: 'הערכה',
  comments: 'הערות',
  completed: 'הושלם',
  pending: 'ממתין',
  approved: 'אושר'
};
```

### Status Terms

```javascript
const STATUS_TERMS = {
  NOT_STARTED: 'לא התחיל',
  IN_PROGRESS: 'בעיבוד',
  SUBMITTED: 'הוגש',
  REVIEWED: 'נבדק',
  APPROVED: 'אושר',
  COMPLETED: 'הושלם',
  REJECTED: 'נדחה',
  NEEDS_REVISION: 'דורש תיקון'
};
```

### Validation Messages

```javascript
const VALIDATION_MESSAGES = {
  REQUIRED_FIELD: 'שדה נדרש',
  INVALID_RANGE: 'ערך לא תקין בטווח',
  DIRECTOR_POINTS_RANGE: 'נקודות הערכת מנהל חייבות להיות בין 0 ל-10',
  RECITAL_UNITS_INVALID: 'יחידות רסיטל חייבות להיות 3 או 5',
  RECITAL_FIELD_INVALID: 'תחום רסיטל חייב להיות קלאסי, ג\'אז או שירה',
  PLAYING_SKILLS_EXCEEDED: 'כישורי נגינה לא יכולים לעלות על 40 נקודות',
  MUSICAL_UNDERSTANDING_EXCEEDED: 'הבנה מוזיקלית לא יכולה לעלות על 30 נקודות',
  TEXT_KNOWLEDGE_EXCEEDED: 'ידיעת הטקסט לא יכולה לעלות על 20 נקודות',
  PLAYING_BY_HEART_EXCEEDED: 'נגינה בעל פה לא יכולה לעלות על 10 נקודות'
};
```

## Development Best Practices

### 1. Grade Calculation Standards

```javascript
// Always use the official calculation function
function calculateBagrutGrade(bagrut) {
  const performanceGrade = calculatePerformanceGrade(
    bagrut.presentations[3]?.detailedGrading
  );
  
  const directorEvaluation = bagrut.directorEvaluation;
  
  return calculateFinalGradeWithDirector(performanceGrade, directorEvaluation);
}

// Helper function for performance grade
function calculatePerformanceGrade(detailedGrading) {
  if (!detailedGrading) return null;
  
  const { playingSkills, musicalUnderstanding, textKnowledge, playingByHeart } = detailedGrading;
  
  const total = (playingSkills?.points || 0) +
                (musicalUnderstanding?.points || 0) +
                (textKnowledge?.points || 0) +
                (playingByHeart?.points || 0);
  
  return total;
}
```

### 2. Validation Patterns

```javascript
// Create consistent validation functions
function validateDirectorEvaluation(evaluation) {
  const errors = [];
  
  if (evaluation.points === null || evaluation.points === undefined) {
    errors.push({
      field: 'points',
      message: VALIDATION_MESSAGES.REQUIRED_FIELD,
      messageEn: 'Director evaluation points are required'
    });
  }
  
  if (typeof evaluation.points === 'number') {
    if (evaluation.points < 0 || evaluation.points > 10) {
      errors.push({
        field: 'points',
        message: VALIDATION_MESSAGES.DIRECTOR_POINTS_RANGE,
        messageEn: 'Director evaluation points must be between 0 and 10'
      });
    }
  }
  
  return errors;
}

// Point validation with new limits
function validateDetailedGradingPoints(grading) {
  const errors = [];
  const limits = {
    playingSkills: 40,
    musicalUnderstanding: 30,
    textKnowledge: 20,
    playingByHeart: 10
  };
  
  Object.entries(grading).forEach(([category, categoryGrading]) => {
    if (categoryGrading.points > limits[category]) {
      errors.push({
        field: `${category}.points`,
        message: `${HEBREW_TERMS[category]} לא יכול לעלות על ${limits[category]} נקודות`,
        messageEn: `${category} cannot exceed ${limits[category]} points`,
        maxAllowed: limits[category],
        received: categoryGrading.points
      });
    }
  });
  
  return errors;
}
```

### 3. State Management Patterns

```javascript
// Bagrut state management
class BagrutState {
  constructor(initialBagrut = null) {
    this.bagrut = initialBagrut;
    this.isDirty = false;
    this.validationErrors = [];
  }
  
  updateDirectorEvaluation(evaluation) {
    this.bagrut.directorEvaluation = evaluation;
    this.isDirty = true;
    this.recalculateFinalGrade();
    this.validate();
  }
  
  updateDetailedGrading(grading) {
    this.bagrut.presentations[3].detailedGrading = grading;
    this.isDirty = true;
    this.recalculateFinalGrade();
    this.validate();
  }
  
  recalculateFinalGrade() {
    const performanceGrade = calculatePerformanceGrade(
      this.bagrut.presentations[3]?.detailedGrading
    );
    
    this.bagrut.finalGrade = calculateFinalGradeWithDirector(
      performanceGrade,
      this.bagrut.directorEvaluation
    );
    
    this.bagrut.finalGradeLevel = getGradeLevelFromScore(this.bagrut.finalGrade);
  }
  
  validate() {
    this.validationErrors = [];
    
    // Validate director evaluation
    if (this.bagrut.directorEvaluation) {
      this.validationErrors.push(...validateDirectorEvaluation(this.bagrut.directorEvaluation));
    }
    
    // Validate detailed grading
    if (this.bagrut.presentations[3]?.detailedGrading) {
      this.validationErrors.push(...validateDetailedGradingPoints(this.bagrut.presentations[3].detailedGrading));
    }
    
    return this.validationErrors.length === 0;
  }
  
  canComplete() {
    return this.validate() &&
           this.bagrut.directorEvaluation?.points !== null &&
           this.bagrut.recitalUnits &&
           this.bagrut.recitalField &&
           this.bagrut.program?.length === 5 &&
           this.bagrut.presentations[3]?.completed;
  }
}
```

### 4. UI Component Patterns

```javascript
// Reusable grade display component
const GradeDisplay = ({ grade, showLevel = true, showColor = true }) => {
  const gradeDetails = getGradeLevelDetails(grade);
  const color = showColor ? getGradeColor(grade) : undefined;
  
  return (
    <div className="grade-display" style={{ color }}>
      <span className="grade-value">{grade || 'לא הוערך'}</span>
      {showLevel && gradeDetails && (
        <span className="grade-level">({gradeDetails.hebrew})</span>
      )}
    </div>
  );
};

// Progress indicator for bagrut completion
const BagrutProgress = ({ bagrut }) => {
  const steps = [
    { key: 'program', label: 'תוכנית', completed: bagrut.program?.length === 5 },
    { key: 'presentations', label: 'מצגות', completed: bagrut.presentations?.filter(p => p.completed).length === 4 },
    { key: 'assessment', label: 'הערכה', completed: bagrut.presentations[3]?.completed },
    { key: 'director', label: 'הערכת מנהל', completed: bagrut.directorEvaluation?.points !== null },
    { key: 'completion', label: 'סיום', completed: bagrut.isCompleted }
  ];
  
  const completedSteps = steps.filter(step => step.completed).length;
  const progress = (completedSteps / steps.length) * 100;
  
  return (
    <div className="bagrut-progress">
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="progress-steps">
        {steps.map((step, index) => (
          <div 
            key={step.key} 
            className={`progress-step ${step.completed ? 'completed' : ''}`}
          >
            {step.label}
          </div>
        ))}
      </div>
      <div className="progress-text">
        {completedSteps}/{steps.length} שלבים הושלמו
      </div>
    </div>
  );
};
```

## API Integration Patterns

### 1. Service Layer Pattern

```javascript
class BagrutService {
  constructor(apiClient) {
    this.api = apiClient;
  }
  
  async updateDirectorEvaluation(bagrutId, evaluation) {
    try {
      const response = await this.api.put(`/bagrut/${bagrutId}/directorEvaluation`, evaluation);
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || error.message,
        errorEn: error.response?.data?.errorEn
      };
    }
  }
  
  async calculateFinalGrade(bagrutId) {
    try {
      const response = await this.api.put(`/bagrut/${bagrutId}/calculateFinalGrade`);
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || error.message 
      };
    }
  }
  
  async completeBagrut(bagrutId, signature) {
    try {
      const response = await this.api.put(`/bagrut/${bagrutId}/complete`, {
        teacherSignature: signature
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || error.message,
        validationErrors: error.response?.data?.validationErrors || []
      };
    }
  }
}
```

### 2. Error Handling Patterns

```javascript
// Centralized error handler for bagrut operations
function handleBagrutError(error, context) {
  const errorInfo = {
    context,
    timestamp: new Date().toISOString(),
    message: error.error || error.errorEn || error.message,
    field: error.field,
    code: error.code
  };
  
  // Log error
  console.error('Bagrut Error:', errorInfo);
  
  // Show user-friendly message
  const userMessage = error.error || error.errorEn || 'שגיאה לא צפויה';
  showNotification(userMessage, 'error');
  
  // Handle specific error types
  switch (error.code) {
    case 'DIRECTOR_EVALUATION_REQUIRED':
      // Redirect to director evaluation form
      navigateToDirectorEvaluation();
      break;
    case 'VALIDATION_ERROR':
      // Highlight problematic fields
      highlightErrorFields(error.validationErrors || [error]);
      break;
    case 'COMPLETION_REQUIREMENTS_NOT_MET':
      // Show requirements checklist
      showCompletionRequirements(error.missingRequirements);
      break;
  }
  
  return errorInfo;
}
```

### 3. Caching Patterns

```javascript
// Bagrut data caching with invalidation
class BagrutCache {
  constructor() {
    this.cache = new Map();
    this.ttl = 5 * 60 * 1000; // 5 minutes
  }
  
  set(bagrutId, data) {
    this.cache.set(bagrutId, {
      data,
      timestamp: Date.now()
    });
  }
  
  get(bagrutId) {
    const cached = this.cache.get(bagrutId);
    if (!cached) return null;
    
    // Check if expired
    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(bagrutId);
      return null;
    }
    
    return cached.data;
  }
  
  invalidate(bagrutId) {
    this.cache.delete(bagrutId);
  }
  
  invalidateAll() {
    this.cache.clear();
  }
}

// Usage with API service
class CachedBagrutService extends BagrutService {
  constructor(apiClient) {
    super(apiClient);
    this.cache = new BagrutCache();
  }
  
  async getBagrut(bagrutId) {
    // Try cache first
    const cached = this.cache.get(bagrutId);
    if (cached) return { success: true, data: cached, fromCache: true };
    
    // Fetch from API
    const result = await super.getBagrut(bagrutId);
    if (result.success) {
      this.cache.set(bagrutId, result.data);
    }
    
    return result;
  }
  
  async updateDirectorEvaluation(bagrutId, evaluation) {
    const result = await super.updateDirectorEvaluation(bagrutId, evaluation);
    if (result.success) {
      this.cache.invalidate(bagrutId); // Invalidate cache after update
    }
    return result;
  }
}
```

## Validation Guidelines

### 1. Client-Side Validation

```javascript
// Comprehensive client-side validation
function validateBagrutClientSide(bagrut) {
  const errors = {
    directorEvaluation: [],
    recitalConfig: [],
    detailedGrading: [],
    program: [],
    general: []
  };
  
  // Director evaluation validation
  if (!bagrut.directorEvaluation) {
    errors.general.push('הערכת מנהל חסרה');
  } else {
    const directorErrors = validateDirectorEvaluation(bagrut.directorEvaluation);
    errors.directorEvaluation.push(...directorErrors);
  }
  
  // Recital configuration validation
  if (!bagrut.recitalUnits || ![3, 5].includes(bagrut.recitalUnits)) {
    errors.recitalConfig.push('יחידות רסיטל חייבות להיות 3 או 5');
  }
  
  if (!bagrut.recitalField || !['קלאסי', 'ג\'אז', 'שירה'].includes(bagrut.recitalField)) {
    errors.recitalConfig.push('תחום רסיטל נדרש');
  }
  
  // Program validation
  if (!bagrut.program || bagrut.program.length !== 5) {
    errors.program.push('נדרשות 5 יצירות בתוכנית');
  } else {
    bagrut.program.forEach((piece, index) => {
      if (!piece.pieceNumber || piece.pieceNumber !== index + 1) {
        errors.program.push(`יצירה ${index + 1}: מספר יצירה לא תקין`);
      }
      if (!piece.composer) {
        errors.program.push(`יצירה ${index + 1}: שם מלחין נדרש`);
      }
      if (!piece.pieceTitle) {
        errors.program.push(`יצירה ${index + 1}: שם יצירה נדרש`);
      }
    });
  }
  
  // Detailed grading validation
  if (bagrut.presentations[3]?.detailedGrading) {
    const gradingErrors = validateDetailedGradingPoints(bagrut.presentations[3].detailedGrading);
    errors.detailedGrading.push(...gradingErrors);
  }
  
  return errors;
}
```

### 2. Real-Time Validation

```javascript
// Real-time validation hook for React
function useBagrutValidation(bagrut) {
  const [errors, setErrors] = useState({});
  const [isValid, setIsValid] = useState(false);
  
  useEffect(() => {
    if (!bagrut) return;
    
    const validationErrors = validateBagrutClientSide(bagrut);
    setErrors(validationErrors);
    
    // Check if any category has errors
    const hasErrors = Object.values(validationErrors).some(categoryErrors => 
      categoryErrors.length > 0
    );
    setIsValid(!hasErrors);
  }, [bagrut]);
  
  return { errors, isValid };
}

// Usage in component
function BagrutForm({ bagrut, onUpdate }) {
  const { errors, isValid } = useBagrutValidation(bagrut);
  
  return (
    <form>
      <DirectorEvaluationInput 
        value={bagrut.directorEvaluation}
        onChange={(evaluation) => onUpdate({ ...bagrut, directorEvaluation: evaluation })}
        errors={errors.directorEvaluation}
      />
      
      <RecitalConfigInput
        units={bagrut.recitalUnits}
        field={bagrut.recitalField}
        onChange={(config) => onUpdate({ ...bagrut, ...config })}
        errors={errors.recitalConfig}
      />
      
      <button disabled={!isValid}>שמור בגרות</button>
    </form>
  );
}
```

## Error Handling Standards

### 1. Error Response Format

All API endpoints should return consistent error responses:

```javascript
{
  "error": "נקודות הערכת מנהל חייבות להיות בין 0 ל-10", // Hebrew (primary)
  "errorEn": "Director evaluation points must be between 0 and 10", // English (fallback)
  "field": "points", // Field that caused the error
  "code": "VALIDATION_ERROR", // Error code for programmatic handling
  "received": 15, // Value that was received (if applicable)
  "expected": "0-10", // Expected value or range
  "context": "directorEvaluation" // Context where error occurred
}
```

### 2. Error Handling Utilities

```javascript
// Error handling utilities
const BagrutErrorHandler = {
  // Format error for display
  formatError(error) {
    return error.error || error.errorEn || error.message || 'שגיאה לא ידועה';
  },
  
  // Check if error is validation-related
  isValidationError(error) {
    return error.code === 'VALIDATION_ERROR' || 
           error.field || 
           error.validationErrors;
  },
  
  // Extract field errors for form display
  getFieldErrors(error) {
    if (error.validationErrors) {
      return error.validationErrors.reduce((acc, err) => {
        acc[err.field] = err.error || err.errorEn;
        return acc;
      }, {});
    }
    
    if (error.field) {
      return { [error.field]: error.error || error.errorEn };
    }
    
    return {};
  },
  
  // Handle completion errors specifically
  handleCompletionError(error) {
    if (error.code === 'DIRECTOR_EVALUATION_REQUIRED') {
      return {
        type: 'missing_requirement',
        message: 'הערכת מנהל נדרשת לסיום הבגרות',
        action: 'navigate_to_director_evaluation'
      };
    }
    
    if (error.code === 'RECITAL_CONFIG_MISSING') {
      return {
        type: 'missing_requirement',
        message: 'תצורת רסיטל נדרשת',
        action: 'navigate_to_recital_config'
      };
    }
    
    return {
      type: 'general_error',
      message: this.formatError(error),
      action: 'show_error_message'
    };
  }
};
```

### 3. Testing Guidelines

```javascript
// Unit tests for grade calculation
describe('Grade Calculation', () => {
  test('should calculate correct 90/10 split', () => {
    const performanceGrade = 85;
    const directorEvaluation = { points: 8 };
    
    const result = calculateFinalGradeWithDirector(performanceGrade, directorEvaluation);
    
    expect(result).toBe(85); // (85 * 0.9) + 8 = 76.5 + 8 = 84.5 ≈ 85
  });
  
  test('should return null when director evaluation missing', () => {
    const result = calculateFinalGradeWithDirector(85, null);
    expect(result).toBeNull();
  });
  
  test('should handle zero director points', () => {
    const result = calculateFinalGradeWithDirector(90, { points: 0 });
    expect(result).toBe(81); // (90 * 0.9) + 0 = 81
  });
});

// Integration tests for API endpoints
describe('Director Evaluation API', () => {
  test('should update director evaluation successfully', async () => {
    const response = await request(app)
      .put('/api/bagrut/test-id/directorEvaluation')
      .send({ points: 8, comments: 'מעולה' })
      .expect(200);
      
    expect(response.body.directorEvaluation.points).toBe(8);
    expect(response.body.finalGrade).toBeGreaterThan(0);
  });
  
  test('should reject invalid director points', async () => {
    const response = await request(app)
      .put('/api/bagrut/test-id/directorEvaluation')
      .send({ points: 15 })
      .expect(400);
      
    expect(response.body.error).toContain('0 ל-10');
  });
});
```

This guide provides comprehensive coverage of the Bagrut system's architecture, calculations, terminology, and best practices. Follow these guidelines to ensure consistent, reliable, and maintainable code when working with the Bagrut system.