import { authService } from './auth.service.js'
import { getCollection } from '../../services/mongoDB.service.js'
import { invitationMigration } from '../../services/invitationMigration.js'
import { ObjectId } from 'mongodb'
import { createLogger } from '../../services/logger.service.js'

const log = createLogger('auth.controller')

export const authController = {
  login,
  refresh,
  logout,
  validateToken,
  changePassword,
  forcePasswordChange,
  forgotPassword,
  resetPassword,
  acceptInvitation,
  initAdmin,
  migrateExistingUsers,
  checkTeacherByEmail,
  removeTeacherByEmail,
  migratePendingInvitations,
  getInvitationModeStats
}

async function login(req, res) {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      })
    }

    const { accessToken, refreshToken, teacher } = await authService.login(email, password)

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000
    })

    res.json({
      accessToken,
      teacher
    })
  } catch (err) {
    log.error({ err: err.message }, 'Login error')

    if (err.message === 'Invalid Credentials' || err.message === 'Invalid email or password') {
      res.status(401).json({
        success: false,
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      })
    } else if (err.message === 'Please accept your invitation first') {
      res.status(400).json({
        success: false,
        error: 'Please accept your invitation first',
        code: 'INVITATION_REQUIRED'
      })
    } else {
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        code: 'INTERNAL_ERROR'
      })
    }
  }
}

async function refresh(req, res) {
  try {
    const refreshToken = req.cookies.refreshToken

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: 'Refresh token is required',
        code: 'MISSING_REFRESH_TOKEN'
      })
    }

    const { accessToken } = await authService.refreshAccessToken(refreshToken)
    res.json({
      success: true,
      data: { accessToken },
      message: 'Token refreshed successfully'
    })
  } catch (err) {
    log.error({ err: err.message }, 'Refresh token error')

    let errorCode = 'INVALID_REFRESH_TOKEN'
    let errorMessage = 'Invalid refresh token'

    if (err.message.includes('expired')) {
      errorCode = 'REFRESH_TOKEN_EXPIRED'
      errorMessage = 'Refresh token has expired'
    } else if (err.message.includes('revoked')) {
      errorCode = 'REFRESH_TOKEN_REVOKED'
      errorMessage = 'Refresh token has been revoked'
    } else if (err.message.includes('malformed')) {
      errorCode = 'MALFORMED_REFRESH_TOKEN'
      errorMessage = 'Malformed refresh token'
    }

    res.status(401).json({
      success: false,
      error: errorMessage,
      code: errorCode
    })
  }
}

async function logout(req, res) {
  try {
    if (!req.teacher || !req.teacher._id) {
      throw new Error('No teacher found in request')
    }

    const teacherId = req.teacher._id.toString()

    log.info({ teacherId }, 'Logging out teacher')
    await authService.logout(req.teacher._id)

    res.clearCookie('refreshToken')
    res.json({
      success: true,
      message: 'Logged out successfully'
    })
  } catch (err) {
    log.error({ err: err.message }, 'Logout error')
    res.status(500).json({
      success: false,
      error: 'Logout failed',
      code: 'LOGOUT_FAILED'
    })
 }
}

async function validateToken(req, res) {
  try {
    const user = req.loggedinUser || req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid authentication state',
        code: 'AUTH_STATE_ERROR'
      });
    }

    res.json({
      success: true,
      data: {
        valid: true,
        user: {
          _id: user._id,
          fullName: user.fullName,
          email: user.email,
          roles: user.roles
        }
      },
      message: 'Token is valid'
    });
  } catch (err) {
    log.error({ err: err.message }, 'Token validation error')
    res.status(500).json({
      success: false,
      error: 'Token validation failed',
      code: 'VALIDATION_ERROR'
    });
  }
}

async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required',
        code: 'MISSING_PASSWORDS'
      });
    }

    const teacherId = req.teacher._id.toString();
    const result = await authService.changePassword(teacherId, currentPassword, newPassword);

    if (result.refreshToken) {
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000
      });
    }

    res.json({
      success: true,
      message: result.message,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      data: {
        tokenVersion: result.tokenVersion,
        teacher: result.teacher
      }
    });
  } catch (err) {
    log.error({ err: err.message }, 'Change password error')

    let errorCode = 'CHANGE_PASSWORD_FAILED';
    let status = 400;

    if (err.message.includes('Current password is incorrect')) {
      errorCode = 'INCORRECT_CURRENT_PASSWORD';
      status = 401;
    } else if (err.message.includes('must be at least 6 characters')) {
      errorCode = 'WEAK_PASSWORD';
    } else if (err.message.includes('must be different')) {
      errorCode = 'SAME_PASSWORD';
    }

    res.status(status).json({
      success: false,
      error: err.message,
      code: errorCode
    });
  }
}

