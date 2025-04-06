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
import authRoutes from './api/auth/auth.route.js';
import orchestraRoutes from './api/orchestra/orchestra.route.js';
import rehearsalRoutes from './api/rehearsal/rehearsal.route.js';
import bagrutRoutes from './api/bagrut/bagrut.route.js';

const _filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(_filename);

const app = express();

const NODE_ENV = process.env.NODE_ENV || 'development';
const MONGO_URI = process.env.MONGO_URI;
const FRONTEND_URL =
  process.env.FRONTEND_URL === 'production'
    ? process.env.FRONTEND_URL
    : 'http://localhost:5173';

const corsOptions = {
  origin:
    NODE_ENV === 'production' ? [FRONTEND_URL] : ['http://localhost:5173'],
  credentials: true,
  optionsSuccessStatus: 200,
};

// Set Content-Type header for all responses
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

if (STORAGE_MODE === 'local') {
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
}

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(helmet());
app.use(mongoSanitize());

// Initialize MongoDB
await initializeMongoDB(MONGO_URI).catch(console.error);

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
app.use('/api/bagrut', authenticateToken, addSchoolYearToRequest, bagrutRoutes);
app.use(
  '/api/school-year',
  authenticateToken,
  addSchoolYearToRequest,
  schoolYearRoutes
);
app.use('/api/files', authenticateToken, fileRoutes);

// Test route
app.get('/api/test', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Server is running',
  });
});

// Static files and catch-all route for production (AFTER API routes)
if (NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'public')));

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

// Improved server startup with error handling
const startServer = () => {
  // Create the server instance separately from starting it
  const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
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

        setTimeout(() => {
          console.log('Trying to restart server...');
          startServer();
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
startServer();
