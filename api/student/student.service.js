// api/student/student.service.js
import { ObjectId } from 'bson';
import { getCollection } from '../../services/mongoDB.service.js';
import { validateStudent } from './student.validation.js';

export const studentService = {
  getStudents,
  getStudentById,
  addStudent,
  updateStudent,
  updateStudentTest,
  removeStudent,
  checkTeacherHasAccessToStudent,
  associateStudentWithTeacher,
  removeStudentTeacherAssociation,
};

async function getStudents(filterBy = {}) {
  try {
    const collection = await getCollection('student');
    const criteria = _buildCriteria(filterBy);

    const students = await collection.find(criteria).toArray();
    return students;
  } catch (err) {
    console.error(`Error getting students: ${err.message}`);
    throw new Error(`Error getting students: ${err.message}`);
  }
}

async function getStudentById(studentId) {
  try {
    console.log(`🔍 Student service: Getting student by ID: ${studentId}`);
    
    // Validate ObjectId format
    if (!ObjectId.isValid(studentId)) {
      throw new Error(`Invalid student ID format: ${studentId}`);
    }
    
    const collection = await getCollection('student');
    const student = await collection.findOne({
      _id: ObjectId.createFromHexString(studentId),
    });

    if (!student) {
      throw new Error(`Student with id ${studentId} not found`);
    }
    
    console.log(`✅ Student service: Found student: ${student.personalInfo?.fullName || 'Unknown'}`);
    return student;
  } catch (err) {
    console.error(`❌ Student service error for ID ${studentId}:`, err.message);
    console.error('Stack trace:', err.stack);
    throw new Error(`Error getting student by id: ${err.message}`);
  }
}

async function addStudent(studentToAdd, teacherId = null, isAdmin = false) {
  try {
    // Validate with the standard (strict) schema
    const { error, value } = validateStudent(studentToAdd);
    if (error) throw error;

    // Ensure we have a primary instrument
    if (value.academicInfo.instrumentProgress) {
      const hasPrimary = value.academicInfo.instrumentProgress.some(
        (inst) => inst.isPrimary
      );
      if (!hasPrimary && value.academicInfo.instrumentProgress.length > 0) {
        value.academicInfo.instrumentProgress[0].isPrimary = true;
      }
    }

    if (
      !value.enrollments?.schoolYears ||
      value.enrollments.schoolYears.length === 0
    ) {
      const schoolYearService = (
        await import('../school-year/school-year.service.js')
      ).schoolYearService;
      const currentSchoolYear = await schoolYearService.getCurrentSchoolYear();

      if (!value.enrollments) {
        value.enrollments = {};
      }

      if (!value.enrollments.schoolYears) {
        value.enrollments.schoolYears = [];
      }

      value.enrollments.schoolYears.push({
        schoolYearId: currentSchoolYear._id.toString(),
        isActive: true,
      });
    }

    // Initialize relationship arrays if not present
    if (!value.teacherIds) value.teacherIds = [];
    if (!value.teacherAssignments) value.teacherAssignments = [];

    value.createdAt = new Date();
    value.updatedAt = new Date();

    const collection = await getCollection('student');
    const result = await collection.insertOne(value);

    if (teacherId && !isAdmin) {
      await associateStudentWithTeacher(
        result.insertedId.toString(),
        teacherId
      );
    }

    return { _id: result.insertedId, ...value };
  } catch (err) {
    console.error(`Error adding student: ${err.message}`);
    throw new Error(`Error adding student: ${err.message}`);
  }
}

