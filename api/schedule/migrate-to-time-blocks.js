import { getCollection } from '../../services/mongoDB.service.js';
import { ObjectId } from 'mongodb';

/**
 * Migration Script: Convert Slot-Based Schedule to Time Block System
 * 
 * This script helps transition from individual slots to intelligent time blocks
 * while preserving existing schedule data and student assignments.
 */

export async function migrateToTimeBlocks(options = {}) {
  console.log('Starting migration from slot-based to time block system...');
  
  try {
    const results = {
      teachersProcessed: 0,
      timeBlocksCreated: 0,
      lessonsPreserved: 0,
      slotsMigrated: 0,
      errors: [],
      dryRun: options.dryRun || false
    };

    // Step 1: Initialize time block structure for all teachers
    console.log('Step 1: Initializing time block structure...');
    await initializeTimeBlockStructure(results);

    // Step 2: Analyze existing schedule slots and group into logical time blocks
    console.log('Step 2: Analyzing existing schedule patterns...');
    await analyzeAndGroupSlots(results);

    // Step 3: Create time blocks from grouped slots
    console.log('Step 3: Creating time blocks from slot patterns...');
    await createTimeBlocksFromSlots(results);

    // Step 4: Migrate student assignments to new structure
    console.log('Step 4: Migrating student assignments...');
    await migrateStudentAssignments(results);

    // Step 5: Validate migration results
    console.log('Step 5: Validating migration results...');
    await validateMigrationResults(results);

    console.log('Migration completed successfully!');
    console.log('Results:', results);
    
    return results;
  } catch (error) {
    console.error('Error during migration:', error.message);
    throw error;
  }
}

async function initializeTimeBlockStructure(results) {
  const teacherCollection = await getCollection('teacher');
  
  const query = results.dryRun ? {} : {
    $set: {
      'teaching.timeBlocks': [],
      updatedAt: new Date()
    }
  };

  if (!results.dryRun) {
    const updateResult = await teacherCollection.updateMany(
      { 'teaching.timeBlocks': { $exists: false } },
      query
    );
    results.teachersProcessed = updateResult.modifiedCount;
  } else {
    const teachers = await teacherCollection.find({}).toArray();
    results.teachersProcessed = teachers.length;
  }

  console.log(`Initialized time block structure for ${results.teachersProcessed} teachers`);
}

async function analyzeAndGroupSlots(results) {
  const teacherCollection = await getCollection('teacher');
  
  const teachers = await teacherCollection.find({
    'teaching.schedule': { $exists: true, $ne: [] }
  }).toArray();

  results.slotAnalysis = [];

  for (const teacher of teachers) {
    try {
      const slots = teacher.teaching?.schedule || [];
      const analysis = analyzeTeacherSlots(teacher._id.toString(), slots);
      results.slotAnalysis.push(analysis);
      
      console.log(`Analyzed ${slots.length} slots for teacher ${teacher.personalInfo?.fullName}`);
    } catch (error) {
      results.errors.push(`Analysis error for teacher ${teacher._id}: ${error.message}`);
    }
  }
}

function analyzeTeacherSlots(teacherId, slots) {
  // Group slots by day
  const slotsByDay = slots.reduce((acc, slot) => {
    if (!slot.day) return acc;
    
    if (!acc[slot.day]) acc[slot.day] = [];
    acc[slot.day].push(slot);
    return acc;
  }, {});

  // For each day, identify continuous time blocks
  const suggestedBlocks = {};
  
  Object.entries(slotsByDay).forEach(([day, daySlots]) => {
    // Sort slots by start time
    const sortedSlots = daySlots.sort((a, b) => {
      const timeA = timeToMinutes(a.startTime);
      const timeB = timeToMinutes(b.startTime);
      return timeA - timeB;
    });

    // Group continuous slots into potential time blocks
    const blocks = [];
    let currentBlock = null;

    for (const slot of sortedSlots) {
      const slotStart = timeToMinutes(slot.startTime);
      const slotEnd = slotStart + (slot.duration || 60);

      if (!currentBlock) {
        // Start new block
        currentBlock = {
          startTime: slot.startTime,
          endTime: minutesToTime(slotEnd),
          slots: [slot],
          location: slot.location,
          totalDuration: slot.duration || 60
        };
      } else {
        const blockEnd = timeToMinutes(currentBlock.endTime);
        
        // If slot is continuous or close (within 15 minutes), add to current block
        if (slotStart <= blockEnd + 15) {
          currentBlock.slots.push(slot);
          currentBlock.endTime = minutesToTime(Math.max(blockEnd, slotEnd));
          currentBlock.totalDuration = timeToMinutes(currentBlock.endTime) - timeToMinutes(currentBlock.startTime);
          
          // Update location if not set or if current slot has location
          if (!currentBlock.location && slot.location) {
            currentBlock.location = slot.location;
          }
        } else {
          // Finish current block and start new one
          blocks.push(currentBlock);
          currentBlock = {
            startTime: slot.startTime,
            endTime: minutesToTime(slotEnd),
            slots: [slot],
            location: slot.location,
            totalDuration: slot.duration || 60
          };
        }
      }
    }

    // Add the last block
    if (currentBlock) {
      blocks.push(currentBlock);
    }

    suggestedBlocks[day] = blocks;
  });

  return {
    teacherId,
    originalSlotCount: slots.length,
    suggestedBlocks,
    totalSuggestedBlocks: Object.values(suggestedBlocks).reduce((sum, blocks) => sum + blocks.length, 0)
  };
}

