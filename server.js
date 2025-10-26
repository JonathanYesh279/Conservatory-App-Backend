import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'net';
import mongoSanitize from 'express-mongo-sanitize';
import helmet from 'helmet';
import { initializeMongoDB } from './services/mongoDB.service.js';
import path from 'path';
import fileRoutes from './api/file/file.route.js';
import { STORAGE_MODE } from './services/fileStorage.service.js';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import { authenticateToken } from './middleware/auth.middleware.js';
import { addSchoolYearToRequest } from './middleware/school-year.middleware.js';

import schoolYearRoutes from './api/school-year/school-year.route.js';
import studentRoutes from './api/student/student.route.js';
import teacherRoutes from './api/teacher/teacher.route.js';
import theoryRoutes from './api/theory/theory.route.js';
import authRoutes from './api/auth/auth.route.js';
import orchestraRoutes from './api/orchestra/orchestra.route.js';
import rehearsalRoutes from './api/rehearsal/rehearsal.route.js';
import bagrutRoutes from './api/bagrut/bagrut.route.js';
import scheduleRoutes from './api/schedule/schedule.route.js';
import attendanceRoutes from './api/schedule/attendance.routes.js';
import timeBlockRoutes from './api/schedule/time-block.route.js';
import analyticsRoutes from './api/analytics/attendance.routes.js';
import adminValidationRoutes from './api/admin/consistency-validation.route.js';
import dateMonitoringRoutes from './api/admin/date-monitoring.route.js';
import pastActivitiesRoutes from './api/admin/past-activities.route.js';
import cascadeDeletionRoutes from './api/admin/cascade-deletion.routes.js';
import cleanupRoutes from './api/admin/cleanup.route.js';
import lessonRoutes from './api/lesson/lesson.route.js';
import { invitationController } from './api/teacher/invitation.controller.js';
import { cascadeSystemInitializer } from './services/cascadeSystemInitializer.js';

const _filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(_filename);

const app = express();

// Enable trust proxy for production (fixes rate limiting behind proxy)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

