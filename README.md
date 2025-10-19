# Music Conservatory Management System - Backend

A comprehensive Node.js backend service for managing a music conservatory, built with Express and MongoDB.

## Overview

This system provides complete management capabilities for a music conservatory, including:

- User authentication and role-based access control
- Student management
- Teacher management
- Orchestra and ensemble management
- Rehearsal scheduling and attendance tracking
- Bagrut (graduation) exam management
- School year management
- File uploads and document management

## Tech Stack

- **Node.js & Express**: Server framework
- **MongoDB**: Database
- **JWT**: Authentication
- **Bcrypt**: Password encryption
- **Joi**: Data validation
- **Multer**: File upload handling
- **AWS S3** (optional): Cloud storage for files
- **Jest**: Testing framework

## Features

### Authentication & Authorization
- Secure login with JWT (access and refresh tokens)
- Role-based access control system
- Supports multiple user roles: Admin, Teacher, Conductor, Ensemble Instructor

### Student Management
- Complete student profile management
- Academic information tracking
- Enrollment in orchestras and ensembles
- Test history and stage progression

### Teacher Management
- Teacher profiles and specializations
- Schedule management
- Student assignment

### Orchestra & Ensemble Management
- Create and manage different orchestra types
- Member management
- Conductor assignment

### Rehearsal Management
- Schedule rehearsals
- Track attendance
- Generate attendance statistics

### Bagrut (Graduation) System
- Track student progress towards graduation
- Manage performance programs
- Record presentations and evaluations
- Document uploads for graduation requirements

### School Year Management
- Define academic years
- Year rollover functionality
- Historical data preservation

### File Management
- Document uploads with local or S3 storage
- Secure file access

## Setup

### Prerequisites
- Node.js (v16+)
- MongoDB
- npm or yar

## API Documentation

### Authentication Endpoints

- `POST /api/auth/login` - Login with email and password
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout (requires authentication)
- `POST /api/auth/init-admin` - Initialize admin user

### Student Endpoints

- `GET /api/student` - Get all students (filterable)
- `GET /api/student/:id` - Get student by ID
- `POST /api/student` - Add a new student
- `PUT /api/student/:id` - Update a student
- `DELETE /api/student/:id` - Deactivate a student

### Teacher Endpoints

- `GET /api/teacher` - Get all teachers (filterable)
- `GET /api/teacher/:id` - Get teacher by ID
- `GET /api/teacher/role/:role` - Get teachers by role
- `POST /api/teacher` - Add a new teacher
- `PUT /api/teacher/:id` - Update a teacher
- `DELETE /api/teacher/:id` - Deactivate a teacher

### Orchestra Endpoints

- `GET /api/orchestra` - Get all orchestras (filterable)
- `GET /api/orchestra/:id` - Get orchestra by ID
- `POST /api/orchestra` - Add a new orchestra
- `PUT /api/orchestra/:id` - Update an orchestra
- `DELETE /api/orchestra/:id` - Deactivate an orchestra
- `POST /api/orchestra/:id/members` - Add member to orchestra
- `DELETE /api/orchestra/:id/members/:studentId` - Remove member from orchestra
- `GET /api/orchestra/:id/rehearsals/:rehearsalId/attendance` - Get rehearsal attendance
- `PUT /api/orchestra/:id/rehearsals/:rehearsalId/attendance` - Update rehearsal attendance
- `GET /api/orchestra/:orchestraId/student/:studentId/attendance` - Get student attendance statistics

### Rehearsal Endpoints

- `GET /api/rehearsal` - Get all rehearsals (filterable)
- `GET /api/rehearsal/orchestra/:orchestraId` - Get orchestra rehearsals
- `GET /api/rehearsal/:id` - Get rehearsal by ID
- `POST /api/rehearsal` - Add a new rehearsal
- `PUT /api/rehearsal/:id` - Update a rehearsal
- `DELETE /api/rehearsal/:id` - Deactivate a rehearsal
- `PUT /api/rehearsal/:rehearsalId/attendance` - Update rehearsal attendance
- `POST /api/rehearsal/bulk-create` - Bulk create rehearsals

### Bagrut (Graduation) Endpoints

- `GET /api/bagrut` - Get all bagruts (filterable)
- `GET /api/bagrut/:id` - Get bagrut by ID
- `GET /api/bagrut/student/:studentId` - Get bagrut by student ID
- `POST /api/bagrut` - Add a new bagrut
- `PUT /api/bagrut/:id` - Update a bagrut
- `PUT /api/bagrut/:id/presentation/:presentationIndex` - Update a specific presentation
- `PUT /api/bagrut/:id/magenBagrut` - Update magen bagrut
- `POST /api/bagrut/:id/document` - Add document to bagrut
- `DELETE /api/bagrut/:id/document/:documentId` - Remove document from bagrut
- `POST /api/bagrut/:id/program` - Add program piece to bagrut
- `DELETE /api/bagrut/:id/program/:pieceId` - Remove program piece from bagrut
- `POST /api/bagrut/:id/accompanist` - Add accompanist to bagrut
- `DELETE /api/bagrut/:id/accompanist/:accompanistId` - Remove accompanist from bagrut

### School Year Endpoints

- `GET /api/school-year` - Get all school years
- `GET /api/school-year/current` - Get current school year
- `GET /api/school-year/:id` - Get school year by ID
- `POST /api/school-year` - Create a new school year
- `PUT /api/school-year/:id` - Update a school year
- `PUT /api/school-year/:id/set-current` - Set as current school year
- `PUT /api/school-year/:id/rollover` - Rollover to new school year

### File Endpoints

- `GET /api/files/:filename` - Get a file by filename

## Project Structure

```
conservatory-app-backend/
├── api/                  # API modules grouped by domain
│   ├── auth/             # Authentication
│   ├── bagrut/           # Graduation exams
│   ├── file/             # File handling
│   ├── orchestra/        # Orchestras and ensembles
│   ├── rehearsal/        # Rehearsals
│   ├── school-year/      # School year management
│   ├── student/          # Student management
│   └── teacher/          # Teacher management
├── middleware/           # Express middleware
├── services/             # Shared services
│   ├── mongoDB.service.js     # Database connection
│   └── fileStorage.service.js # File storage (local/S3)
├── uploads/              # Local file storage (if using)
├── tests/                # Test files
├── .env                  # Environment variables
├── .env.test             # Test environment variables
├── package.json          # Project dependencies
└── server.js             # Application entry point
```

## Testing

This project uses Jest for testing. To run the tests:

```
npm test             # Run all tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
```

## Security Features

- JWT authentication with refresh tokens
- Password hashing with bcrypt
- Rate limiting for sensitive routes
- HTTP-only cookies for refresh tokens
- Input validation with Joi
- MongoDB query sanitization
- Helmet for HTTP security headers

## Deployment

For production deployment:

1. Set appropriate environment variables for production
2. Build and deploy to your preferred hosting service
3. Set up a MongoDB database (Atlas recommended for production)
4. Configure a reverse proxy (Nginx/Apache) if needed

## License

This project is licensed under the ISC License.

## Author

Yehonatan Yeshayahu

---

For issues or feature requests, please open an issue on the project repository.
