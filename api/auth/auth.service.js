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
  logout
}

async function login(email, password) {
  try {
    console.log('Login attempt with email:', email);
    const collection = await getCollection('teacher');
    const teacher = await collection.findOne({
      'credentials.email': email,
      isActive: true,
    })

    if (!teacher) {
      throw new Error('Invalid email or password');
    }

    const match = await bcrypt.compare(password, teacher.credentials.password);
    if (!match) {
      throw new Error('Invalid email or password');
    }

    const { accessToken, refreshToken } = await generateTokens(teacher);

    await collection.updateOne(
      { _id: teacher._id },
      {
        $set: {
          'credentials.refreshToken': refreshToken,
          'credentials.lastLogin': new Date(),
          updatedAt: new Date(),
        },
      }
    )

    return {
      accessToken,
      refreshToken,
      teacher: {
        _id: teacher._id.toString(),
        fullName: teacher.personalInfo.fullName,
        email: teacher.credentials.email,
        roles: teacher.roles,
      }
    }
  } catch (err) {
    console.error(`Error in login: ${err.message}`)
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
  const accessToken = generateAccessToken(teacher)
  const refreshToken = generateRefreshToken(teacher)
  return { accessToken, refreshToken }
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