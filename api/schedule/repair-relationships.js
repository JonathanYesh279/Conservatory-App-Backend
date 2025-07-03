import { getCollection } from '../../services/mongoDB.service.js';
import { ObjectId } from 'mongodb';

/**
 * Data Migration Script: Repair Schedule-Teacher-Student Relationships
 * 
 * This script fixes broken relationships between Schedule, Teacher, and Student entities
 * by ensuring bidirectional consistency and proper initialization of arrays.
 */

export async function repairAllRelationships() {
  console.log('Starting comprehensive relationship repair...');
  
  try {
    const results = {
      teachersFixed: 0,
      studentsFixed: 0,
      relationshipsRebuilt: 0,
      orphanedSchedules: 0,
      errors: []
    };

    // Step 1: Initialize missing teaching structures for teachers
    console.log('Step 1: Initializing teacher structures...');
    await initializeTeacherStructures(results);

    // Step 2: Initialize missing arrays for students
    console.log('Step 2: Initializing student structures...');
    await initializeStudentStructures(results);

    // Step 3: Rebuild relationships based on existing schedule data
    console.log('Step 3: Rebuilding relationships from schedule data...');
    await rebuildRelationshipsFromSchedule(results);

    // Step 4: Clean up orphaned schedule slots
    console.log('Step 4: Cleaning up orphaned schedule slots...');
    await cleanupOrphanedSchedules(results);

    // Step 5: Validate data integrity
    console.log('Step 5: Validating data integrity...');
    await validateDataIntegrity(results);

    console.log('Relationship repair completed!');
    console.log('Results:', results);
    
    return results;
  } catch (error) {
    console.error('Error during relationship repair:', error.message);
    throw error;
  }
}

async function initializeTeacherStructures(results) {
  const teacherCollection = await getCollection('teacher');
  
  const teachersWithoutStructure = await teacherCollection.find({
    $or: [
      { 'teaching.studentIds': { $exists: false } },
      { 'teaching.schedule': { $exists: false } },
      { 'teaching.studentIds': null },
      { 'teaching.schedule': null }
    ]
  }).toArray();

  for (const teacher of teachersWithoutStructure) {
    try {
      await teacherCollection.updateOne(
        { _id: teacher._id },
        {
          $set: {
            'teaching.studentIds': teacher.teaching?.studentIds || [],
            'teaching.schedule': teacher.teaching?.schedule || [],
            updatedAt: new Date()
          }
        }
      );
      results.teachersFixed++;
      console.log(`Fixed teacher structure: ${teacher.personalInfo?.fullName}`);
    } catch (error) {
      results.errors.push(`Teacher ${teacher._id}: ${error.message}`);
    }
  }
}

async function initializeStudentStructures(results) {
  const studentCollection = await getCollection('student');
  
  const studentsWithoutStructure = await studentCollection.find({
    $or: [
      { teacherIds: { $exists: false } },
      { teacherAssignments: { $exists: false } },
      { teacherIds: null },
      { teacherAssignments: null }
    ]
  }).toArray();

  for (const student of studentsWithoutStructure) {
    try {
      await studentCollection.updateOne(
        { _id: student._id },
        {
          $set: {
            teacherIds: student.teacherIds || [],
            teacherAssignments: student.teacherAssignments || [],
            updatedAt: new Date()
          }
        }
      );
      results.studentsFixed++;
      console.log(`Fixed student structure: ${student.personalInfo?.fullName}`);
    } catch (error) {
      results.errors.push(`Student ${student._id}: ${error.message}`);
    }
  }
}

