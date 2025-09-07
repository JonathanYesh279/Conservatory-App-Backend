# Bagrut Frontend Integration Guide

## Overview

This guide provides comprehensive instructions for integrating the updated Bagrut system into frontend applications. It covers form field mapping, validation requirements, API integration examples, and error handling patterns.

## Table of Contents

1. [Form Field Mapping](#form-field-mapping)
2. [Validation Requirements](#validation-requirements)
3. [API Integration Examples](#api-integration-examples)
4. [Error Response Handling](#error-response-handling)
5. [UI Component Examples](#ui-component-examples)
6. [State Management Patterns](#state-management-patterns)
7. [Testing Strategies](#testing-strategies)

## Form Field Mapping

### Core Bagrut Form Fields

```javascript
// Main bagrut form mapping
const BAGRUT_FORM_FIELDS = {
  // Basic information
  studentId: {
    apiField: 'studentId',
    type: 'select', // Student dropdown
    required: true,
    validation: 'objectId'
  },
  teacherId: {
    apiField: 'teacherId',
    type: 'select', // Teacher dropdown
    required: true,
    validation: 'objectId'
  },
  conservatoryName: {
    apiField: 'conservatoryName',
    type: 'text',
    required: false,
    maxLength: 200,
    placeholder: 'שם הקונסרבטוריון'
  },
  schoolYear: {
    apiField: 'schoolYear',
    type: 'select', // Year dropdown
    required: true,
    options: ['2024', '2025', '2026']
  },
  
  // New required fields
  recitalUnits: {
    apiField: 'recitalUnits',
    type: 'radio',
    required: true,
    options: [
      { value: 3, label: '3 יחידות' },
      { value: 5, label: '5 יחידות' }
    ],
    default: 5
  },
  recitalField: {
    apiField: 'recitalField',
    type: 'select',
    required: true,
    options: [
      { value: 'קלאסי', label: 'קלאסי' },
      { value: 'ג\'אז', label: 'ג\'אז' },
      { value: 'שירה', label: 'שירה' }
    ],
    default: 'קלאסי'
  },
  
  // Director information
  directorName: {
    apiField: 'directorName',
    type: 'text',
    required: false,
    default: 'לימור אקטע',
    placeholder: 'שם מנהל הקונסרבטוריון'
  }
};
```

### Director Evaluation Form Fields

```javascript
const DIRECTOR_EVALUATION_FIELDS = {
  points: {
    apiField: 'points',
    type: 'number',
    required: true,
    min: 0,
    max: 10,
    step: 1,
    label: 'נקודות הערכת מנהל (0-10)',
    helpText: 'הערכה זו מהווה 10% מהציון הסופי'
  },
  comments: {
    apiField: 'comments',
    type: 'textarea',
    required: false,
    maxLength: 500,
    label: 'הערות מנהל',
    placeholder: 'הערות על הביצוע, יצירתיות, והתרשמות כללית...'
  }
};
```

### Program Piece Form Fields

```javascript
const PROGRAM_PIECE_FIELDS = {
  pieceNumber: {
    apiField: 'pieceNumber',
    type: 'number',
    required: true,
    min: 1,
    max: 5,
    label: 'מספר יצירה',
    readOnly: true // Auto-calculated based on position
  },
  composer: {
    apiField: 'composer',
    type: 'text',
    required: true,
    maxLength: 200,
    label: 'מלחין',
    placeholder: 'שם המלחין'
  },
  pieceTitle: {
    apiField: 'pieceTitle',
    type: 'text',
    required: true,
    maxLength: 300,
    label: 'שם היצירה',
    placeholder: 'שם היצירה'
  },
  movement: {
    apiField: 'movement',
    type: 'text',
    required: false,
    maxLength: 200,
    label: 'הרגה',
    placeholder: 'הרגה ראשונה, השנייה...'
  },
  duration: {
    apiField: 'duration',
    type: 'time',
    required: true,
    pattern: /^(\d{1,2}:)?\d{1,2}:\d{2}$/,
    label: 'משך זמן',
    placeholder: 'MM:SS או HH:MM:SS',
    helpText: 'פורמט: דקות:שניות (למשל: 15:30)'
  },
  youtubeLink: {
    apiField: 'youtubeLink',
    type: 'url',
    required: false,
    label: 'קישור YouTube',
    placeholder: 'https://youtube.com/watch?v=...',
    validation: 'url'
  }
};
```

### Detailed Grading Form Fields (Updated Point System)

```javascript
const DETAILED_GRADING_FIELDS = {
  playingSkills: {
    apiField: 'playingSkills',
    label: 'כישורי נגינה',
    maxPoints: 40, // Updated from 20
    fields: {
      points: {
        type: 'number',
        min: 0,
        max: 40,
        required: true,
        label: 'נקודות (0-40)'
      },
      grade: {
        type: 'select',
        options: ['מעולה', 'טוב מאוד', 'טוב', 'מספיק', 'לא מספיק'],
        label: 'הערכה איכותית'
      },
      comments: {
        type: 'textarea',
        maxLength: 300,
        label: 'הערות',
        placeholder: 'הערות על הטכניקה, הביצוע, והשליטה במכשיר'
      }
    }
  },
  musicalUnderstanding: {
    apiField: 'musicalUnderstanding',
    label: 'הבנה מוזיקלית',
    maxPoints: 30, // Updated from 40
    fields: {
      points: {
        type: 'number',
        min: 0,
        max: 30,
        required: true,
        label: 'נקודות (0-30)'
      },
      grade: {
        type: 'select',
        options: ['מעולה', 'טוב מאוד', 'טוב', 'מספיק', 'לא מספיק'],
        label: 'הערכה איכותית'
      },
      comments: {
        type: 'textarea',
        maxLength: 300,
        label: 'הערות',
        placeholder: 'הערות על הפרשנות, הביטוי המוזיקלי, והבנת המבנה'
      }
    }
  },
  textKnowledge: {
    apiField: 'textKnowledge',
    label: 'ידיעת הטקסט',
    maxPoints: 20, // Updated from 30
    fields: {
      points: {
        type: 'number',
        min: 0,
        max: 20,
        required: true,
        label: 'נקודות (0-20)'
      },
      grade: {
        type: 'select',
        options: ['מעולה', 'טוב מאוד', 'טוב', 'מספיק', 'לא מספיק'],
        label: 'הערכה איכותית'
      },
      comments: {
        type: 'textarea',
        maxLength: 300,
        label: 'הערות',
        placeholder: 'הערות על הכרת המילים, הביטוי, והדיקציה'
      }
    }
  },
  playingByHeart: {
    apiField: 'playingByHeart',
    label: 'נגינה בעל פה',
    maxPoints: 10, // Unchanged
    fields: {
      points: {
        type: 'number',
        min: 0,
        max: 10,
        required: true,
        label: 'נקודות (0-10)'
      },
      grade: {
        type: 'select',
        options: ['מעולה', 'טוב מאוד', 'טוב', 'מספיק', 'לא מספיק'],
        label: 'הערכה איכותית'
      },
      comments: {
        type: 'textarea',
        maxLength: 300,
        label: 'הערות',
        placeholder: 'הערות על הזיכרון המוזיקלי והביצוע ללא תווים'
      }
    }
  }
};
```

## Validation Requirements

### Client-Side Validation Rules

```javascript
// Validation configuration
const VALIDATION_RULES = {
  // Director evaluation validation
  directorEvaluation: {
    points: [
      { rule: 'required', message: 'נקודות הערכת מנהל נדרשות' },
      { rule: 'number', message: 'חייב להיות מספר' },
      { rule: 'min', value: 0, message: 'מינימום 0 נקודות' },
      { rule: 'max', value: 10, message: 'מקסימום 10 נקודות' },
      { rule: 'integer', message: 'חייב להיות מספר שלם' }
    ],
    comments: [
      { rule: 'maxLength', value: 500, message: 'מקסימום 500 תווים' }
    ]
  },
  
  // Recital configuration validation
  recitalConfig: {
    units: [
      { rule: 'required', message: 'יחידות רסיטל נדרשות' },
      { rule: 'enum', values: [3, 5], message: 'יחידות רסיטל חייבות להיות 3 או 5' }
    ],
    field: [
      { rule: 'required', message: 'תחום רסיטל נדרש' },
      { rule: 'enum', values: ['קלאסי', 'ג\'אז', 'שירה'], message: 'תחום רסיטל לא תקין' }
    ]
  },
  
  // Program piece validation
  programPiece: {
    pieceNumber: [
      { rule: 'required', message: 'מספר יצירה נדרש' },
      { rule: 'number', message: 'חייב להיות מספר' },
      { rule: 'min', value: 1, message: 'מינימום 1' },
      { rule: 'max', value: 5, message: 'מקסימום 5' }
    ],
    composer: [
      { rule: 'required', message: 'שם מלחין נדרש' },
      { rule: 'maxLength', value: 200, message: 'מקסימום 200 תווים' }
    ],
    pieceTitle: [
      { rule: 'required', message: 'שם יצירה נדרש' },
      { rule: 'maxLength', value: 300, message: 'מקסימום 300 תווים' }
    ],
    duration: [
      { rule: 'required', message: 'משך זמן נדרש' },
      { rule: 'pattern', value: /^(\d{1,2}:)?\d{1,2}:\d{2}$/, message: 'פורמט זמן לא תקין (MM:SS)' }
    ],
    youtubeLink: [
      { rule: 'url', message: 'קישור לא תקין', allowEmpty: true }
    ]
  },
  
  // Detailed grading validation with new limits
  detailedGrading: {
    playingSkills: {
      points: [
        { rule: 'required', message: 'נקודות כישורי נגינה נדרשות' },
        { rule: 'number', message: 'חייב להיות מספר' },
        { rule: 'min', value: 0, message: 'מינימום 0 נקודות' },
        { rule: 'max', value: 40, message: 'מקסימום 40 נקודות' }
      ]
    },
    musicalUnderstanding: {
      points: [
        { rule: 'required', message: 'נקודות הבנה מוזיקלית נדרשות' },
        { rule: 'number', message: 'חייב להיות מספר' },
        { rule: 'min', value: 0, message: 'מינימום 0 נקודות' },
        { rule: 'max', value: 30, message: 'מקסימום 30 נקודות' }
      ]
    },
    textKnowledge: {
      points: [
        { rule: 'required', message: 'נקודות ידיעת הטקסט נדרשות' },
        { rule: 'number', message: 'חייב להיות מספר' },
        { rule: 'min', value: 0, message: 'מינימום 0 נקודות' },
        { rule: 'max', value: 20, message: 'מקסימום 20 נקודות' }
      ]
    },
    playingByHeart: {
      points: [
        { rule: 'required', message: 'נקודות נגינה בעל פה נדרשות' },
        { rule: 'number', message: 'חייב להיות מספר' },
        { rule: 'min', value: 0, message: 'מינימום 0 נקודות' },
        { rule: 'max', value: 10, message: 'מקסימום 10 נקודות' }
      ]
    }
  }
};
```

### Validation Implementation

```javascript
// Validation utility functions
class BagrutValidator {
  static validateField(value, rules) {
    const errors = [];
    
    for (const rule of rules) {
      const error = this.applyRule(value, rule);
      if (error) errors.push(error);
    }
    
    return errors;
  }
  
  static applyRule(value, rule) {
    switch (rule.rule) {
      case 'required':
        if (value === null || value === undefined || value === '') {
          return rule.message;
        }
        break;
        
      case 'number':
        if (isNaN(Number(value))) {
          return rule.message;
        }
        break;
        
      case 'min':
        if (Number(value) < rule.value) {
          return rule.message;
        }
        break;
        
      case 'max':
        if (Number(value) > rule.value) {
          return rule.message;
        }
        break;
        
      case 'enum':
        if (!rule.values.includes(value)) {
          return rule.message;
        }
        break;
        
      case 'pattern':
        if (!rule.value.test(value)) {
          return rule.message;
        }
        break;
        
      case 'url':
        if (value && rule.allowEmpty !== true) {
          try {
            new URL(value);
          } catch {
            return rule.message;
          }
        }
        break;
        
      case 'maxLength':
        if (value && value.length > rule.value) {
          return rule.message;
        }
        break;
        
      case 'integer':
        if (!Number.isInteger(Number(value))) {
          return rule.message;
        }
        break;
    }
    
    return null;
  }
  
  static validateDirectorEvaluation(evaluation) {
    const errors = {};
    
    if (evaluation.points !== undefined) {
      const pointsErrors = this.validateField(evaluation.points, VALIDATION_RULES.directorEvaluation.points);
      if (pointsErrors.length > 0) errors.points = pointsErrors;
    }
    
    if (evaluation.comments) {
      const commentsErrors = this.validateField(evaluation.comments, VALIDATION_RULES.directorEvaluation.comments);
      if (commentsErrors.length > 0) errors.comments = commentsErrors;
    }
    
    return errors;
  }
  
  static validateDetailedGrading(grading) {
    const errors = {};
    
    Object.entries(DETAILED_GRADING_FIELDS).forEach(([category, config]) => {
      if (grading[category]) {
        const categoryErrors = {};
        
        const pointsRules = VALIDATION_RULES.detailedGrading[category]?.points || [];
        const pointsErrors = this.validateField(grading[category].points, pointsRules);
        if (pointsErrors.length > 0) categoryErrors.points = pointsErrors;
        
        if (Object.keys(categoryErrors).length > 0) {
          errors[category] = categoryErrors;
        }
      }
    });
    
    return errors;
  }
}
```

## API Integration Examples

### Complete API Service Implementation

```javascript
class BagrutApiService {
  constructor(baseUrl, authToken) {
    this.baseUrl = baseUrl;
    this.authToken = authToken;
  }
  
  // Helper method for API calls
  async apiCall(method, endpoint, data = null) {
    const config = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`
      }
    };
    
    if (data) {
      config.body = JSON.stringify(data);
    }
    
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, config);
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || result.errorEn || `HTTP ${response.status}`);
      }
      
      return { success: true, data: result };
    } catch (error) {
      return { 
        success: false, 
        error: error.message,
        details: error.response?.data 
      };
    }
  }
  
  // Core CRUD operations
  async createBagrut(bagrutData) {
    return this.apiCall('POST', '/api/bagrut', bagrutData);
  }
  
  async getBagrut(bagrutId) {
    return this.apiCall('GET', `/api/bagrut/${bagrutId}`);
  }
  
  async updateBagrut(bagrutId, updates) {
    return this.apiCall('PUT', `/api/bagrut/${bagrutId}`, updates);
  }
  
  // New director evaluation endpoint
  async updateDirectorEvaluation(bagrutId, evaluation) {
    return this.apiCall('PUT', `/api/bagrut/${bagrutId}/directorEvaluation`, evaluation);
  }
  
  // New recital configuration endpoint
  async setRecitalConfiguration(bagrutId, config) {
    return this.apiCall('PUT', `/api/bagrut/${bagrutId}/recitalConfiguration`, config);
  }
  
  // Updated grading details
  async updateGradingDetails(bagrutId, gradingDetails) {
    return this.apiCall('PUT', `/api/bagrut/${bagrutId}/gradingDetails`, gradingDetails);
  }
  
  // Program management
  async updateProgram(bagrutId, program) {
    return this.apiCall('PUT', `/api/bagrut/${bagrutId}/program`, { program });
  }
  
  async addProgramPiece(bagrutId, piece) {
    return this.apiCall('POST', `/api/bagrut/${bagrutId}/program`, piece);
  }
  
  // Final grade calculation
  async calculateFinalGrade(bagrutId) {
    return this.apiCall('PUT', `/api/bagrut/${bagrutId}/calculateFinalGrade`);
  }
  
  // Completion
  async completeBagrut(bagrutId, signature) {
    return this.apiCall('PUT', `/api/bagrut/${bagrutId}/complete`, { teacherSignature: signature });
  }
}
```

### Usage Examples

```javascript
// Initialize the service
const bagrutApi = new BagrutApiService('/api', userToken);

