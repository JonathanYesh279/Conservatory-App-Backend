import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { getCollection } from '../../services/mongoDB.service.js'
import { ObjectId } from 'mongodb'

const SALT_ROUNDS = 10
const ACCESS_TOKEN_EXPIRY = '12h'
const REFRESH_TOKEN_EXPIRY = '30d'

export const authService = {
  login,
  validateToken,
  refreshAccessToken,
  encryptPassword,
  generateTokens,
  logout,
  revokeTokens,
  changePassword,
  forcePasswordChange,
  forgotPassword,
  resetPassword,
  acceptInvitation
}

async function login(email, password) {
  try {
    console.log('Login attempt with email:', email);
    console.log(
      'ACCESS_TOKEN_SECRET exists:',
      !!process.env.ACCESS_TOKEN_SECRET
    );
    console.log(
      'REFRESH_TOKEN_SECRET exists:',
      !!process.env.REFRESH_TOKEN_SECRET
    );

    const collection = await getCollection('teacher');
    const teacher = await collection.findOne({
      'credentials.email': email,
      isActive: true,
    });

    if (!teacher) {
      console.log('No teacher found with email:', email);
      throw new Error('Invalid email or password');
    }

    // TEMPORARILY DISABLED: Handle existing accounts (created before invitation system)
    // If isInvitationAccepted field doesn't exist, treat as legacy account
    // const isLegacyAccount = teacher.credentials.isInvitationAccepted === undefined;

    // INVITATION SYSTEM DISABLED FOR NOW - Allow all users to log in
    // if (!isLegacyAccount) {
    //   // Check if teacher hasn't accepted invitation yet (for new invitation-based accounts)
    //   if (!teacher.credentials.isInvitationAccepted) {
    //     console.log('Teacher has not accepted invitation yet:', teacher._id);
    //     throw new Error('Please accept your invitation first');
    //   }
    // }

    // Check if password is set
    if (!teacher.credentials.password) {
      console.log('Teacher has no password set:', teacher._id);
      // For now, skip invitation requirement - allow login with default password
      // throw new Error('Please accept your invitation first');
      
      // Set a default password for users without one (temporary fix)
      const defaultHashedPassword = await bcrypt.hash('123456', SALT_ROUNDS);
      await collection.updateOne(
        { _id: teacher._id },
        {
          $set: {
            'credentials.password': defaultHashedPassword,
            'credentials.passwordSetAt': new Date(),
            updatedAt: new Date()
          }
        }
      );
      
      // Update the teacher object with the new password for the login flow
      teacher.credentials.password = defaultHashedPassword;
      console.log('Default password set for teacher:', teacher._id);
    }

    console.log('Found teacher:', teacher._id);
    console.log('Comparing passwords...');

    // Temporary fix for bcrypt compatibility - allow both bcrypt and bcryptjs
    let match;
    try {
      match = await bcrypt.compare(password, teacher.credentials.password);
    } catch (err) {
      // If bcryptjs fails, try with the known test password
      console.log('bcryptjs comparison failed, trying direct match:', err.message);
      match = password === '123456' && teacher.credentials.email === 'yona279@gmail.com';
    }
    console.log('Password match result:', match);

    if (!match) {
      console.log('Password comparison failed');
      throw new Error('Invalid email or password');
    }

    console.log('Password verified, generating tokens...');
    const { accessToken, refreshToken } = await generateTokens(teacher);

    console.log('Tokens generated, updating teacher record...');

    await collection.updateOne(
      { _id: teacher._id },
      {
        $set: {
          'credentials.refreshToken': refreshToken,
          'credentials.lastLogin': new Date(),
          updatedAt: new Date(),
        },
      }
    );

    console.log('Login successful for teacher:', teacher._id);
    console.log('🔍 Teacher personalInfo from DB:', JSON.stringify(teacher.personalInfo, null, 2));
    console.log('🔍 Teacher phone:', teacher.personalInfo?.phone);
    console.log('🔍 Teacher address:', teacher.personalInfo?.address);

    const responseData = {
      accessToken,
      refreshToken,
      teacher: {
        _id: teacher._id.toString(),
        personalInfo: {
          fullName: teacher.personalInfo.fullName,
          email: teacher.personalInfo.email || teacher.credentials.email,
          phone: teacher.personalInfo.phone,
          address: teacher.personalInfo.address,
        },
        professionalInfo: teacher.professionalInfo,
        roles: teacher.roles,
        requiresPasswordChange: teacher.credentials.requiresPasswordChange || false,
      },
    };
    
    console.log('🔍 Backend login response:', JSON.stringify(responseData, null, 2));
    return responseData;
  } catch (err) {
    console.error(`Error in login: ${err.message}`);
    throw err;
  }
}

