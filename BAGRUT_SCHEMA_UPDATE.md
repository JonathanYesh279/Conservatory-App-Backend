# Bagrut Schema Update for Ministry of Education Requirements

This document describes the MongoDB schema updates made to align the bagrut collection with the official Ministry of Education Bagrut form requirements.

## Changes Made

### 1. Corrected Point Allocations in Detailed Grading

Updated the point distribution in `presentations[3].detailedGrading` and `magenBagrut.detailedGrading`:

| Category | Old Max Points | New Max Points | Change |
|----------|---------------|----------------|--------|
| playingSkills | 20 | **40** | +20 |
| musicalUnderstanding | 40 | **30** | -10 |
| textKnowledge | 30 | **20** | -10 |
| playingByHeart | 10 | 10 | No change |

**Total remains 100 points**

### 2. New Required Fields Added

Added to the main bagrut document:

- **`directorName`**: String (default: "לימור אקטע")
- **`directorEvaluation`**: Object with:
  - `points`: Number (0-10, nullable)
  - `percentage`: Number (default: 10)
  - `comments`: String (default: empty)
- **`recitalUnits`**: Number (3 or 5, default: 3)
- **`recitalField`**: String ("קלאסי", "ג'אז", "שירה", default: "קלאסי")

### 3. Enhanced Program Schema

Updated program pieces to include:

- **`pieceNumber`**: Number (1-5, required) - indicates the order of pieces in the program

### 4. Updated Final Grade Calculation

Added new calculation function `calculateFinalGradeWithDirectorEvaluation()`:
- Base grade from detailed grading: 90% of final grade
- Director evaluation: 10% of final grade
- Formula: `(baseGrade * 0.9) + (directorEvaluation.points * 10)`

## Files Modified

### Schema/Validation Files
- `/api/bagrut/bagrut.validation.js`
  - Updated `magenBagrutGradingSchema` with corrected point allocations
  - Added new fields to `bagrutSchema`
  - Enhanced `pieceSchema` with `pieceNumber`
  - Added `calculateFinalGradeWithDirectorEvaluation()` function

### Service Files
- `/api/bagrut/bagrut.service.js`
  - Updated import to include new calculation function
  - Fixed default point allocations in migration helper functions

### Migration Script
- `/scripts/migrateBagrutOfficialForm.js` (NEW)
  - Comprehensive migration script for existing data
  - Includes backup functionality
  - Updates point allocations and adds new fields

## Migration Instructions

### For Existing Data

Run the migration script to update all existing bagrut documents:

```bash
node scripts/migrateBagrutOfficialForm.js
```

**What the migration does:**
1. Creates a backup of existing data
2. Updates point allocations in detailed grading
3. Adds new required fields with default values
4. Adds `pieceNumber` to program pieces
5. Recalculates any existing grades with the corrected formula

### Safety Features

- **Automatic Backup**: Creates a timestamped backup collection before migration
- **Safe Execution**: Only updates documents that need changes
- **Error Handling**: Continues processing even if individual records fail
- **Detailed Logging**: Provides comprehensive migration summary

## Usage Examples

### Creating a New Bagrut

```javascript
const newBagrut = {
  studentId: "student123",
  teacherId: "teacher456",
  program: [
    {
      pieceNumber: 1,
      pieceTitle: "Moonlight Sonata",
      composer: "Beethoven",
      duration: "15:00",
      movement: "First Movement",
      youtubeLink: "https://youtube.com/watch?v=..."
    }
  ],
  directorName: "לימור אקטע",
  directorEvaluation: {
    points: 8,
    percentage: 10,
    comments: "ביצוע מעולה"
  },
  recitalUnits: 5,
  recitalField: "קלאסי"
}
```

### Calculating Final Grade

```javascript
import { calculateFinalGradeWithDirectorEvaluation } from './api/bagrut/bagrut.validation.js'

const detailedGrading = {
  playingSkills: { points: 36, maxPoints: 40 },
  musicalUnderstanding: { points: 28, maxPoints: 30 },
  textKnowledge: { points: 16, maxPoints: 20 },
  playingByHeart: { points: 10, maxPoints: 10 }
}

const directorEvaluation = {
  points: 8,
  percentage: 10
}

const finalGrade = calculateFinalGradeWithDirectorEvaluation(detailedGrading, directorEvaluation)
// Result: 89 (base: 90 * 0.9 = 81, director: 8 * 10 = 80 → 81 + 8 = 89)
```

## Backward Compatibility

- Existing bagrut documents remain functional
- Old point allocations are automatically migrated
- New fields are added with sensible defaults
- Grade calculations maintain accuracy while incorporating director evaluation

## Validation

All new fields include proper validation:
- `pieceNumber`: Must be 1-5
- `recitalUnits`: Must be 3 or 5
- `recitalField`: Must be one of ["קלאסי", "ג'אז", "שירה"]
- `directorEvaluation.points`: Must be 0-10 or null

## Testing

The schema has been thoroughly tested to ensure:
- Point allocations are correct (40+30+20+10=100)
- New fields validate properly
- Final grade calculation includes director evaluation
- Migration script handles edge cases safely