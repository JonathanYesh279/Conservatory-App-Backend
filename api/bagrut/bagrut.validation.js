import Joi from 'joi'

const PRESENTATION_STATUSES = ['עבר/ה', 'לא עבר/ה', 'לא נבחן']
const ACCOMPANIMENT_TYPES = ['נגן מלווה', 'הרכב']
const GRADE_LEVELS = {
  'מעולה': { min: 95, max: 100 },
  'טוב מאוד': { min: 90, max: 94 },
  'טוב': { min: 75, max: 89 },
  'מספיק': { min: 55, max: 74 },
  'מספיק בקושי': { min: 45, max: 54 },
  'לא עבר/ה': { min: 0, max: 44 }
}
const GRADE_LEVEL_NAMES = Object.keys(GRADE_LEVELS)

const magenBagrutGradingSchema = Joi.object({
  playingSkills: Joi.object({
    grade: Joi.string().valid('לא הוערך', 'מעולה', 'טוב מאוד', 'טוב', 'מספיק', 'מספיק בקושי', 'לא עבר/ה').default('לא הוערך'),
    points: Joi.number().min(0).max(40).allow(null).default(null),
    maxPoints: Joi.number().default(40),
    comments: Joi.string().allow('').default('אין הערות')
  }).default({ grade: 'לא הוערך', points: null, maxPoints: 40, comments: 'אין הערות' }),
  
  musicalUnderstanding: Joi.object({
    grade: Joi.string().valid('לא הוערך', 'מעולה', 'טוב מאוד', 'טוב', 'מספיק', 'מספיק בקושי', 'לא עבר/ה').default('לא הוערך'),
    points: Joi.number().min(0).max(30).allow(null).default(null),
    maxPoints: Joi.number().default(30),
    comments: Joi.string().allow('').default('אין הערות')
  }).default({ grade: 'לא הוערך', points: null, maxPoints: 30, comments: 'אין הערות' }),
  
  textKnowledge: Joi.object({
    grade: Joi.string().valid('לא הוערך', 'מעולה', 'טוב מאוד', 'טוב', 'מספיק', 'מספיק בקושי', 'לא עבר/ה').default('לא הוערך'),
    points: Joi.number().min(0).max(20).allow(null).default(null),
    maxPoints: Joi.number().default(20),
    comments: Joi.string().allow('').default('אין הערות')
  }).default({ grade: 'לא הוערך', points: null, maxPoints: 20, comments: 'אין הערות' }),
  
  playingByHeart: Joi.object({
    grade: Joi.string().valid('לא הוערך', 'מעולה', 'טוב מאוד', 'טוב', 'מספיק', 'מספיק בקושי', 'לא עבר/ה').default('לא הוערך'),
    points: Joi.number().min(0).max(10).allow(null).default(null),
    maxPoints: Joi.number().default(10),
    comments: Joi.string().allow('').default('אין הערות')
  }).default({ grade: 'לא הוערך', points: null, maxPoints: 10, comments: 'אין הערות' })
}).default({
  playingSkills: { grade: 'לא הוערך', points: null, maxPoints: 40, comments: 'אין הערות' },
  musicalUnderstanding: { grade: 'לא הוערך', points: null, maxPoints: 30, comments: 'אין הערות' },
  textKnowledge: { grade: 'לא הוערך', points: null, maxPoints: 20, comments: 'אין הערות' },
  playingByHeart: { grade: 'לא הוערך', points: null, maxPoints: 10, comments: 'אין הערות' }
})

const pieceGradingSchema = Joi.object({
  pieceNumber: Joi.number().integer().min(1).max(5).required(),
  pieceTitle: Joi.string().allow('').default(''),
  composer: Joi.string().allow('').default(''),
  playingSkills: Joi.number().min(0).max(40).allow(null).default(null),
  musicalUnderstanding: Joi.number().min(0).max(30).allow(null).default(null),
  textKnowledge: Joi.number().min(0).max(20).allow(null).default(null),
  playingByHeart: Joi.boolean().default(false),
  comments: Joi.string().allow('').default('')
})

const presentationSchemaWithNotes = Joi.object({
  completed: Joi.boolean().default(false),
  status: Joi.string().valid(...PRESENTATION_STATUSES).default('לא נבחן'),
  date: Joi.date().allow(null).default(null),
  review: Joi.string().allow('', null).default(null),
  reviewedBy: Joi.string().allow(null).default(null),
  lastUpdatedBy: Joi.string().allow(null).default(null),
  notes: Joi.string().allow('').default(''),
  recordingLinks: Joi.array().items(Joi.string().uri()).default([]),
})