async function rebuildRelationshipsFromSchedule(results) {
  const teacherCollection = await getCollection('teacher');
  const studentCollection = await getCollection('student');
  
  // Get all teachers with schedule data
  const teachersWithSchedule = await teacherCollection.find({
    'teaching.schedule': { $exists: true, $ne: [] }
  }).toArray();

  for (const teacher of teachersWithSchedule) {
    try {
      const scheduleSlots = teacher.teaching.schedule || [];
      const assignedStudentIds = [...new Set(
        scheduleSlots
          .filter(slot => slot.studentId)
          .map(slot => slot.studentId)
      )];

      // Update teacher's studentIds to match schedule
      if (assignedStudentIds.length > 0) {
        await teacherCollection.updateOne(
          { _id: teacher._id },
          {
            $set: {
              'teaching.studentIds': assignedStudentIds,
              updatedAt: new Date()
            }
          }
        );

        // Update each student's records
        for (const studentId of assignedStudentIds) {
          try {
            const student = await studentCollection.findOne({
              _id: ObjectId.createFromHexString(studentId)
            });

            if (student) {
              // Get schedule slots for this student from this teacher
              const studentSlots = scheduleSlots.filter(slot => slot.studentId === studentId);

              // Create teacher assignments for active schedule slots
              const activeAssignments = studentSlots.map(slot => ({
                teacherId: teacher._id.toString(),
                scheduleSlotId: slot._id.toString(),
                startDate: slot.createdAt || new Date(),
                endDate: null,
                isActive: true,
                notes: slot.notes || null,
                createdAt: slot.createdAt || new Date(),
                updatedAt: new Date()
              }));

              // Update student record
              await studentCollection.updateOne(
                { _id: student._id },
                {
                  $addToSet: { teacherIds: teacher._id.toString() },
                  $set: {
                    teacherAssignments: [
                      ...(student.teacherAssignments || []).filter(
                        assignment => assignment.teacherId !== teacher._id.toString()
                      ),
                      ...activeAssignments
                    ],
                    updatedAt: new Date()
                  }
                }
              );

              results.relationshipsRebuilt++;
              console.log(`Rebuilt relationship: ${teacher.personalInfo?.fullName} <-> ${student.personalInfo?.fullName}`);
            }
          } catch (error) {
            results.errors.push(`Rebuilding relationship for student ${studentId}: ${error.message}`);
          }
        }
      }
    } catch (error) {
      results.errors.push(`Rebuilding relationships for teacher ${teacher._id}: ${error.message}`);
    }
  }
}

async function cleanupOrphanedSchedules(results) {
  const teacherCollection = await getCollection('teacher');
  const studentCollection = await getCollection('student');
  
  const teachers = await teacherCollection.find({
    'teaching.schedule': { $exists: true, $ne: [] }
  }).toArray();

  for (const teacher of teachers) {
    try {
      const scheduleSlots = teacher.teaching.schedule || [];
      const validSlots = [];
      
      for (const slot of scheduleSlots) {
        if (slot.studentId) {
          // Check if student exists
          const student = await studentCollection.findOne({
            _id: ObjectId.createFromHexString(slot.studentId)
          });
          
          if (student) {
            validSlots.push(slot);
          } else {
            console.log(`Removing orphaned schedule slot for non-existent student: ${slot.studentId}`);
            results.orphanedSchedules++;
          }
        } else {
          // Keep available slots
          validSlots.push(slot);
        }
      }

      // Update teacher with cleaned schedule
      if (validSlots.length !== scheduleSlots.length) {
        await teacherCollection.updateOne(
          { _id: teacher._id },
          {
            $set: {
              'teaching.schedule': validSlots,
              updatedAt: new Date()
            }
          }
        );
      }
    } catch (error) {
      results.errors.push(`Cleaning orphaned schedules for teacher ${teacher._id}: ${error.message}`);
    }
  }
}

async function validateDataIntegrity(results) {
  const teacherCollection = await getCollection('teacher');
  const studentCollection = await getCollection('student');
  
  console.log('Validating data integrity...');
  
  // Check teacher-student consistency
  const teachers = await teacherCollection.find({}).toArray();
  for (const teacher of teachers) {
    const studentIds = teacher.teaching?.studentIds || [];
    const scheduleStudentIds = [
      ...new Set((teacher.teaching?.schedule || [])
        .filter(slot => slot.studentId)
        .map(slot => slot.studentId))
    ];
    
    // Ensure studentIds matches schedule
    if (JSON.stringify(studentIds.sort()) !== JSON.stringify(scheduleStudentIds.sort())) {
      console.log(`Inconsistency found in teacher ${teacher.personalInfo?.fullName}: studentIds and schedule don't match`);
      await teacherCollection.updateOne(
        { _id: teacher._id },
        {
          $set: {
            'teaching.studentIds': scheduleStudentIds,
            updatedAt: new Date()
          }
        }
      );
    }
  }
  
  console.log('Data integrity validation completed.');
}