// Example: Complete bagrut workflow
async function completeBagrutWorkflow(bagrutData) {
  try {
    // 1. Create bagrut
    const createResult = await bagrutApi.createBagrut({
      studentId: bagrutData.studentId,
      teacherId: bagrutData.teacherId,
      recitalUnits: bagrutData.recitalUnits,
      recitalField: bagrutData.recitalField
    });
    
    if (!createResult.success) {
      throw new Error(`יצירת בגרות נכשלה: ${createResult.error}`);
    }
    
    const bagrutId = createResult.data._id;
    
    // 2. Set up program
    const programResult = await bagrutApi.updateProgram(bagrutId, bagrutData.program);
    if (!programResult.success) {
      throw new Error(`עדכון תוכנית נכשל: ${programResult.error}`);
    }
    
    // 3. Update detailed grading
    const gradingResult = await bagrutApi.updateGradingDetails(bagrutId, bagrutData.gradingDetails);
    if (!gradingResult.success) {
      throw new Error(`עדכון הערכה מפורטת נכשל: ${gradingResult.error}`);
    }
    
    // 4. Set director evaluation
    const directorResult = await bagrutApi.updateDirectorEvaluation(bagrutId, bagrutData.directorEvaluation);
    if (!directorResult.success) {
      throw new Error(`עדכון הערכת מנהל נכשל: ${directorResult.error}`);
    }
    
    // 5. Calculate final grade
    const gradeResult = await bagrutApi.calculateFinalGrade(bagrutId);
    if (!gradeResult.success) {
      throw new Error(`חישוב ציון סופי נכשל: ${gradeResult.error}`);
    }
    
    // 6. Complete bagrut
    const completionResult = await bagrutApi.completeBagrut(bagrutId, bagrutData.teacherSignature);
    if (!completionResult.success) {
      throw new Error(`סיום בגרות נכשל: ${completionResult.error}`);
    }
    
    return completionResult.data;
    
  } catch (error) {
    console.error('Bagrut workflow error:', error);
    throw error;
  }
}
```

## Error Response Handling

### Error Response Parser

```javascript
class BagrutErrorHandler {
  static parseError(error) {
    // Handle network errors
    if (!error.response) {
      return {
        type: 'network',
        message: 'שגיאת רשת - בדוק את החיבור לאינטרנט',
        messageEn: 'Network error - check internet connection'
      };
    }
    
    const errorData = error.response.data || {};
    
    // Parse validation errors
    if (errorData.code === 'VALIDATION_ERROR' || errorData.validationErrors) {
      return {
        type: 'validation',
        message: errorData.error || 'שגיאת אימות',
        messageEn: errorData.errorEn || 'Validation error',
        field: errorData.field,
        validationErrors: errorData.validationErrors || [errorData],
        fieldErrors: this.extractFieldErrors(errorData)
      };
    }
    
    // Parse business logic errors
    if (errorData.code) {
      return {
        type: 'business',
        code: errorData.code,
        message: errorData.error || 'שגיאה עסקית',
        messageEn: errorData.errorEn || 'Business logic error',
        context: errorData.context,
        suggestions: this.getSuggestions(errorData.code)
      };
    }
    
    // Generic error
    return {
      type: 'generic',
      message: errorData.error || errorData.message || 'שגיאה לא ידועה',
      messageEn: errorData.errorEn || 'Unknown error'
    };
  }
  
