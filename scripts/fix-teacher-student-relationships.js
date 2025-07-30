/**
 * Data Migration Script: Fix Teacher-Student Relationship Synchronization
 * 
 * This script fixes the inconsistent teacher-student relationships in the database
 * where students have teacherIds but teachers don't have corresponding studentIds.
 * 
 * Usage: node scripts/fix-teacher-student-relationships.js
 */

import { getCollection } from '../services/mongoDB.service.js';
import { ObjectId } from 'mongodb';

async function fixTeacherStudentRelationships() {
  console.log('🔧 Starting teacher-student relationship synchronization...');
  
  let studentsProcessed = 0;
  let teachersUpdated = 0;
  let errors = 0;

  try {
    const studentCollection = await getCollection('student');
    const teacherCollection = await getCollection('teacher');

    // Find all students with teacherIds
    const students = await studentCollection.find({ 
      teacherIds: { $exists: true, $ne: [] },
      isActive: { $ne: false }
    }).toArray();

    console.log(`📊 Found ${students.length} students with teacher assignments to process`);

    for (const student of students) {
      try {
        studentsProcessed++;
        console.log(`\n👤 Processing student ${studentsProcessed}/${students.length}: ${student.personalInfo?.fullName || 'Unknown'} (${student._id})`);
        
        const studentId = student._id.toString();
        const teacherIds = student.teacherIds || [];
        
        console.log(`   📋 Student has ${teacherIds.length} teacher assignments: ${teacherIds.join(', ')}`);

        for (const teacherId of teacherIds) {
          try {
            // Validate teacherId format
            if (!ObjectId.isValid(teacherId)) {
              console.warn(`   ⚠️  Invalid teacherId format: ${teacherId} - skipping`);
              continue;
            }

            // Check if teacher exists
            const teacher = await teacherCollection.findOne({
              _id: ObjectId.createFromHexString(teacherId)
            });

            if (!teacher) {
              console.warn(`   ⚠️  Teacher ${teacherId} not found - skipping`);
              continue;
            }

            // Check if student is already in teacher's studentIds
            const currentStudentIds = teacher.teaching?.studentIds || [];
            const studentAlreadyLinked = currentStudentIds.includes(studentId);

            if (studentAlreadyLinked) {
              console.log(`   ✅ Student already linked to teacher ${teacherId} (${teacher.personalInfo?.fullName || 'Unknown'})`);
              continue;
            }

            // Add student to teacher's studentIds
            const updateResult = await teacherCollection.updateOne(
              { _id: ObjectId.createFromHexString(teacherId) },
              { 
                $addToSet: { 'teaching.studentIds': studentId },
                $set: { updatedAt: new Date() }
              }
            );

            if (updateResult.modifiedCount > 0) {
              teachersUpdated++;
              console.log(`   🔄 Added student ${studentId} to teacher ${teacherId} (${teacher.personalInfo?.fullName || 'Unknown'})`);
            } else {
              console.log(`   ℹ️  No update needed for teacher ${teacherId}`);
            }

          } catch (teacherError) {
            console.error(`   ❌ Error processing teacher ${teacherId}:`, teacherError.message);
            errors++;
          }
        }

      } catch (studentError) {
        console.error(`❌ Error processing student ${student._id}:`, studentError.message);
        errors++;
      }
    }

    // Validation phase - check for inconsistencies
    console.log('\n🔍 Running validation phase...');
    await validateRelationshipIntegrity();

    console.log('\n📈 Migration Summary:');
    console.log(`   👥 Students processed: ${studentsProcessed}`);
    console.log(`   👨‍🏫 Teacher records updated: ${teachersUpdated}`);
    console.log(`   ❌ Errors encountered: ${errors}`);
    console.log('✅ Teacher-student relationship synchronization completed!');

  } catch (error) {
    console.error('💥 Fatal error during migration:', error);
    process.exit(1);
  }
}