async function updateStudent(
  studentId,
  studentToUpdate,
  teacherId = null,
  isAdmin = false
) {
  try {
    // For updates, use the flexible validation schema
    const { error, value } = validateStudent(studentToUpdate, true);
    if (error) throw new Error(`Invalid student data: ${error.message}`);

    if (teacherId && !isAdmin) {
      const hasAccess = await checkTeacherHasAccessToStudent(
        teacherId,
        studentId
      );
      if (!hasAccess) {
        throw new Error('Not authorized to update student');
      }
    }

    // Set the updatedAt field
    value.updatedAt = new Date();

    // Ensure we have a primary instrument if updating instrumentProgress
    if (value.academicInfo?.instrumentProgress) {
      const hasPrimary = value.academicInfo.instrumentProgress.some(
        (inst) => inst.isPrimary
      );
      if (!hasPrimary && value.academicInfo.instrumentProgress.length > 0) {
        value.academicInfo.instrumentProgress[0].isPrimary = true;
      }
    }

    // Apply the update
    const collection = await getCollection('student');
    const result = await collection.findOneAndUpdate(
      { _id: ObjectId.createFromHexString(studentId) },
      { $set: value },
      { returnDocument: 'after' }
    );

    if (!result) throw new Error(`Student with id ${studentId} not found`);
    return result;
  } catch (err) {
    console.error(`Error updating student: ${err.message}`);
    throw new Error(`Error updating student: ${err.message}`);
  }
}

