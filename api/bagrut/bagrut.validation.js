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

const presentationSchema = Joi.object({
  completed: Joi.boolean().default(false),
  status: Joi.string().valid(...PRESENTATION_STATUSES).default('לא נבחן'),
  date: Joi.date().allow(null).default(null),
  review: Joi.string().allow('').default(null),
  reviewedBy: Joi.string().allow(null).default(null),
  grade: Joi.number().min(0).max(100).allow(null).default(null),
  gradeLevel: Joi.string().valid(...GRADE_LEVEL_NAMES).allow(null).default(null),
})

const pieceSchema = Joi.object({
  pieceTitle: Joi.string().required(),
  composer: Joi.string().required(),
  duration: Joi.string().required(),
  movement: Joi.string().allow('').default(''),
  youtubeLink: Joi.string().uri().allow(null).required(),
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

const gradingDetailSchema = Joi.object({
  technique: Joi.object({
    grade: Joi.number().min(0).max(20).allow(null).default(null),
    maxPoints: Joi.number().default(20),
    comments: Joi.string().allow('').default('')
  }).default({ grade: null, maxPoints: 20, comments: '' }),
  interpretation: Joi.object({
    grade: Joi.number().min(0).max(30).allow(null).default(null),
    maxPoints: Joi.number().default(30),
    comments: Joi.string().allow('').default('')
  }).default({ grade: null, maxPoints: 30, comments: '' }),
  musicality: Joi.object({
    grade: Joi.number().min(0).max(40).allow(null).default(null),
    maxPoints: Joi.number().default(40),
    comments: Joi.string().allow('').default('')
  }).default({ grade: null, maxPoints: 40, comments: '' }),
  overall: Joi.object({
    grade: Joi.number().min(0).max(10).allow(null).default(null),
    maxPoints: Joi.number().default(10),
    comments: Joi.string().allow('').default('')
  }).default({ grade: null, maxPoints: 10, comments: '' })
}).default({
  technique: { grade: null, maxPoints: 20, comments: '' },
  interpretation: { grade: null, maxPoints: 30, comments: '' },
  musicality: { grade: null, maxPoints: 40, comments: '' },
  overall: { grade: null, maxPoints: 10, comments: '' }
})

export const bagrutSchema = Joi.object({
  studentId: Joi.string().required(),
  teacherId: Joi.string().required(),
  program: Joi.array().items(pieceSchema).default([]),

  accompaniment: Joi.object({
    type: Joi.string().valid(...ACCOMPANIMENT_TYPES).required(),
    accompanists: Joi.array().items(accompanistSchema).default([]),
  }).default({ type: 'נגן מלווה', accompanists: [] }),

  presentations: Joi.array().items(presentationSchema).length(4)
    .default([
      { completed: false, status: 'לא נבחן', date: null, review: null, reviewedBy: null, grade: null, gradeLevel: null },
      { completed: false, status: 'לא נבחן', date: null, review: null, reviewedBy: null, grade: null, gradeLevel: null },
      { completed: false, status: 'לא נבחן', date: null, review: null, reviewedBy: null, grade: null, gradeLevel: null },
      { completed: false, status: 'לא נבחן', date: null, review: null, reviewedBy: null, grade: null, gradeLevel: null },
    ]),

  gradingDetails: gradingDetailSchema,

  magenBagrut: presentationSchema.default({
    completed: false,
    status: 'לא נבחן',
    date: null,
    review: null,
    reviewedBy: null,
    grade: null,
    gradeLevel: null,
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
  return bagrutSchema.validate(bagrut, { abortEarly: false })
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

export function calculateFinalGradeFromDetails(gradingDetails) {
  const { technique, interpretation, musicality, overall } = gradingDetails
  
  if (!technique.grade || !interpretation.grade || !musicality.grade || !overall.grade) {
    return null
  }
  
  return technique.grade + interpretation.grade + musicality.grade + overall.grade
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