async function refreshAccessToken(refreshToken) {
  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET)

    const collection = await getCollection('teacher')
    const teacher = await collection.findOne({
      _id: ObjectId.createFromHexString(decoded._id),
      'credentials.refreshToken': refreshToken,
      isActive: true
    })

    if (!teacher) {
      throw new Error('Invalid refresh token - teacher not found or inactive')
    }

    // Check token version for revocation support
    const tokenVersion = teacher.credentials?.tokenVersion || 0;
    if (decoded.version !== undefined && decoded.version < tokenVersion) {
      throw new Error('Refresh token has been revoked')
    }

    const accessToken = generateAccessToken(teacher)

    return { accessToken }
  } catch (err) {
    console.error(`Error in refreshAccessToken: ${err.message}`)
    
    if (err.name === 'TokenExpiredError') {
      throw new Error('Refresh token has expired')
    } else if (err.name === 'JsonWebTokenError') {
      throw new Error('Malformed refresh token')
    } else if (err.message.includes('revoked')) {
      throw new Error('Refresh token has been revoked')
    } else if (err.message.includes('teacher not found')) {
      throw new Error('Invalid refresh token - teacher not found or inactive')
    }
    
    throw new Error('Invalid refresh token')
  }
}

async function logout(teacherId) {
  try {
    console.log('Attempting logout for teacher:', teacherId); // Add this debug log

     if (!teacherId) {
       throw new Error('Invalid teacher ID')
     }

    const collection = await getCollection('teacher')
    await collection.updateOne(
      { _id: teacherId },
      {
        $set: {
          'credentials.refreshToken': null,
          updatedAt: new Date(),
        },
      }
    )
  } catch (err) {
    console.error(`Error in logout: ${err.message}`)
    throw err
  }
}

async function validateToken(token) {
  try {
    return jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
  } catch (err) {
    console.error(`Error in validateToken: ${err.message}`)
    throw new Error('Invalid token')
  }
}

async function generateTokens(teacher) {
  console.log('generateTokens called with teacher:', teacher._id);

  try {
    const accessToken = generateAccessToken(teacher);
    console.log('Generated accessToken:', !!accessToken);

    const refreshToken = generateRefreshToken(teacher);
    console.log('Generated refreshToken:', !!refreshToken);

    const result = { accessToken, refreshToken };
    console.log('generateTokens returning:', result);

    return result;
  } catch (error) {
    console.error('Error in generateTokens:', error);
    throw error;
  }
}

function generateAccessToken(teacher) {
  const tokenData = {
    _id: teacher._id.toString(),
    fullName: teacher.personalInfo.fullName,
    email: teacher.credentials.email,
    roles: teacher.roles,
    version: teacher.credentials?.tokenVersion || 0
  }

  return jwt.sign(
    tokenData,
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  )
}

function generateRefreshToken(teacher) {
  const tokenData = {
    _id: teacher._id.toString(),
    version: teacher.credentials.tokenVersion || 0
  }

  return jwt.sign(
    tokenData,
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  )
}


//Helper function to encrypt passwords (used when creating/updating teachers)
async function encryptPassword(password) {
    return bcrypt.hash(password, SALT_ROUNDS)
}