async function createTimeBlocksFromSlots(results) {
  const teacherCollection = await getCollection('teacher');
  
  for (const analysis of results.slotAnalysis) {
    try {
      const timeBlocks = [];
      
      // Convert suggested blocks to time block format
      Object.entries(analysis.suggestedBlocks).forEach(([day, blocks]) => {
        blocks.forEach(block => {
          // Only create blocks that are at least 30 minutes
          if (block.totalDuration >= 30) {
            const timeBlock = {
              _id: new ObjectId(),
              day,
              startTime: block.startTime,
              endTime: block.endTime,
              totalDuration: block.totalDuration,
              location: block.location || null,
              notes: `Migrated from ${block.slots.length} individual slots`,
              isActive: true,
              assignedLessons: [], // Will be populated in next step
              recurring: { isRecurring: true, excludeDates: [] },
              createdAt: new Date(),
              updatedAt: new Date(),
              migrationInfo: {
                originalSlots: block.slots.map(slot => slot._id?.toString()).filter(Boolean),
                migratedAt: new Date()
              }
            };
            
            timeBlocks.push(timeBlock);
          }
        });
      });

      if (!results.dryRun && timeBlocks.length > 0) {
        await teacherCollection.updateOne(
          { _id: ObjectId.createFromHexString(analysis.teacherId) },
          {
            $push: { 'teaching.timeBlocks': { $each: timeBlocks } },
            $set: { updatedAt: new Date() }
          }
        );
      }

      results.timeBlocksCreated += timeBlocks.length;
      console.log(`Created ${timeBlocks.length} time blocks for teacher ${analysis.teacherId}`);
      
    } catch (error) {
      results.errors.push(`Time block creation error for teacher ${analysis.teacherId}: ${error.message}`);
    }
  }
}

async function migrateStudentAssignments(results) {
  const teacherCollection = await getCollection('teacher');
  const studentCollection = await getCollection('student');
  
  const teachers = await teacherCollection.find({
    'teaching.timeBlocks': { $exists: true, $ne: [] }
  }).toArray();

  for (const teacher of teachers) {
    try {
      const originalSlots = teacher.teaching?.schedule || [];
      const timeBlocks = teacher.teaching?.timeBlocks || [];
      
      // For each assigned slot, find corresponding time block and create lesson assignment
      for (const slot of originalSlots) {
        if (!slot.studentId || slot.isAvailable === false) continue;
        
        // Find the time block that should contain this slot
        const containingBlock = timeBlocks.find(block => 
          block.day === slot.day &&
          block.migrationInfo?.originalSlots?.includes(slot._id?.toString())
        );

        if (!containingBlock) {
          console.log(`Warning: Could not find containing block for slot ${slot._id} on ${slot.day}`);
          continue;
        }

        // Create lesson assignment within the time block
        const lessonAssignment = {
          _id: new ObjectId(),
          studentId: slot.studentId,
          startTime: slot.startTime,
          endTime: slot.endTime || addMinutesToTime(slot.startTime, slot.duration),
          duration: slot.duration || 60,
          assignmentDate: slot.createdAt || new Date(),
          isActive: true,
          notes: slot.notes || 'Migrated from individual slot',
          createdAt: slot.createdAt || new Date(),
          updatedAt: new Date(),
          migrationInfo: {
            originalSlotId: slot._id?.toString(),
            migratedAt: new Date()
          }
        };

        if (!results.dryRun) {
          // Add lesson to time block
          await teacherCollection.updateOne(
            { 
              _id: teacher._id,
              'teaching.timeBlocks._id': containingBlock._id
            },
            { 
              $push: { 'teaching.timeBlocks.$.assignedLessons': lessonAssignment }
            }
          );

          // Update student's teacher assignments
          const teacherAssignment = {
            teacherId: teacher._id.toString(),
            timeBlockId: containingBlock._id.toString(),
            lessonId: lessonAssignment._id.toString(),
            startDate: slot.createdAt || new Date(),
            endDate: null,
            isActive: true,
            scheduleInfo: {
              day: slot.day,
              startTime: slot.startTime,
              endTime: lessonAssignment.endTime,
              duration: slot.duration || 60,
              location: containingBlock.location
            },
            notes: 'Migrated from slot-based system',
            createdAt: new Date(),
            updatedAt: new Date(),
            migrationInfo: {
              originalSlotId: slot._id?.toString(),
              migratedAt: new Date()
            }
          };

          // Only push if no active assignment for this teacher already exists
          const existingAssignment = await studentCollection.findOne({
            _id: ObjectId.createFromHexString(slot.studentId),
            'teacherAssignments': {
              $elemMatch: {
                teacherId: teacher._id.toString(),
                isActive: true
              }
            }
          });

          if (!existingAssignment) {
            await studentCollection.updateOne(
              { _id: ObjectId.createFromHexString(slot.studentId) },
              {
                $push: { teacherAssignments: teacherAssignment },
                $set: { updatedAt: new Date() }
              }
            );
          }
        }

        results.lessonsPreserved++;
      }

      results.slotsMigrated += originalSlots.length;
      
    } catch (error) {
      results.errors.push(`Student assignment migration error for teacher ${teacher._id}: ${error.message}`);
    }
  }

  console.log(`Migrated ${results.lessonsPreserved} lesson assignments from ${results.slotsMigrated} slots`);
}