  static extractFieldErrors(errorData) {
    const fieldErrors = {};
    
    if (errorData.validationErrors) {
      errorData.validationErrors.forEach(err => {
        if (err.field) {
          fieldErrors[err.field] = err.error || err.errorEn;
        }
      });
    } else if (errorData.field) {
      fieldErrors[errorData.field] = errorData.error || errorData.errorEn;
    }
    
    return fieldErrors;
  }
  
  static getSuggestions(errorCode) {
    const suggestions = {
      'DIRECTOR_EVALUATION_REQUIRED': [
        'השלם את הערכת המנהל לפני המשך התהליך',
        'וודא שהזנת נקודות בין 0-10',
        'הוסף הערות רלוונטיות להערכה'
      ],
      'RECITAL_CONFIG_MISSING': [
        'בחר את מספר יחידות הרסיטל (3 או 5)',
        'בחר את תחום הרסיטל (קלאסי/ג\'אז/שירה)',
        'שמור את התצורה לפני המשך'
      ],
      'INVALID_POINT_ALLOCATION': [
        'בדוק את חלוקת הנקודות בהערכה המפורטת',
        'וודא שלא עברת את המגבלות החדשות',
        'כישורי נגינה: מקסימום 40 נקודות',
        'הבנה מוזיקלית: מקסימום 30 נקודות'
      ]
    };
    
    return suggestions[errorCode] || [];
  }
  