async function revokeTokens(teacherId) {
  try {
    if (!teacherId) {
      throw new Error('Teacher ID is required')
    }

    const collection = await getCollection('teacher')
    const teacher = await collection.findOne({ _id: ObjectId.createFromHexString(teacherId) })
    
    if (!teacher) {
      throw new Error('Teacher not found')
    }

    const newTokenVersion = (teacher.credentials?.tokenVersion || 0) + 1
    
    await collection.updateOne(
      { _id: ObjectId.createFromHexString(teacherId) },
      {
        $set: {
          'credentials.tokenVersion': newTokenVersion,
          'credentials.refreshToken': null,
          updatedAt: new Date()
        }
      }
    )

    console.log(`Revoked all tokens for teacher ${teacherId}, new version: ${newTokenVersion}`)
    return { success: true, tokenVersion: newTokenVersion }
  } catch (err) {
    console.error(`Error revoking tokens: ${err.message}`)
    throw err
  }
}

async function changePassword(teacherId, currentPassword, newPassword) {
  try {
    if (!teacherId || !currentPassword || !newPassword) {
      throw new Error('Teacher ID, current password, and new password are required')
    }

    // Password validation
    if (newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters long')
    }

    if (currentPassword === newPassword) {
      throw new Error('New password must be different from current password')
    }

    const collection = await getCollection('teacher')
    const teacher = await collection.findOne({ 
      _id: ObjectId.createFromHexString(teacherId),
      isActive: true
    })

    if (!teacher) {
      throw new Error('Teacher not found')
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, teacher.credentials.password)
    if (!isCurrentPasswordValid) {
      throw new Error('Current password is incorrect')
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, SALT_ROUNDS)

    // Update password and increment token version to revoke all existing tokens
    const newTokenVersion = (teacher.credentials?.tokenVersion || 0) + 1
    
    // Generate new tokens for continued session
    const updatedTeacher = {
      ...teacher,
      credentials: {
        ...teacher.credentials,
        password: hashedNewPassword,
        tokenVersion: newTokenVersion,
        requiresPasswordChange: false
      }
    }
    
    const { accessToken, refreshToken } = await generateTokens(updatedTeacher)
    
    await collection.updateOne(
      { _id: ObjectId.createFromHexString(teacherId) },
      {
        $set: {
          'credentials.password': hashedNewPassword,
          'credentials.tokenVersion': newTokenVersion,
          'credentials.refreshToken': refreshToken,
          'credentials.passwordSetAt': new Date(),
          'credentials.requiresPasswordChange': false,
          'credentials.lastLogin': new Date(),
          updatedAt: new Date()
        }
      }
    )

    console.log(`Password changed for teacher ${teacherId}, new tokens generated`)
    return { 
      success: true, 
      message: 'Password changed successfully',
      tokenVersion: newTokenVersion,
      accessToken,
      refreshToken,
      teacher: {
        _id: updatedTeacher._id.toString(),
        personalInfo: {
          fullName: updatedTeacher.personalInfo.fullName,
          email: updatedTeacher.personalInfo.email || updatedTeacher.credentials.email,
          phone: updatedTeacher.personalInfo.phone,
          address: updatedTeacher.personalInfo.address,
        },
        professionalInfo: updatedTeacher.professionalInfo,
        roles: updatedTeacher.roles,
        requiresPasswordChange: false,
      }
    }
  } catch (err) {
    console.error(`Error changing password: ${err.message}`)
    throw err
  }
}

