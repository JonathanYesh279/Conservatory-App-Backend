/**
 * Student Deletion Preview Service
 * Analyzes database relationships and dependencies for student entities
 * Provides comprehensive impact analysis before deletion
 */

import { getCollection } from '../../services/mongoDB.service.js';
import { ObjectId } from 'mongodb';

/**
 * Collection relationships mapping for student deletion analysis
 */
const STUDENT_RELATIONSHIPS = [
  {
    collection: 'teacher',
    fields: [
      { path: 'teaching.studentIds', type: 'array', description: 'Teacher-student assignments' },
      { path: 'teaching.timeBlocks.assignedLessons.studentId', type: 'nested', description: 'Private lesson assignments' }
    ],
    criticality: 'medium',
    impact: 'Teacher assignments and lesson schedules will be affected'
  },
  {
    collection: 'orchestra',
    fields: [
      { path: 'memberIds', type: 'array', description: 'Orchestra membership' }
    ],
    criticality: 'medium',
    impact: 'Student will be removed from orchestras'
  },
  {
    collection: 'rehearsal',
    fields: [
      { path: 'attendees.studentId', type: 'nested', description: 'Rehearsal attendance records' }
    ],
    criticality: 'low',
    impact: 'Historical rehearsal attendance will be lost'
  },
  {
    collection: 'theory',
    fields: [
      { path: 'attendees.studentId', type: 'nested', description: 'Theory lesson attendance' }
    ],
    criticality: 'low',
    impact: 'Theory lesson attendance records will be lost'
  },
  {
    collection: 'privateAttendance',
    fields: [
      { path: 'studentId', type: 'direct', description: 'Private lesson attendance records' }
    ],
    criticality: 'high',
    impact: 'All private lesson attendance history will be permanently lost'
  },
  {
    collection: 'privateLessons',
    fields: [
      { path: 'studentId', type: 'direct', description: 'Private lesson records' }
    ],
    criticality: 'high',
    impact: 'All private lesson records will be permanently lost'
  },
  {
    collection: 'bagrut',
    fields: [
      { path: 'studentId', type: 'direct', description: 'Bagrut exam records' }
    ],
    criticality: 'critical',
    impact: 'Academic bagrut records will be permanently lost'
  }
];

export const studentDeletionPreviewService = {
  generateDeletionPreview,
  analyzeStudentRelationships,
  calculateImpactLevel,
  generateWarnings
};

/**
 * Generate comprehensive deletion preview for a student
 */
async function generateDeletionPreview(studentId) {
  try {
    console.log(`🔍 Generating deletion preview for student: ${studentId}`);

    // Validate input
    if (!studentId) {
      throw new Error('Student ID is required');
    }

    if (!ObjectId.isValid(studentId)) {
      throw new Error('Invalid student ID format');
    }

    // Validate student exists and get basic info
    const student = await getStudentInfo(studentId);
    if (!student) {
      throw new Error(`Student with ID ${studentId} not found`);
    }

    // Analyze all relationships
    const impacts = await analyzeStudentRelationships(studentId);

    // Generate warnings based on impact analysis
    const warnings = generateWarnings(impacts, student);

    // Calculate overall impact level
    const estimatedImpact = calculateImpactLevel(impacts);

    // Determine if deletion should be allowed
    const canDelete = !impacts.bagrut || impacts.bagrut.count === 0 || estimatedImpact !== 'high';

    // Calculate relationship counts
    const relationships = await calculateRelationshipCounts(studentId);

    const preview = {
      student: {
        id: studentId,
        name: student.personalInfo?.fullName || 'Unknown Student',
        class: student.academicInfo?.class || 'Unknown',
        isActive: student.isActive !== false,
        instruments: student.academicInfo?.instrumentProgress?.map(ip => ip.instrumentName) || []
      },
      impacts,
      warnings,
      canDelete,
      estimatedImpact,
      relationships,
      generatedAt: new Date(),
      summary: {
        totalRecords: Object.values(impacts).reduce((sum, impact) => sum + (impact.count || 0), 0),
        affectedCollections: Object.keys(impacts).filter(key => impacts[key].count > 0).length,
        criticalData: warnings.filter(w => w.severity === 'critical').length > 0
      }
    };

    console.log(`✅ Generated deletion preview for ${student.personalInfo?.fullName}: ${preview.summary.totalRecords} total records affected`);
    return { success: true, data: preview };

  } catch (error) {
    console.error(`❌ Error generating deletion preview for student ${studentId}:`, error);
    return {
      success: false,
      error: error.message,
      code: 'PREVIEW_GENERATION_FAILED'
    };
  }
}

