import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'

// Sample users with different roles (teachers)
export const testUsers = {
  admin: {
    personalInfo: {
      fullName: 'Test Admin',
      phone: '0542395023',
      email: 'admin@test.com',
      address: 'Test Admin address',
    },
    roles: ['מנהל'],
    professionalInfo: {
      instrument: 'חצוצרה',
      isActive: true,
    },
    teaching: {
      studentIds: [],
      schedule: [],
    },
    conducting: {
      orchestraIds: [],
    },
    ensemblesIds: [],
    credentials: {
      email: 'admin@test.com',
      password: '$2b$10$TestHashedPasswordForAdmin',
    },
    isActive: true,
  },
  teacher: {
    personalInfo: {
      fullName: 'Test Teacher',
      phone: '0542395024',
      email: 'teacher@test.com',
      address: 'Test Teacher address',
    },
    roles: ['מורה'],
    professionalInfo: {
      instrument: 'קלרינט',
      isActive: true,
    },
    teaching: {
      studentIds: [],
      schedule: [],
    },
    credentials: {
      email: 'teacher@test.com',
      password: '$2b$10$TestHashedPasswordForTeacher',
    },
    isActive: true,
  },
  conductor: {
    personalInfo: {
      fullName: 'Test Conductor',
      phone: '0542395025',
      email: 'conductor@test.com',
      address: 'Test conductor address',
    },
    roles: ['מנצח'],
    professionalInfo: {
      instrument: 'חצוצרה',
      isActive: true,
    },
    conducting: {
      orchestraIds: [],
    },
    credentials: {
      email: 'conductor@test.com',
      password: '$2b$10$TestHashedPasswordForConductor',
    },
    isActive: true,
  },
}

// For testing we will create real passwords and hash them
export async function setupTestUsers() {
  const SALT_ROUNDS = 10;

  // Create actual password hashes for test users
  const adminPassword = await bcrypt.hash('admin123', SALT_ROUNDS)
  const teacherPassword = await bcrypt.hash('teacher123', SALT_ROUNDS)
  const conductorPassword = await bcrypt.hash('conductor123', SALT_ROUNDS)  

  const users = { ...testUsers }
  users.admin.credentials.password = adminPassword
  users.teacher.credentials.password = teacherPassword
  users.conductor.credentials.password = conductorPassword

  return users
}

export function generateTokens(user) {
  // Set an enviromental test secrets
  const accessTokenSecret = 'test-access-token-secret'
  const refreshTokenSecret = 'test-refresh-token-secret'

  const accessToken = jwt.sign(
    {
      _id: user._id.toString(),
      fullName: user.personalInfo.fullName,
      email: user.credentials.email,
      roles: user.roles,
    },
    accessTokenSecret,
    { expiresIn: '1h' }
  )

  const refreshToken = jwt.sign(
    {
      _id: user._id.toString(),
      version: 0
    },
    refreshTokenSecret,
    { expiresIn: '7d' }
  )

  return { accessToken, refreshToken }
}