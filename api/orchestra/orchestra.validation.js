import Joi from 'joi'

const VALID_TYPES = ['הרכב', 'תזמורת']
const VALID_LOCATIONS = [
  'אולם ערן',
  'סטודיו קאמרי 1',
  'סטודיו קאמרי 2',
  'אולפן הקלטות',
  'חדר חזרות 1',
  'חדר חזרות 2',
  'חדר מחשבים',
  'חדר 1',
  'חדר 2',
  'חדר חזרות',
  'חדר 5',
  'חדר 6',
  'חדר 7',
  'חדר 8',
  'חדר 9',
  'חדר 10',
  'חדר 11',
  'חדר 12',
  'חדר 13',
  'חדר 14',
  'חדר 15',
  'חדר 16',
  'חדר 17',
  'חדר 18',
  'חדר 19',
  'חדר 20',
  'חדר 21',
  'חדר 22',
  'חדר 23',
  'חדר 24',
  'חדר 25',
  'חדר 26',
  'חדר תאוריה א',
  'חדר תאוריה ב',
];

export const orchestraSchema = Joi.object({
  // Allow any name string (removed validation against VALID_NAMES)
  name: Joi.string().trim().required(),
  type: Joi.string()
    .valid(...VALID_TYPES)
    .required(),
  conductorId: Joi.string().required(),
  memberIds: Joi.array().items(Joi.string()).default([]),
  rehearsalIds: Joi.array().items(Joi.string()).default([]),
  schoolYearId: Joi.string().required(),
  location: Joi.string()
    .valid(...VALID_LOCATIONS)
    .default('חדר 1'),
  isActive: Joi.boolean().default(true),
});

export function validateOrchestra(orchestra) {
  return orchestraSchema.validate(orchestra, { abortEarly: false });
}

export const ORCHESTRA_CONSTANTS = {
  VALID_TYPES,
  VALID_LOCATIONS,
};