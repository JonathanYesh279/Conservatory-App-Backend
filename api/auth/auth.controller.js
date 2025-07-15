import { authService } from './auth.service.js'
import { getCollection } from '../../services/mongoDB.service.js'
import { ObjectId } from 'mongodb'

export const authController = {
  login,
  refresh,
  logout,
  initAdmin
}

async function login(req, res) {
  try {
    const { email, password } = req.body

    console.log('Controller received:', { email, password });

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
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
    if (err.message === 'Invalid Credentials') {
      res.status(401).json({ error: 'Invalid email or password' });
    } else {
      console.error(`Error in login: ${err.message}`);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

async function refresh(req, res) {
  try {
    const refreshToken = req.cookies.refreshToken

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token is required' })
    }

    const { accessToken } = await authService.refreshAccessToken(refreshToken)
    res.json({ accessToken })
  } catch (err) {
    res.status(401).json({ error: 'Invalid refresh token' })
  }
}

async function logout(req, res) {
  try {
    if (!req.teacher || !req.teacher._id) {
      throw new Error('No teacher found in request')
    }

    const teacherId = req.teacher._id.toString()

    console.log('Logging out teacher:', teacherId)
    await authService.logout(req.teacher._id)

    res.clearCookie('refreshToken')
    res.json({ message: 'Logged out successfully' })
  } catch (err) {
    console.error(`Error in logout: ${err.message}`)
    res.status(500).json({ error: 'Logout failed'})
 }
}

async function initAdmin(req, res) {
  try {
    const collection = await getCollection('teacher');

    // Check if admin already exists by role
    const adminExists = await collection.findOne({ roles: { $in: ['מנהל'] } });
    if (adminExists) {
      console.log('Found existing admin:', adminExists._id.toString())
      return res.status(400).json({ error: 'Admin already exists' });
    }

    // Additional check: ensure admin email is not already taken
    const emailExists = await collection.findOne({
      $or: [
        { 'credentials.email': 'admin@example.com' },
        { 'personalInfo.email': 'admin@example.com' }
      ]
    });
    
    if (emailExists) {
      console.log('Admin email already in use by user:', emailExists._id.toString());
      return res.status(400).json({ error: 'Admin email already in use' });
    }

    // Create admin
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
        password: await authService.encryptPassword('123456'), // Hash the password
      },
      isActive: true,
      createdAt: new Date(),
    };

    const result = await collection.insertOne(adminData)
    console.log('Created new admin with ID:', result.insertedId.toString())
    res.status(201).json({ message: 'Admin created successfully' });
  } catch (err) {
    console.error('Error creating admin:', err);
    res.status(500).json({ error: 'Failed to create admin' });
  }
}