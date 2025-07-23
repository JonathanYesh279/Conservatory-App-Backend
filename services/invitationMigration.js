/**
 * Invitation Migration Utilities
 * Tools for migrating between EMAIL and DEFAULT_PASSWORD invitation modes
 */

import { getCollection } from './mongoDB.service.js';
import { authService } from '../api/auth/auth.service.js';
import { emailService } from './emailService.js';
import { invitationConfig } from './invitationConfig.js';
import crypto from 'crypto';

export const invitationMigration = {
  migratePendingInvitations,
  switchInvitationMode,
  getInvitationModeStats,
  resetTeacherToInvitationMode
};

/**
 * Migrate all pending invitations from EMAIL to DEFAULT_PASSWORD mode
 * This converts teachers waiting for email invitations to default password users
 */
async function migratePendingInvitations() {
  try {
    const collection = await getCollection('teacher');
    
    // Find all teachers with pending email invitations
    const pendingInvitations = await collection.find({
      'credentials.isInvitationAccepted': false,
      'credentials.invitationToken': { $exists: true },
      'credentials.invitationMode': 'EMAIL',
      isActive: true
    }).toArray();
    
    console.log(`Found ${pendingInvitations.length} pending email invitations to migrate`);
    
    if (pendingInvitations.length === 0) {
      return {
        success: true,
        message: 'No pending invitations to migrate',
        migratedCount: 0
      };
    }
    
    let migratedCount = 0;
    const errors = [];
    const defaultPassword = invitationConfig.getDefaultPassword();
    const hashedPassword = await authService.encryptPassword(defaultPassword);
    
    for (const teacher of pendingInvitations) {
      try {
        const result = await collection.updateOne(
          { _id: teacher._id },
          {
            $set: {
              'credentials.password': hashedPassword,
              'credentials.isInvitationAccepted': true,
              'credentials.requiresPasswordChange': true,
              'credentials.passwordSetAt': new Date(),
              'credentials.invitationMode': 'DEFAULT_PASSWORD',
              updatedAt: new Date()
            },
            $unset: {
              'credentials.invitationToken': '',
              'credentials.invitationExpiry': ''
            }
          }
        );
        
        if (result.modifiedCount === 1) {
          migratedCount++;
          console.log(`✅ Migrated teacher: ${teacher.personalInfo.fullName} (${teacher._id})`);
        }
      } catch (error) {
        const errorMsg = `Failed to migrate teacher ${teacher.personalInfo.fullName}: ${error.message}`;
        errors.push(errorMsg);
        console.error(errorMsg);
      }
    }
    
    return {
      success: true,
      message: `Migration completed. ${migratedCount} teachers migrated to default password mode.`,
      migratedCount,
      totalFound: pendingInvitations.length,
      errors: errors.length > 0 ? errors : undefined,
      defaultPassword: defaultPassword
    };
  } catch (error) {
    console.error('Migration failed:', error);
    throw new Error(`Migration failed: ${error.message}`);
  }
}

/**
 * Switch invitation mode and optionally migrate existing data
 */
async function switchInvitationMode(newMode, migrateExisting = false) {
  try {
    if (!invitationConfig.validateMode(newMode)) {
      throw new Error(`Invalid invitation mode: ${newMode}`);
    }
    
    const currentMode = invitationConfig.getCurrentMode();
    console.log(`Switching from ${currentMode} to ${newMode}`);
    
    let migrationResult = null;
    
    if (migrateExisting && currentMode === 'EMAIL' && newMode === 'DEFAULT_PASSWORD') {
      migrationResult = await migratePendingInvitations();
    }
    
    return {
      success: true,
      message: `Invitation mode switched to ${newMode}`,
      previousMode: currentMode,
      newMode: newMode,
      migrationResult: migrationResult,
      note: 'Remember to update the INVITATION_MODE environment variable and restart the server'
    };
  } catch (error) {
    console.error('Mode switch failed:', error);
    throw error;
  }
}

/**
 * Get statistics about current invitation modes in the database
 */
async function getInvitationModeStats() {
  try {
    const collection = await getCollection('teacher');
    
    const stats = await collection.aggregate([
      {
        $match: { isActive: true }
      },
      {
        $group: {
          _id: {
            invitationMode: '$credentials.invitationMode',
            isInvitationAccepted: '$credentials.isInvitationAccepted',
            requiresPasswordChange: '$credentials.requiresPasswordChange'
          },
          count: { $sum: 1 }
        }
      }
    ]).toArray();
    
    // Count pending invitations
    const pendingInvitations = await collection.countDocuments({
      'credentials.isInvitationAccepted': false,
      'credentials.invitationToken': { $exists: true },
      isActive: true
    });
    
    // Count users requiring password change
    const requirePasswordChange = await collection.countDocuments({
      'credentials.requiresPasswordChange': true,
      isActive: true
    });
    
    return {
      currentMode: invitationConfig.getCurrentMode(),
      stats: stats,
      pendingInvitations: pendingInvitations,
      requirePasswordChange: requirePasswordChange,
      timestamp: new Date()
    };
  } catch (error) {
    console.error('Stats retrieval failed:', error);
    throw error;
  }
}

/**
 * Reset a specific teacher back to invitation mode (useful for testing)
 */
async function resetTeacherToInvitationMode(teacherId, mode = 'EMAIL') {
  try {
    if (!invitationConfig.validateMode(mode)) {
      throw new Error(`Invalid invitation mode: ${mode}`);
    }
    
    const collection = await getCollection('teacher');
    const teacher = await collection.findOne({ 
      _id: teacherId,
      isActive: true 
    });
    
    if (!teacher) {
      throw new Error('Teacher not found');
    }
    
    if (mode === 'EMAIL') {
      // Reset to email invitation mode
      const invitationToken = crypto.randomBytes(32).toString('hex');
      const invitationExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      
      await collection.updateOne(
        { _id: teacherId },
        {
          $set: {
            'credentials.invitationToken': invitationToken,
            'credentials.invitationExpiry': invitationExpiry,
            'credentials.isInvitationAccepted': false,
            'credentials.invitationMode': 'EMAIL',
            updatedAt: new Date()
          },
          $unset: {
            'credentials.password': '',
            'credentials.requiresPasswordChange': '',
            'credentials.passwordSetAt': ''
          }
        }
      );
      
      // Send invitation email
      await emailService.sendInvitationEmail(
        teacher.credentials.email, 
        invitationToken, 
        teacher.personalInfo.fullName
      );
      
      return {
        success: true,
        message: 'Teacher reset to EMAIL invitation mode',
        invitationToken: invitationToken
      };
    } else {
      // Reset to default password mode
      const defaultPassword = invitationConfig.getDefaultPassword();
      const hashedPassword = await authService.encryptPassword(defaultPassword);
      
      await collection.updateOne(
        { _id: teacherId },
        {
          $set: {
            'credentials.password': hashedPassword,
            'credentials.isInvitationAccepted': true,
            'credentials.requiresPasswordChange': true,
            'credentials.passwordSetAt': new Date(),
            'credentials.invitationMode': 'DEFAULT_PASSWORD',
            updatedAt: new Date()
          },
          $unset: {
            'credentials.invitationToken': '',
            'credentials.invitationExpiry': ''
          }
        }
      );
      
      return {
        success: true,
        message: 'Teacher reset to DEFAULT_PASSWORD mode',
        defaultPassword: defaultPassword
      };
    }
  } catch (error) {
    console.error('Teacher reset failed:', error);
    throw error;
  }
}