async function validateMigrationResults(results) {
  const teacherCollection = await getCollection('teacher');
  const studentCollection = await getCollection('student');
  
  console.log('Validating migration results...');
  
  // Check that all teachers have time block structure
  const teachersWithoutBlocks = await teacherCollection.countDocuments({
    'teaching.timeBlocks': { $exists: false }
  });

  if (teachersWithoutBlocks > 0) {
    results.errors.push(`${teachersWithoutBlocks} teachers still missing time block structure`);
  }

  // Check for orphaned student assignments
  const studentsWithOldAssignments = await studentCollection.countDocuments({
    'teacherAssignments': { $exists: false }
  });

  console.log(`Validation: ${teachersWithoutBlocks} teachers without blocks, ${studentsWithOldAssignments} students without new assignments`);
}

// Utility functions
function timeToMinutes(timeString) {
  if (!timeString) return 0;
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function addMinutesToTime(timeString, minutes) {
  const totalMinutes = timeToMinutes(timeString) + minutes;
  return minutesToTime(totalMinutes);
}

// Additional migration utilities

export async function createBackup() {
  console.log('Creating backup of current schedule data...');
  
  const teacherCollection = await getCollection('teacher');
  const studentCollection = await getCollection('student');
  
  const teachers = await teacherCollection.find({}).toArray();
  const students = await studentCollection.find({}).toArray();
  
  const backup = {
    timestamp: new Date(),
    teachers: teachers,
    students: students,
    version: '1.0'
  };

  // Persist backup to MongoDB
  const backupCollection = await getCollection('migration_backups');
  await backupCollection.insertOne(backup);

  console.log(`Backup created and saved with ${teachers.length} teachers and ${students.length} students`);

  return backup;
}

export async function rollbackMigration() {
  console.log('Rolling back time block migration...');
  
  const teacherCollection = await getCollection('teacher');
  const studentCollection = await getCollection('student');
  
  // Only remove migrated time blocks (preserve UI-created ones)
  await teacherCollection.updateMany(
    { 'teaching.timeBlocks.migrationInfo.migratedAt': { $exists: true } },
    {
      $pull: { 'teaching.timeBlocks': { 'migrationInfo.migratedAt': { $exists: true } } },
      $set: { updatedAt: new Date() }
    }
  );
  
  // Remove new teacher assignments from students
  await studentCollection.updateMany(
    {},
    {
      $pull: { 
        teacherAssignments: { 
          'migrationInfo.migratedAt': { $exists: true } 
        }
      },
      $set: { updatedAt: new Date() }
    }
  );
  
  console.log('Migration rollback completed');
}

export async function generateMigrationReport(teacherId = null) {
  const teacherCollection = await getCollection('teacher');
  const studentCollection = await getCollection('student');
  
  const filter = teacherId ? { _id: ObjectId.createFromHexString(teacherId) } : {};
  const teachers = await teacherCollection.find(filter).toArray();
  
  const report = {
    generatedAt: new Date(),
    teachers: [],
    summary: {
      totalTeachers: 0,
      teachersWithTimeBlocks: 0,
      totalTimeBlocks: 0,
      totalLessons: 0,
      migrationCoverage: 0
    }
  };

  for (const teacher of teachers) {
    const originalSlots = teacher.teaching?.schedule?.length || 0;
    const timeBlocks = teacher.teaching?.timeBlocks?.length || 0;
    const assignedLessons = teacher.teaching?.timeBlocks?.reduce(
      (sum, block) => sum + (block.assignedLessons?.length || 0), 0
    ) || 0;

    const teacherReport = {
      teacherId: teacher._id.toString(),
      teacherName: teacher.personalInfo?.fullName,
      originalSlots,
      timeBlocks,
      assignedLessons,
      migrationRatio: originalSlots > 0 ? (assignedLessons / originalSlots) : 0,
      hasTimeBlocks: timeBlocks > 0
    };

    report.teachers.push(teacherReport);
    report.summary.totalTeachers++;
    if (timeBlocks > 0) report.summary.teachersWithTimeBlocks++;
    report.summary.totalTimeBlocks += timeBlocks;
    report.summary.totalLessons += assignedLessons;
  }

  report.summary.migrationCoverage = report.summary.totalTeachers > 0 
    ? (report.summary.teachersWithTimeBlocks / report.summary.totalTeachers) * 100 
    : 0;

  return report;
}