import Joi from 'joi';

const VALID_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];

// Validation schema for teacher-student assignment
export const teacherStudentAssignmentSchema = Joi.object({
  studentId: Joi.string().required().messages({
    'any.required': 'מזהה התלמיד הוא שדה חובה',
  }),
});

export function validateTeacherStudentAssignment(data) {
  return teacherStudentAssignmentSchema.validate(data, { abortEarly: false });
}

export const SCHEDULE_CONSTANTS = {
  VALID_DAYS,
};
