/**
 * Relationship Validation Service
 * 
 * This service provides validation functions to ensure teacher-student 
 * relationship integrity across the database.
 */

import { getCollection } from './mongoDB.service.js';
import { ObjectId } from 'mongodb';

export const relationshipValidationService = {
  validateStudentTeacherRelationships,
  validateTeacherStudentRelationships,
  validateBidirectionalRelationships,
  detectRelationshipInconsistencies,
  repairRelationshipInconsistencies,
};

/**
 * Validate that all teachers in a student's teacherIds exist and have the student in their studentIds
 * @param {string} studentId - Student ID to validate
 * @param {Array} teacherIds - Array of teacher IDs to validate
 * @returns {Promise<Object>} Validation result
 */
async function validateStudentTeacherRelationships(studentId, teacherIds = []) {
  try {
    const teacherCollection = await getCollection('teacher');
    const validationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      validatedTeachers: []
    };

    if (!teacherIds || teacherIds.length === 0) {
      return validationResult;
    }

    for (const teacherId of teacherIds) {
      // Validate ObjectId format
      if (!ObjectId.isValid(teacherId)) {
        validationResult.isValid = false;
        validationResult.errors.push(`Invalid teacher ID format: ${teacherId}`);
        continue;
      }

      // Check if teacher exists
      const teacher = await teacherCollection.findOne({
        _id: ObjectId.createFromHexString(teacherId),
        isActive: { $ne: false }
      });

      if (!teacher) {
        validationResult.isValid = false;
        validationResult.errors.push(`Teacher not found: ${teacherId}`);
        continue;
      }

      // Check if teacher has student in their studentIds
      const teacherStudentIds = teacher.teaching?.studentIds || [];
      if (!teacherStudentIds.includes(studentId)) {
        validationResult.warnings.push({
          type: 'MISSING_BIDIRECTIONAL_LINK',
          message: `Teacher ${teacherId} (${teacher.personalInfo?.fullName}) doesn't have student ${studentId} in studentIds`,
          teacherId,
          teacherName: teacher.personalInfo?.fullName,
          fixable: true
        });
      }

      validationResult.validatedTeachers.push({
        teacherId,
        teacherName: teacher.personalInfo?.fullName,
        instrument: teacher.professionalInfo?.instrument,
        hasStudentLinked: teacherStudentIds.includes(studentId)
      });
    }

    return validationResult;
  } catch (error) {
    console.error('Error validating student-teacher relationships:', error);
    return {
      isValid: false,
      errors: [`Validation failed: ${error.message}`],
      warnings: [],
      validatedTeachers: []
    };
  }
}

/**
 * Validate that all students in a teacher's studentIds exist and have the teacher in their teacherIds
 * @param {string} teacherId - Teacher ID to validate
 * @param {Array} studentIds - Array of student IDs to validate
 * @returns {Promise<Object>} Validation result
 */
async function validateTeacherStudentRelationships(teacherId, studentIds = []) {
  try {
    const studentCollection = await getCollection('student');
    const validationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      validatedStudents: []
    };

    if (!studentIds || studentIds.length === 0) {
      return validationResult;
    }

    for (const studentId of studentIds) {
      // Validate ObjectId format
      if (!ObjectId.isValid(studentId)) {
        validationResult.isValid = false;
        validationResult.errors.push(`Invalid student ID format: ${studentId}`);
        continue;
      }

      // Check if student exists
      const student = await studentCollection.findOne({
        _id: ObjectId.createFromHexString(studentId),
        isActive: { $ne: false }
      });

      if (!student) {
        validationResult.isValid = false;
        validationResult.errors.push(`Student not found: ${studentId}`);
        continue;
      }

      // Check if student has teacher in their teacherIds
      const studentTeacherIds = student.teacherIds || [];
      if (!studentTeacherIds.includes(teacherId)) {
        validationResult.warnings.push({
          type: 'MISSING_BIDIRECTIONAL_LINK',
          message: `Student ${studentId} (${student.personalInfo?.fullName}) doesn't have teacher ${teacherId} in teacherIds`,
          studentId,
          studentName: student.personalInfo?.fullName,
          fixable: true
        });
      }

      validationResult.validatedStudents.push({
        studentId,
        studentName: student.personalInfo?.fullName,
        hasTeacherLinked: studentTeacherIds.includes(teacherId)
      });
    }

    return validationResult;
  } catch (error) {
    console.error('Error validating teacher-student relationships:', error);
    return {
      isValid: false,
      errors: [`Validation failed: ${error.message}`],
      warnings: [],
      validatedStudents: []
    };
  }
}

/**
 * Validate bidirectional relationships for a specific student-teacher pair
 * @param {string} studentId - Student ID
 * @param {string} teacherId - Teacher ID
 * @returns {Promise<Object>} Validation result
 */