  static displayError(error, container) {
    const parsedError = this.parseError(error);
    
    // Clear previous errors
    container.innerHTML = '';
    
    // Create error display
    const errorDiv = document.createElement('div');
    errorDiv.className = `error-message error-${parsedError.type}`;
    
    // Main error message
    const messageDiv = document.createElement('div');
    messageDiv.className = 'error-main-message';
    messageDiv.textContent = parsedError.message;
    errorDiv.appendChild(messageDiv);
    
    // Field-specific errors
    if (parsedError.fieldErrors && Object.keys(parsedError.fieldErrors).length > 0) {
      const fieldErrorsDiv = document.createElement('div');
      fieldErrorsDiv.className = 'field-errors';
      
      Object.entries(parsedError.fieldErrors).forEach(([field, message]) => {
        const fieldErrorDiv = document.createElement('div');
        fieldErrorDiv.className = 'field-error';
        fieldErrorDiv.innerHTML = `<strong>${field}:</strong> ${message}`;
        fieldErrorsDiv.appendChild(fieldErrorDiv);
      });
      
      errorDiv.appendChild(fieldErrorsDiv);
    }
    
    // Suggestions
    if (parsedError.suggestions && parsedError.suggestions.length > 0) {
      const suggestionsDiv = document.createElement('div');
      suggestionsDiv.className = 'error-suggestions';
      suggestionsDiv.innerHTML = '<strong>הצעות לפתרון:</strong>';
      
      const suggestionsList = document.createElement('ul');
      parsedError.suggestions.forEach(suggestion => {
        const li = document.createElement('li');
        li.textContent = suggestion;
        suggestionsList.appendChild(li);
      });
      
      suggestionsDiv.appendChild(suggestionsList);
      errorDiv.appendChild(suggestionsDiv);
    }
    
    container.appendChild(errorDiv);
  }
}
```

## UI Component Examples

### Director Evaluation Component (React)

```jsx
import React, { useState, useEffect } from 'react';
import { BagrutValidator } from '../utils/validation';

