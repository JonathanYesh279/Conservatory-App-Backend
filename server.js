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
import { invitationController } from './api/teacher/invitation.controller.js';

const _filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(_filename);

const app = express();

// Enable trust proxy for production (fixes rate limiting behind proxy)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

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
app.use(helmet());
app.use(mongoSanitize());

// Initialize MongoDB
await initializeMongoDB(MONGO_URI).catch(console.error);

// Direct invitation routes (no auth required)
app.get('/accept-invitation/:token', (req, res) => {
  const { token } = req.params;
  
  // Serve a simple HTML form for password setting
  res.send(`
    <!DOCTYPE html>
    <html dir="rtl" lang="he">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>הגדרת סיסמה - מערכת הקונסרבטוריון</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #f5f5f5;
          margin: 0;
          padding: 20px;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
        }
        .container {
          background: white;
          padding: 30px;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          max-width: 400px;
          width: 100%;
        }
        h1 {
          color: #333;
          text-align: center;
          margin-bottom: 30px;
        }
        .form-group {
          margin-bottom: 20px;
        }
        label {
          display: block;
          margin-bottom: 5px;
          font-weight: bold;
          color: #555;
        }
        input[type="password"] {
          width: 100%;
          padding: 12px;
          border: 2px solid #ddd;
          border-radius: 5px;
          font-size: 16px;
          box-sizing: border-box;
        }
        input[type="password"]:focus {
          outline: none;
          border-color: #007bff;
        }
        button {
          width: 100%;
          padding: 15px;
          background-color: #007bff;
          color: white;
          border: none;
          border-radius: 5px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          transition: background-color 0.3s;
        }
        button:hover {
          background-color: #0056b3;
        }
        button:disabled {
          background-color: #ccc;
          cursor: not-allowed;
        }
        .message {
          margin-top: 20px;
          padding: 10px;
          border-radius: 5px;
          text-align: center;
        }
        .success {
          background-color: #d4edda;
          color: #155724;
          border: 1px solid #c3e6cb;
        }
        .error {
          background-color: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
        }
        .loading {
          display: none;
          text-align: center;
          margin-top: 20px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>הגדרת סיסמה</h1>
        <form id="passwordForm">
          <div class="form-group">
            <label for="password">סיסמה חדשה:</label>
            <input type="password" id="password" name="password" required minlength="6" 
                   placeholder="הכנס סיסמה באורך 6 תווים לפחות">
          </div>
          <div class="form-group">
            <label for="confirmPassword">אימות סיסמה:</label>
            <input type="password" id="confirmPassword" name="confirmPassword" required minlength="6" 
                   placeholder="הכנס את הסיסמה שוב">
          </div>
          <button type="submit" id="submitBtn">הגדר סיסמה</button>
        </form>
        
        <div class="loading" id="loading">
          <p>מגדיר סיסמה...</p>
        </div>
        
        <div id="message"></div>
      </div>

      <script>
        document.getElementById('passwordForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          
          const password = document.getElementById('password').value;
          const confirmPassword = document.getElementById('confirmPassword').value;
          const submitBtn = document.getElementById('submitBtn');
          const loading = document.getElementById('loading');
          const messageDiv = document.getElementById('message');
          
          // Clear previous messages
          messageDiv.innerHTML = '';
          
          // Validate passwords match
          if (password !== confirmPassword) {
            messageDiv.innerHTML = '<div class="message error">הסיסמאות אינן זהות</div>';
            return;
          }
          
          // Show loading
          submitBtn.disabled = true;
          loading.style.display = 'block';
          
          try {
            const response = await fetch('/api/teacher/invitation/accept/${token}', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ password })
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
              messageDiv.innerHTML = '<div class="message success">הסיסמה הוגדרה בהצלחה! מעביר אותך לדף הכניסה...</div>';
              
              // Store tokens and user data (matching frontend expectations)
              try {
                if (result.data.accessToken) {
                  localStorage.setItem('accessToken', result.data.accessToken);
                }
                if (result.data.refreshToken) {
                  localStorage.setItem('refreshToken', result.data.refreshToken);
                }
                if (result.data.teacher) {
                  localStorage.setItem('user', JSON.stringify(result.data.teacher));
                }
              } catch (storageError) {
                console.log('Storage error:', storageError);
                // Continue without storage
              }
              
              // Redirect to login page after 2 seconds
              setTimeout(() => {
                window.location.href = '${process.env.FRONTEND_URL || 'http://localhost:5173'}/login';
              }, 2000);
              
            } else {
              messageDiv.innerHTML = '<div class="message error">' + (result.error || 'שגיאה לא ידועה') + '</div>';
            }
          } catch (error) {
            messageDiv.innerHTML = '<div class="message error">שגיאה בחיבור לשרת</div>';
          } finally {
            submitBtn.disabled = false;
            loading.style.display = 'none';
          }
        });
      </script>
    </body>
    </html>
  `);
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
app.use('/api/files', authenticateToken, fileRoutes);

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
