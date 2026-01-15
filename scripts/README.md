# Seed Scripts for Strings Department (מחלקת כלי קשת)

## Files Included

- `seed_data.json` - Contains 14 teachers and 107 students from the strings department
- `schedule_data.json` - Contains schedule data extracted from the teacher schedules (92 lessons)
- `teacher_complete_data.json` - **NEW** Contains teachers' time blocks and full schedule data
- `seed-strings-students.js` - Basic seeder (teachers + students only)
- `seed-strings-complete.js` - Complete seeder (teachers + students + schedules)
- `seed-strings-with-timeblocks.js` - **RECOMMENDED** Full seeder with time blocks support

## Usage

### Prerequisites

1. Make sure MongoDB is running
2. Copy these files to your project's `scripts` directory
3. Set the environment variables:
   ```bash
   export MONGO_URI=mongodb://localhost:27017/your-db
   # or
   export MONGODB_URI=mongodb://localhost:27017/your-db
   export MONGODB_NAME=Conservatory-DB
   ```

### Running the Seed Script

```bash
# RECOMMENDED: Full seeding with time blocks (creates slots before assigning students)
node scripts/seed-strings-with-timeblocks.js

# Alternative: Basic seeding (teachers and students only)
node scripts/seed-strings-students.js

# Alternative: Complete seeding without time blocks (may fail if your system requires slots)
node scripts/seed-strings-complete.js
```

## Important: Time Blocks

Your system requires time blocks (slots) to exist before students can be assigned to teachers.
The `seed-strings-with-timeblocks.js` script handles this by:

1. Creating each teacher with their `timeBlocks` array populated
2. Time blocks include: day, startTime, endTime, totalDuration, location
3. Only then are students linked to teachers within valid time blocks

### Example Time Block Created:
```javascript
{
  _id: "auto-generated",
  day: "ראשון",
  startTime: "13:00",
  endTime: "19:15",
  totalDuration: 375,
  location: "21",
  isActive: true,
  assignedLessons: [],
  recurring: { isRecurring: true, excludeDates: [] }
}
```

## What Gets Created

### Teachers (14 total)
- לוין ורוניקה (כינור)
- קוטליאר אלונה (כינור)
- פורמן נטליה (כינור)
- זיסקינד מרינה (כינור)
- ארונזון אנה (כינור)
- אברהם סבטלנה (כינור)
- סלטקין אלה (כינור)
- סוחובוק זינה (נבל)
- ברגמן מרסל (צ'לו)
- מלצר הרן (צ'לו)
- רבין לובה (צ'לו)
- פלדמן אלסיה (צ'לו)
- גילנסון מרק (קונטרבס)
- בן חורין דניאל (קונטרבס)

### Students (107 total)
Students are imported with:
- Personal info (name, phone, email, address, parent details)
- Academic info (instrument, class level)
- Teacher assignment
- Lesson duration

### Schedules
From the teacher schedule file, the script extracts:
- Day of week (ראשון-שישי)
- Start time
- Duration
- Student-teacher linkage

## Data Structure Created

### Teacher Document
```javascript
{
  personalInfo: { fullName, phone, email, address },
  roles: ['מורה'],
  professionalInfo: { instrument, isActive },
  teaching: {
    studentIds: [...],
    schedule: [{ studentId, day, startTime, endTime, duration }],
    timeBlocks: []
  },
  schoolYears: [{ schoolYearId, isActive }],
  credentials: { email, password },
  isActive: true
}
```

### Student Document
```javascript
{
  personalInfo: { fullName, phone, age, address, parentName, parentPhone, parentEmail },
  academicInfo: {
    instrumentProgress: [{ instrumentName, isPrimary, currentStage }],
    class: 'א-יב',
    tests: { stageTest, technicalTest }
  },
  enrollments: {
    teacherIds: [...],
    teacherAssignments: [{ teacherId, day, time, duration }],
    orchestraIds: [],
    schoolYears: []
  },
  scheduleInfo: { day, startTime, endTime, duration },
  isActive: true
}
```

## Important Notes

1. **Duplicate Prevention**: The script checks for existing records before creating new ones
2. **Default Password**: All teachers get the password `123456` and `requiresPasswordChange: true`
3. **Schedule Matching**: Student names from the schedule file are matched against student records using fuzzy matching
4. **School Year**: Automatically uses or creates the current school year

## Customization

To add more data or modify the import:

1. Edit `seed_data.json` for student/teacher basic info
2. Edit `schedule_data.json` for schedule data
3. The JSON format is documented in the script files

## Troubleshooting

- If students aren't being matched to schedules, check the name spelling in `schedule_data.json`
- If teachers are missing schedules, ensure they exist in `seed_data.json`
- Check MongoDB connection if script fails immediately