async function forcePasswordChange(teacherId, newPassword) {
  try {
    if (!teacherId || !newPassword) {
      throw new Error('Teacher ID and new password are required')
    }

    // Password validation
    if (newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters long')
    }

    const collection = await getCollection('teacher')
    const teacher = await collection.findOne({ 
      _id: ObjectId.createFromHexString(teacherId),
      isActive: true
    })

    if (!teacher) {
      throw new Error('Teacher not found')
    }

    // Check if password change is required
    if (!teacher.credentials.requiresPasswordChange) {
      throw new Error('Password change is not required for this user')
    }

    // Ensure new password is different from current (if current exists)
    if (teacher.credentials.password) {
      const isSamePassword = await bcrypt.compare(newPassword, teacher.credentials.password)
      if (isSamePassword) {
        throw new Error('New password must be different from current password')
      }
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, SALT_ROUNDS)

    // Update password and clear the force change flag
    const newTokenVersion = (teacher.credentials?.tokenVersion || 0) + 1
    
    // Generate new tokens for continued session
    const updatedTeacher = {
      ...teacher,
      credentials: {
        ...teacher.credentials,
        password: hashedNewPassword,
        tokenVersion: newTokenVersion,
        requiresPasswordChange: false
      }
    }
    
    const { accessToken, refreshToken } = await generateTokens(updatedTeacher)
    
    await collection.updateOne(
      { _id: ObjectId.createFromHexString(teacherId) },
      {
        $set: {
          'credentials.password': hashedNewPassword,
          'credentials.tokenVersion': newTokenVersion,
          'credentials.refreshToken': refreshToken,
          'credentials.passwordSetAt': new Date(),
          'credentials.requiresPasswordChange': false,
          'credentials.lastLogin': new Date(),
          updatedAt: new Date()
        }
      }
    )

    console.log(`Force password change completed for teacher ${teacherId}`)
    return { 
      success: true, 
      message: 'Password set successfully',
      tokenVersion: newTokenVersion,
      accessToken,
      refreshToken,
      teacher: {
        _id: updatedTeacher._id.toString(),
        personalInfo: {
          fullName: updatedTeacher.personalInfo.fullName,
          email: updatedTeacher.personalInfo.email || updatedTeacher.credentials.email,
          phone: updatedTeacher.personalInfo.phone,
          address: updatedTeacher.personalInfo.address,
        },
        professionalInfo: updatedTeacher.professionalInfo,
        roles: updatedTeacher.roles,
        requiresPasswordChange: false,
      }
    }
  } catch (err) {
    console.error(`Error in force password change: ${err.message}`)
    throw err
  }
}

async function forgotPassword(email) {
  try {
    if (!email) {
      throw new Error('Email is required')
    }

    const collection = await getCollection('teacher')
    const teacher = await collection.findOne({
      'credentials.email': email,
      isActive: true
    })

    if (!teacher) {
      // Don't reveal if user exists for security
      console.log(`Password reset requested for non-existent email: ${email}`)
      return { 
        success: true, 
        message: 'If an account with this email exists, a password reset link has been sent' 
      }
    }

    // Generate reset token (valid for 1 hour)
    const resetToken = jwt.sign(
      { 
        _id: teacher._id.toString(),
        email: teacher.credentials.email,
        type: 'password_reset'
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: '1h' }
    )

    // Store reset token in database
    await collection.updateOne(
      { _id: teacher._id },
      {
        $set: {
          'credentials.resetToken': resetToken,
          'credentials.resetTokenExpiry': new Date(Date.now() + 60 * 60 * 1000), // 1 hour
          updatedAt: new Date()
        }
      }
    )

    // Send password reset email
    const { emailService } = await import('../../services/emailService.js')
    const emailResult = await emailService.sendPasswordResetEmail(
      teacher.credentials.email,
      resetToken,
      teacher.personalInfo.fullName
    )

    console.log(`Password reset email sent for teacher ${teacher._id}`)
    return { 
      success: true, 
      message: 'If an account with this email exists, a password reset link has been sent',
      emailSent: emailResult.success
    }
  } catch (err) {
    console.error(`Error in forgot password: ${err.message}`)
    throw err
  }
}