/**
 * Analyze all database relationships for a student
 */
async function analyzeStudentRelationships(studentId) {
  const impacts = {};

  for (const relationship of STUDENT_RELATIONSHIPS) {
    try {
      const collection = await getCollection(relationship.collection);
      const analysis = await analyzeCollectionImpact(collection, relationship, studentId);

      if (analysis.count > 0) {
        impacts[relationship.collection] = analysis;
      }
    } catch (error) {
      console.warn(`⚠️ Error analyzing ${relationship.collection}:`, error.message);
      impacts[relationship.collection] = {
        count: 0,
        items: [],
        error: error.message,
        impact: 'Could not analyze this collection'
      };
    }
  }

  return impacts;
}

/**
 * Analyze impact for a specific collection
 */
async function analyzeCollectionImpact(collection, relationship, studentId) {
  const queries = [];
  const sampleItems = [];
  let totalCount = 0;

  try {
    // Build queries for each field in the relationship
    for (const field of relationship.fields) {
      try {
        const query = buildQueryForField(field, studentId);

        // Validate query is properly formed
        if (!query || Object.keys(query).length === 0) {
          console.warn(`⚠️ Invalid query generated for field ${field.path} in ${relationship.collection}`);
          continue;
        }

        const count = await collection.countDocuments(query);
        totalCount += count;

        if (count > 0) {
          // Get sample items (limit to 3 for preview)
          const items = await collection.find(query)
            .limit(3)
            .project(buildProjectionForField(field))
            .toArray();

          sampleItems.push(...items.map(item => formatSampleItem(item, field, relationship.collection)));
        }
      } catch (fieldError) {
        console.warn(`⚠️ Error analyzing field ${field.path} in ${relationship.collection}:`, fieldError.message);
        // Continue with other fields
      }
    }

    return {
      count: totalCount,
      items: sampleItems,
      impact: relationship.impact,
      criticality: relationship.criticality,
      description: relationship.fields.map(f => f.description).join(', ')
    };

  } catch (error) {
    console.error(`❌ Error analyzing collection ${relationship.collection}:`, error.message);
    return {
      count: 0,
      items: [],
      impact: 'Error analyzing this collection',
      criticality: 'unknown',
      description: 'Analysis failed',
      error: error.message
    };
  }
}

/**
 * Build MongoDB query for a specific field type
 */
function buildQueryForField(field, studentId) {
  try {
    if (!field || !field.path || !studentId) {
      throw new Error('Invalid field or studentId provided');
    }

    switch (field.type) {
      case 'direct':
        return { [field.path]: studentId };

      case 'array':
        return { [field.path]: studentId };

      case 'nested':
        return { [field.path]: studentId };

      default:
        console.warn(`⚠️ Unknown field type: ${field.type}, defaulting to direct match`);
        return { [field.path]: studentId };
    }
  } catch (error) {
    console.error(`❌ Error building query for field ${field?.path}:`, error.message);
    return {};
  }
}

/**
 * Build projection for sample data
 */
function buildProjectionForField(field) {
  const projection = { _id: 1 };

  // Include relevant fields based on collection
  if (field.path.includes('timeBlocks')) {
    projection['teaching.timeBlocks'] = 1;
    projection['personalInfo.fullName'] = 1;
  } else if (field.path.includes('attendees')) {
    projection.date = 1;
    projection.attendees = 1;
    projection.title = 1;
  } else {
    projection[field.path.split('.')[0]] = 1;
    projection.createdAt = 1;
    projection.date = 1;
    projection.title = 1;
    projection.name = 1;
  }

  return projection;
}

/**
 * Format sample item for display
 */
function formatSampleItem(item, field, collectionName) {
  const formatted = {
    id: item._id.toString(),
    collection: collectionName,
    type: field.description
  };

  // Add collection-specific formatting
  switch (collectionName) {
    case 'teacher':
      formatted.name = item.personalInfo?.fullName || 'Unknown Teacher';
      formatted.detail = field.path.includes('timeBlocks') ? 'Private lesson assignment' : 'Student assignment';
      break;

    case 'orchestra':
      formatted.name = item.name || 'Unknown Orchestra';
      formatted.detail = 'Orchestra membership';
      break;

    case 'rehearsal':
    case 'theory':
      formatted.name = item.title || 'Lesson/Rehearsal';
      formatted.detail = item.date ? new Date(item.date).toLocaleDateString('he-IL') : 'Unknown date';
      break;

    case 'privateAttendance':
    case 'privateLessons':
      formatted.name = 'Private Lesson';
      formatted.detail = item.date ? new Date(item.date).toLocaleDateString('he-IL') : 'Lesson record';
      break;

    case 'bagrut':
      formatted.name = 'Bagrut Record';
      formatted.detail = item.createdAt ? new Date(item.createdAt).toLocaleDateString('he-IL') : 'Academic record';
      break;

    default:
      formatted.name = 'Record';
      formatted.detail = 'Data record';
  }

  return formatted;
}