const presentationSchemaWithGrade = Joi.object({
  completed: Joi.boolean().default(false),
  status: Joi.string().valid(...PRESENTATION_STATUSES).default('לא נבחן'),
  date: Joi.date().allow(null).default(null),
  review: Joi.string().allow('', null).default(null),
  reviewedBy: Joi.string().allow(null).default(null),
  lastUpdatedBy: Joi.string().allow(null).default(null),
  grade: Joi.number().min(0).max(100).allow(null).default(null),
  gradeLevel: Joi.string().valid(...GRADE_LEVEL_NAMES).allow(null).default(null),
  recordingLinks: Joi.array().items(Joi.string().uri()).default([]),
  detailedGrading: magenBagrutGradingSchema.default({
    playingSkills: { grade: 'לא הוערך', points: null, maxPoints: 40, comments: 'אין הערות' },
    musicalUnderstanding: { grade: 'לא הוערך', points: null, maxPoints: 30, comments: 'אין הערות' },
    textKnowledge: { grade: 'לא הוערך', points: null, maxPoints: 20, comments: 'אין הערות' },
    playingByHeart: { grade: 'לא הוערך', points: null, maxPoints: 10, comments: 'אין הערות' }
  }),
  pieceGradings: Joi.array().items(pieceGradingSchema).default([])
})

const pieceSchema = Joi.object({
  pieceNumber: Joi.number().integer().min(1).max(5).required(),
  pieceTitle: Joi.string().allow('').default(''),
  composer: Joi.string().allow('').default(''),
  duration: Joi.string().allow('').default(''),
  movement: Joi.string().allow('').default(''),
  youtubeLink: Joi.string().uri().allow('', null).default(null),
})

const accompanistSchema = Joi.object({
  name: Joi.string().required(),
  instrument: Joi.string().required(),
  phone: Joi.string().pattern(/^05\d{8}$/).allow(null),
})

const documentSchema = Joi.object({
  title: Joi.string().required(),
  fileUrl: Joi.string().required(),
  fileKey: Joi.string().allow(null).default(null),
  uploadDate: Joi.date().default(() => new Date()),
  uploadedBy: Joi.string().required(),
})


export const bagrutSchema = Joi.object({
  studentId: Joi.string().required(),
  teacherId: Joi.string().required(),
  program: Joi.array().items(pieceSchema).default([]),
  
  // New required fields for official Bagrut form
  directorName: Joi.string().default('לימור אקטע'),
  directorEvaluation: Joi.object({
    points: Joi.number().min(0).max(10).allow(null).default(null),
    percentage: Joi.number().default(10),
    comments: Joi.string().allow('').default('')
  }).default({ points: null, percentage: 10, comments: '' }),
  recitalUnits: Joi.number().valid(3, 5).default(5),
  recitalField: Joi.string().valid('קלאסי', 'ג\'אז', 'שירה', 'מוסיקה ישראלית', 'מוסיקה עולמית').default('קלאסי'),

  accompaniment: Joi.object({
    type: Joi.string().valid(...ACCOMPANIMENT_TYPES).default('נגן מלווה'),
    accompanists: Joi.array().items(accompanistSchema).default([]),
  }).default({ type: 'נגן מלווה', accompanists: [] }),

  presentations: Joi.array().items(Joi.alternatives().try(
    presentationSchemaWithNotes,
    presentationSchemaWithGrade
  )).max(4)
    .default([
      { completed: false, status: 'לא נבחן', date: null, review: null, reviewedBy: null, lastUpdatedBy: null, notes: '', recordingLinks: [] },
      { completed: false, status: 'לא נבחן', date: null, review: null, reviewedBy: null, lastUpdatedBy: null, notes: '', recordingLinks: [] },
      { completed: false, status: 'לא נבחן', date: null, review: null, reviewedBy: null, lastUpdatedBy: null, notes: '', recordingLinks: [] },
      { 
        completed: false, 
        status: 'לא נבחן', 
        date: null, 
        review: null, 
        reviewedBy: null, 
        lastUpdatedBy: null,
        grade: null, 
        gradeLevel: null,
        recordingLinks: [],
        detailedGrading: {
          playingSkills: { grade: 'לא הוערך', points: null, maxPoints: 40, comments: 'אין הערות' },
          musicalUnderstanding: { grade: 'לא הוערך', points: null, maxPoints: 30, comments: 'אין הערות' },
          textKnowledge: { grade: 'לא הוערך', points: null, maxPoints: 20, comments: 'אין הערות' },
          playingByHeart: { grade: 'לא הוערך', points: null, maxPoints: 10, comments: 'אין הערות' }
        }
      }
    ]),

  // Legacy gradingDetails field for backward compatibility (optional)
  gradingDetails: Joi.object({
    technique: Joi.object({
      grade: Joi.number().allow(null).default(null),
      maxPoints: Joi.number().default(20),
      comments: Joi.string().allow('').default('')
    }).default({ grade: null, maxPoints: 20, comments: '' }),
    interpretation: Joi.object({
      grade: Joi.number().allow(null).default(null), 
      maxPoints: Joi.number().default(30),
      comments: Joi.string().allow('').default('')
    }).default({ grade: null, maxPoints: 30, comments: '' }),
    musicality: Joi.object({
      grade: Joi.number().allow(null).default(null),
      maxPoints: Joi.number().default(40), 
      comments: Joi.string().allow('').default('')
    }).default({ grade: null, maxPoints: 40, comments: '' }),
    overall: Joi.object({
      grade: Joi.number().allow(null).default(null),
      maxPoints: Joi.number().default(10),
      comments: Joi.string().allow('').default('')
    }).default({ grade: null, maxPoints: 10, comments: '' })
  }).optional(),

  magenBagrut: presentationSchemaWithGrade.default({
    completed: false,
    status: 'לא נבחן',
    date: null,
    review: null,
    reviewedBy: null,
    lastUpdatedBy: null,
    grade: null,
    gradeLevel: null,
    recordingLinks: [],
    detailedGrading: {
      playingSkills: { grade: 'לא הוערך', points: null, maxPoints: 40, comments: 'אין הערות' },
      musicalUnderstanding: { grade: 'לא הוערך', points: null, maxPoints: 30, comments: 'אין הערות' },
      textKnowledge: { grade: 'לא הוערך', points: null, maxPoints: 20, comments: 'אין הערות' },
      playingByHeart: { grade: 'לא הוערך', points: null, maxPoints: 10, comments: 'אין הערות' }
    },
    pieceGradings: []
  }),

  documents: Joi.array().items(documentSchema).default([]),

  conservatoryName: Joi.string().allow('').default(''),
  finalGrade: Joi.number().min(0).max(100).allow(null).default(null),
  finalGradeLevel: Joi.string().valid(...GRADE_LEVEL_NAMES).allow(null).default(null),
  teacherSignature: Joi.string().allow('').default(''),
  completionDate: Joi.date().allow(null).default(null),
  isCompleted: Joi.boolean().default(false),
  testDate: Joi.date().allow(null).default(null),
  notes: Joi.string().allow('').default(''),
  isActive: Joi.boolean().default(true),
  createdAt: Joi.date().default(() => new Date()),
  updatedAt: Joi.date().default(() => new Date()),
})