async function validateBidirectionalRelationships(studentId, teacherId) {
  try {
    const studentCollection = await getCollection('student');
    const teacherCollection = await getCollection('teacher');

    const result = {
      isValid: true,
      studentHasTeacher: false,
      teacherHasStudent: false,
      errors: []
    };

    // Validate ObjectId formats
    if (!ObjectId.isValid(studentId)) {
      result.isValid = false;
      result.errors.push(`Invalid student ID format: ${studentId}`);
      return result;
    }

    if (!ObjectId.isValid(teacherId)) {
      result.isValid = false;
      result.errors.push(`Invalid teacher ID format: ${teacherId}`);
      return result;
    }

    // Check student
    const student = await studentCollection.findOne({
      _id: ObjectId.createFromHexString(studentId)
    });

    if (!student) {
      result.isValid = false;
      result.errors.push(`Student not found: ${studentId}`);
    } else {
      const studentTeacherIds = student.teacherIds || [];
      result.studentHasTeacher = studentTeacherIds.includes(teacherId);
    }

    // Check teacher
    const teacher = await teacherCollection.findOne({
      _id: ObjectId.createFromHexString(teacherId)
    });

    if (!teacher) {
      result.isValid = false;
      result.errors.push(`Teacher not found: ${teacherId}`);
    } else {
      const teacherStudentIds = teacher.teaching?.studentIds || [];
      result.teacherHasStudent = teacherStudentIds.includes(studentId);
    }

    // Check bidirectional consistency
    if (result.isValid && result.studentHasTeacher !== result.teacherHasStudent) {
      result.isValid = false;
      result.errors.push(
        `Bidirectional relationship inconsistency: ` +
        `Student has teacher: ${result.studentHasTeacher}, ` +
        `Teacher has student: ${result.teacherHasStudent}`
      );
    }

    return result;
  } catch (error) {
    console.error('Error validating bidirectional relationships:', error);
    return {
      isValid: false,
      studentHasTeacher: false,
      teacherHasStudent: false,
      errors: [`Validation failed: ${error.message}`]
    };
  }
}

/**
 * Detect all relationship inconsistencies in the database
 * @returns {Promise<Object>} Inconsistencies report
 */
async function detectRelationshipInconsistencies() {
  try {
    const studentCollection = await getCollection('student');
    const teacherCollection = await getCollection('teacher');

    const report = {
      summary: {
        totalStudents: 0,
        totalTeachers: 0,
        studentsWithTeachers: 0,
        teachersWithStudents: 0,
        inconsistentRelationships: 0
      },
      inconsistencies: [],
      orphanedReferences: {
        studentsWithInvalidTeachers: [],
        teachersWithInvalidStudents: []
      }
    };

    // Analyze students
    const students = await studentCollection.find({ 
      isActive: { $ne: false } 
    }).toArray();
    
    report.summary.totalStudents = students.length;

    for (const student of students) {
      const studentId = student._id.toString();
      const teacherIds = student.teacherIds || [];

      if (teacherIds.length > 0) {
        report.summary.studentsWithTeachers++;

        for (const teacherId of teacherIds) {
          if (!ObjectId.isValid(teacherId)) {
            report.orphanedReferences.studentsWithInvalidTeachers.push({
              studentId,
              studentName: student.personalInfo?.fullName,
              invalidTeacherId: teacherId
            });
            continue;
          }

          const teacher = await teacherCollection.findOne({
            _id: ObjectId.createFromHexString(teacherId)
          });

          if (!teacher) {
            report.orphanedReferences.studentsWithInvalidTeachers.push({
              studentId,
              studentName: student.personalInfo?.fullName,
              missingTeacherId: teacherId
            });
            continue;
          }

          const teacherStudentIds = teacher.teaching?.studentIds || [];
          if (!teacherStudentIds.includes(studentId)) {
            report.inconsistencies.push({
              type: 'STUDENT_HAS_TEACHER_BUT_TEACHER_MISSING_STUDENT',
              studentId,
              studentName: student.personalInfo?.fullName,
              teacherId,
              teacherName: teacher.personalInfo?.fullName,
              description: `Student ${studentId} has teacher ${teacherId} but teacher doesn't have student`
            });
            report.summary.inconsistentRelationships++;
          }
        }
      }
    }

    // Analyze teachers
    const teachers = await teacherCollection.find({ 
      isActive: { $ne: false } 
    }).toArray();
    
    report.summary.totalTeachers = teachers.length;

    for (const teacher of teachers) {
      const teacherId = teacher._id.toString();
      const studentIds = teacher.teaching?.studentIds || [];

      if (studentIds.length > 0) {
        report.summary.teachersWithStudents++;

        for (const studentId of studentIds) {
          if (!ObjectId.isValid(studentId)) {
            report.orphanedReferences.teachersWithInvalidStudents.push({
              teacherId,
              teacherName: teacher.personalInfo?.fullName,
              invalidStudentId: studentId
            });
            continue;
          }

          const student = await studentCollection.findOne({
            _id: ObjectId.createFromHexString(studentId)
          });

          if (!student) {
            report.orphanedReferences.teachersWithInvalidStudents.push({
              teacherId,
              teacherName: teacher.personalInfo?.fullName,
              missingStudentId: studentId
            });
            continue;
          }

          const studentTeacherIds = student.teacherIds || [];
          if (!studentTeacherIds.includes(teacherId)) {
            // Check if we already have this inconsistency from the student side
            const existingInconsistency = report.inconsistencies.find(inc => 
              inc.studentId === studentId && inc.teacherId === teacherId
            );

            if (!existingInconsistency) {
              report.inconsistencies.push({
                type: 'TEACHER_HAS_STUDENT_BUT_STUDENT_MISSING_TEACHER',
                studentId,
                studentName: student.personalInfo?.fullName,
                teacherId,
                teacherName: teacher.personalInfo?.fullName,
                description: `Teacher ${teacherId} has student ${studentId} but student doesn't have teacher`
              });
              report.summary.inconsistentRelationships++;
            }
          }
        }
      }
    }

    return report;
  } catch (error) {
    console.error('Error detecting relationship inconsistencies:', error);
    throw error;
  }
}