const DirectorEvaluationForm = ({ bagrut, onSubmit, onError }) => {
  const [points, setPoints] = useState(bagrut?.directorEvaluation?.points || '');
  const [comments, setComments] = useState(bagrut?.directorEvaluation?.comments || '');
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Real-time validation
  useEffect(() => {
    const evaluation = { points: Number(points), comments };
    const validationErrors = BagrutValidator.validateDirectorEvaluation(evaluation);
    setErrors(validationErrors);
  }, [points, comments]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (Object.keys(errors).length > 0) {
      onError?.('יש לתקן את השגיאות לפני השמירה');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await onSubmit({
        points: Number(points),
        comments
      });
    } catch (error) {
      onError?.(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="director-evaluation-form">
      <div className="form-header">
        <h3>הערכת מנהל</h3>
        <p className="form-description">
          הערכה זו מהווה 10% מהציון הסופי של התלמיד
        </p>
      </div>
      
      <div className="form-group">
        <label htmlFor="director-points">
          נקודות הערכת מנהל (0-10) *
        </label>
        <input
          id="director-points"
          type="number"
          min="0"
          max="10"
          step="1"
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          className={errors.points ? 'error' : ''}
          required
        />
        {errors.points && (
          <div className="error-message">
            {errors.points[0]}
          </div>
        )}
        
        {/* Visual point scale */}
        <div className="points-scale">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(value => (
            <button
              key={value}
              type="button"
              className={`scale-point ${points == value ? 'selected' : ''}`}
              onClick={() => setPoints(value.toString())}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
      
      <div className="form-group">
        <label htmlFor="director-comments">
          הערות מנהל
        </label>
        <textarea
          id="director-comments"
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          placeholder="הערות על הביצוע, יצירתיות, והתרשמות כללית..."
          maxLength="500"
          rows="4"
          className={errors.comments ? 'error' : ''}
        />
        <div className="character-count">
          {comments.length}/500
        </div>
        {errors.comments && (
          <div className="error-message">
            {errors.comments[0]}
          </div>
        )}
      </div>
      
      {/* Grade impact preview */}
      {points && bagrut?.presentations?.[3]?.grade && (
        <div className="grade-preview">
          <h4>תחזית ציון סופי</h4>
          <div className="grade-calculation">
            <div className="performance-component">
              ציון ביצוע: {bagrut.presentations[3].grade} (90%)
              = {Math.round(bagrut.presentations[3].grade * 0.9)}
            </div>
            <div className="director-component">
              הערכת מנהל: {points} (10%)
            </div>
            <div className="final-grade">
              <strong>
                ציון סופי משוער: {Math.round(bagrut.presentations[3].grade * 0.9) + Number(points)}
              </strong>
            </div>
          </div>
        </div>
      )}
      
      <div className="form-actions">
        <button
          type="submit"
          disabled={isSubmitting || Object.keys(errors).length > 0}
          className="btn btn-primary"
        >
          {isSubmitting ? 'שומר...' : 'שמור הערכת מנהל'}
        </button>
      </div>
    </form>
  );
};

export default DirectorEvaluationForm;
```

### Detailed Grading Component with Updated Point System

```jsx
import React, { useState, useEffect } from 'react';
import { DETAILED_GRADING_FIELDS } from '../constants/bagrutFields';
import { BagrutValidator } from '../utils/validation';

const DetailedGradingForm = ({ bagrut, onSubmit, onError }) => {
  const [grading, setGrading] = useState(
    bagrut?.presentations?.[3]?.detailedGrading || {
      playingSkills: { points: '', grade: '', comments: '' },
      musicalUnderstanding: { points: '', grade: '', comments: '' },
      textKnowledge: { points: '', grade: '', comments: '' },
      playingByHeart: { points: '', grade: '', comments: '' }
    }
  );
  
  const [errors, setErrors] = useState({});
  const [totalPoints, setTotalPoints] = useState(0);
  
  // Calculate total points
  useEffect(() => {
    const total = Object.values(grading).reduce((sum, category) => {
      return sum + (Number(category.points) || 0);
    }, 0);
    setTotalPoints(total);
  }, [grading]);
  
  // Validate grading
  useEffect(() => {
    const validationErrors = BagrutValidator.validateDetailedGrading(grading);
    setErrors(validationErrors);
  }, [grading]);
  
  const updateCategory = (categoryName, field, value) => {
    setGrading(prev => ({
      ...prev,
      [categoryName]: {
        ...prev[categoryName],
        [field]: value
      }
    }));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (Object.keys(errors).length > 0) {
      onError?.('יש לתקן את השגיאות לפני השמירה');
      return;
    }
    
    // Add maxPoints to each category
    const gradingWithMaxPoints = Object.entries(grading).reduce((acc, [category, data]) => {
      acc[category] = {
        ...data,
        points: Number(data.points),
        maxPoints: DETAILED_GRADING_FIELDS[category].maxPoints
      };
      return acc;
    }, {});
    
    try {
      await onSubmit({ detailedGrading: gradingWithMaxPoints });
    } catch (error) {
      onError?.(error.message);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="detailed-grading-form">
      <div className="form-header">
        <h3>הערכה מפורטת</h3>
        <div className="total-points">
          <strong>סך כל נקודות: {totalPoints}/100</strong>
        </div>
      </div>
      
      {Object.entries(DETAILED_GRADING_FIELDS).map(([categoryName, config]) => (
        <div key={categoryName} className="grading-category">
          <h4 className="category-title">
            {config.label}
            <span className="max-points">({config.maxPoints} נקודות)</span>
          </h4>
          
          <div className="category-inputs">
            {/* Points input */}
            <div className="form-group">
              <label>נקודות (0-{config.maxPoints})</label>
              <input
                type="number"
                min="0"
                max={config.maxPoints}
                value={grading[categoryName]?.points || ''}
                onChange={(e) => updateCategory(categoryName, 'points', e.target.value)}
                className={errors[categoryName]?.points ? 'error' : ''}
              />
              {errors[categoryName]?.points && (
                <div className="error-message">
                  {errors[categoryName].points[0]}
                </div>
              )}
            </div>
            
            {/* Grade select */}
            <div className="form-group">
              <label>הערכה איכותית</label>
              <select
                value={grading[categoryName]?.grade || ''}
                onChange={(e) => updateCategory(categoryName, 'grade', e.target.value)}
              >
                <option value="">בחר הערכה</option>
                <option value="מעולה">מעולה</option>
                <option value="טוב מאוד">טוב מאוד</option>
                <option value="טוב">טוב</option>
                <option value="מספיק">מספיק</option>
                <option value="לא מספיק">לא מספיק</option>
              </select>
            </div>
            
            {/* Comments */}
            <div className="form-group">
              <label>הערות</label>
              <textarea
                value={grading[categoryName]?.comments || ''}
                onChange={(e) => updateCategory(categoryName, 'comments', e.target.value)}
                placeholder={`הערות על ${config.label.toLowerCase()}`}
                maxLength="300"
                rows="2"
              />
              <div className="character-count">
                {(grading[categoryName]?.comments || '').length}/300
              </div>
            </div>
          </div>
          
          {/* Visual progress bar */}
          <div className="points-progress">
            <div 
              className="progress-fill"
              style={{ 
                width: `${((grading[categoryName]?.points || 0) / config.maxPoints) * 100}%` 
              }}
            />
          </div>
        </div>
      ))}
      
      {/* Grade level preview */}
      <div className="grade-preview">
        <div className="grade-breakdown">
          <h4>פירוט נקודות</h4>
          {Object.entries(DETAILED_GRADING_FIELDS).map(([category, config]) => (
            <div key={category} className="grade-line">
              <span>{config.label}:</span>
              <span>
                {grading[category]?.points || 0}/{config.maxPoints}
              </span>
            </div>
          ))}
          <div className="grade-total">
            <strong>סה"כ: {totalPoints}/100</strong>
          </div>
        </div>
        
        {totalPoints > 0 && (
          <div className="grade-level">
            <strong>רמת ציון: {getGradeLevelFromScore(totalPoints)}</strong>
          </div>
        )}
      </div>
      
      <div className="form-actions">
        <button
          type="submit"
          disabled={Object.keys(errors).length > 0}
          className="btn btn-primary"
        >
          שמור הערכה מפורטת
        </button>
      </div>
    </form>
  );
};

// Helper function (should be imported from utilities)
function getGradeLevelFromScore(score) {
  if (score >= 95) return 'מעולה מאוד';
  if (score >= 90) return 'מעולה';
  if (score >= 85) return 'טוב מאוד';
  if (score >= 80) return 'טוב';
  if (score >= 75) return 'כמעט טוב';
  if (score >= 65) return 'מספיק';
  if (score >= 55) return 'כמעט מספיק';
  return 'לא מספיק';
}

export default DetailedGradingForm;
```

## State Management Patterns

### Redux Pattern for Bagrut State

```javascript
// actions/bagrutActions.js
export const BAGRUT_ACTIONS = {
  FETCH_BAGRUT_REQUEST: 'FETCH_BAGRUT_REQUEST',
  FETCH_BAGRUT_SUCCESS: 'FETCH_BAGRUT_SUCCESS',
  FETCH_BAGRUT_FAILURE: 'FETCH_BAGRUT_FAILURE',
  
  UPDATE_DIRECTOR_EVALUATION_REQUEST: 'UPDATE_DIRECTOR_EVALUATION_REQUEST',
  UPDATE_DIRECTOR_EVALUATION_SUCCESS: 'UPDATE_DIRECTOR_EVALUATION_SUCCESS',
  UPDATE_DIRECTOR_EVALUATION_FAILURE: 'UPDATE_DIRECTOR_EVALUATION_FAILURE',
  
  CALCULATE_FINAL_GRADE_REQUEST: 'CALCULATE_FINAL_GRADE_REQUEST',
  CALCULATE_FINAL_GRADE_SUCCESS: 'CALCULATE_FINAL_GRADE_SUCCESS',
  CALCULATE_FINAL_GRADE_FAILURE: 'CALCULATE_FINAL_GRADE_FAILURE',
  
  CLEAR_ERRORS: 'CLEAR_ERRORS'
};

// Action creators
export const fetchBagrut = (bagrutId) => async (dispatch, getState) => {
  dispatch({ type: BAGRUT_ACTIONS.FETCH_BAGRUT_REQUEST });
  
  try {
    const bagrutApi = new BagrutApiService(process.env.API_URL, getState().auth.token);
    const result = await bagrutApi.getBagrut(bagrutId);
    
    if (result.success) {
      dispatch({ 
        type: BAGRUT_ACTIONS.FETCH_BAGRUT_SUCCESS, 
        payload: result.data 
      });
    } else {
      dispatch({ 
        type: BAGRUT_ACTIONS.FETCH_BAGRUT_FAILURE, 
        payload: result.error 
      });
    }
  } catch (error) {
    dispatch({ 
      type: BAGRUT_ACTIONS.FETCH_BAGRUT_FAILURE, 
      payload: error.message 
    });
  }
};

export const updateDirectorEvaluation = (bagrutId, evaluation) => async (dispatch, getState) => {
  dispatch({ type: BAGRUT_ACTIONS.UPDATE_DIRECTOR_EVALUATION_REQUEST });
  
  try {
    const bagrutApi = new BagrutApiService(process.env.API_URL, getState().auth.token);
    const result = await bagrutApi.updateDirectorEvaluation(bagrutId, evaluation);
    
    if (result.success) {
      dispatch({ 
        type: BAGRUT_ACTIONS.UPDATE_DIRECTOR_EVALUATION_SUCCESS, 
        payload: result.data 
      });
      
      // Auto-calculate final grade after director evaluation update
      dispatch(calculateFinalGrade(bagrutId));
    } else {
      dispatch({ 
        type: BAGRUT_ACTIONS.UPDATE_DIRECTOR_EVALUATION_FAILURE, 
        payload: result.error 
      });
    }
  } catch (error) {
    dispatch({ 
      type: BAGRUT_ACTIONS.UPDATE_DIRECTOR_EVALUATION_FAILURE, 
      payload: error.message 
    });
  }
};

// reducers/bagrutReducer.js
const initialState = {
  current: null,
  loading: false,
  error: null,
  calculating: false
};

export default function bagrutReducer(state = initialState, action) {
  switch (action.type) {
    case BAGRUT_ACTIONS.FETCH_BAGRUT_REQUEST:
      return {
        ...state,
        loading: true,
        error: null
      };
      
    case BAGRUT_ACTIONS.FETCH_BAGRUT_SUCCESS:
      return {
        ...state,
        loading: false,
        current: action.payload,
        error: null
      };
      
    case BAGRUT_ACTIONS.FETCH_BAGRUT_FAILURE:
      return {
        ...state,
        loading: false,
        error: action.payload
      };
      
    case BAGRUT_ACTIONS.UPDATE_DIRECTOR_EVALUATION_REQUEST:
      return {
        ...state,
        loading: true,
        error: null
      };
      
    case BAGRUT_ACTIONS.UPDATE_DIRECTOR_EVALUATION_SUCCESS:
      return {
        ...state,
        loading: false,
        current: {
          ...state.current,
          ...action.payload
        },
        error: null
      };
      
    case BAGRUT_ACTIONS.CALCULATE_FINAL_GRADE_REQUEST:
      return {
        ...state,
        calculating: true
      };
      
    case BAGRUT_ACTIONS.CALCULATE_FINAL_GRADE_SUCCESS:
      return {
        ...state,
        calculating: false,
        current: {
          ...state.current,
          finalGrade: action.payload.finalGrade,
          finalGradeLevel: action.payload.finalGradeLevel
        }
      };
      
    case BAGRUT_ACTIONS.CLEAR_ERRORS:
      return {
        ...state,
        error: null
      };
      
    default:
      return state;
  }
}
```

## Testing Strategies

### Component Testing Examples

```javascript
// __tests__/DirectorEvaluationForm.test.js
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DirectorEvaluationForm from '../components/DirectorEvaluationForm';

describe('DirectorEvaluationForm', () => {
  const mockBagrut = {
    _id: 'test-bagrut-id',
    directorEvaluation: {
      points: 8,
      comments: 'ביצוע מעולה'
    }
  };
  
  test('should render with existing data', () => {
    render(
      <DirectorEvaluationForm 
        bagrut={mockBagrut}
        onSubmit={jest.fn()}
      />
    );
    
    expect(screen.getByDisplayValue('8')).toBeInTheDocument();
    expect(screen.getByDisplayValue('ביצוע מעולה')).toBeInTheDocument();
  });
  
  test('should validate points range', async () => {
    const onError = jest.fn();
    
    render(
      <DirectorEvaluationForm 
        bagrut={mockBagrut}
        onSubmit={jest.fn()}
        onError={onError}
      />
    );
    
    const pointsInput = screen.getByLabelText(/נקודות הערכת מנהל/);
    fireEvent.change(pointsInput, { target: { value: '15' } });
    
    await waitFor(() => {
      expect(screen.getByText(/מקסימום 10 נקודות/)).toBeInTheDocument();
    });
  });
  
  test('should call onSubmit with correct data', async () => {
    const onSubmit = jest.fn();
    
    render(
      <DirectorEvaluationForm 
        bagrut={mockBagrut}
        onSubmit={onSubmit}
      />
    );
    
    const submitButton = screen.getByText('שמור הערכת מנהל');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        points: 8,
        comments: 'ביצוע מעולה'
      });
    });
  });
  
  test('should show grade impact preview', () => {
    const bagrutWithGrade = {
      ...mockBagrut,
      presentations: [{}, {}, {}, { grade: 85 }]
    };
    
    render(
      <DirectorEvaluationForm 
        bagrut={bagrutWithGrade}
        onSubmit={jest.fn()}
      />
    );
    
    // Should show calculation: (85 * 0.9) + 8 = 84.5 ≈ 85
    expect(screen.getByText(/ציון סופי משוער: 85/)).toBeInTheDocument();
  });
});

// __tests__/bagrutApi.test.js
import { BagrutApiService } from '../services/bagrutApi';

// Mock fetch
global.fetch = jest.fn();

describe('BagrutApiService', () => {
  let bagrutApi;
  
  beforeEach(() => {
    bagrutApi = new BagrutApiService('http://localhost:3000', 'test-token');
    fetch.mockClear();
  });
  
  test('should update director evaluation successfully', async () => {
    const mockResponse = {
      _id: 'bagrut-id',
      directorEvaluation: { points: 9, comments: 'מעולה' },
      finalGrade: 87
    };
    
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });
    
    const result = await bagrutApi.updateDirectorEvaluation('bagrut-id', {
      points: 9,
      comments: 'מעולה'
    });
    
    expect(result.success).toBe(true);
    expect(result.data.finalGrade).toBe(87);
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/bagrut/bagrut-id/directorEvaluation',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-token'
        }),
        body: JSON.stringify({ points: 9, comments: 'מעולה' })
      })
    );
  });
  
  test('should handle validation errors', async () => {
    const errorResponse = {
      error: 'נקודות הערכת מנהל חייבות להיות בין 0 ל-10',
      errorEn: 'Director evaluation points must be between 0 and 10',
      field: 'points'
    };
    
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve(errorResponse)
    });
    
    const result = await bagrutApi.updateDirectorEvaluation('bagrut-id', {
      points: 15
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('0 ל-10');
  });
});

