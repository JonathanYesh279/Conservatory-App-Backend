// api/rehearsal/rehearsal.service.js
import { getCollection } from '../../services/mongoDB.service.js';
import {
  validateRehearsal,
  validateBulkCreate,
  validateAttendance,
} from './rehearsal.validation.js';
import { ObjectId } from 'mongodb';

export const rehearsalService = {
  getRehearsals,
  getRehearsalById,
  getOrchestraRehearsals,
  addRehearsal,
  updateRehearsal,
  removeRehearsal,
  bulkCreateRehearsals,
  bulkDeleteRehearsalsByOrchestra,
  bulkUpdateRehearsalsByOrchestra,
  updateAttendance,
};

async function getRehearsals(filterBy = {}) {
  try {
    const collection = await getCollection('rehearsal');
    const criteria = _buildCriteria(filterBy);

    const rehearsal = await collection
      .find(criteria)
      .sort({ date: 1 })
      .toArray();

    return rehearsal;
  } catch (err) {
    console.error(`Failed to get rehearsals: ${err}`);
    throw new Error(`Failed to get rehearsals: ${err}`);
  }
}

async function getRehearsalById(rehearsalId) {
  try {
    const collection = await getCollection('rehearsal');
    const rehearsal = await collection.findOne({
      _id: ObjectId.createFromHexString(rehearsalId),
    });

    if (!rehearsal)
      throw new Error(`Rehearsal with id ${rehearsalId} not found`);
    return rehearsal;
  } catch (err) {
    console.error(`Failed to get rehearsal by id: ${err}`);
    throw new Error(`Failed to get rehearsal by id: ${err}`);
  }
}

async function getOrchestraRehearsals(orchestraId, filterBy = {}) {
  try {
    filterBy.groupId = orchestraId;

    return await getRehearsals(filterBy);
  } catch (err) {
    console.error(`Failed to get orchestra rehearsals: ${err}`);
    throw new Error(`Failed to get orchestra rehearsals: ${err}`);
  }
}

async function addRehearsal(rehearsalToAdd, teacherId, isAdmin = false) {
  try {
    console.log(
      'Adding rehearsal with data:',
      JSON.stringify(rehearsalToAdd, null, 2)
    );

    const { error, value } = validateRehearsal(rehearsalToAdd);
    if (error) {
      console.error(`Validation error:`, error.details);
      throw error;
    }

    if (!value.schoolYearId) {
      console.error('Missing required schoolYearId in rehearsal data');
      throw new Error('School year ID is required');
    }

    if (!isAdmin) {
      // Get the orchestra collection first and verify permissions
      const orchestraCollection = await getCollection('orchestra');
      if (!orchestraCollection) {
        console.error('Failed to get orchestra collection');
        throw new Error(
          'Database error: Failed to access orchestra collection'
        );
      }

      const orchestra = await orchestraCollection.findOne({
        _id: ObjectId.createFromHexString(value.groupId),
        conductorId: teacherId.toString(),
      });

      if (!orchestra) {
        throw new Error('Not authorized to add rehearsal for this orchestra');
      }
    }

    // Set creation timestamps
    value.createdAt = new Date();
    value.updatedAt = new Date();

    // Calculate day of week if not provided
    if (value.dayOfWeek === undefined) {
      const rehearsalDate = new Date(value.date);
      value.dayOfWeek = rehearsalDate.getDay();
    }

    // Insert rehearsal
    const rehearsalCollection = await getCollection('rehearsal');
    if (!rehearsalCollection) {
      console.error('Failed to get rehearsal collection');
      throw new Error('Database error: Failed to access rehearsal collection');
    }

    const result = await rehearsalCollection.insertOne(value);
    console.log(
      `Successfully inserted rehearsal with ID: ${result.insertedId}`
    );

    // Update orchestra if this is an orchestra rehearsal
    if (value.type === 'תזמורת') {
      try {
        const orchestraCollection = await getCollection('orchestra');
        if (!orchestraCollection) {
          console.error('Failed to get orchestra collection for updating');
          throw new Error(
            'Database error: Failed to access orchestra collection'
          );
        }

        const updateResult = await orchestraCollection.updateOne(
          { _id: ObjectId.createFromHexString(value.groupId) },
          { $push: { rehearsalIds: result.insertedId.toString() } }
        );

        console.log(`Orchestra update result: ${JSON.stringify(updateResult)}`);
      } catch (updateErr) {
        // If the orchestra update fails, log it but don't fail the entire operation
        console.error(
          `Failed to update orchestra with rehearsal ID: ${updateErr}`
        );
      }
    }

    return {
      _id: result.insertedId,
      id: result.insertedId,
      ...value,
    };
  } catch (err) {
    console.error(`Failed to add rehearsal: ${err}`);
    throw new Error(`Failed to add rehearsal: ${err}`);
  }
}