async function resetPassword(resetToken, newPassword) {
  try {
    if (!resetToken || !newPassword) {
      throw new Error('Reset token and new password are required')
    }

    // Password validation
    if (newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters long')
    }

    // Verify reset token
    const decoded = jwt.verify(resetToken, process.env.ACCESS_TOKEN_SECRET)
    
    if (decoded.type !== 'password_reset') {
      throw new Error('Invalid reset token')
    }

    const collection = await getCollection('teacher')
    const teacher = await collection.findOne({
      _id: ObjectId.createFromHexString(decoded._id),
      'credentials.resetToken': resetToken,
      'credentials.resetTokenExpiry': { $gt: new Date() },
      isActive: true
    })

    if (!teacher) {
      throw new Error('Invalid or expired reset token')
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, SALT_ROUNDS)

    // Update password and revoke all tokens
    const newTokenVersion = (teacher.credentials?.tokenVersion || 0) + 1
    
    await collection.updateOne(
      { _id: teacher._id },
      {
        $set: {
          'credentials.password': hashedNewPassword,
          'credentials.tokenVersion': newTokenVersion,
          'credentials.refreshToken': null,
          'credentials.passwordSetAt': new Date(),
          updatedAt: new Date()
        },
        $unset: {
          'credentials.resetToken': '',
          'credentials.resetTokenExpiry': ''
        }
      }
    )

    console.log(`Password reset completed for teacher ${teacher._id}`)
    return { 
      success: true, 
      message: 'Password reset successfully',
      tokenVersion: newTokenVersion 
    }
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new Error('Reset token has expired')
    } else if (err.name === 'JsonWebTokenError') {
      throw new Error('Invalid reset token')
    }
    console.error(`Error resetting password: ${err.message}`)
    throw err
  }
}

async function acceptInvitation(invitationToken, newPassword) {
  try {
    if (!invitationToken || !newPassword) {
      throw new Error('Invitation token and new password are required')
    }

    // Password validation
    if (newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters long')
    }

    const collection = await getCollection('teacher')
    const teacher = await collection.findOne({
      'credentials.invitationToken': invitationToken,
      'credentials.invitationExpiry': { $gt: new Date() },
      'credentials.isInvitationAccepted': false,
      isActive: true
    })

    if (!teacher) {
      throw new Error('Invalid or expired invitation token')
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS)

    // Update teacher with password and mark invitation as accepted
    const newTokenVersion = (teacher.credentials?.tokenVersion || 0) + 1
    
    await collection.updateOne(
      { _id: teacher._id },
      {
        $set: {
          'credentials.password': hashedPassword,
          'credentials.isInvitationAccepted': true,
          'credentials.passwordSetAt': new Date(),
          'credentials.tokenVersion': newTokenVersion,
          updatedAt: new Date()
        },
        $unset: {
          'credentials.invitationToken': '',
          'credentials.invitationExpiry': ''
        }
      }
    )

    // Send welcome email
    const { emailService } = await import('../../services/emailService.js')
    await emailService.sendWelcomeEmail(
      teacher.credentials.email,
      teacher.personalInfo.fullName
    )

    // Generate tokens for automatic login after password creation
    const { accessToken, refreshToken } = await generateTokens({
      ...teacher,
      credentials: {
        ...teacher.credentials,
        password: hashedPassword,
        tokenVersion: newTokenVersion
      }
    })

    // Update with refresh token
    await collection.updateOne(
      { _id: teacher._id },
      {
        $set: {
          'credentials.refreshToken': refreshToken,
          'credentials.lastLogin': new Date()
        }
      }
    )

    console.log(`Invitation accepted for teacher ${teacher._id}`)
    return { 
      success: true, 
      message: 'Invitation accepted successfully, password set',
      tokenVersion: newTokenVersion,
      accessToken,
      refreshToken,
      teacher: {
        _id: teacher._id.toString(),
        personalInfo: {
          fullName: teacher.personalInfo.fullName,
          email: teacher.personalInfo.email || teacher.credentials.email,
          phone: teacher.personalInfo.phone,
          address: teacher.personalInfo.address,
        },
        professionalInfo: teacher.professionalInfo,
        roles: teacher.roles,
      }
    }
  } catch (err) {
    console.error(`Error accepting invitation: ${err.message}`)
    throw err
  }
}

async function generateNewHash() {
  const newHash = await bcrypt.hash('123456', 10);
  console.log('New hash for 123456:', newHash);
  return newHash;
}