async function forcePasswordChange(req, res) {
  try {
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({
        success: false,
        error: 'New password is required',
        code: 'MISSING_PASSWORD'
      });
    }

    const teacherId = req.teacher._id.toString();
    const result = await authService.forcePasswordChange(teacherId, newPassword);

    if (result.refreshToken) {
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000
      });
    }

    res.json({
      success: true,
      message: result.message,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      data: {
        tokenVersion: result.tokenVersion,
        requiresPasswordChange: false,
        teacher: result.teacher
      }
    });
  } catch (err) {
    log.error({ err: err.message }, 'Force password change error')

    let errorCode = 'FORCE_PASSWORD_CHANGE_FAILED';
    let status = 400;

    if (err.message.includes('must be at least 6 characters')) {
      errorCode = 'WEAK_PASSWORD';
    } else if (err.message.includes('must be different')) {
      errorCode = 'SAME_PASSWORD';
    } else if (err.message.includes('not required')) {
      errorCode = 'PASSWORD_CHANGE_NOT_REQUIRED';
    }

    res.status(status).json({
      success: false,
      error: err.message,
      code: errorCode
    });
  }
}

async function forgotPassword(req, res) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
        code: 'MISSING_EMAIL'
      });
    }

    const result = await authService.forgotPassword(email);

    res.json({
      success: true,
      message: result.message
    });
  } catch (err) {
    log.error({ err: err.message }, 'Forgot password error')

    res.json({
      success: true,
      message: 'If an account with this email exists, a password reset link has been sent'
    });
  }
}

async function resetPassword(req, res) {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Reset token and new password are required',
        code: 'MISSING_RESET_DATA'
      });
    }

    const result = await authService.resetPassword(token, newPassword);

    res.json({
      success: true,
      message: result.message,
      data: { tokenVersion: result.tokenVersion }
    });
  } catch (err) {
    log.error({ err: err.message }, 'Reset password error')

    let errorCode = 'RESET_PASSWORD_FAILED';
    let status = 400;

    if (err.message.includes('expired')) {
      errorCode = 'RESET_TOKEN_EXPIRED';
      status = 401;
    } else if (err.message.includes('Invalid reset token')) {
      errorCode = 'INVALID_RESET_TOKEN';
      status = 401;
    } else if (err.message.includes('must be at least 6 characters')) {
      errorCode = 'WEAK_PASSWORD';
    }

    res.status(status).json({
      success: false,
      error: err.message,
      code: errorCode
    });
  }
}

async function acceptInvitation(req, res) {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Invitation token and new password are required',
        code: 'MISSING_INVITATION_DATA'
      });
    }

    const result = await authService.acceptInvitation(token, newPassword);

    if (result.refreshToken) {
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000
      });
    }

    res.json({
      success: true,
      message: result.message,
      data: { tokenVersion: result.tokenVersion },
      accessToken: result.accessToken,
      teacher: result.teacher
    });
  } catch (err) {
    log.error({ err: err.message }, 'Accept invitation error')

    let errorCode = 'ACCEPT_INVITATION_FAILED';
    let status = 400;

    if (err.message.includes('expired')) {
      errorCode = 'INVITATION_TOKEN_EXPIRED';
      status = 401;
    } else if (err.message.includes('Invalid invitation token')) {
      errorCode = 'INVALID_INVITATION_TOKEN';
      status = 401;
    } else if (err.message.includes('must be at least 6 characters')) {
      errorCode = 'WEAK_PASSWORD';
    }

    res.status(status).json({
      success: false,
      error: err.message,
      code: errorCode
    });
  }
}

async function initAdmin(req, res) {
  try {
    const collection = await getCollection('teacher');

    const adminExists = await collection.findOne({ roles: { $in: ['מנהל'] } });
    if (adminExists) {
      log.info({ adminId: adminExists._id.toString() }, 'Admin already exists')
      return res.status(400).json({ error: 'Admin already exists' });
    }

    const emailExists = await collection.findOne({
      $or: [
        { 'credentials.email': 'admin@example.com' },
        { 'personalInfo.email': 'admin@example.com' }
      ]
    });

    if (emailExists) {
      log.info({ userId: emailExists._id.toString() }, 'Admin email already in use')
      return res.status(400).json({ error: 'Admin email already in use' });
    }

    const adminData = {
      personalInfo: {
        fullName: 'מנהל מערכת',
        phone: '0501234567',
        email: 'admin@example.com',
        address: 'כתובת המנהל',
      },
      roles: ['מנהל'],
      teaching: {
        studentIds: [],
        schedule: [],
      },
      conducting: {
        orchestraIds: [],
      },
      ensembleIds: [],
      credentials: {
        email: 'admin@example.com',
        password: await authService.encryptPassword('123456'),
        isInvitationAccepted: true,
        passwordSetAt: new Date(),
      },
      isActive: true,
      createdAt: new Date(),
    };

    const result = await collection.insertOne(adminData)
    log.info({ adminId: result.insertedId.toString() }, 'Created new admin')
    res.status(201).json({ message: 'Admin created successfully' });
  } catch (err) {
    log.error({ err: err.message }, 'Error creating admin')
    res.status(500).json({ error: 'Failed to create admin' });
  }
}