async function updateRehearsal(
  rehearsalId,
  rehearsalToUpdate,
  teacherId,
  isAdmin = false
) {
  try {
    const { error, value } = validateRehearsal(rehearsalToUpdate);

    if (error) throw error;

    value.updatedAt = new Date();

    if (!isAdmin) {
      const orchestraCollection = await getCollection('orchestra');
      if (!orchestraCollection) {
        throw new Error(
          'Database error: Failed to access orchestra collection'
        );
      }

      const orchestra = await orchestraCollection.findOne({
        _id: ObjectId.createFromHexString(value.groupId),
      });

      if (!orchestra) {
        throw new Error(`Orchestra with id ${value.groupId} not found`);
      }

      if (orchestra.conductorId !== teacherId.toString()) {
        throw new Error(
          `Teacher with id ${teacherId} is not the conductor of the orchestra`
        );
      }
    }

    const collection = await getCollection('rehearsal');
    if (!collection) {
      throw new Error('Database error: Failed to access rehearsal collection');
    }

    const result = await collection.findOneAndUpdate(
      { _id: ObjectId.createFromHexString(rehearsalId) },
      { $set: value },
      { returnDocument: 'after' }
    );

    if (!result) throw new Error(`Rehearsal with id ${rehearsalId} not found`);
    return result;
  } catch (err) {
    console.error(`Failed to update rehearsal: ${err}`);
    throw new Error(`Failed to update rehearsal: ${err}`);
  }
}

async function removeRehearsal(rehearsalId, teacherId, isAdmin = false) {
  try {
    const rehearsal = await getRehearsalById(rehearsalId);

    if (!isAdmin) {
      const orchestraCollection = await getCollection('orchestra');
      if (!orchestraCollection) {
        throw new Error(
          'Database error: Failed to access orchestra collection'
        );
      }

      const orchestra = await orchestraCollection.findOne({
        _id: ObjectId.createFromHexString(rehearsal.groupId),
      });

      if (!orchestra)
        throw new Error(`Orchestra with id ${rehearsal.groupId} not found`);

      if (orchestra.conductorId !== teacherId.toString())
        throw new Error(
          `Teacher with id ${teacherId} is not the conductor of the orchestra`
        );
    }

    // Remove from orchestra record
    if (rehearsal.type === 'תזמורת') {
      const orchestraCollection = await getCollection('orchestra');
      if (orchestraCollection) {
        await orchestraCollection.updateOne(
          { _id: ObjectId.createFromHexString(rehearsal.groupId) },
          { $pull: { rehearsalIds: rehearsalId } }
        );
      }
    }

    // Delete associated attendance records
    try {
      const activityCollection = await getCollection('activity_attendance');
      if (activityCollection) {
        await activityCollection.deleteMany({
          sessionId: rehearsalId,
          activityType: 'תזמורת',
        });
      }
    } catch (attendanceErr) {
      console.warn(
        `Failed to delete attendance records: ${attendanceErr.message}`
      );
    }

    // Hard delete - actually remove the document
    const collection = await getCollection('rehearsal');
    if (!collection) {
      throw new Error('Database error: Failed to access rehearsal collection');
    }

    const result = await collection.findOneAndDelete(
      { _id: ObjectId.createFromHexString(rehearsalId) }
    );

    if (!result) throw new Error(`Rehearsal with id ${rehearsalId} not found`);

    return result;
  } catch (err) {
    console.error(`Failed to remove rehearsal: ${err}`);
    throw new Error(`Failed to remove rehearsal: ${err}`);
  }
}