/**
 * Calculate overall impact level
 */
function calculateImpactLevel(impacts) {
  let criticalCount = 0;
  let highCount = 0;
  let totalRecords = 0;

  for (const [collection, impact] of Object.entries(impacts)) {
    totalRecords += impact.count || 0;

    if (impact.criticality === 'critical') {
      criticalCount += impact.count || 0;
    } else if (impact.criticality === 'high') {
      highCount += impact.count || 0;
    }
  }

  // Impact level calculation
  if (criticalCount > 0 || totalRecords > 100) {
    return 'high';
  } else if (highCount > 10 || totalRecords > 20) {
    return 'medium';
  } else {
    return 'low';
  }
}

/**
 * Generate warnings based on impact analysis
 */
function generateWarnings(impacts, student) {
  const warnings = [];

  // Check for critical data
  if (impacts.bagrut && impacts.bagrut.count > 0) {
    warnings.push({
      type: 'CRITICAL_DATA_LOSS',
      severity: 'critical',
      message: `הסטודנט קשור ל-${impacts.bagrut.count} רשומות בגרות שיימחקו לצמיתות`,
      collection: 'bagrut',
      affectedRecords: impacts.bagrut.count
    });
  }

  // Check for large attendance data loss
  const attendanceCount = (impacts.privateAttendance?.count || 0) +
                         (impacts.rehearsal?.count || 0) +
                         (impacts.theory?.count || 0);

  if (attendanceCount > 50) {
    warnings.push({
      type: 'LARGE_ATTENDANCE_LOSS',
      severity: 'high',
      message: `${attendanceCount} רשומות נוכחות יימחקו - מידע היסטורי חשוב`,
      collection: 'attendance',
      affectedRecords: attendanceCount
    });
  }

  // Check for active teacher assignments
  if (impacts.teacher && impacts.teacher.count > 0) {
    warnings.push({
      type: 'ACTIVE_ASSIGNMENTS',
      severity: 'medium',
      message: `הסטודנט משובץ ל-${impacts.teacher.count} מורים - השיבוצים יבוטלו`,
      collection: 'teacher',
      affectedRecords: impacts.teacher.count
    });
  }

  // Check for orchestra membership
  if (impacts.orchestra && impacts.orchestra.count > 0) {
    warnings.push({
      type: 'ORCHESTRA_MEMBERSHIP',
      severity: 'medium',
      message: `הסטודנט חבר ב-${impacts.orchestra.count} הרכבים - החברות תבוטל`,
      collection: 'orchestra',
      affectedRecords: impacts.orchestra.count
    });
  }

  // Check if student is active
  if (student.isActive !== false) {
    warnings.push({
      type: 'ACTIVE_STUDENT',
      severity: 'medium',
      message: 'הסטודנט פעיל במערכת - שקול להעביר לסטטוס לא פעיל במקום מחיקה',
      collection: 'student',
      affectedRecords: 1
    });
  }

  return warnings;
}

/**
 * Calculate relationship counts (parents, teachers, etc.)
 */
async function calculateRelationshipCounts(studentId) {
  try {
    // Count active teacher relationships
    const teacherCollection = await getCollection('teacher');
    const teachersCount = await teacherCollection.countDocuments({
      'teaching.studentIds': studentId
    });

    // Count parent relationships (if implemented in your system)
    // For now, we'll extract from student data
    const student = await getStudentInfo(studentId);
    const parentsCount = student.personalInfo?.parents ?
      Object.keys(student.personalInfo.parents).filter(key =>
        student.personalInfo.parents[key] &&
        typeof student.personalInfo.parents[key] === 'object'
      ).length : 0;

    return {
      parents: parentsCount,
      teachers: teachersCount
    };
  } catch (error) {
    console.warn('⚠️ Error calculating relationship counts:', error.message);
    return { parents: 0, teachers: 0 };
  }
}

/**
 * Get basic student information
 */
async function getStudentInfo(studentId) {
  try {
    const collection = await getCollection('student');
    return await collection.findOne({
      _id: ObjectId.createFromHexString(studentId)
    });
  } catch (error) {
    console.error(`❌ Error getting student info for ${studentId}:`, error);
    return null;
  }
}