// __tests__/validation.test.js
import { BagrutValidator } from '../utils/validation';

describe('BagrutValidator', () => {
  test('should validate director evaluation points', () => {
    const validEvaluation = { points: 8, comments: 'טוב' };
    const errors = BagrutValidator.validateDirectorEvaluation(validEvaluation);
    expect(Object.keys(errors)).toHaveLength(0);
  });
  
  test('should reject invalid director evaluation points', () => {
    const invalidEvaluation = { points: 15, comments: 'טוב' };
    const errors = BagrutValidator.validateDirectorEvaluation(invalidEvaluation);
    expect(errors.points).toBeDefined();
    expect(errors.points[0]).toContain('10 נקודות');
  });
  
  test('should validate detailed grading with new limits', () => {
    const validGrading = {
      playingSkills: { points: 35 }, // Max 40
      musicalUnderstanding: { points: 25 }, // Max 30
      textKnowledge: { points: 18 }, // Max 20
      playingByHeart: { points: 9 } // Max 10
    };
    
    const errors = BagrutValidator.validateDetailedGrading(validGrading);
    expect(Object.keys(errors)).toHaveLength(0);
  });
  
  test('should reject points exceeding new limits', () => {
    const invalidGrading = {
      playingSkills: { points: 45 }, // Exceeds 40
      musicalUnderstanding: { points: 35 }, // Exceeds 30
    };
    
    const errors = BagrutValidator.validateDetailedGrading(invalidGrading);
    expect(errors.playingSkills?.points).toBeDefined();
    expect(errors.musicalUnderstanding?.points).toBeDefined();
  });
});
```

This comprehensive frontend integration guide provides all the necessary components, patterns, and examples for successfully implementing the updated Bagrut system in frontend applications. The guide covers form mappings, validation, API integration, error handling, and testing strategies to ensure a robust implementation.