export function validateBagrut(bagrut) {
  const result = bagrutSchema.validate(bagrut, { abortEarly: false })
  return result
}

export function getGradeLevelFromScore(score) {
  if (score === null || score === undefined) return null
  
  for (const [level, range] of Object.entries(GRADE_LEVELS)) {
    if (score >= range.min && score <= range.max) {
      return level
    }
  }
  return 'לא עבר/ה'
}

export function validateGradeConsistency(grade, gradeLevel) {
  if (grade === null || gradeLevel === null) return true
  
  const expectedLevel = getGradeLevelFromScore(grade)
  return expectedLevel === gradeLevel
}


export function calculateTotalGradeFromDetailedGrading(detailedGrading) {
  if (!detailedGrading) return null
  
  const { playingSkills, musicalUnderstanding, textKnowledge, playingByHeart } = detailedGrading
  
  // Check if all categories have points assigned
  if (!playingSkills?.points && playingSkills?.points !== 0 ||
      !musicalUnderstanding?.points && musicalUnderstanding?.points !== 0 ||
      !textKnowledge?.points && textKnowledge?.points !== 0 ||
      !playingByHeart?.points && playingByHeart?.points !== 0) {
    return null
  }
  
  const totalPoints = playingSkills.points + musicalUnderstanding.points + textKnowledge.points + playingByHeart.points
  
  // Ensure total doesn't exceed 100
  return Math.min(totalPoints, 100)
}

export function calculateFinalGradeWithDirector(performanceGrade, directorEvaluation) {
  if (!performanceGrade || !directorEvaluation?.points) return null;
  return (performanceGrade * 0.9) + (directorEvaluation.points);
}

export function calculateFinalGradeWithDirectorEvaluation(detailedGrading, directorEvaluation) {
  const baseGrade = calculateTotalGradeFromDetailedGrading(detailedGrading)
  
  if (baseGrade === null || !directorEvaluation?.points && directorEvaluation?.points !== 0) {
    return null
  }
  
  // Base grade is 90% of final grade, director evaluation is 10%
  const finalGrade = Math.round((baseGrade * 0.9) + (directorEvaluation.points * directorEvaluation.percentage / 100 * 100))
  
  // Ensure final grade doesn't exceed 100
  return Math.min(finalGrade, 100)
}

export function validateBagrutCompletion(bagrut) {
  const errors = []
  
  const incompletePresentation = bagrut.presentations.find(p => !p.completed)
  if (incompletePresentation) {
    errors.push('כל ההשמעות חייבות להיות מושלמות')
  }
  
  if (!bagrut.magenBagrut.completed) {
    errors.push('מגן בגרות חייב להיות מושלם')
  }
  
  if (!bagrut.program || bagrut.program.length === 0) {
    errors.push('חובה להוסיף יצירות לתוכנית')
  }
  
  return errors
}

export const BAGRUT_CONSTANTS = {
  PRESENTATION_STATUSES,
  ACCOMPANIMENT_TYPES,
  GRADE_LEVELS,
  GRADE_LEVEL_NAMES,
}