import nodemailer from 'nodemailer';
import sgMail from '@sendgrid/mail';

export const emailService = {
  sendInvitationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail
};

// Email transporter configuration
let transporter = null;

function getEmailTransporter() {
  if (!transporter) {
    // Gmail configuration
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER, // Your Gmail address
        pass: process.env.EMAIL_PASS  // Your Gmail App Password
      }
    });
  }
  return transporter;
}

async function sendInvitationEmail(email, token, teacherName) {
  // Use the backend route for invitation acceptance - this bypasses frontend routing issues
  // For production, this will be the same domain. For development, we need the backend port.
  const backendUrl = process.env.NODE_ENV === 'production' 
    ? (process.env.FRONTEND_URL || 'https://conservatory-app-backend.onrender.com')
    : 'http://localhost:3001';
  
  const invitationUrl = `${backendUrl}/accept-invitation/${token}`;
  
  // Log the actual URL being sent for debugging
  console.log('=== INVITATION URL DEBUG ===');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('FRONTEND_URL env var:', process.env.FRONTEND_URL);
  console.log('Backend URL used:', backendUrl);
  console.log('Generated invitation URL:', invitationUrl);
  console.log('Token provided:', token);
  console.log('Teacher name:', teacherName);
  console.log('Using backend HTML page for invitation acceptance');
  console.log('============================');
  
  // Email template for invitation
  const emailContent = {
    to: email,
    subject: 'הזמנה להצטרף למערכת הקונסרבטוריון', // "Invitation to join conservatory system"
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
          <h2 style="color: #333; margin-bottom: 20px;">שלום ${teacherName},</h2>
          
          <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
            הוזמנת להצטרף למערכת הקונסרבטוריון כמורה.
          </p>
          
          <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 30px;">
            אנא לחץ על הכפתור הבא כדי להגדיר את הסיסמה שלך ולהתחיל להשתמש במערכת:
          </p>
          
          <div style="text-align: center; margin-bottom: 30px;">
            <a href="${invitationUrl}" 
               style="background-color: #007bff; color: white; padding: 15px 30px; 
                      text-decoration: none; border-radius: 5px; font-size: 16px; 
                      font-weight: bold; display: inline-block;">
              הגדר סיסמה
            </a>
          </div>
          
          <p style="color: #999; font-size: 14px; margin-bottom: 10px;">
            <strong>חשוב לדעת:</strong>
          </p>
          
          <ul style="color: #666; font-size: 14px; line-height: 1.5; margin-bottom: 20px;">
            <li>הקישור תקף ל-7 ימים בלבד</li>
            <li>אחרי הגדרת הסיסמה, תוכל להתחבר למערכת</li>
            <li>בבעיות טכניות, פנה למנהל המערכת</li>
          </ul>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          
          <p style="color: #999; font-size: 12px; text-align: center;">
            אם לא ביקשת הזמנה זו, אנא התעלם מהודעה זו.
          </p>
          
          <p style="color: #999; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} מערכת הקונסרבטוריון
          </p>
        </div>
      </div>
    `
  };

  // Log email details for debugging
  console.log('=== INVITATION EMAIL ===');
  console.log('To:', emailContent.to);
  console.log('Subject:', emailContent.subject);
  console.log('Invitation URL:', invitationUrl);
  console.log('Teacher Name:', teacherName);
  console.log('========================');

  // Send actual email if configured
  if (process.env.SENDGRID_API_KEY) {
    // Use SendGrid (easier setup)
    try {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      
      const msg = {
        to: email,
        from: process.env.FROM_EMAIL || 'noreply@conservatory.com',
        subject: emailContent.subject,
        html: emailContent.html
      };
      
      await sgMail.send(msg);
      console.log('✅ Email sent successfully via SendGrid');
      
      return {
        success: true,
        message: 'Invitation email sent successfully',
        recipient: email
      };
    } catch (error) {
      console.error('❌ SendGrid email failed:', error);
      return {
        success: false,
        message: 'Failed to send invitation email',
        error: error.message
      };
    }
  } else if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    // Use Gmail/Nodemailer
    try {
      const transporter = getEmailTransporter();
      const mailOptions = {
        from: `"מערכת הקונסרבטוריון" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: emailContent.subject,
        html: emailContent.html
      };
      
      const info = await transporter.sendMail(mailOptions);
      console.log('✅ Email sent successfully:', info.messageId);
      
      return {
        success: true,
        message: 'Invitation email sent successfully',
        recipient: email,
        messageId: info.messageId
      };
    } catch (error) {
      console.error('❌ Email sending failed:', error);
      return {
        success: false,
        message: 'Failed to send invitation email',
        error: error.message
      };
    }
  } else {
    console.log('📧 Email service not configured - email logging only');
    return {
      success: true,
      message: 'Invitation email logged (no email service configured)',
      recipient: email
    };
  }
}

