import { getCollection } from '../../services/mongoDB.service.js';
import { authService } from '../auth/auth.service.js';
import { emailService } from '../../services/emailService.js';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';

export const invitationService = {
  validateInvitation,
  acceptInvitation,
  resendInvitation
};

async function validateInvitation(token) {
  try {
    const collection = await getCollection('teacher');
    const teacher = await collection.findOne({
      'credentials.invitationToken': token,
      'credentials.invitationExpiry': { $gt: new Date() },
      'credentials.isInvitationAccepted': false,
      isActive: true
    });

    if (!teacher) {
      throw new Error('Invalid or expired invitation');
    }

    return {
      isValid: true,
      teacher: {
        _id: teacher._id.toString(),
        personalInfo: {
          fullName: teacher.personalInfo.fullName,
          email: teacher.credentials.email
        },
        roles: teacher.roles
      }
    };
  } catch (err) {
    console.error(`Error validating invitation: ${err.message}`);
    throw err;
  }
}

async function acceptInvitation(token, password) {
  try {
    const collection = await getCollection('teacher');
    
    // Find teacher with valid invitation
    const teacher = await collection.findOne({
      'credentials.invitationToken': token,
      'credentials.invitationExpiry': { $gt: new Date() },
      'credentials.isInvitationAccepted': false,
      isActive: true
    });

    if (!teacher) {
      throw new Error('Invalid or expired invitation');
    }

    // Basic password validation
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    // Hash password and update teacher
    const hashedPassword = await authService.encryptPassword(password);
    
    const result = await collection.findOneAndUpdate(
      { _id: teacher._id },
      {
        $set: {
          'credentials.password': hashedPassword,
          'credentials.isInvitationAccepted': true,
          'credentials.passwordSetAt': new Date(),
          updatedAt: new Date()
        },
        $unset: {
          'credentials.invitationToken': '',
          'credentials.invitationExpiry': ''
        }
      },
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new Error('Failed to update teacher');
    }

    const updatedTeacher = result;

    // Generate tokens for immediate login
    const { accessToken, refreshToken } = await authService.generateTokens(updatedTeacher);

    // Update refresh token in database
    await collection.updateOne(
      { _id: updatedTeacher._id },
      {
        $set: {
          'credentials.refreshToken': refreshToken,
          'credentials.lastLogin': new Date(),
          updatedAt: new Date()
        }
      }
    );

    return {
      accessToken,
      refreshToken,
      teacher: {
        _id: updatedTeacher._id.toString(),
        personalInfo: {
          fullName: updatedTeacher.personalInfo.fullName,
          email: updatedTeacher.credentials.email
        },
        roles: updatedTeacher.roles,
      }
    };
  } catch (err) {
    console.error(`Error accepting invitation: ${err.message}`);
    throw err;
  }
}

async function resendInvitation(teacherId, adminId) {
  try {
    const collection = await getCollection('teacher');
    
    // Find teacher
    const teacher = await collection.findOne({
      _id: ObjectId.createFromHexString(teacherId),
      isActive: true
    });

    if (!teacher) {
      throw new Error('Teacher not found');
    }

    // Check if invitation has already been accepted
    if (teacher.credentials.isInvitationAccepted) {
      throw new Error('Invitation has already been accepted');
    }

    // Generate new invitation token
    const invitationToken = crypto.randomBytes(32).toString('hex');
    const invitationExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Update teacher with new invitation token
    await collection.updateOne(
      { _id: teacher._id },
      {
        $set: {
          'credentials.invitationToken': invitationToken,
          'credentials.invitationExpiry': invitationExpiry,
          'credentials.invitedAt': new Date(),
          'credentials.invitedBy': adminId,
          updatedAt: new Date()
        }
      }
    );

    // Send invitation email
    await emailService.sendInvitationEmail(teacher.credentials.email, invitationToken, teacher.personalInfo.fullName);

    return {
      success: true,
      message: 'Invitation resent successfully',
      teacherId: teacher._id.toString(),
      email: teacher.credentials.email
    };
  } catch (err) {
    console.error(`Error resending invitation: ${err.message}`);
    throw err;
  }
}

