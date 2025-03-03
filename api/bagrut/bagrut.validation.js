import Joi from 'joi'

const PRESENTATION_STATUSES = ['עבר/ה', 'לא עבר/ה', 'לא נבחן']
const ACCOMPANIMENT_TYPES = ['נגן מלווה', 'הרכב']

const presentationSchema = Joi.object({
  completed: Joi.boolean().default(false),
  status: Joi.string().valid(...PRESENTATION_STATUSES).default('לא נבחן'),
  date: Joi.date().allow(null).default(null),
  review: Joi.string().allow('').default(null),
  reviewedBy: Joi.string().allow(null).default(null),
})

const pieceSchema = Joi.object({
  pieceTitle: Joi.string().required(),
  composer: Joi.string().required(),
  duration: Joi.string().required(),
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
  uploadDate: Joi.date().default(Date.now),
  uploadedBy: Joi.string().required(),
})

export const bagrutSchema = Joi.object({
  studentId: Joi.string().required(),
  teacherId: Joi.string().required(),
  program: Joi.array().items(pieceSchema).default([]),

  accompaniment: Joi.object({
    type: Joi.string().valid(...ACCOMPANIMENT_TYPES).required(),
    accompanists: Joi.array().items(accompanistSchema).default([]),
  }).default({ type: 'נגן מלווה', accompanists: [] }),

  presentations: Joi.array().items(presentationSchema).length(3)
    .default([
      { completed: false, status: 'לא נבחן', date: null, review: null, reviewedBy: null },
      { completed: false, status: 'לא נבחן', date: null, review: null, reviewedBy: null },
      { completed: false, status: 'לא נבחן', date: null, review: null, reviewedBy: null },
    ]),

  magenBagrut: presentationSchema.default({
    completed: false,
    status: 'לא נבחן',
    date: null,
    review: null,
    reviewedBy: null,
  }),

  documents: Joi.array().items(documentSchema).default([]),

  testDate: Joi.date().allow(null).default(null),
  notes: Joi.string().allow('').default(''),
  isActive: Joi.boolean().default(true),
  createdAt: Joi.date().default(Date.now),
  updatedAt: Joi.date().default(Date.now),
})

export function validateBagrut(bagrut) {
  return bagrutSchema.validate(bagrut, { abortEarly: false });
}

export const BAGRUT_CONSTANTS = {
  PRESENTATION_STATUSES,
  ACCOMPANIMENT_TYPES,
}
