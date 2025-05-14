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

    if (rehearsal.type === 'תזמורת') {
      const orchestraCollection = await getCollection('orchestra');
      if (orchestraCollection) {
        await orchestraCollection.updateOne(
          { _id: ObjectId.createFromHexString(rehearsal.groupId) },
          { $pull: { rehearsalIds: rehearsalId } }
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
          isActive: false,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
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
      isActive: true,
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

async function updateAttendance(rehearsalId, attendanceData, isAdmin = false) {
  try {
    const { error, value } = validateAttendance(attendanceData);
    if (error) throw error;

    const { present, absent } = value;

    if (!isAdmin) {
      throw new Error('Not authorized to update attendance');
    }

    const rehearsal = await getRehearsalById(rehearsalId);

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

    const activityCollection = await getCollection('activity_attendance');
    if (!activityCollection) {
      console.warn(
        'Activity attendance collection not available, skipping attendance records'
      );
      return result;
    }

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

    return result;
  } catch (err) {
    console.error(`Error updating attendance ${rehearsalId}: ${err.message}`);
    throw new Error(`Error updating attendance ${rehearsalId}: ${err.message}`);
  }
}

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

  if (filterBy.showInactive) {
    if (filterBy.isActive !== undefined) {
      criteria.isActive = filterBy.isActive;
    }
  } else {
    criteria.isActive = true;
  }

  return criteria;
}