async function validateRelationshipIntegrity() {
  try {
    const studentCollection = await getCollection('student');
    const teacherCollection = await getCollection('teacher');

    console.log('   🔍 Checking for remaining inconsistencies...');

    let inconsistentRelationships = 0;

    // Check students with teacherIds
    const students = await studentCollection.find({ 
      teacherIds: { $exists: true, $ne: [] },
      isActive: { $ne: false }
    }).toArray();

    for (const student of students) {
      const studentId = student._id.toString();
      const studentTeacherIds = student.teacherIds || [];

      for (const teacherId of studentTeacherIds) {
        if (!ObjectId.isValid(teacherId)) continue;

        const teacher = await teacherCollection.findOne({
          _id: ObjectId.createFromHexString(teacherId)
        });

        if (!teacher) continue;

        const teacherStudentIds = teacher.teaching?.studentIds || [];
        
        if (!teacherStudentIds.includes(studentId)) {
          console.warn(`   ⚠️  INCONSISTENCY: Student ${studentId} has teacher ${teacherId} but teacher doesn't have student`);
          inconsistentRelationships++;
        }
      }
    }

    // Check teachers with studentIds
    const teachers = await teacherCollection.find({ 
      'teaching.studentIds': { $exists: true, $ne: [] },
      isActive: { $ne: false }
    }).toArray();

    for (const teacher of teachers) {
      const teacherId = teacher._id.toString();
      const teacherStudentIds = teacher.teaching?.studentIds || [];

      for (const studentId of teacherStudentIds) {
        if (!ObjectId.isValid(studentId)) continue;

        const student = await studentCollection.findOne({
          _id: ObjectId.createFromHexString(studentId)
        });

        if (!student) continue;

        const studentTeacherIds = student.teacherIds || [];
        
        if (!studentTeacherIds.includes(teacherId)) {
          console.warn(`   ⚠️  INCONSISTENCY: Teacher ${teacherId} has student ${studentId} but student doesn't have teacher`);
          inconsistentRelationships++;
        }
      }
    }

    if (inconsistentRelationships === 0) {
      console.log('   ✅ All relationships are now synchronized!');
    } else {
      console.warn(`   ⚠️  Found ${inconsistentRelationships} remaining inconsistencies`);
    }

  } catch (error) {
    console.error('   ❌ Error during validation:', error.message);
  }
}

// Dry run function to preview changes without applying them
async function dryRun() {
  console.log('🧪 DRY RUN MODE - No changes will be made');
  console.log('=====================================\n');

  try {
    const studentCollection = await getCollection('student');
    const teacherCollection = await getCollection('teacher');

    const students = await studentCollection.find({ 
      teacherIds: { $exists: true, $ne: [] },
      isActive: { $ne: false }
    }).toArray();

    console.log(`📊 Would process ${students.length} students with teacher assignments`);

    let potentialUpdates = 0;

    for (const student of students) {
      const studentId = student._id.toString();
      const teacherIds = student.teacherIds || [];
      
      console.log(`\n👤 Student: ${student.personalInfo?.fullName || 'Unknown'} (${studentId})`);
      console.log(`   📋 Has ${teacherIds.length} teacher assignments: ${teacherIds.join(', ')}`);

      for (const teacherId of teacherIds) {
        if (!ObjectId.isValid(teacherId)) continue;

        const teacher = await teacherCollection.findOne({
          _id: ObjectId.createFromHexString(teacherId)
        });

        if (!teacher) {
          console.log(`   ⚠️  Teacher ${teacherId} not found`);
          continue;
        }

        const currentStudentIds = teacher.teaching?.studentIds || [];
        const studentAlreadyLinked = currentStudentIds.includes(studentId);

        if (!studentAlreadyLinked) {
          console.log(`   🔄 WOULD ADD: Student to teacher ${teacherId} (${teacher.personalInfo?.fullName || 'Unknown'})`);
          potentialUpdates++;
        } else {
          console.log(`   ✅ Already linked to teacher ${teacherId} (${teacher.personalInfo?.fullName || 'Unknown'})`);
        }
      }
    }

    console.log(`\n📈 Dry Run Summary:`);
    console.log(`   👥 Students to process: ${students.length}`);
    console.log(`   🔄 Teacher records that would be updated: ${potentialUpdates}`);

  } catch (error) {
    console.error('💥 Error during dry run:', error);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run') || args.includes('-d');

  if (isDryRun) {
    await dryRun();
  } else {
    console.log('⚠️  This will modify your database. Use --dry-run to preview changes first.');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    await fixTeacherStudentRelationships();
  }

  process.exit(0);
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
}

export { fixTeacherStudentRelationships, validateRelationshipIntegrity };