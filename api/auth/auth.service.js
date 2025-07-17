import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
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
  logout
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

    // Handle existing accounts (created before invitation system)
    // If isInvitationAccepted field doesn't exist, treat as legacy account
    const isLegacyAccount = teacher.credentials.isInvitationAccepted === undefined;
    
    if (!isLegacyAccount) {
      // Check if teacher hasn't accepted invitation yet (for new invitation-based accounts)
      if (!teacher.credentials.isInvitationAccepted) {
        console.log('Teacher has not accepted invitation yet:', teacher._id);
        throw new Error('Please accept your invitation first');
      }
    }

    // Check if password is set (should be set for all accounts)
    if (!teacher.credentials.password) {
      console.log('Teacher has no password set:', teacher._id);
      throw new Error('Please accept your invitation first');
    }

    console.log('Found teacher:', teacher._id);
    console.log('Comparing passwords...');

    const match = await bcrypt.compare(password, teacher.credentials.password);
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

    return {
      accessToken,
      refreshToken,
      teacher: {
        _id: teacher._id.toString(),
        personalInfo: {
          fullName: teacher.personalInfo.fullName,
          email: teacher.credentials.email,
        },
        roles: teacher.roles,
      },
    };
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
      throw new Error(`Invalid refresh token`)
    }

    const accessToken = generateAccessToken(teacher)

    return { accessToken }
  } catch (err) {
    console.error(`Error in refreshAccessToken: ${err.message}`)
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

async function generateNewHash() {
  const newHash = await bcrypt.hash('123456', 10);
  console.log('New hash for 123456:', newHash);
  return newHash;
}