async function updateStudentTest(
  studentId,
  instrumentName,
  testType,
  status,
  teacherId = null,
  isAdmin = false
) {
  try {
    console.log(`Processing test update for student ${studentId}`, {
      instrumentName,
      testType,
      status,
      teacherId,
      isAdmin
    });

    // First, get the current student to find the instrument
    const student = await getStudentById(studentId);

    if (!student) {
      throw new Error(`Student with id ${studentId} not found`);
    }

    // Find the instrument index
    const instrumentIndex = student.academicInfo.instrumentProgress.findIndex(
      (i) => i.instrumentName === instrumentName
    );

    if (instrumentIndex === -1) {
      throw new Error(
        `Instrument ${instrumentName} not found for student ${studentId}`
      );
    }

    // Get previous status before any changes
    const previousStatus =
      student.academicInfo.instrumentProgress[instrumentIndex]?.tests?.[
        testType
      ]?.status || 'לא נבחן';

    console.log(`Previous test status: ${previousStatus}, New status: ${status}`);

    // Create update object with only the necessary changes
    const updateData = {
      academicInfo: {
        instrumentProgress: [...student.academicInfo.instrumentProgress],
      },
      updatedAt: new Date(),
    };

    // Ensure the tests object structure exists
    if (!updateData.academicInfo.instrumentProgress[instrumentIndex].tests) {
      updateData.academicInfo.instrumentProgress[instrumentIndex].tests = {};
    }

    if (
      !updateData.academicInfo.instrumentProgress[instrumentIndex].tests[
        testType
      ]
    ) {
      updateData.academicInfo.instrumentProgress[instrumentIndex].tests[
        testType
      ] = {};
    }

    // Update the test status
    updateData.academicInfo.instrumentProgress[instrumentIndex].tests[
      testType
    ].status = status;
    updateData.academicInfo.instrumentProgress[instrumentIndex].tests[
      testType
    ].lastTestDate = new Date();

    // Auto-increment stage if needed
    const passingStatuses = [
      'עבר/ה',
      'עבר/ה בהצטיינות',
      'עבר/ה בהצטיינות יתרה',
    ];
    const failingStatuses = ['לא נבחן', 'לא עבר/ה'];

    if (
      testType === 'stageTest' &&
      passingStatuses.includes(status) &&
      failingStatuses.includes(previousStatus) &&
      updateData.academicInfo.instrumentProgress[instrumentIndex].currentStage 
    ) {
      console.log(
        `Incrementing stage for student ${studentId}, instrument ${instrumentName}` +
        ` from ${updateData.academicInfo.instrumentProgress[instrumentIndex].currentStage}` +
        ` to ${updateData.academicInfo.instrumentProgress[instrumentIndex].currentStage + 1}`
      );
      
      updateData.academicInfo.instrumentProgress[instrumentIndex].currentStage =
        student.academicInfo.instrumentProgress[instrumentIndex].currentStage +
        1;
    }

    // Check authorization if needed
    if (teacherId && !isAdmin) {
      const hasAccess = await checkTeacherHasAccessToStudent(
        teacherId,
        studentId
      );
      if (!hasAccess) {
        throw new Error('Not authorized to update student test');
      }
    }

    // Apply the update
    const collection = await getCollection('student');
    const result = await collection.findOneAndUpdate(
      { _id: ObjectId.createFromHexString(studentId) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new Error(`Student with id ${studentId} not found after update attempt`);
    }

    console.log(`Successfully updated test for student ${studentId}`);
    return result;
  } catch (err) {
    console.error(`Error updating student test: ${err.message}`);
    throw new Error(`Error updating student test: ${err.message}`);
  }
}

async function removeStudent(studentId, teacherId = null, isAdmin = false) {
  try {
    if (teacherId && !isAdmin) {
      const hasAccess = await checkTeacherHasAccessToStudent(
        teacherId,
        studentId
      );
      if (!hasAccess) {
        throw new Error('Not authorized to remove student');
      }

      return await removeStudentTeacherAssociation(studentId, teacherId);
    }

    const collection = await getCollection('student');
    const result = await collection.findOneAndUpdate(
      { _id: ObjectId.createFromHexString(studentId) },
      {
        $set: {
          isActive: false,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    if (!result) throw new Error(`Student with id ${studentId} not found`);
    return result;
  } catch (err) {
    console.error(`Error removing student ${studentId}: ${err.message}`);
    throw err;
  }
}

async function checkTeacherHasAccessToStudent(teacherId, studentId) {
  try {
    const teacherCollection = await getCollection('teacher');
    const teacher = await teacherCollection.findOne({
      _id: ObjectId.createFromHexString(teacherId),
      'teaching.studentIds': studentId,
      isActive: true,
    });

    return !!teacher;
  } catch (err) {
    console.error(`Error checking teacher access to student: ${err.message}`);
    throw new Error(`Error checking teacher access to student: ${err.message}`);
  }
}

async function associateStudentWithTeacher(studentId, teacherId, scheduleSlotId = null) {
  try {
    const teacherCollection = await getCollection('teacher');
    const studentCollection = await getCollection('student');
    
    // Always update the teacher's studentIds array for backward compatibility
    await teacherCollection.updateOne(
      { _id: ObjectId.createFromHexString(teacherId) },
      { $addToSet: { 'teaching.studentIds': studentId } }
    );
    
    // Update the student's teacherIds array for backward compatibility
    await studentCollection.updateOne(
      { _id: ObjectId.createFromHexString(studentId) },
      { $addToSet: { teacherIds: teacherId } }
    );
    
    // If a schedule slot is provided, create a proper teacher assignment
    if (scheduleSlotId) {
      const assignment = {
        teacherId,
        scheduleSlotId,
        startDate: new Date(),
        endDate: null,
        isActive: true,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Add the assignment to the student's record
      await studentCollection.updateOne(
        { _id: ObjectId.createFromHexString(studentId) },
        { $push: { teacherAssignments: assignment } }
      );
      
      // Update the schedule slot to mark it as assigned
      await teacherCollection.updateOne(
        { 
          _id: ObjectId.createFromHexString(teacherId),
          'teaching.schedule._id': ObjectId.createFromHexString(scheduleSlotId)
        },
        { 
          $set: { 
            'teaching.schedule.$.studentId': studentId,
            'teaching.schedule.$.isAvailable': false,
            'teaching.schedule.$.updatedAt': new Date()
          }
        }
      );
      
      return {
        success: true,
        studentId,
        teacherId,
        scheduleSlotId,
        assignment
      };
    }

    return {
      success: true,
      studentId,
      teacherId,
    };
  } catch (err) {
    console.error(`Error associating student with teacher: ${err.message}`);
    throw new Error(`Error associating student with teacher: ${err.message}`);
  }
}

async function removeStudentTeacherAssociation(studentId, teacherId) {
  try {
    const teacherCollection = await getCollection('teacher');
    const studentCollection = await getCollection('student');
    
    // For backward compatibility, remove student from teacher's studentIds array
    await teacherCollection.updateOne(
      { _id: ObjectId.createFromHexString(teacherId) },
      { $pull: { 'teaching.studentIds': studentId } }
    );

    // Update all schedule slots for this student to be available again
    await teacherCollection.updateMany(
      { 
        _id: ObjectId.createFromHexString(teacherId),
        'teaching.schedule.studentId': studentId
      },
      { 
        $set: { 
          'teaching.schedule.$[elem].studentId': null,
          'teaching.schedule.$[elem].isAvailable': true,
          'teaching.schedule.$[elem].updatedAt': new Date()
        }
      },
      {
        arrayFilters: [{ 'elem.studentId': studentId }]
      }
    );
    
    // Mark all teacher assignments for this student as inactive
    await studentCollection.updateMany(
      { 
        _id: ObjectId.createFromHexString(studentId),
        'teacherAssignments.teacherId': teacherId,
        'teacherAssignments.isActive': true
      },
      { 
        $set: { 
          'teacherAssignments.$[elem].isActive': false,
          'teacherAssignments.$[elem].endDate': new Date(),
          'teacherAssignments.$[elem].updatedAt': new Date()
        }
      },
      {
        arrayFilters: [{ 'elem.teacherId': teacherId, 'elem.isActive': true }]
      }
    );
    
    // For backward compatibility, remove teacher from student's teacherIds array
    await studentCollection.updateOne(
      { _id: ObjectId.createFromHexString(studentId) },
      { $pull: { teacherIds: teacherId } }
    );

    return {
      message: 'Student removed from teacher successfully',
      studentId,
      teacherId,
    };
  } catch (err) {
    console.error(`Error removing student from teacher: ${err.message}`);
    throw new Error(`Error removing student from teacher: ${err.message}`);
  }
}

function _buildCriteria(filterBy) {
  const criteria = {};

  // Update to support instrument filtering against the new structure
  if (filterBy.instrument) {
    criteria['academicInfo.instrumentProgress.instrumentName'] =
      filterBy.instrument;
  }

  if (filterBy.class) {
    criteria['academicInfo.class'] = filterBy.class;
  }

  if (filterBy.stage) {
    const stageNum = parseInt(filterBy.stage);
    criteria['academicInfo.instrumentProgress.currentStage'] = stageNum;
  }

  if (filterBy.name) {
    criteria['personalInfo.fullName'] = {
      $regex: filterBy.name,
      $options: 'i',
    };
  }

  // Update test filtering to check new structure
  if (filterBy.technicalTest) {
    criteria['academicInfo.instrumentProgress.tests.technicalTest.status'] =
      filterBy.technicalTest;
  }

  if (filterBy.stageTest) {
    criteria['academicInfo.instrumentProgress.tests.stageTest.status'] =
      filterBy.stageTest;
  }

  // Unchanged criteria
  if (filterBy.teacherId) {
    criteria['enrollments.teachers'] = {
      $elemMatch: {
        teacherId: filterBy.teacherId,
        isActive: true,
      },
    };
  }

  if (filterBy.orchestraId) {
    criteria['enrollments.orchestras'] = {
      $elemMatch: {
        orchestraId: filterBy.orchestraId,
      },
    };
  }

  if (filterBy.schoolYearId) {
    criteria['enrollments.schoolYears'] = {
      $elemMatch: {
        schoolYearId: filterBy.schoolYearId,
        isActive: true,
      },
    };
  }

  if (filterBy.showInactive) {
    if (filterBy.isActive !== undefined) {
      criteria.isActive = filterBy.isActive;
    }
  } else {
    criteria.isActive = true;
  }

  return criteria;
}