const NODE_ENV = process.env.NODE_ENV || 'development';
const MONGO_URI = process.env.MONGODB_URI;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const corsOptions = {
  origin: NODE_ENV === 'production'
    ? [
        'https://rmc-music.org',
        'https://www.rmc-music.org',
        'http://rmc-music.org',
        'http://www.rmc-music.org',
        FRONTEND_URL // Keep existing FRONTEND_URL for backward compatibility
      ].filter(Boolean) // Remove any undefined values
    : [
        'http://localhost:5173',
        'http://172.29.139.184:5173',
        'http://10.0.2.2:5173', // Android emulator
        /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:5173$/, // Local network IPs
        /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}:5173$/, // Private network IPs
        /^http:\/\/172\.\d{1,3}\.\d{1,3}\.\d{1,3}:5173$/ // Private network IPs
      ],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use('/api', (req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

if (STORAGE_MODE === 'local') {
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
}

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Configure Helmet with proper CSP for Vite/ES modules and Google Fonts
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "https://rmc-music.org", "wss://rmc-music.org"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(mongoSanitize());

// Initialize MongoDB (moved to startup sequence below for better error handling)

// Direct invitation routes (no auth required)

// API configuration endpoint for frontend
app.get('/api/config', (req, res) => {
  res.json({
    apiUrl: process.env.API_URL || `https://${req.get('host')}/api`,
    environment: process.env.NODE_ENV
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use(
  '/api/student',
  authenticateToken,
  addSchoolYearToRequest,
  studentRoutes
);
app.use(
  '/api/teacher',
  authenticateToken,
  addSchoolYearToRequest,
  teacherRoutes
);
// Add plural route for frontend compatibility
app.use(
  '/api/teachers',
  authenticateToken,
  addSchoolYearToRequest,
  teacherRoutes
);
app.use(
  '/api/orchestra',
  authenticateToken,
  addSchoolYearToRequest,
  orchestraRoutes
);
app.use(
  '/api/rehearsal',
  authenticateToken,
  addSchoolYearToRequest,
  rehearsalRoutes
);
app.use('/api/theory', authenticateToken, addSchoolYearToRequest, theoryRoutes);
app.use('/api/bagrut', authenticateToken, addSchoolYearToRequest, bagrutRoutes);
app.use(
  '/api/school-year',
  authenticateToken,
  addSchoolYearToRequest,
  schoolYearRoutes
);
app.use(
  '/api/schedule',
  authenticateToken,
  addSchoolYearToRequest,
  scheduleRoutes
);
app.use(
  '/api',
  authenticateToken,
  addSchoolYearToRequest,
  timeBlockRoutes
);
app.use(
  '/api/attendance',
  authenticateToken,
  addSchoolYearToRequest,
  attendanceRoutes
);
app.use(
  '/api/analytics',
  authenticateToken,
  addSchoolYearToRequest,
  analyticsRoutes
);
app.use(
  '/api/admin/consistency-validation',
  authenticateToken,
  adminValidationRoutes
);
app.use(
  '/api/admin/date-monitoring',
  authenticateToken,
  dateMonitoringRoutes
);
app.use(
  '/api/admin/past-activities',
  authenticateToken,
  pastActivitiesRoutes
);
app.use(
  '/api/admin',
  authenticateToken,
  cascadeDeletionRoutes
);
app.use(
  '/api/admin/cleanup',
  authenticateToken,
  cleanupRoutes
);
app.use('/api/files', authenticateToken, fileRoutes);
app.use(
  '/api/lessons',
  authenticateToken,
  addSchoolYearToRequest,
  lessonRoutes
);

// Test route
app.get('/api/test', (req, res) => {
  console.log('API test route hit');
  res.status(200).json({
    success: true,
    data: {
      status: 'OK',
      message: 'API Server is running',
      time: new Date().toISOString(),
      path: req.originalUrl,
      environment: process.env.NODE_ENV,
      trustProxy: app.get('trust proxy')
    },
    message: 'Server is running properly'
  });
});

// Test invitation URL generation
app.get('/api/test-invitation-url', (req, res) => {
  const testToken = 'test-token-123';
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const invitationUrl = `${frontendUrl}/accept-invitation/${testToken}`;
  
  console.log('=== TEST INVITATION URL ===');
  console.log('FRONTEND_URL env var:', process.env.FRONTEND_URL);
  console.log('Generated invitation URL:', invitationUrl);
  console.log('===========================');
  
  res.status(200).json({
    success: true,
    data: {
      frontendUrl,
      invitationUrl,
      testToken,
      environment: process.env.NODE_ENV
    },
    message: 'Invitation URL test'
  });
});

// Serve invitation acceptance page
app.get('/accept-invitation/:token', (req, res) => {
  const token = req.params.token;
  console.log('Serving invitation acceptance page for token:', token);
  
  // Serve the HTML file
  res.sendFile(path.join(__dirname, 'views/accept-invitation.html'));
});

// Serve force password change page (for default password users)
app.get('/force-password-change', (req, res) => {
  console.log('Serving force password change page');
  res.sendFile(path.join(__dirname, 'views/force-password-change.html'));
});

// Static files and catch-all route for production (AFTER API routes)
if (NODE_ENV === 'production') {
  // Serve static files with proper MIME types
  app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, filepath) => {
      // Set correct MIME types for JavaScript modules
      if (filepath.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
      } else if (filepath.endsWith('.mjs')) {
        res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
      } else if (filepath.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css; charset=UTF-8');
      }
    }
  }));

  // Catch-all route for frontend routing - ONLY for non-API routes
  app.get('*', (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api/')) {
      return next();
    }
    res.sendFile(path.join(__dirname, 'public/index.html'));
  });
}

// 404 handler - Must come AFTER production routes
app.use((req, res) => {
  console.log('404 Not Found:', req.method, req.originalUrl);
  res.status(404).json({
    error: 'Not Found',
    path: req.originalUrl,
  });
});

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// Improved server startup with error handling
const startServer = async () => {
  // Create the HTTP server instance separately from starting it
  const server = app.listen(PORT, HOST, async () => {
    console.log(`🚀 Server is running on http://${HOST}:${PORT}`);
    console.log(`📱 External devices can access via: http://172.29.139.184:${PORT}`);
    console.log(`💻 Local access still works via: http://localhost:${PORT}`);
    
    // Initialize WebSocket and cascade system after server is running
    try {
      console.log('🔌 Initializing WebSocket and Cascade System...');
      await cascadeSystemInitializer.initialize(server);
      console.log('✅ Server started with Cascade System and WebSocket enabled');
    } catch (error) {
      console.error('❌ Failed to initialize WebSocket/Cascade system:', error);
      // Don't crash the server - continue without WebSocket
    }
  });

  // Handle port in use errors
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.log(`Port ${PORT} is already in use`);

      // Try to release the port
      console.log('Attempting to free the port...');

      // Create a temporary server to attempt releasing the port
      const temp = createServer();

      // Try to listen on the port
      temp.listen(PORT);

      // If we can't listen, the port is truly in use
      temp.on('error', () => {
        console.error(`Port ${PORT} is still in use by another process.`);
        process.exit(1);
      });

      // If we can listen, close the connection and try again
      temp.on('listening', () => {
        console.log(
          `Found orphaned connection on port ${PORT}, cleaning up...`
        );
        temp.close();

        setTimeout(async () => {
          console.log('Trying to restart server...');
          await startServer();
        }, 1000);
      });
    } else {
      console.error('Server error:', error);
      process.exit(1);
    }
  });

  // Handle graceful shutdown for nodemon restarts
  process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down server gracefully');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down server gracefully');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

  return server;
};

// Start the server using our improved startup function
console.log('🚀 Starting server initialization...');
console.log('🌍 Environment:', process.env.NODE_ENV || 'development');
console.log('📦 Storage Mode:', process.env.STORAGE_MODE || 'local');

(async () => {
  try {
    // Initialize MongoDB with connection string
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is not set. Please configure it on Render.com');
    }

    await initializeMongoDB(mongoUri);
    console.log('✅ MongoDB initialized successfully');

    // Start the server
    await startServer();
    console.log('🎯 Server startup function called');
  } catch (error) {
    console.error('❌ Failed to initialize server:', error);
    console.error('💡 Make sure to set the MONGODB_URI environment variable in Render.com dashboard');
    process.exit(1);
  }
})();