async function migrateExistingUsers(req, res) {
  try {
    log.info('Starting migration of existing users')

    const collection = await getCollection('teacher');

    const teachersToUpdate = await collection.find({
      'credentials.isInvitationAccepted': { $exists: false }
    }).toArray();

    log.info({ count: teachersToUpdate.length }, 'Found teachers to migrate')

    if (teachersToUpdate.length === 0) {
      return res.json({
        message: 'No teachers need migration',
        migratedCount: 0
      });
    }

    let migratedCount = 0;
    const errors = [];

    for (const teacher of teachersToUpdate) {
      try {
        const updateResult = await collection.updateOne(
          { _id: teacher._id },
          {
            $set: {
              'credentials.isInvitationAccepted': true,
              'credentials.passwordSetAt': teacher.createdAt || new Date(),
              updatedAt: new Date()
            }
          }
        );

        if (updateResult.modifiedCount === 1) {
          migratedCount++;
        } else {
          errors.push(`Failed to update teacher: ${teacher.personalInfo.fullName} (${teacher._id})`);
        }
      } catch (error) {
        errors.push(`Error updating teacher ${teacher.personalInfo.fullName}: ${error.message}`);
      }
    }

    log.info({ migratedCount }, 'Migration completed')

    res.json({
      message: 'Migration completed successfully',
      migratedCount,
      totalFound: teachersToUpdate.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    log.error({ err: error.message }, 'Migration failed')
    res.status(500).json({ error: 'Migration failed: ' + error.message });
  }
}

async function checkTeacherByEmail(req, res) {
  try {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const collection = await getCollection('teacher');
    const teacher = await collection.findOne({
      'credentials.email': email
    });

    if (teacher) {
      res.json({
        exists: true,
        teacher: {
          id: teacher._id,
          name: teacher.personalInfo.fullName,
          email: teacher.credentials.email,
          isActive: teacher.isActive,
          invitationAccepted: teacher.credentials.isInvitationAccepted,
          hasPassword: !!teacher.credentials.password,
          hasInvitationToken: !!teacher.credentials.invitationToken,
          invitationExpiry: teacher.credentials.invitationExpiry,
          createdAt: teacher.createdAt,
          updatedAt: teacher.updatedAt
        }
      });
    } else {
      res.json({ exists: false });
    }
  } catch (error) {
    log.error({ err: error.message }, 'Error checking teacher by email')
    res.status(500).json({ error: 'Failed to check teacher' });
  }
}

async function removeTeacherByEmail(req, res) {
  try {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const collection = await getCollection('teacher');

    const teacher = await collection.findOne({
      'credentials.email': email
    });

    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    const result = await collection.deleteOne({
      'credentials.email': email
    });

    if (result.deletedCount === 1) {
      log.info({ email, teacherName: teacher.personalInfo.fullName }, 'Removed teacher')
      res.json({
        success: true,
        message: 'Teacher removed successfully',
        removedTeacher: {
          id: teacher._id,
          name: teacher.personalInfo.fullName,
          email: teacher.credentials.email
        }
      });
    } else {
      res.status(500).json({ error: 'Failed to remove teacher' });
    }
  } catch (error) {
    log.error({ err: error.message }, 'Error removing teacher by email')
    res.status(500).json({ error: 'Failed to remove teacher' });
  }
}

async function migratePendingInvitations(req, res) {
  try {
    const result = await invitationMigration.migratePendingInvitations();
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    log.error({ err: error.message }, 'Migration error')
    res.status(500).json({
      success: false,
      error: 'Migration failed: ' + error.message
    });
  }
}

async function getInvitationModeStats(req, res) {
  try {
    const stats = await invitationMigration.getInvitationModeStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    log.error({ err: error.message }, 'Stats retrieval error')
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve stats: ' + error.message
    });
  }
}