// Additional utility functions for specific repairs

export async function repairTeacherStudentRelationship(teacherId, studentId) {
  try {
    const teacherCollection = await getCollection('teacher');
    const studentCollection = await getCollection('student');
    
    // Add student to teacher's studentIds
    await teacherCollection.updateOne(
      { _id: ObjectId.createFromHexString(teacherId) },
      { 
        $addToSet: { 'teaching.studentIds': studentId },
        $set: { updatedAt: new Date() }
      }
    );
    
    // Add teacher to student's teacherIds
    await studentCollection.updateOne(
      { _id: ObjectId.createFromHexString(studentId) },
      { 
        $addToSet: { teacherIds: teacherId },
        $set: { updatedAt: new Date() }
      }
    );
    
    return { success: true, teacherId, studentId };
  } catch (error) {
    console.error(`Error repairing relationship: ${error.message}`);
    throw error;
  }
}

export async function validateScheduleIntegrity() {
  const teacherCollection = await getCollection('teacher');
  const studentCollection = await getCollection('student');
  
  const report = {
    totalTeachers: 0,
    totalStudents: 0,
    totalScheduleSlots: 0,
    inconsistencies: [],
    orphanedSchedules: []
  };
  
  // Check all teachers
  const teachers = await teacherCollection.find({}).toArray();
  report.totalTeachers = teachers.length;
  
  for (const teacher of teachers) {
    const studentIds = teacher.teaching?.studentIds || [];
    const scheduleSlots = teacher.teaching?.schedule || [];
    report.totalScheduleSlots += scheduleSlots.length;
    
    // Check for orphaned schedule slots
    for (const slot of scheduleSlots) {
      if (slot.studentId) {
        const student = await studentCollection.findOne({
          _id: ObjectId.createFromHexString(slot.studentId)
        });
        
        if (!student) {
          report.orphanedSchedules.push({
            teacherId: teacher._id,
            teacherName: teacher.personalInfo?.fullName,
            slotId: slot._id,
            orphanedStudentId: slot.studentId
          });
        }
      }
    }
    
    // Check studentIds consistency
    const scheduleStudentIds = [...new Set(
      scheduleSlots
        .filter(slot => slot.studentId)
        .map(slot => slot.studentId)
    )];
    
    if (JSON.stringify(studentIds.sort()) !== JSON.stringify(scheduleStudentIds.sort())) {
      report.inconsistencies.push({
        teacherId: teacher._id,
        teacherName: teacher.personalInfo?.fullName,
        issue: 'studentIds does not match schedule slots',
        expected: scheduleStudentIds,
        actual: studentIds
      });
    }
  }
  
  // Check all students
  const students = await studentCollection.find({}).toArray();
  report.totalStudents = students.length;
  
  for (const student of students) {
    const teacherIds = student.teacherIds || [];
    const teacherAssignments = student.teacherAssignments || [];
    const activeAssignments = teacherAssignments.filter(a => a.isActive);
    
    // Check if teacherIds matches active assignments
    const assignmentTeacherIds = [...new Set(activeAssignments.map(a => a.teacherId))];
    
    if (JSON.stringify(teacherIds.sort()) !== JSON.stringify(assignmentTeacherIds.sort())) {
      report.inconsistencies.push({
        studentId: student._id,
        studentName: student.personalInfo?.fullName,
        issue: 'teacherIds does not match active assignments',
        expected: assignmentTeacherIds,
        actual: teacherIds
      });
    }
  }
  
  return report;
}