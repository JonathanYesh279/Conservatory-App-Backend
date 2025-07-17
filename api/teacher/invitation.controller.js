import { invitationService } from './invitation.service.js';
import { emailService } from '../../services/emailService.js';

export const invitationController = {
  validateInvitation,
  acceptInvitation,
  resendInvitation
};

async function validateInvitation(req, res) {
  try {
    const { token } = req.params;
    
    if (!token) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invitation token is required' 
      });
    }
    
    const result = await invitationService.validateInvitation(token);
    res.json({
      success: true,
      data: {
        teacher: {
          personalInfo: {
            fullName: result.teacher.personalInfo.fullName,
            email: result.teacher.personalInfo.email
          },
          roles: result.teacher.roles
        }
      },
      message: 'Invitation validated successfully'
    });
  } catch (err) {
    console.error(`Error validating invitation: ${err.message}`);
    
    if (err.message === 'Invalid or expired invitation') {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid or expired invitation token' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
}

async function acceptInvitation(req, res) {
  try {
    const { token } = req.params;
    const { password } = req.body;
    
    if (!token) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invitation token is required' 
      });
    }
    
    if (!password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Password is required' 
      });
    }
    
    // Basic password validation
    if (password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        error: 'Password must be at least 6 characters long' 
      });
    }
    
    const result = await invitationService.acceptInvitation(token, password);
    
    // Set refresh token cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });
    
    // Send welcome email
    try {
      await emailService.sendWelcomeEmail(result.teacher.personalInfo.email, result.teacher.personalInfo.fullName);
    } catch (emailError) {
      console.error('Welcome email failed:', emailError);
      // Don't fail the invitation acceptance if email fails
    }
    
    // Return response in expected format
    res.json({
      success: true,
      data: {
        teacher: {
          _id: result.teacher._id,
          personalInfo: {
            fullName: result.teacher.personalInfo.fullName,
            email: result.teacher.personalInfo.email
          },
          roles: result.teacher.roles
        },
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      },
      message: 'Account activated successfully'
    });
  } catch (err) {
    console.error(`Error accepting invitation: ${err.message}`);
    
    if (err.message === 'Invalid or expired invitation') {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid or expired invitation token' 
      });
    }
    
    if (err.message === 'Password must be at least 6 characters long') {
      return res.status(400).json({ 
        success: false, 
        error: err.message 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
}

async function resendInvitation(req, res) {
  try {
    const { teacherId } = req.params;
    
    if (!teacherId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Teacher ID is required' 
      });
    }
    
    // Get admin ID from authenticated user
    const adminId = req.teacher?._id;
    if (!adminId) {
      return res.status(401).json({ 
        success: false, 
        error: 'Admin authentication required' 
      });
    }
    
    // Check if user has admin role
    const userRoles = req.teacher?.roles || [];
    if (!userRoles.includes('מנהל')) {
      return res.status(403).json({ 
        success: false, 
        error: 'Admin access required' 
      });
    }
    
    const result = await invitationService.resendInvitation(teacherId, adminId);
    res.json({
      success: true,
      data: {
        teacherId: result.teacherId,
        email: result.email
      },
      message: 'Invitation resent successfully'
    });
  } catch (err) {
    console.error(`Error resending invitation: ${err.message}`);
    
    if (err.message === 'Teacher not found') {
      return res.status(404).json({ 
        success: false, 
        error: 'Teacher not found' 
      });
    }
    
    if (err.message === 'Invitation has already been accepted') {
      return res.status(400).json({ 
        success: false, 
        error: 'Invitation has already been accepted' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
}