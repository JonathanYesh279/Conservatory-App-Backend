/**
 * Script to create test theory lessons in the database
 * This will help verify that the frontend can display theory lessons properly
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Theory Lesson Schema (matching the backend model)
const theoryLessonSchema = new mongoose.Schema({
  category: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String },
  teacherId: { type: String, required: true },
  teacherName: { type: String, required: true },
  date: { type: Date, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  duration: { type: Number, required: true },
  location: { type: String, required: true },
  maxStudents: { type: Number, default: 15 },
  studentIds: [{ type: String }],
  registeredStudents: [{
    studentId: String,
    registrationDate: { type: Date, default: Date.now },
    status: { type: String, default: 'רשום' }
  }],
  attendanceList: [{
    studentId: String,
    studentName: String,
    status: { type: String, enum: ['הגיע/ה', 'לא הגיע/ה', 'מחלה'], default: 'לא הגיע/ה' },
    notes: String,
    timestamp: { type: Date, default: Date.now }
  }],
  attendance: {
    present: [String],
    absent: [String]
  },
  syllabus: String,
  homework: String,
  notes: String,
  isActive: { type: Boolean, default: true },
  schoolYearId: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const TheoryLesson = mongoose.model('TheoryLesson', theoryLessonSchema);

// Test data - realistic theory lessons
const testTheoryLessons = [
  {
    category: 'הרמוניה',
    title: 'יסודות הרמוניה בסיסית',
    description: 'לימוד יסודות ההרמוניה הקלאסית - טריאדות ואקורדי דומיננטה',
    teacherId: 'teacher001',
    teacherName: 'ד"ר מירית כהן',
    date: new Date('2024-01-15T19:00:00Z'),
    startTime: '19:00',
    endTime: '20:30',
    duration: 90,
    location: 'חדר תיאוריה 1',
    maxStudents: 12,
    studentIds: ['student001', 'student002', 'student003'],
    syllabus: 'טריאדות מז\'ור ומינור, אקורדי דומיננטה שביעית, הולכת קולות בסיסית',
    homework: 'תרגילי הרמוניזציה של מנגינה פשוטה',
    notes: 'שיעור מעולה עם השתתפות פעילה',
    isActive: true
  },
  {
    category: 'היסטוריה של המוזיקה',
    title: 'התקופה הבארוקית',
    description: 'היכרות עם מוזיקת הבארוק והמלחינים החשובים של התקופה',
    teacherId: 'teacher002',
    teacherName: 'פרופ\' דוד לוי',
    date: new Date('2024-01-16T18:00:00Z'),
    startTime: '18:00',
    endTime: '19:30',
    duration: 90,
    location: 'חדר תיאוריה 2',
    maxStudents: 15,
    studentIds: ['student004', 'student005', 'student006', 'student007'],
    syllabus: 'באך, ויוואלדי, הנדל - מאפיינים סגנוניים של המוזיקה הבארוקית',
    homework: 'האזנה לבחירת יצירות בארוקיות וניתוח קצר',
    isActive: true
  },
  {
    category: 'כתיבה מוזיקלית',
    title: 'אסכולת המינים הכנסייתיים',
    description: 'לימוד המינים הכנסייתיים ושימושם בכתיבה מוזיקלית',
    teacherId: 'teacher003',
    teacherName: 'מוריה שפירא',
    date: new Date('2024-01-17T19:30:00Z'),
    startTime: '19:30',
    endTime: '21:00',
    duration: 90,
    location: 'חדר תיאוריה 1',
    maxStudents: 10,
    studentIds: ['student008', 'student009'],
    syllabus: 'מין דוריאני, פריגיאני, לידיאני, מיקסולידיאני',
    homework: 'יצירת מנגינה קצרה במין לבחירה',
    notes: 'שיעור מאתגר, נדרש מעקב צמוד',
    isActive: true
  },
  {
    category: 'צורות מוזיקליות',
    title: 'הסונטה הקלאסית',
    description: 'ניתוח מבנה הסונטה הקלאסית וצורת הסונטה-אלגרו',
    teacherId: 'teacher001',
    teacherName: 'ד"ר מירית כהן',
    date: new Date('2024-01-18T20:00:00Z'),
    startTime: '20:00',
    endTime: '21:30',
    duration: 90,
    location: 'חדר תיאוריה 3',
    maxStudents: 8,
    studentIds: ['student010', 'student011', 'student012'],
    syllabus: 'חשיפה, פיתוח, רקפיטולציה - ניתוח סונטות של מוצרט',
    homework: 'ניתוח סונטה למפתח במז\'ור מס\' 11',
    isActive: true
  },
  {
    category: 'פוליפוניה',
    title: 'כתיבה פוגה בסיסית',
    description: 'יסודות כתיבת הפוגה ואמצעי הפיתוח הפוליפוני',
    teacherId: 'teacher004',
    teacherName: 'אלכס פטרוב',
    date: new Date('2024-01-19T18:30:00Z'),
    startTime: '18:30',
    endTime: '20:00',
    duration: 90,
    location: 'חדר תיאוריה 2',
    maxStudents: 6,
    studentIds: ['student013', 'student014'],
    syllabus: 'נושא הפוגה, תשובה, פיתוח נגדי, סטרטות',
    homework: 'כתיבת חשיפת פוגה בשני קולות',
    notes: 'שיעור מתקדם מאוד, דורש הכנה יסודית',
    isActive: true
  },
  {
    category: 'הרמוניה',
    title: 'אקורדים זרים ומודולציה',
    description: 'לימוד אקורדים זרים בסיסיים ומעברים טונאליים',
    teacherId: 'teacher002',
    teacherName: 'פרופ\' דוד לוי',
    date: new Date('2024-01-22T19:00:00Z'),
    startTime: '19:00',
    endTime: '20:30',
    duration: 90,
    location: 'חדר תיאוריה 1',
    maxStudents: 12,
    studentIds: ['student001', 'student015', 'student016'],
    syllabus: 'אקורד נאפוליטני, אקורדי שישית מוגברת, מודולציה לטון השכן',
    homework: 'הרמוניזציה של בס נתון עם מודולציה',
    isActive: true
  }
];

async function createTestTheoryLessons() {
  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/conservatory-app');
    console.log('✅ Connected to MongoDB');

    // Clear existing theory lessons (optional - comment out if you want to keep existing data)
    console.log('🗑️ Clearing existing theory lessons...');
    await TheoryLesson.deleteMany({});
    console.log('✅ Cleared existing theory lessons');

    // Create test theory lessons
    console.log('📚 Creating test theory lessons...');
    const createdLessons = await TheoryLesson.insertMany(testTheoryLessons);
    console.log(`✅ Created ${createdLessons.length} test theory lessons`);

    // Display summary
    console.log('\n📋 Created Theory Lessons:');
    for (const lesson of createdLessons) {
      console.log(`- ${lesson.category}: ${lesson.title} (${lesson.date.toLocaleDateString('he-IL')}, ${lesson.startTime})`);
    }

    console.log('\n🎉 Test theory lessons created successfully!');
    console.log('💡 Now you can test the frontend theory lessons page at http://localhost:5173/theory-lessons');

  } catch (error) {
    console.error('❌ Error creating test theory lessons:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the script
if (require.main === module) {
  createTestTheoryLessons();
}

module.exports = { createTestTheoryLessons };