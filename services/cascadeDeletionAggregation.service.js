/**
 * MongoDB Aggregation Pipelines for Cascade Deletion System
 * Provides comprehensive data integrity validation and orphaned reference detection
 */

import { getDB } from './mongoDB.service.js';
import { ObjectId } from 'mongodb';

export const cascadeDeletionAggregationService = {
  
  /**
   * Find all orphaned student references across collections
   * Returns students referenced in other collections but missing from student collection
   */
  async findOrphanedStudentReferences() {
    const db = getDB();
    
    try {
      // Get all active student IDs for reference
      const activeStudents = await db.collection('student').aggregate([
        { $match: { isActive: true } },
        { $project: { _id: 1 } },
        { $group: { _id: null, activeStudentIds: { $push: '$_id' } } }
      ]).toArray();
      
      const activeStudentIds = activeStudents[0]?.activeStudentIds || [];
      
      // Find orphaned references in teacher collection
      const teacherOrphans = await db.collection('teacher').aggregate([
        { $match: { isActive: true } },
        { $unwind: '$teaching.studentIds' },
        { 
          $match: { 
            'teaching.studentIds': { $nin: activeStudentIds }
          } 
        },
        {
          $group: {
            _id: '$teaching.studentIds',
            referencedInTeachers: { $push: '$_id' },
            count: { $sum: 1 }
          }
        },
        {
          $project: {
            orphanedStudentId: '$_id',
            referencedInTeachers: 1,
            teacherCount: '$count',
            _id: 0
          }
        }
      ]).toArray();

      // Find orphaned references in orchestra collection
      const orchestraOrphans = await db.collection('orchestra').aggregate([
        { $match: { isActive: true } },
        { $unwind: '$memberIds' },
        { 
          $match: { 
            memberIds: { $nin: activeStudentIds }
          } 
        },
        {
          $group: {
            _id: '$memberIds',
            referencedInOrchestras: { $push: '$_id' },
            count: { $sum: 1 }
          }
        },
        {
          $project: {
            orphanedStudentId: '$_id',
            referencedInOrchestras: 1,
            orchestraCount: '$count',
            _id: 0
          }
        }
      ]).toArray();

      // Find orphaned references in rehearsal attendance
      const rehearsalOrphans = await db.collection('rehearsal').aggregate([
        { $unwind: '$attendance' },
        { 
          $match: { 
            'attendance.studentId': { $nin: activeStudentIds }
          } 
        },
        {
          $group: {
            _id: '$attendance.studentId',
            referencedInRehearsals: { $push: '$_id' },
            count: { $sum: 1 }
          }
        },
        {
          $project: {
            orphanedStudentId: '$_id',
            referencedInRehearsals: 1,
            rehearsalCount: '$count',
            _id: 0
          }
        }
      ]).toArray();

      // Find orphaned references in theory lessons
      const theoryOrphans = await db.collection('theory_lesson').aggregate([
        { $unwind: '$studentIds' },
        { 
          $match: { 
            studentIds: { $nin: activeStudentIds }
          } 
        },
        {
          $group: {
            _id: '$studentIds',
            referencedInTheoryLessons: { $push: '$_id' },
            count: { $sum: 1 }
          }
        },
        {
          $project: {
            orphanedStudentId: '$_id',
            referencedInTheoryLessons: 1,
            theoryLessonCount: '$count',
            _id: 0
          }
        }
      ]).toArray();

      // Find orphaned references in bagrut collection
      const bagrutOrphans = await db.collection('bagrut').aggregate([
        { $match: { isActive: true } },
        { 
          $match: { 
            studentId: { $nin: activeStudentIds }
          } 
        },
        {
          $project: {
            orphanedStudentId: '$studentId',
            bagrutId: '$_id',
            teacherId: 1,
            _id: 0
          }
        }
      ]).toArray();

      // Find orphaned references in activity attendance
      const attendanceOrphans = await db.collection('activity_attendance').aggregate([
        { 
          $match: { 
            studentId: { $nin: activeStudentIds }
          } 
        },
        {
          $group: {
            _id: '$studentId',
            referencedInAttendance: { $push: '$_id' },
            count: { $sum: 1 }
          }
        },
        {
          $project: {
            orphanedStudentId: '$_id',
            referencedInAttendance: 1,
            attendanceCount: '$count',
            _id: 0
          }
        }
      ]).toArray();

      return {
        summary: {
          totalOrphanedStudents: new Set([
            ...teacherOrphans.map(o => o.orphanedStudentId.toString()),
            ...orchestraOrphans.map(o => o.orphanedStudentId.toString()),
            ...rehearsalOrphans.map(o => o.orphanedStudentId.toString()),
            ...theoryOrphans.map(o => o.orphanedStudentId.toString()),
            ...bagrutOrphans.map(o => o.orphanedStudentId.toString()),
            ...attendanceOrphans.map(o => o.orphanedStudentId.toString())
          ]).size,
          byCollection: {
            teachers: teacherOrphans.length,
            orchestras: orchestraOrphans.length,
            rehearsals: rehearsalOrphans.length,
            theoryLessons: theoryOrphans.length,
            bagrut: bagrutOrphans.length,
            attendance: attendanceOrphans.length
          }
        },
        details: {
          teacherOrphans,
          orchestraOrphans,
          rehearsalOrphans,
          theoryOrphans,
          bagrutOrphans,
          attendanceOrphans
        }
      };
    } catch (error) {
      console.error('Error finding orphaned student references:', error);
      throw error;
    }
  },

  /**
   * Detect bidirectional reference inconsistencies
   * Finds cases where relationships are not properly maintained in both directions
   */
  async detectBidirectionalInconsistencies() {
    const db = getDB();
    
    try {
      // Student-Teacher relationship inconsistencies
      const studentTeacherInconsistencies = await db.collection('student').aggregate([
        { $match: { isActive: true } },
        { $unwind: '$teacherIds' },
        {
          $lookup: {
            from: 'teacher',
            let: { studentId: '$_id', teacherId: '$teacherIds' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$_id', '$$teacherId'] },
                      { $eq: ['$isActive', true] },
                      { $not: { $in: ['$$studentId', '$teaching.studentIds'] } }
                    ]
                  }
                }
              }
            ],
            as: 'inconsistentTeacher'
          }
        },
        { $match: { inconsistentTeacher: { $ne: [] } } },
        {
          $project: {
            studentId: '$_id',
            teacherId: '$teacherIds',
            issue: 'Student references teacher but teacher does not reference student',
            _id: 0
          }
        }
      ]).toArray();

      // Teacher-Student relationship inconsistencies  
      const teacherStudentInconsistencies = await db.collection('teacher').aggregate([
        { $match: { isActive: true } },
        { $unwind: '$teaching.studentIds' },
        {
          $lookup: {
            from: 'student',
            let: { teacherId: '$_id', studentId: '$teaching.studentIds' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$_id', '$$studentId'] },
                      { $eq: ['$isActive', true] },
                      { $not: { $in: ['$$teacherId', '$teacherIds'] } }
                    ]
                  }
                }
              }
            ],
            as: 'inconsistentStudent'
          }
        },
        { $match: { inconsistentStudent: { $ne: [] } } },
        {
          $project: {
            teacherId: '$_id',
            studentId: '$teaching.studentIds',
            issue: 'Teacher references student but student does not reference teacher',
            _id: 0
          }
        }
      ]).toArray();

      // Orchestra-Student relationship inconsistencies
      const orchestraStudentInconsistencies = await db.collection('orchestra').aggregate([
        { $match: { isActive: true } },
        { $unwind: '$memberIds' },
        {
          $lookup: {
            from: 'student',
            let: { orchestraId: '$_id', studentId: '$memberIds' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$_id', '$$studentId'] },
                      { $eq: ['$isActive', true] },
                      { $not: { $in: ['$$orchestraId', '$orchestraIds'] } }
                    ]
                  }
                }
              }
            ],
            as: 'inconsistentStudent'
          }
        },
        { $match: { inconsistentStudent: { $ne: [] } } },
        {
          $project: {
            orchestraId: '$_id',
            studentId: '$memberIds',
            issue: 'Orchestra references student but student does not reference orchestra',
            _id: 0
          }
        }
      ]).toArray();

      // Student-Orchestra relationship inconsistencies
      const studentOrchestraInconsistencies = await db.collection('student').aggregate([
        { $match: { isActive: true } },
        { $unwind: '$orchestraIds' },
        {
          $lookup: {
            from: 'orchestra',
            let: { studentId: '$_id', orchestraId: '$orchestraIds' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$_id', '$$orchestraId'] },
                      { $eq: ['$isActive', true] },
                      { $not: { $in: ['$$studentId', '$memberIds'] } }
                    ]
                  }
                }
              }
            ],
            as: 'inconsistentOrchestra'
          }
        },
        { $match: { inconsistentOrchestra: { $ne: [] } } },
        {
          $project: {
            studentId: '$_id',
            orchestraId: '$orchestraIds',
            issue: 'Student references orchestra but orchestra does not reference student',
            _id: 0
          }
        }
      ]).toArray();

      // Bagrut relationship inconsistencies
      const bagrutInconsistencies = await db.collection('bagrut').aggregate([
        { $match: { isActive: true } },
        {
          $lookup: {
            from: 'student',
            let: { bagrutId: '$_id', studentId: '$studentId' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$_id', '$$studentId'] },
                      { $eq: ['$isActive', true] },
                      { $ne: ['$bagrutId', '$$bagrutId'] }
                    ]
                  }
                }
              }
            ],
            as: 'inconsistentStudent'
          }
        },
        { $match: { inconsistentStudent: { $ne: [] } } },
        {
          $project: {
            bagrutId: '$_id',
            studentId: '$studentId',
            issue: 'Bagrut references student but student does not reference bagrut',
            _id: 0
          }
        }
      ]).toArray();

      return {
        summary: {
          totalInconsistencies: studentTeacherInconsistencies.length + 
                              teacherStudentInconsistencies.length + 
                              orchestraStudentInconsistencies.length + 
                              studentOrchestraInconsistencies.length + 
                              bagrutInconsistencies.length,
          byType: {
            studentTeacher: studentTeacherInconsistencies.length,
            teacherStudent: teacherStudentInconsistencies.length,
            orchestraStudent: orchestraStudentInconsistencies.length,
            studentOrchestra: studentOrchestraInconsistencies.length,
            bagrut: bagrutInconsistencies.length
          }
        },
        details: {
          studentTeacherInconsistencies,
          teacherStudentInconsistencies,
          orchestraStudentInconsistencies,
          studentOrchestraInconsistencies,
          bagrutInconsistencies
        }
      };
    } catch (error) {
      console.error('Error detecting bidirectional inconsistencies:', error);
      throw error;
    }
  },

  /**
   * Generate cascade deletion impact report for a specific student
   * Shows all references that would be affected by deleting a student
   */
  async generateCascadeDeletionImpactReport(studentId) {
    const db = getDB();
    
    try {
      const studentObjectId = new ObjectId(studentId);
      
      // Find student details
      const student = await db.collection('student').findOne({ _id: studentObjectId });
      
      if (!student) {
        throw new Error(`Student with ID ${studentId} not found`);
      }

      // Find all teacher relationships
      const teacherImpact = await db.collection('teacher').aggregate([
        {
          $match: {
            $or: [
              { 'teaching.studentIds': studentObjectId },
              { 'teaching.timeBlocks.assignedLessons.studentId': studentId }
            ],
            isActive: true
          }
        },
        {
          $project: {
            teacherId: '$_id',
            teacherName: { $concat: ['$personalInfo.firstName', ' ', '$personalInfo.lastName'] },
            studentInTeaching: { $in: [studentObjectId, '$teaching.studentIds'] },
            timeBlockLessonsCount: {
              $size: {
                $reduce: {
                  input: { $ifNull: ['$teaching.timeBlocks', []] },
                  initialValue: [],
                  in: {
                    $concatArrays: [
                      '$$value',
                      {
                        $filter: {
                          input: { $ifNull: ['$$this.assignedLessons', []] },
                          cond: { $eq: ['$$this.studentId', studentId] }
                        }
                      }
                    ]
                  }
                }
              }
            }
          }
        }
      ]).toArray();

      // Find all orchestra relationships
      const orchestraImpact = await db.collection('orchestra').aggregate([
        { 
          $match: { 
            memberIds: studentObjectId,
            isActive: true
          }
        },
        {
          $project: {
            orchestraId: '$_id',
            orchestraName: '$name',
            totalMembers: { $size: '$memberIds' },
            rehearsalCount: { $size: { $ifNull: ['$rehearsalIds', []] } }
          }
        }
      ]).toArray();

      // Find all rehearsal attendance
      const rehearsalImpact = await db.collection('rehearsal').aggregate([
        { 
          $match: { 
            'attendance.studentId': studentObjectId
          }
        },
        {
          $project: {
            rehearsalId: '$_id',
            groupId: 1,
            date: 1,
            attendanceStatus: {
              $arrayElemAt: [
                {
                  $filter: {
                    input: '$attendance',
                    cond: { $eq: ['$$this.studentId', studentObjectId] }
                  }
                },
                0
              ]
            }
          }
        }
      ]).toArray();

      // Find all theory lesson relationships
      const theoryImpact = await db.collection('theory_lesson').aggregate([
        { 
          $match: { 
            studentIds: studentObjectId
          }
        },
        {
          $project: {
            theoryLessonId: '$_id',
            teacherId: 1,
            category: 1,
            date: 1,
            totalStudents: { $size: '$studentIds' }
          }
        }
      ]).toArray();

      // Find bagrut relationship
      const bagrutImpact = await db.collection('bagrut').aggregate([
        { 
          $match: { 
            studentId: studentObjectId,
            isActive: true
          }
        },
        {
          $project: {
            bagrutId: '$_id',
            teacherId: 1,
            presentationCount: { $size: { $ifNull: ['$presentations', []] } },
            completedPresentations: {
              $size: {
                $filter: {
                  input: { $ifNull: ['$presentations', []] },
                  cond: { $ne: ['$$this.grade', null] }
                }
              }
            }
          }
        }
      ]).toArray();

      // Find activity attendance
      const attendanceImpact = await db.collection('activity_attendance').aggregate([
        { 
          $match: { 
            studentId: studentObjectId
          }
        },
        {
          $group: {
            _id: '$activityType',
            totalRecords: { $sum: 1 },
            attendanceStatuses: { $push: '$status' },
            sessions: { $addToSet: '$sessionId' }
          }
        },
        {
          $project: {
            activityType: '$_id',
            totalRecords: 1,
            uniqueSessions: { $size: '$sessions' },
            _id: 0
          }
        }
      ]).toArray();

      return {
        student: {
          id: studentId,
          name: `${student.personalInfo?.firstName || ''} ${student.personalInfo?.lastName || ''}`.trim(),
          isActive: student.isActive,
          currentReferences: {
            teachers: student.teacherIds?.length || 0,
            orchestras: student.orchestraIds?.length || 0,
            hasBagrut: !!student.bagrutId
          }
        },
        impactSummary: {
          teachersAffected: teacherImpact.length,
          orchestrasAffected: orchestraImpact.length,
          rehearsalsAffected: rehearsalImpact.length,
          theoryLessonsAffected: theoryImpact.length,
          bagrutRecordsAffected: bagrutImpact.length,
          attendanceRecordsAffected: attendanceImpact.reduce((sum, a) => sum + a.totalRecords, 0)
        },
        detailedImpact: {
          teachers: teacherImpact,
          orchestras: orchestraImpact,
          rehearsals: rehearsalImpact,
          theoryLessons: theoryImpact,
          bagrut: bagrutImpact,
          attendance: attendanceImpact
        },
        recommendedActions: this.generateRecommendedActions({
          teacherImpact,
          orchestraImpact,
          rehearsalImpact,
          theoryImpact,
          bagrutImpact,
          attendanceImpact
        })
      };
    } catch (error) {
      console.error('Error generating cascade deletion impact report:', error);
      throw error;
    }
  },

  /**
   * Validate data integrity across all collections
   * Comprehensive check for referential integrity and data consistency
   */
  async validateDataIntegrity() {
    const db = getDB();
    
    try {
      console.log('Starting comprehensive data integrity validation...');
      
      // Get collection statistics
      const collections = ['student', 'teacher', 'orchestra', 'rehearsal', 'theory_lesson', 'bagrut', 'activity_attendance'];
      const stats = {};
      
      for (const collectionName of collections) {
        const collection = db.collection(collectionName);
        const count = await collection.countDocuments();
        const activeCount = await collection.countDocuments({ isActive: true });
        stats[collectionName] = { total: count, active: activeCount };
      }

      // Run all validation checks in parallel
      const [
        orphanedReferences,
        bidirectionalIssues,
        duplicateReferences,
        invalidObjectIds
      ] = await Promise.all([
        this.findOrphanedStudentReferences(),
        this.detectBidirectionalInconsistencies(),
        this.findDuplicateReferences(),
        this.findInvalidObjectIds()
      ]);

      const overallHealth = {
        score: this.calculateIntegrityScore({
          orphanedReferences,
          bidirectionalIssues,
          duplicateReferences,
          invalidObjectIds,
          stats
        }),
        issues: {
          orphanedReferences: orphanedReferences.summary.totalOrphanedStudents,
          bidirectionalIssues: bidirectionalIssues.summary.totalInconsistencies,
          duplicateReferences: duplicateReferences.summary.totalDuplicates,
          invalidObjectIds: invalidObjectIds.summary.totalInvalid
        },
        recommendations: this.generateIntegrityRecommendations({
          orphanedReferences,
          bidirectionalIssues,
          duplicateReferences,
          invalidObjectIds
        })
      };

      return {
        timestamp: new Date(),
        collectionStats: stats,
        integrityChecks: {
          orphanedReferences,
          bidirectionalIssues,
          duplicateReferences,
          invalidObjectIds
        },
        overallHealth
      };
    } catch (error) {
      console.error('Error validating data integrity:', error);
      throw error;
    }
  },

  // Helper methods
  async findDuplicateReferences() {
    const db = getDB();
    
    // Find duplicate student IDs in teacher.teaching.studentIds
    const teacherDuplicates = await db.collection('teacher').aggregate([
      { $match: { isActive: true } },
      {
        $project: {
          teacherId: '$_id',
          studentIds: '$teaching.studentIds',
          duplicateStudents: {
            $filter: {
              input: '$teaching.studentIds',
              cond: {
                $gt: [
                  {
                    $size: {
                      $filter: {
                        input: '$teaching.studentIds',
                        cond: { $eq: ['$$this', '$$item'] }
                      }
                    }
                  },
                  1
                ]
              }
            }
          }
        }
      },
      { $match: { duplicateStudents: { $ne: [] } } }
    ]).toArray();

    return {
      summary: {
        totalDuplicates: teacherDuplicates.length
      },
      details: {
        teacherDuplicates
      }
    };
  },

  async findInvalidObjectIds() {
    // This would check for malformed ObjectIds in references
    // Implementation depends on specific validation rules
    return {
      summary: {
        totalInvalid: 0
      },
      details: {}
    };
  },

  calculateIntegrityScore(checks) {
    const totalIssues = checks.orphanedReferences.summary.totalOrphanedStudents +
                       checks.bidirectionalIssues.summary.totalInconsistencies +
                       checks.duplicateReferences.summary.totalDuplicates +
                       checks.invalidObjectIds.summary.totalInvalid;
                       
    const totalRecords = Object.values(checks.stats).reduce((sum, stat) => sum + stat.active, 0);
    
    if (totalRecords === 0) return 100;
    
    const errorRate = totalIssues / totalRecords;
    return Math.max(0, Math.round((1 - errorRate) * 100));
  },

  generateRecommendedActions(impact) {
    const actions = [];
    
    if (impact.teacherImpact.length > 0) {
      actions.push('Remove student references from teacher.teaching.studentIds arrays');
      actions.push('Clear schedule slots assigned to this student');
    }
    
    if (impact.orchestraImpact.length > 0) {
      actions.push('Remove student from orchestra.memberIds arrays');
      actions.push('Consider reassigning orchestra roles if student had special responsibilities');
    }
    
    if (impact.rehearsalImpact.length > 0) {
      actions.push('Archive rehearsal attendance records (do not delete historical data)');
    }
    
    if (impact.theoryImpact.length > 0) {
      actions.push('Remove student from theory_lesson.studentIds arrays');
    }
    
    if (impact.bagrutImpact.length > 0) {
      actions.push('Archive bagrut record with completed presentations');
      actions.push('Ensure academic records are preserved for institutional requirements');
    }
    
    if (impact.attendanceImpact.length > 0) {
      actions.push('Archive activity attendance records');
    }
    
    return actions;
  },

  generateIntegrityRecommendations(checks) {
    const recommendations = [];
    
    if (checks.orphanedReferences.summary.totalOrphanedStudents > 0) {
      recommendations.push('Run orphaned reference cleanup script');
      recommendations.push('Implement referential integrity constraints');
    }
    
    if (checks.bidirectionalIssues.summary.totalInconsistencies > 0) {
      recommendations.push('Synchronize bidirectional relationships');
      recommendations.push('Add validation middleware to prevent future inconsistencies');
    }
    
    if (checks.duplicateReferences.summary.totalDuplicates > 0) {
      recommendations.push('Remove duplicate references from arrays');
      recommendations.push('Add unique constraints where appropriate');
    }
    
    return recommendations;
  }
};