/**
 * Simple script to add test theory lessons directly using the existing backend service
 * This uses the existing MongoDB connection and service layer
 */

import { theoryService } from './api/theory/theory.service.js';
import { initializeMongoDB } from './services/mongoDB.service.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Test data - realistic theory lessons using valid schema
const testTheoryLessons = [
  {
    category: 'מגמה',
    teacherId: '507f1f77bcf86cd799439011', // Mock teacher ID
    date: new Date('2024-01-15'),
    dayOfWeek: 1, // Monday
    startTime: '19:00',
    endTime: '20:30',
    location: 'חדר תאוריה א',
    studentIds: [],
    notes: 'שיעור יסודות הרמוניה בסיסית',
    syllabus: 'טריאדות מז\'ור ומינור, אקורדי דומיננטה שביעית',
    homework: 'תרגילי הרמוניזציה של מנגינה פשוטה',
    schoolYearId: '507f1f77bcf86cd799439000' // Mock school year ID
  },
  {
    category: 'מתקדמים א',
    teacherId: '507f1f77bcf86cd799439012',
    date: new Date('2024-01-16'),
    dayOfWeek: 2, // Tuesday
    startTime: '18:00',
    endTime: '19:30',
    location: 'חדר תאוריה ב',
    studentIds: [],
    notes: 'התקופה הבארוקית והמלחינים החשובים',
    syllabus: 'באך, ויוואלדי, הנדל - מאפיינים סגנוניים',
    homework: 'האזנה לבחירת יצירות בארוקיות וניתוח קצר',
    schoolYearId: '507f1f77bcf86cd799439000'
  },
  {
    category: 'מתחילים',
    teacherId: '507f1f77bcf86cd799439013',
    date: new Date('2024-01-17'),
    dayOfWeek: 3, // Wednesday
    startTime: '19:30',
    endTime: '21:00',
    location: 'חדר 1',
    studentIds: [],
    notes: 'אסכולת המינים הכנסייתיים',
    syllabus: 'מין דוריאני, פריגיאני, לידיאני, מיקסולידיאני',
    homework: 'יצירת מנגינה קצרה במין לבחירה',
    schoolYearId: '507f1f77bcf86cd799439000'
  },
  {
    category: 'מתקדמים ב',
    teacherId: '507f1f77bcf86cd799439011',
    date: new Date('2024-01-18'),
    dayOfWeek: 4, // Thursday
    startTime: '20:00',
    endTime: '21:30',
    location: 'חדר 2',
    studentIds: [],
    notes: 'הסונטה הקלאסית וצורת הסונטה-אלגרו',
    syllabus: 'חשיפה, פיתוח, רקפיטולציה - ניתוח סונטות של מוצרט',
    homework: 'ניתוח סונטה למפתח במז\'ור מס\' 11',
    schoolYearId: '507f1f77bcf86cd799439000'
  },
  {
    category: 'מתקדמים ג',
    teacherId: '507f1f77bcf86cd799439014',
    date: new Date('2024-01-19'),
    dayOfWeek: 5, // Friday
    startTime: '18:30',
    endTime: '20:00',
    location: 'סטודיו קאמרי 1',
    studentIds: [],
    notes: 'כתיבה פוגה בסיסית - שיעור מתקדם מאוד',
    syllabus: 'נושא הפוגה, תשובה, פיתוח נגדי, סטרטות',
    homework: 'כתיבת חשיפת פוגה בשני קולות',
    schoolYearId: '507f1f77bcf86cd799439000'
  },
  {
    category: 'תאוריה כלי',
    teacherId: '507f1f77bcf86cd799439012',
    date: new Date('2024-01-22'),
    dayOfWeek: 1, // Monday
    startTime: '19:00',
    endTime: '20:30',
    location: 'חדר תאוריה א',
    studentIds: [],
    notes: 'אקורדים זרים ומודולציה',
    syllabus: 'אקורד נאפוליטני, אקורדי שישית מוגברת, מודולציה לטון השכן',
    homework: 'הרמוניזציה של בס נתון עם מודולציה',
    schoolYearId: '507f1f77bcf86cd799439000'
  }
];

async function addTestTheoryLessons() {
  try {
    console.log('🔌 Connecting to database...');
    await initializeMongoDB();
    console.log('✅ Connected to database');

    console.log('📚 Adding test theory lessons...');
    let successCount = 0;
    let errorCount = 0;

    for (const [index, lessonData] of testTheoryLessons.entries()) {
      try {
        console.log(`📝 Creating lesson ${index + 1}: ${lessonData.title}`);
        const createdLesson = await theoryService.addTheoryLesson(lessonData);
        console.log(`✅ Created lesson: ${createdLesson.title} (ID: ${createdLesson._id})`);
        successCount++;
      } catch (error) {
        console.error(`❌ Failed to create lesson ${index + 1}: ${error.message}`);
        errorCount++;
      }
    }

    console.log(`\n🎉 Summary:`);
    console.log(`✅ Successfully created: ${successCount} lessons`);
    console.log(`❌ Failed to create: ${errorCount} lessons`);

    if (successCount > 0) {
      console.log('\n💡 You can now test the frontend at http://localhost:5173/theory-lessons');
    }

  } catch (error) {
    console.error('🚨 Script failed:', error);
  } finally {
    console.log('🔌 Closing database connection');
    process.exit(0);
  }
}

// Run the script
addTestTheoryLessons();