/**
 * Repair detected relationship inconsistencies
 * @param {Object} inconsistenciesReport - Report from detectRelationshipInconsistencies
 * @param {boolean} dryRun - If true, only simulate repairs without making changes
 * @returns {Promise<Object>} Repair results
 */
async function repairRelationshipInconsistencies(inconsistenciesReport, dryRun = false) {
  try {
    const studentCollection = await getCollection('student');
    const teacherCollection = await getCollection('teacher');

    const repairResults = {
      dryRun,
      repaired: {
        studentTeacherLinks: 0,
        teacherStudentLinks: 0,
        orphanedReferences: 0
      },
      errors: []
    };

    console.log(`${dryRun ? '🧪 DRY RUN:' : '🔧'} Repairing ${inconsistenciesReport.inconsistencies.length} inconsistencies...`);

    // Repair bidirectional relationship inconsistencies
    for (const inconsistency of inconsistenciesReport.inconsistencies) {
      try {
        const { studentId, teacherId, type } = inconsistency;

        if (type === 'STUDENT_HAS_TEACHER_BUT_TEACHER_MISSING_STUDENT') {
          console.log(`${dryRun ? 'WOULD REPAIR:' : 'REPAIRING:'} Adding student ${studentId} to teacher ${teacherId}`);
          
          if (!dryRun) {
            await teacherCollection.updateOne(
              { _id: ObjectId.createFromHexString(teacherId) },
              { 
                $addToSet: { 'teaching.studentIds': studentId },
                $set: { updatedAt: new Date() }
              }
            );
          }
          repairResults.repaired.teacherStudentLinks++;

        } else if (type === 'TEACHER_HAS_STUDENT_BUT_STUDENT_MISSING_TEACHER') {
          console.log(`${dryRun ? 'WOULD REPAIR:' : 'REPAIRING:'} Adding teacher ${teacherId} to student ${studentId}`);
          
          if (!dryRun) {
            await studentCollection.updateOne(
              { _id: ObjectId.createFromHexString(studentId) },
              { 
                $addToSet: { teacherIds: teacherId },
                $set: { updatedAt: new Date() }
              }
            );
          }
          repairResults.repaired.studentTeacherLinks++;
        }

      } catch (error) {
        repairResults.errors.push(`Failed to repair ${inconsistency.type}: ${error.message}`);
        console.error(`❌ Repair failed:`, error);
      }
    }

    // Clean up orphaned references
    const orphanedStudentRefs = inconsistenciesReport.orphanedReferences.studentsWithInvalidTeachers;
    const orphanedTeacherRefs = inconsistenciesReport.orphanedReferences.teachersWithInvalidStudents;

    for (const orphan of orphanedStudentRefs) {
      console.log(`${dryRun ? 'WOULD CLEAN:' : 'CLEANING:'} Invalid teacher reference from student ${orphan.studentId}`);
      
      if (!dryRun) {
        await studentCollection.updateOne(
          { _id: ObjectId.createFromHexString(orphan.studentId) },
          { 
            $pull: { teacherIds: orphan.invalidTeacherId || orphan.missingTeacherId },
            $set: { updatedAt: new Date() }
          }
        );
      }
      repairResults.repaired.orphanedReferences++;
    }

    for (const orphan of orphanedTeacherRefs) {
      console.log(`${dryRun ? 'WOULD CLEAN:' : 'CLEANING:'} Invalid student reference from teacher ${orphan.teacherId}`);
      
      if (!dryRun) {
        await teacherCollection.updateOne(
          { _id: ObjectId.createFromHexString(orphan.teacherId) },
          { 
            $pull: { 'teaching.studentIds': orphan.invalidStudentId || orphan.missingStudentId },
            $set: { updatedAt: new Date() }
          }
        );
      }
      repairResults.repaired.orphanedReferences++;
    }

    return repairResults;
  } catch (error) {
    console.error('Error repairing relationship inconsistencies:', error);
    throw error;
  }
}