async function bulkCreateRehearsals(data, teacherId, isAdmin = false) {
  try {
    console.log(
      'Bulk creating rehearsals with data:',
      JSON.stringify(data, null, 2)
    );

    const { error, value } = validateBulkCreate(data);
    if (error) {
      console.error(`Bulk validation error:`, error.details);
      throw error;
    }

    // Check authorization if not admin
    if (!isAdmin) {
      try {
        const orchestraCollection = await getCollection('orchestra');
        if (!orchestraCollection) {
          throw new Error(
            'Database error: Failed to access orchestra collection'
          );
        }

        const teacherIdStr = teacherId ? teacherId.toString() : '';
        console.log(`Checking orchestra access for teacher: ${teacherIdStr}`);

        const orchestra = await orchestraCollection.findOne({
          _id: ObjectId.createFromHexString(value.orchestraId),
          conductorId: teacherIdStr,
        });

        if (!orchestra) {
          throw new Error(
            'Not authorized to bulk create rehearsals for this orchestra'
          );
        }
      } catch (authErr) {
        console.error(`Authorization error: ${authErr.message}`);
        throw new Error(`Authorization failed: ${authErr.message}`);
      }
    }

    const {
      orchestraId,
      startDate,
      endDate,
      dayOfWeek,
      startTime,
      endTime,
      location,
      excludeDates = [],
      notes,
      schoolYearId,
    } = value;

    // Verify school year ID
    if (!schoolYearId) {
      console.error('Missing schoolYearId in bulk rehearsal data');
      throw new Error('School year ID is required for bulk creation');
    }

    // Generate dates for rehearsals
    const dates = _generateDatesForDayOfWeek(
      new Date(startDate),
      new Date(endDate),
      dayOfWeek,
      (excludeDates || []).map((day) => new Date(day))
    );

    console.log(`Generated ${dates.length} dates for rehearsals`);

    // Create rehearsal documents
    const rehearsals = dates.map((date) => ({
      groupId: orchestraId,
      type: 'תזמורת',
      date,
      dayOfWeek,
      startTime,
      endTime,
      location,
      attendance: { present: [], absent: [] },
      notes: notes || '',
      schoolYearId: schoolYearId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    if (rehearsals.length === 0) {
      console.log('No rehearsal dates generated, returning empty result');
      return { insertedCount: 0, rehearsalIds: [] };
    }

    // Get rehearsal collection
    let rehearsalCollection;
    try {
      rehearsalCollection = await getCollection('rehearsal');
      if (!rehearsalCollection) {
        throw new Error('Rehearsal collection is undefined');
      }
    } catch (dbErr) {
      console.error(`Failed to get rehearsal collection: ${dbErr}`);
      throw new Error(
        `Database error: Failed to access rehearsal collection - ${dbErr.message}`
      );
    }

    const result = { insertedCount: 0, rehearsalIds: [] };

    // Insert rehearsals in batches
    const batchSize = 100;
    for (let i = 0; i < rehearsals.length; i += batchSize) {
      try {
        const batch = rehearsals.slice(i, i + batchSize);
        console.log(
          `Inserting batch ${i / batchSize + 1} with ${batch.length} rehearsals`
        );

        const batchResult = await rehearsalCollection.insertMany(batch);
        console.log(`Batch inserted with result:`, batchResult);

        result.insertedCount += batchResult.insertedCount;
        const batchIds = Object.values(batchResult.insertedIds).map((id) =>
          id.toString()
        );
        result.rehearsalIds = [...result.rehearsalIds, ...batchIds];
      } catch (batchErr) {
        console.error(`Error inserting batch: ${batchErr}`);
        throw new Error(
          `Failed to insert rehearsal batch: ${batchErr.message}`
        );
      }
    }

    // Update orchestra with new rehearsal IDs
    if (result.rehearsalIds.length > 0) {
      try {
        const orchestraCollection = await getCollection('orchestra');
        if (orchestraCollection) {
          console.log(
            `Updating orchestra ${orchestraId} with ${result.rehearsalIds.length} new rehearsal IDs`
          );

          const updateResult = await orchestraCollection.updateOne(
            { _id: ObjectId.createFromHexString(orchestraId) },
            { $push: { rehearsalIds: { $each: result.rehearsalIds } } }
          );

          console.log(`Orchestra update result:`, updateResult);
        } else {
          console.warn(
            'Orchestra collection not available, skipping orchestra update'
          );
        }
      } catch (updateErr) {
        // Log the error but don't fail the entire operation
        console.error(
          `Failed to update orchestra with rehearsal IDs: ${updateErr}`
        );
      }
    }

    console.log(`Successfully created ${result.insertedCount} rehearsals`);
    return result;
  } catch (err) {
    console.error(`Failed to bulk create rehearsals: ${err}`);
    throw new Error(`Failed to bulk create rehearsals: ${err}`);
  }
}

async function bulkDeleteRehearsalsByOrchestra(orchestraId, userId, isAdmin = false) {
  try {
    // Input validation
    if (!orchestraId || !ObjectId.isValid(orchestraId)) {
      throw new Error('Invalid orchestra ID');
    }

    // Get collections
    const orchestraCollection = await getCollection('orchestra');
    const rehearsalCollection = await getCollection('rehearsal');
    const activityCollection = await getCollection('activity_attendance');

    if (!orchestraCollection || !rehearsalCollection) {
      throw new Error('Database error: Failed to access required collections');
    }

    // Verify orchestra exists
    const orchestra = await orchestraCollection.findOne({
      _id: ObjectId.createFromHexString(orchestraId)
    });

    if (!orchestra) {
      throw new Error('Orchestra not found');
    }

    // Authorization check - only admin or conductor of this orchestra can delete
    if (!isAdmin) {
      if (orchestra.conductorId !== userId.toString()) {
        throw new Error('Not authorized to delete rehearsals for this orchestra');
      }
    }

    // Get all rehearsals for this orchestra to collect IDs for cleanup
    const rehearsals = await rehearsalCollection.find({ 
      groupId: orchestraId 
    }).toArray();

    const rehearsalIds = rehearsals.map(r => r._id.toString());

    let deletedCount = 0;

    // Use transaction for data consistency
    const client = rehearsalCollection.client || rehearsalCollection.s?.client;
    if (client) {
      const session = client.startSession();
      
      try {
        await session.withTransaction(async () => {
          // Delete all rehearsals for this orchestra
          const deleteResult = await rehearsalCollection.deleteMany(
            { groupId: orchestraId },
            { session }
          );
          
          deletedCount = deleteResult.deletedCount;

          // Clean up attendance records if collection exists
          if (activityCollection && rehearsalIds.length > 0) {
            await activityCollection.deleteMany(
              { 
                sessionId: { $in: rehearsalIds },
                activityType: 'תזמורת'
              },
              { session }
            );
          }

          // Update orchestra to remove rehearsal IDs
          await orchestraCollection.updateOne(
            { _id: ObjectId.createFromHexString(orchestraId) },
            { $set: { rehearsalIds: [] } },
            { session }
          );
        });
      } finally {
        await session.endSession();
      }
    } else {
      // Fallback without transaction if session not available
      const deleteResult = await rehearsalCollection.deleteMany({
        groupId: orchestraId
      });
      
      deletedCount = deleteResult.deletedCount;

      // Clean up attendance records
      if (activityCollection && rehearsalIds.length > 0) {
        try {
          await activityCollection.deleteMany({
            sessionId: { $in: rehearsalIds },
            activityType: 'תזמורת'
          });
        } catch (attendanceErr) {
          console.warn(`Failed to delete attendance records: ${attendanceErr.message}`);
        }
      }

      // Update orchestra
      try {
        await orchestraCollection.updateOne(
          { _id: ObjectId.createFromHexString(orchestraId) },
          { $set: { rehearsalIds: [] } }
        );
      } catch (orchestraErr) {
        console.warn(`Failed to update orchestra: ${orchestraErr.message}`);
      }
    }

    // Logging
    console.log(`User ${userId} deleted ${deletedCount} rehearsals for orchestra ${orchestraId}`);

    return {
      deletedCount,
      message: `Successfully deleted ${deletedCount} rehearsals for orchestra`
    };
  } catch (err) {
    console.error(`Failed to bulk delete rehearsals by orchestra: ${err}`);
    throw new Error(`Failed to bulk delete rehearsals by orchestra: ${err.message}`);
  }
}

async function bulkUpdateRehearsalsByOrchestra(orchestraId, updateData, userId, isAdmin = false) {
  try {
    // Input validation
    if (!orchestraId || !ObjectId.isValid(orchestraId)) {
      throw new Error('Invalid orchestra ID');
    }

    // Validate update data - check for forbidden fields
    const forbiddenFields = ['_id', 'createdAt', 'updatedAt', 'groupId', 'date', 'schoolYearId'];
    const updateKeys = Object.keys(updateData);
    const hasForbiddenField = updateKeys.some(key => forbiddenFields.includes(key));

    if (hasForbiddenField) {
      throw new Error(`Cannot update these fields in bulk operations: ${forbiddenFields.join(', ')}`);
    }

    // Validate time format if provided
    if (updateData.startTime && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(updateData.startTime)) {
      throw new Error('Start time must be in HH:MM format');
    }

    if (updateData.endTime && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(updateData.endTime)) {
      throw new Error('End time must be in HH:MM format');
    }

    // Get collections
    const orchestraCollection = await getCollection('orchestra');
    const rehearsalCollection = await getCollection('rehearsal');

    if (!orchestraCollection || !rehearsalCollection) {
      throw new Error('Database error: Failed to access required collections');
    }

    // Verify orchestra exists
    const orchestra = await orchestraCollection.findOne({
      _id: ObjectId.createFromHexString(orchestraId)
    });

    if (!orchestra) {
      throw new Error('Orchestra not found');
    }

    // Authorization check - only admin or conductor of this orchestra can update
    if (!isAdmin) {
      if (orchestra.conductorId !== userId.toString()) {
        throw new Error('Not authorized to update rehearsals for this orchestra');
      }
    }

    // Prepare update object with metadata
    const updateObject = {
      ...updateData,
      updatedAt: new Date()
    };

    let updatedCount = 0;

    // Use transaction for data consistency
    const client = rehearsalCollection.client || rehearsalCollection.s?.client;
    if (client) {
      const session = client.startSession();
      
      try {
        await session.withTransaction(async () => {
          // Update all rehearsals for this orchestra
          const updateResult = await rehearsalCollection.updateMany(
            { groupId: orchestraId },
            { $set: updateObject },
            { session }
          );
          
          updatedCount = updateResult.modifiedCount;

          // Update orchestra's last modified timestamp
          await orchestraCollection.updateOne(
            { _id: ObjectId.createFromHexString(orchestraId) },
            { $set: { lastModified: new Date() } },
            { session }
          );
        });
      } finally {
        await session.endSession();
      }
    } else {
      // Fallback without transaction if session not available
      const updateResult = await rehearsalCollection.updateMany(
        { groupId: orchestraId },
        { $set: updateObject }
      );
      
      updatedCount = updateResult.modifiedCount;

      // Update orchestra
      try {
        await orchestraCollection.updateOne(
          { _id: ObjectId.createFromHexString(orchestraId) },
          { $set: { lastModified: new Date() } }
        );
      } catch (orchestraErr) {
        console.warn(`Failed to update orchestra: ${orchestraErr.message}`);
      }
    }

    // Logging
    console.log(`User ${userId} updated ${updatedCount} rehearsals for orchestra ${orchestraId}`);

    return {
      updatedCount,
      message: `Successfully updated ${updatedCount} rehearsals for orchestra`
    };
  } catch (err) {
    console.error(`Failed to bulk update rehearsals by orchestra: ${err}`);
    throw new Error(`Failed to bulk update rehearsals by orchestra: ${err.message}`);
  }
}

async function updateAttendance(
  rehearsalId,
  attendanceData,
  teacherId,
  isAdmin = false
) {
  try {
    const { error, value } = validateAttendance(attendanceData);
    if (error) throw error;

    const { present, absent } = value;

    // Load the rehearsal to get details
    const rehearsal = await getRehearsalById(rehearsalId);

    if (!isAdmin) {
      // Check if teacher has permissions for this orchestra
      const orchestraCollection = await getCollection('orchestra');
      if (!orchestraCollection) {
        throw new Error(
          'Database error: Failed to access orchestra collection'
        );
      }

      const orchestra = await orchestraCollection.findOne({
        _id: ObjectId.createFromHexString(rehearsal.groupId),
        conductorId: teacherId.toString(),
      });

      if (!orchestra) {
        throw new Error(
          'Not authorized to update attendance for this rehearsal'
        );
      }
    }

    const collection = await getCollection('rehearsal');
    if (!collection) {
      throw new Error('Database error: Failed to access rehearsal collection');
    }

    const result = await collection.findOneAndUpdate(
      { _id: ObjectId.createFromHexString(rehearsalId) },
      {
        $set: {
          attendance: {
            present,
            absent,
          },
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    if (!result) throw new Error(`Rehearsal with id ${rehearsalId} not found`);

    try {
      const activityCollection = await getCollection('activity_attendance');
      if (activityCollection) {
        // Delete existing attendance records
        await activityCollection.deleteMany({
          sessionId: rehearsalId,
          activityType: 'תזמורת',
        });

        // Create new attendance records
        const presentPromises = present.map((studentId) =>
          activityCollection.insertOne({
            studentId,
            activityType: 'תזמורת',
            groupId: rehearsal.groupId,
            sessionId: rehearsalId,
            date: rehearsal.date,
            status: 'הגיע/ה',
            notes: '',
            createdAt: new Date(),
          })
        );

        const absentPromises = absent.map((studentId) =>
          activityCollection.insertOne({
            studentId,
            activityType: 'תזמורת',
            groupId: rehearsal.groupId,
            sessionId: rehearsalId,
            date: rehearsal.date,
            status: 'לא הגיע/ה',
            notes: '',
            createdAt: new Date(),
          })
        );

        await Promise.all([...presentPromises, ...absentPromises]);
      }
    } catch (activityErr) {
      // Log but don't fail if activity records couldn't be created
      console.warn(`Could not create activity records: ${activityErr.message}`);
    }

    return result;
  } catch (err) {
    console.error(`Error updating attendance ${rehearsalId}: ${err.message}`);
    throw new Error(`Error updating attendance ${rehearsalId}: ${err.message}`);
  }
}

// Helper function to generate dates for a specific day of the week
function _generateDatesForDayOfWeek(
  startDate,
  endDate,
  dayOfWeek,
  excludesDates = []
) {
  const dates = [];
  const currentDate = new Date(startDate);

  // Calculate first occurrence of the specified day of week
  currentDate.setDate(
    currentDate.getDate() + ((dayOfWeek - currentDate.getDay() + 7) % 7)
  );

  // If the first occurrence is before the start date, move to next week
  if (currentDate < startDate) {
    currentDate.setDate(currentDate.getDate() + 7);
  }

  // Generate all dates until end date
  while (currentDate <= endDate) {
    const shouldExclude = excludesDates.some(
      (excludeDate) => excludeDate.toDateString() === currentDate.toDateString()
    );

    if (!shouldExclude) {
      dates.push(new Date(currentDate));
    }

    currentDate.setDate(currentDate.getDate() + 7);
  }

  return dates;
}

// Helper function to build query criteria from filter
function _buildCriteria(filterBy) {
  const criteria = {};

  if (filterBy.groupId) {
    criteria.groupId = filterBy.groupId;
  }

  if (filterBy.type) {
    criteria.type = filterBy.type;
  }

  if (filterBy.fromDate) {
    criteria.date = criteria.date || {};
    criteria.date.$gte = new Date(filterBy.fromDate);
    console.log('Date filter applied:', {
      fromDate: filterBy.fromDate,
      converted: new Date(filterBy.fromDate),
    });
  }

  if (filterBy.toDate) {
    criteria.date = criteria.date || {};
    criteria.date.$lte = new Date(filterBy.toDate);
  }

  // isActive filtering removed - all records are now active (hard delete implementation)

  return criteria;
}