async function sendPasswordResetEmail(email, token, teacherName) {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${token}`;
  
  const emailContent = {
    to: email,
    subject: 'איפוס סיסמה - מערכת הקונסרבטוריון', // "Password Reset - Conservatory System"
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
          <h2 style="color: #333; margin-bottom: 20px;">שלום ${teacherName},</h2>
          
          <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
            קיבלנו בקשה לאיפוס הסיסמה שלך במערכת הקונסרבטוריון.
          </p>
          
          <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 30px;">
            לחץ על הכפתור הבא כדי לאפס את הסיסמה שלך:
          </p>
          
          <div style="text-align: center; margin-bottom: 30px;">
            <a href="${resetUrl}" 
               style="background-color: #dc3545; color: white; padding: 15px 30px; 
                      text-decoration: none; border-radius: 5px; font-size: 16px; 
                      font-weight: bold; display: inline-block;">
              איפוס סיסמה
            </a>
          </div>
          
          <p style="color: #999; font-size: 14px; margin-bottom: 20px;">
            הקישור תקף ל-1 שעה בלבד מסיבות אבטחה.
          </p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          
          <p style="color: #999; font-size: 12px; text-align: center;">
            אם לא ביקשת איפוס סיסמה, אנא התעלם מהודעה זו.
          </p>
        </div>
      </div>
    `
  };

  console.log('=== PASSWORD RESET EMAIL ===');
  console.log('To:', emailContent.to);
  console.log('Reset URL:', resetUrl);
  console.log('=============================');

  // Send actual email if configured
  if (process.env.SENDGRID_API_KEY) {
    // Use SendGrid
    try {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      
      const msg = {
        to: email,
        from: process.env.FROM_EMAIL || 'noreply@conservatory.com',
        subject: emailContent.subject,
        html: emailContent.html
      };
      
      await sgMail.send(msg);
      console.log('✅ Password reset email sent successfully via SendGrid');
      
      return {
        success: true,
        message: 'Password reset email sent successfully',
        recipient: email
      };
    } catch (error) {
      console.error('❌ SendGrid password reset email failed:', error);
      return {
        success: false,
        message: 'Failed to send password reset email',
        error: error.message
      };
    }
  } else if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    // Use Gmail/Nodemailer
    try {
      const transporter = getEmailTransporter();
      const mailOptions = {
        from: `"מערכת הקונסרבטוריון" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: emailContent.subject,
        html: emailContent.html
      };
      
      const info = await transporter.sendMail(mailOptions);
      console.log('✅ Password reset email sent successfully:', info.messageId);
      
      return {
        success: true,
        message: 'Password reset email sent successfully',
        recipient: email,
        messageId: info.messageId
      };
    } catch (error) {
      console.error('❌ Password reset email sending failed:', error);
      return {
        success: false,
        message: 'Failed to send password reset email',
        error: error.message
      };
    }
  } else {
    console.log('📧 Email service not configured - password reset email logging only');
    return {
      success: true,
      message: 'Password reset email logged (no email service configured)',
      recipient: email
    };
  }
}

async function sendWelcomeEmail(email, teacherName) {
  const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;
  
  const emailContent = {
    to: email,
    subject: 'ברוכים הבאים למערכת הקונסרבטוריון', // "Welcome to Conservatory System"
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
          <h2 style="color: #333; margin-bottom: 20px;">ברוכים הבאים ${teacherName}!</h2>
          
          <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
            הצטרפת בהצלחה למערכת הקונסרבטוריון.
          </p>
          
          <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 30px;">
            כעת תוכל להתחבר למערכת ולהתחיל להשתמש בכל התכונות הזמינות לך.
          </p>
          
          <div style="text-align: center; margin-bottom: 30px;">
            <a href="${loginUrl}" 
               style="background-color: #28a745; color: white; padding: 15px 30px; 
                      text-decoration: none; border-radius: 5px; font-size: 16px; 
                      font-weight: bold; display: inline-block;">
              התחבר למערכת
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px; line-height: 1.5; margin-bottom: 20px;">
            במערכת תוכל לנהל את התלמידים שלך, לעדכן לוחות זמנים, ולגשת לכל המידע הרלוונטי.
          </p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          
          <p style="color: #999; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} מערכת הקונסרבטוריון
          </p>
        </div>
      </div>
    `
  };

  console.log('=== WELCOME EMAIL ===');
  console.log('To:', emailContent.to);
  console.log('Login URL:', loginUrl);
  console.log('=====================');

  // TODO: Implement actual email sending
  return {
    success: true,
    message: 'Welcome email queued for sending',
    recipient: email
  };
}

// Helper function to validate email configuration
export function validateEmailConfig() {
  const requiredEnvVars = ['FRONTEND_URL'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.warn('Missing email configuration:', missingVars);
    return false;
  }
  
  return true;
}