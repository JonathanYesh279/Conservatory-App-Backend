/**
 * Comprehensive String Department Seeder
 *
 * This script seeds the entire strings department:
 * 1. Creates/updates string teachers (כינור, צ'לו, ויולה)
 * 2. Creates string students
 * 3. Links students to teachers with proper teacherAssignments
 * 4. Creates schedule entries
 *
 * Usage:
 *   node scripts/seed-strings-department.js --dry-run    # Preview changes
 *   node scripts/seed-strings-department.js --apply      # Apply changes
 */

import 'dotenv/config'
import { MongoClient, ObjectId } from 'mongodb'

// ============================================================================
// STRING TEACHERS DATA
// ============================================================================
const STRING_TEACHERS = [
  {
    personalInfo: {
      fullName: 'סבטלנה אברהם',
      phone: '054-2192466',
      email: 'svetlana.avraham@placeholder.local'
    },
    roles: ['מורה'],
    professionalInfo: {
      instrument: 'כינור',
      isActive: true
    }
  },
  {
    personalInfo: {
      fullName: 'אנה ארונזון',
      phone: '',
      email: 'anna.aronzon1@gmail.com'
    },
    roles: ['מורה'],
    professionalInfo: {
      instrument: 'כינור',
      isActive: true
    }
  },
  {
    personalInfo: {
      fullName: 'מרסל ברגמן',
      phone: '052-6610884',
      email: 'bergman@gmail.com'
    },
    roles: ['מורה'],
    professionalInfo: {
      instrument: "צ'לו",
      isActive: true
    }
  },
  {
    personalInfo: {
      fullName: 'סשה דולוב',
      phone: '052-7265423',
      email: 'sasha.doulov@placeholder.local'
    },
    roles: ['מורה'],
    professionalInfo: {
      instrument: "צ'לו",
      isActive: true
    }
  },
  {
    personalInfo: {
      fullName: 'אלה סלטקין',
      phone: '052-4409312',
      email: 'ella.slatkin@placeholder.local'
    },
    roles: ['מורה'],
    professionalInfo: {
      instrument: 'כינור',
      isActive: true
    }
  },
  {
    personalInfo: {
      fullName: 'מרינה זיסקינד',
      phone: '054-6665847',
      email: 'marina.ziskind@placeholder.local'
    },
    roles: ['מורה'],
    professionalInfo: {
      instrument: 'כינור',
      isActive: true
    }
  },
  {
    personalInfo: {
      fullName: 'ורוניקה לוין',
      phone: '054-6312877',
      email: 'veronika.levin@placeholder.local'
    },
    roles: ['מורה'],
    professionalInfo: {
      instrument: 'כינור',
      isActive: true
    }
  },
  {
    personalInfo: {
      fullName: 'אלונה קוטליאר',
      phone: '054-5997257',
      email: 'alona.kotlyar@placeholder.local'
    },
    roles: ['מורה'],
    professionalInfo: {
      instrument: 'כינור',
      isActive: true
    }
  },
  {
    personalInfo: {
      fullName: 'אלסיה פלדמן',
      phone: '054-4790175',
      email: 'alesya.feldman@placeholder.local'
    },
    roles: ['מורה'],
    professionalInfo: {
      instrument: "צ'לו",
      isActive: true
    }
  },
  {
    personalInfo: {
      fullName: 'לובה רבין',
      phone: '054-7655245',
      email: 'lubarabin@gmail.com'
    },
    roles: ['מורה'],
    professionalInfo: {
      instrument: "צ'לו",
      isActive: true
    }
  }
]

// Teacher name mapping (for matching different name formats in student data)
const TEACHER_NAME_ALIASES = {
  'אברהם סבטלנה': 'סבטלנה אברהם',
  'ארונזון אנה': 'אנה ארונזון',
  'ברגמן מרסל': 'מרסל ברגמן',
  'דולוב סשה': 'סשה דולוב',
  'דולוב אלכס': 'סשה דולוב',
  'סלטקין אלה': 'אלה סלטקין',
  'זיסקינד מרינה': 'מרינה זיסקינד',
  'לוין ורוניקה': 'ורוניקה לוין',
  'קוטליאר אלונה': 'אלונה קוטליאר',
  'פלדמן אלסיה': 'אלסיה פלדמן',
  'רבין לובה': 'לובה רבין'
}

// ============================================================================
// SCHEDULE DATA (Teacher -> Students)
// ============================================================================
const ALL_SCHEDULES = {
  'סבטלנה אברהם': [
    { day: 'ראשון', time: '13:00', familyName: 'שורץ ציגלר', firstName: 'כחל', duration: 60, room: '21' },
    { day: 'ראשון', time: '14:15', familyName: 'אלחרט', firstName: 'שרה', duration: 30, room: '21' },
    { day: 'ראשון', time: '14:45', familyName: 'ויינר', firstName: 'אדר', duration: 30, room: '21' },
    { day: 'ראשון', time: '15:15', familyName: 'סורקין', firstName: 'שרה', duration: 60, room: '21' },
    { day: 'ראשון', time: '16:15', familyName: 'נייטס', firstName: 'אלה', duration: 60, room: '21' },
    { day: 'ראשון', time: '17:15', familyName: 'שראיזין', firstName: 'איתי', duration: 60, room: '21' },
    { day: 'ראשון', time: '18:15', familyName: 'סופיר', firstName: 'ליטל', duration: 30, room: '21' },
    { day: 'ראשון', time: '18:45', familyName: 'בן זמרה', firstName: 'אגם', duration: 30, room: '21' },
    { day: 'שני', time: '15:30', familyName: 'ויינר', firstName: 'אדר', duration: 30, room: '21' },
    { day: 'שני', time: '16:00', familyName: 'קאופמן', firstName: 'אלמוג', duration: 30, room: '21' },
    { day: 'שני', time: '16:30', familyName: 'אלטמן', firstName: 'אמה', duration: 30, room: '21' },
    { day: 'שני', time: '17:00', familyName: 'צדוק', firstName: 'ניתאי', duration: 60, room: '21' },
    { day: 'שלישי', time: '13:30', familyName: 'שורץ ציגלר', firstName: 'כחל', duration: 60, room: '21' },
    { day: 'שלישי', time: '14:30', familyName: 'נייטס', firstName: 'אלה', duration: 60, room: '21' },
    { day: 'שלישי', time: '15:30', familyName: 'סופיר', firstName: 'ליטל', duration: 30, room: '21' },
    { day: 'שלישי', time: '16:00', familyName: 'סורקין', firstName: 'שרה', duration: 60, room: '21' },
    { day: 'שלישי', time: '17:00', familyName: 'בן זמרה', firstName: 'אגם', duration: 30, room: '21' },
    { day: 'שלישי', time: '17:30', familyName: 'אלחרט', firstName: 'שרה', duration: 30, room: '21' },
    { day: 'שלישי', time: '18:00', familyName: 'שראיזין', firstName: 'איתי', duration: 60, room: '21' },
    { day: 'שישי', time: '11:30', familyName: 'צדוק', firstName: 'ניתאי', duration: 60, room: '11' },
    { day: 'שישי', time: '12:30', familyName: 'אלטמן', firstName: 'אמה', duration: 30, room: '11' },
    { day: 'שישי', time: '13:00', familyName: 'קאופמן', firstName: 'אלמוג', duration: 30, room: '11' },
  ],
  'אנה ארונזון': [
    { day: 'שני', time: '15:00', familyName: 'רויטמן', firstName: 'רוני', duration: 30, room: '7' },
    { day: 'שני', time: '15:30', familyName: 'מעוז', firstName: 'תהל', duration: 30, room: '7' },
    { day: 'שני', time: '16:00', familyName: 'כהן', firstName: 'פרל', duration: 45, room: '7' },
    { day: 'שני', time: '16:45', familyName: 'פאסי', firstName: 'יעל', duration: 45, room: '7' },
    { day: 'שני', time: '17:30', familyName: 'פרץ', firstName: 'ליהיא', duration: 60, room: '7' },
    { day: 'שני', time: '18:30', familyName: 'מעוז', firstName: 'היילי', duration: 30, room: '7' },
    { day: 'שני', time: '19:00', familyName: 'מעוז', firstName: 'מתן', duration: 30, room: '7' },
    { day: 'שני', time: '19:30', familyName: 'שמלה', firstName: 'חנה', duration: 45, room: '7' },
    { day: 'חמישי', time: '15:30', familyName: 'רויטמן', firstName: 'רוני', duration: 30, room: '7' },
    { day: 'חמישי', time: '16:00', familyName: 'כהן', firstName: 'פרל', duration: 45, room: '7' },
    { day: 'חמישי', time: '16:45', familyName: 'פאסי', firstName: 'יעל', duration: 45, room: '7' },
    { day: 'חמישי', time: '17:30', familyName: 'פרץ', firstName: 'ליהיא', duration: 60, room: '7' },
    { day: 'חמישי', time: '18:30', familyName: 'מעוז', firstName: 'תהל', duration: 30, room: '7' },
    { day: 'חמישי', time: '19:00', familyName: 'מעוז', firstName: 'היילי', duration: 45, room: '7' },
    { day: 'חמישי', time: '19:45', familyName: 'מעוז', firstName: 'מתן', duration: 45, room: '7' },
    { day: 'חמישי', time: '20:30', familyName: 'שמלה', firstName: 'חנה', duration: 45, room: '7' },
  ],
  'מרסל ברגמן': [
    { day: 'ראשון', time: '15:15', familyName: 'קרבלניק', firstName: 'בן', duration: 30, room: 'תיאוריה ב' },
    { day: 'ראשון', time: '15:45', familyName: 'רוטקופ', firstName: 'שקד', duration: 45, room: 'תיאוריה ב' },
    { day: 'ראשון', time: '16:30', familyName: 'חן', firstName: 'מיקה', duration: 45, room: 'תיאוריה ב' },
    { day: 'שלישי', time: '14:30', familyName: 'גרינפלד', firstName: 'אורי', duration: 45, room: 'תיאוריה ב' },
    { day: 'חמישי', time: '17:15', familyName: 'קרבלניק', firstName: 'בן', duration: 30, room: '' },
    { day: 'חמישי', time: '17:45', familyName: 'גרינפלד', firstName: 'אורי', duration: 45, room: '' },
    { day: 'חמישי', time: '18:30', familyName: 'חן', firstName: 'מיקה', duration: 45, room: '' },
    { day: 'שישי', time: '13:00', familyName: 'רוטקופ', firstName: 'שקד', duration: 45, room: 'תיאוריה ב' },
  ],
  'סשה דולוב': [
    { day: 'שני', time: '13:15', familyName: 'שחר', firstName: 'זיו', duration: 30, room: 'סטודיו 1' },
    { day: 'שני', time: '13:45', familyName: 'פורת', firstName: 'לביא', duration: 30, room: 'סטודיו 1' },
    { day: 'שני', time: '15:15', familyName: 'גרפילד', firstName: 'נועם', duration: 30, room: 'סטודיו 1' },
    { day: 'שני', time: '17:30', familyName: 'מקובצקי', firstName: 'הלל', duration: 30, room: 'סטודיו 1' },
    { day: 'שני', time: '18:00', familyName: 'סויברט', firstName: 'ניאה', duration: 45, room: 'סטודיו 1' },
    { day: 'שני', time: '18:45', familyName: 'מילס', firstName: 'אביגיל', duration: 45, room: 'סטודיו 1' },
    { day: 'שישי', time: '12:30', familyName: 'שחר', firstName: 'זיו', duration: 30, room: '' },
    { day: 'שישי', time: '13:00', familyName: 'פורת', firstName: 'לביא', duration: 30, room: '' },
    { day: 'שישי', time: '13:30', familyName: 'גרפילד', firstName: 'נועם', duration: 30, room: '' },
    { day: 'שישי', time: '14:00', familyName: 'סויברט', firstName: 'ניאה', duration: 45, room: '' },
    { day: 'שישי', time: '14:45', familyName: 'מילס', firstName: 'אביגיל', duration: 45, room: '' },
    { day: 'שישי', time: '15:30', familyName: 'מקובצקי', firstName: 'הלל', duration: 30, room: '' },
  ],
  'אלה סלטקין': [
    { day: 'שני', time: '15:00', familyName: 'שוורץ', firstName: 'אלה', duration: 45, room: 'במה 2' },
    { day: 'שני', time: '16:00', familyName: 'גולן', firstName: 'ליבי', duration: 30, room: 'במה 2' },
    { day: 'שני', time: '16:30', familyName: 'גל הדר', firstName: 'ארייה', duration: 30, room: 'במה 2' },
    { day: 'שני', time: '17:00', familyName: 'אלפרן', firstName: 'הלנה', duration: 45, room: 'במה 2' },
    { day: 'שני', time: '17:45', familyName: 'לוי', firstName: 'לילה', duration: 45, room: 'במה 2' },
    { day: 'חמישי', time: '16:00', familyName: 'אלפרן', firstName: 'הלנה', duration: 45, room: '24' },
    { day: 'חמישי', time: '16:45', familyName: 'גל הדר', firstName: 'ארייה', duration: 30, room: '24' },
    { day: 'חמישי', time: '17:15', familyName: 'גולן', firstName: 'ליבי', duration: 30, room: '24' },
    { day: 'חמישי', time: '17:45', familyName: 'לוי', firstName: 'לילה', duration: 45, room: '24' },
  ],
  'ורוניקה לוין': [
    { day: 'ראשון', time: '13:00', familyName: 'אנטונוב', firstName: 'ליזה', duration: 45, room: 'דולב 2' },
    { day: 'ראשון', time: '13:45', familyName: 'סורקין', firstName: 'איתן', duration: 30, room: 'דולב 2' },
    { day: 'ראשון', time: '14:15', familyName: 'שם טוב', firstName: 'הילה', duration: 45, room: 'דולב 2' },
    { day: 'ראשון', time: '15:00', familyName: 'יעקב הכהן', firstName: 'גאיה', duration: 60, room: 'דולב 2' },
    { day: 'ראשון', time: '16:00', familyName: 'שם טוב', firstName: 'שירה', duration: 30, room: 'דולב 2' },
    { day: 'ראשון', time: '16:30', familyName: 'אליהו', firstName: 'שירה', duration: 45, room: 'דולב 2' },
    { day: 'ראשון', time: '17:15', familyName: 'אליאב', firstName: 'שחר', duration: 30, room: 'דולב 2' },
    { day: 'ראשון', time: '17:45', familyName: 'שמיר', firstName: 'גילי', duration: 30, room: 'דולב 2' },
    { day: 'ראשון', time: '18:15', familyName: 'יחזקאל', firstName: 'שרה', duration: 45, room: 'דולב 2' },
    { day: 'ראשון', time: '19:00', familyName: 'שם טוב', firstName: 'קרולין', duration: 60, room: 'דולב 2' },
    { day: 'שני', time: '14:30', familyName: 'מזרחי', firstName: 'שיר', duration: 30, room: 'דולב 2' },
    { day: 'שני', time: '15:00', familyName: 'אהרוני', firstName: 'מיכאלה', duration: 30, room: 'דולב 2' },
    { day: 'שני', time: '15:30', familyName: 'גרפילד', firstName: 'בנימין', duration: 30, room: 'דולב 2' },
    { day: 'שני', time: '17:00', familyName: 'שקלוסקי', firstName: 'נעה', duration: 30, room: 'דולב 2' },
    { day: 'שני', time: '17:30', familyName: 'הולנד', firstName: 'יעל', duration: 45, room: 'דולב 2' },
    { day: 'שני', time: '18:15', familyName: 'יפעת', firstName: 'ליה', duration: 30, room: 'דולב 2' },
    { day: 'שני', time: '18:45', familyName: 'בן הרוש', firstName: 'שנה', duration: 45, room: 'דולב 2' },
    { day: 'שני', time: '19:30', familyName: 'יליזרוב', firstName: 'נועה', duration: 60, room: 'דולב 2' },
    { day: 'רביעי', time: '14:15', familyName: 'אהרוני', firstName: 'מיכאלה', duration: 30, room: 'דולב 2' },
    { day: 'רביעי', time: '14:45', familyName: 'יפעת', firstName: 'ליה', duration: 30, room: 'דולב 2' },
    { day: 'רביעי', time: '15:15', familyName: 'סורקין', firstName: 'איתן', duration: 45, room: 'דולב 2' },
    { day: 'רביעי', time: '16:00', familyName: 'מזרחי', firstName: 'שיר', duration: 30, room: 'דולב 2' },
    { day: 'רביעי', time: '16:30', familyName: 'שם טוב', firstName: 'שירה', duration: 30, room: 'דולב 2' },
    { day: 'רביעי', time: '17:00', familyName: 'שמיר', firstName: 'גילי', duration: 30, room: 'דולב 2' },
    { day: 'רביעי', time: '17:30', familyName: 'שקלוסקי', firstName: 'נעה', duration: 30, room: 'דולב 2' },
    { day: 'רביעי', time: '18:00', familyName: 'יחזקאל', firstName: 'שרה', duration: 30, room: 'דולב 2' },
    { day: 'חמישי', time: '14:45', familyName: 'בן הרוש', firstName: 'שנה', duration: 45, room: 'דולב 2' },
    { day: 'חמישי', time: '15:30', familyName: 'שם טוב', firstName: 'הילה', duration: 45, room: 'דולב 2' },
    { day: 'חמישי', time: '16:15', familyName: 'גרפילד', firstName: 'בנימין', duration: 30, room: 'דולב 2' },
    { day: 'חמישי', time: '16:45', familyName: 'אליאב', firstName: 'שחר', duration: 30, room: 'דולב 2' },
    { day: 'חמישי', time: '17:15', familyName: 'הולנד', firstName: 'יעל', duration: 45, room: 'דולב 2' },
    { day: 'חמישי', time: '18:00', familyName: 'אליהו', firstName: 'שירה', duration: 30, room: 'דולב 2' },
    { day: 'חמישי', time: '18:30', familyName: 'אנטונוב', firstName: 'ליזה', duration: 45, room: 'דולב 2' },
    { day: 'חמישי', time: '19:15', familyName: 'יליזרוב', firstName: 'נועה', duration: 60, room: 'דולב 2' },
  ],
  'אלסיה פלדמן': [
    { day: 'ראשון', time: '10:00', familyName: 'אקטע', firstName: 'תמיר', duration: 45, room: 'תאוריה ב' },
    { day: 'ראשון', time: '14:30', familyName: 'שם טוב', firstName: 'נעמי', duration: 45, room: 'תאוריה ב' },
    { day: 'ראשון', time: '15:15', familyName: 'עופר', firstName: 'מרים', duration: 30, room: 'תאוריה ב' },
    { day: 'ראשון', time: '15:45', familyName: 'פיינברג', firstName: 'נהורה', duration: 30, room: 'תאוריה ב' },
    { day: 'שני', time: '14:15', familyName: 'גומונוב', firstName: 'דין', duration: 45, room: '24' },
    { day: 'שני', time: '15:00', familyName: 'שטורך', firstName: 'אגם', duration: 30, room: '24' },
    { day: 'שני', time: '15:30', familyName: 'ריבולוב', firstName: 'פולינה', duration: 45, room: '24' },
    { day: 'שני', time: '16:15', familyName: 'לכמן', firstName: 'אמה', duration: 45, room: '24' },
    { day: 'שני', time: '17:00', familyName: 'נבו', firstName: 'נעמה', duration: 45, room: '24' },
    { day: 'שני', time: '17:45', familyName: 'זהבי', firstName: 'רננה', duration: 45, room: '24' },
    { day: 'שני', time: '18:30', familyName: 'גרונשטיין', firstName: 'אדל', duration: 30, room: '24' },
    { day: 'שני', time: '19:00', familyName: 'פישל', firstName: 'אליענה', duration: 45, room: '24' },
    { day: 'רביעי', time: '14:30', familyName: 'עופר', firstName: 'מרים', duration: 30, room: '24' },
    { day: 'רביעי', time: '15:15', familyName: 'נבו', firstName: 'נעמה', duration: 45, room: '24' },
    { day: 'חמישי', time: '14:00', familyName: 'גומונוב', firstName: 'דין', duration: 45, room: '11' },
    { day: 'חמישי', time: '14:45', familyName: 'לכמן', firstName: 'אמה', duration: 45, room: '11' },
    { day: 'חמישי', time: '15:30', familyName: 'שם טוב', firstName: 'נעמי', duration: 45, room: '11' },
    { day: 'חמישי', time: '16:15', familyName: 'ריבולוב', firstName: 'פולינה', duration: 45, room: '11' },
    { day: 'חמישי', time: '17:00', familyName: 'גרונשטיין', firstName: 'אדל', duration: 30, room: '11' },
    { day: 'חמישי', time: '17:30', familyName: 'זהבי', firstName: 'רננה', duration: 45, room: '11' },
    { day: 'חמישי', time: '18:15', familyName: 'שטורך', firstName: 'אגם', duration: 30, room: '11' },
    { day: 'חמישי', time: '18:45', familyName: 'פיינברג', firstName: 'נהורה', duration: 45, room: '11' },
    { day: 'חמישי', time: '19:30', familyName: 'פישל', firstName: 'אליענה', duration: 45, room: '11' },
  ],
  'אלונה קוטליאר': [
    { day: 'ראשון', time: '14:15', familyName: 'טיחונצ\'יק', firstName: 'אליסה', duration: 45, room: '16' },
    { day: 'ראשון', time: '15:00', familyName: 'דרור', firstName: 'מטע', duration: 45, room: '16' },
    { day: 'ראשון', time: '15:45', familyName: 'מרגולין', firstName: 'הדר', duration: 60, room: '16' },
    { day: 'ראשון', time: '16:45', familyName: 'לסר', firstName: 'שחר', duration: 45, room: '16' },
    { day: 'שני', time: '12:45', familyName: 'חופרי', firstName: 'יובל', duration: 45, room: '16' },
    { day: 'שני', time: '14:45', familyName: 'תמרקין', firstName: 'אורי', duration: 30, room: '16' },
    { day: 'שני', time: '15:15', familyName: 'בירמן', firstName: 'ביאנקה', duration: 30, room: '16' },
    { day: 'שני', time: '17:00', familyName: 'סויסה', firstName: 'אגם', duration: 45, room: '16' },
    { day: 'שני', time: '17:45', familyName: 'סויסה', firstName: 'פז', duration: 30, room: '16' },
    { day: 'שני', time: '18:15', familyName: 'מילס', firstName: 'מלאכי', duration: 45, room: '16' },
    { day: 'שני', time: '19:00', familyName: 'שטראוס', firstName: 'שושנה', duration: 45, room: '16' },
    { day: 'שני', time: '19:45', familyName: 'רזאל', firstName: 'בארי', duration: 60, room: '16' },
    { day: 'רביעי', time: '14:30', familyName: 'תמרקין', firstName: 'אורי', duration: 30, room: '16' },
    { day: 'רביעי', time: '15:30', familyName: 'לסר', firstName: 'שחר', duration: 45, room: '16' },
    { day: 'רביעי', time: '18:00', familyName: 'דרור', firstName: 'מטע', duration: 45, room: '16' },
    { day: 'רביעי', time: '19:45', familyName: 'רזאל', firstName: 'בארי', duration: 60, room: '16' },
    { day: 'חמישי', time: '14:15', familyName: 'טיחונצ\'יק', firstName: 'אליסא', duration: 45, room: '16' },
    { day: 'חמישי', time: '15:00', familyName: 'חופרי', firstName: 'יובל', duration: 45, room: '16' },
    { day: 'חמישי', time: '15:45', familyName: 'מרגולין', firstName: 'הדר', duration: 60, room: '16' },
    { day: 'חמישי', time: '16:45', familyName: 'סויסה', firstName: 'פז', duration: 30, room: '16' },
    { day: 'חמישי', time: '17:15', familyName: 'סויסה', firstName: 'אגם', duration: 45, room: '16' },
    { day: 'חמישי', time: '18:00', familyName: 'בירמן', firstName: 'ביאנקה', duration: 30, room: '16' },
    { day: 'חמישי', time: '18:30', familyName: 'מילס', firstName: 'מלאכי', duration: 45, room: '16' },
    { day: 'חמישי', time: '19:15', familyName: 'שטראוס', firstName: 'שושנה', duration: 45, room: '16' },
  ],
  'לובה רבין': [
    { day: 'שני', time: '14:30', familyName: 'יהודין', firstName: 'דוד', duration: 45, room: 'תיאוריה ב' },
    { day: 'שני', time: '15:15', familyName: 'מיכנובסקי', firstName: 'איתן', duration: 60, room: 'תיאוריה ב' },
    { day: 'שני', time: '16:15', familyName: 'ויינר', firstName: 'ציפורה', duration: 30, room: 'תיאוריה ב' },
    { day: 'שני', time: '16:45', familyName: 'עין צבי', firstName: 'גלעד', duration: 45, room: 'תיאוריה ב' },
    { day: 'שני', time: '17:45', familyName: 'פיש', firstName: 'יונתן', duration: 45, room: 'תיאוריה ב' },
    { day: 'שני', time: '18:30', familyName: 'שם טוב', firstName: 'שי', duration: 60, room: 'תיאוריה ב' },
    { day: 'שני', time: '19:30', familyName: 'זלצבורג', firstName: 'ברטה', duration: 45, room: 'תיאוריה ב' },
    { day: 'שני', time: '20:15', familyName: 'הרבר', firstName: 'מאיה', duration: 60, room: 'תיאוריה ב' },
    { day: 'רביעי', time: '14:30', familyName: 'יהודין', firstName: 'דוד', duration: 45, room: 'תיאוריה ב' },
    { day: 'רביעי', time: '15:15', familyName: 'גולוב', firstName: 'תום', duration: 30, room: 'תיאוריה ב' },
    { day: 'רביעי', time: '15:45', familyName: 'פיש', firstName: 'יונתן', duration: 30, room: 'תיאוריה ב' },
    { day: 'רביעי', time: '17:00', familyName: 'מיכנובסקי', firstName: 'איתן', duration: 60, room: 'תיאוריה ב' },
    { day: 'רביעי', time: '18:00', familyName: 'ויינר', firstName: 'ציפורה', duration: 30, room: 'תיאוריה ב' },
    { day: 'רביעי', time: '18:30', familyName: 'עין צבי', firstName: 'גלעד', duration: 45, room: 'תיאוריה ב' },
    { day: 'רביעי', time: '19:15', familyName: 'זלצבורג', firstName: 'ברטה', duration: 45, room: 'תיאוריה ב' },
    { day: 'רביעי', time: '20:00', familyName: 'הרבר', firstName: 'מאיה', duration: 60, room: 'תיאוריה ב' },
  ]
}

// ============================================================================
// SEEDER CLASS
// ============================================================================

class StringsDepartmentSeeder {
  constructor(applyChanges = false) {
    this.applyChanges = applyChanges
    this.client = null
    this.db = null
    this.schoolYearId = null
    this.teacherMap = new Map() // name -> teacher document
    this.studentMap = new Map() // name -> student document
    this.stats = {
      teachersCreated: 0,
      teachersUpdated: 0,
      studentsCreated: 0,
      studentsUpdated: 0,
      assignmentsCreated: 0,
      errors: []
    }
  }

  async connect() {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI
    if (!uri) throw new Error('MongoDB URI not found')
    this.client = new MongoClient(uri)
    await this.client.connect()
    this.db = this.client.db(process.env.MONGODB_NAME || 'Conservatory-DB')
    console.log('✓ Connected to MongoDB')
  }

  async disconnect() {
    if (this.client) {
      await this.client.close()
      console.log('✓ Disconnected from MongoDB')
    }
  }

  async getSchoolYear() {
    const schoolYear = await this.db.collection('school_year').findOne({ isCurrent: true })
    if (schoolYear) {
      this.schoolYearId = schoolYear._id.toString()
      console.log(`✓ Found current school year: ${this.schoolYearId}`)
    } else {
      console.log('⚠ No current school year found')
    }
    return this.schoolYearId
  }

  calculateEndTime(startTime, duration) {
    const [hours, minutes] = startTime.split(':').map(Number)
    const totalMinutes = hours * 60 + minutes + duration
    const endHours = Math.floor(totalMinutes / 60)
    const endMins = totalMinutes % 60
    return `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`
  }

  normalizeTeacherName(name) {
    // Check aliases first
    if (TEACHER_NAME_ALIASES[name]) {
      return TEACHER_NAME_ALIASES[name]
    }
    return name
  }

  // ============================================================================
  // STEP 1: Create/Update Teachers
  // ============================================================================
  async seedTeachers() {
    console.log('\n' + '='.repeat(60))
    console.log('STEP 1: Seeding Teachers')
    console.log('='.repeat(60))

    const teacherCollection = this.db.collection('teacher')

    for (const teacherData of STRING_TEACHERS) {
      const fullName = teacherData.personalInfo.fullName
      console.log(`\n  Processing: ${fullName}`)

      // Check if teacher exists
      let existingTeacher = await teacherCollection.findOne({
        'personalInfo.fullName': fullName
      })

      if (existingTeacher) {
        console.log(`    ✓ Teacher exists (ID: ${existingTeacher._id})`)
        this.teacherMap.set(fullName, existingTeacher)

        // Update instrument if needed
        if (existingTeacher.professionalInfo?.instrument !== teacherData.professionalInfo.instrument) {
          console.log(`    → Updating instrument: ${existingTeacher.professionalInfo?.instrument} → ${teacherData.professionalInfo.instrument}`)
          if (this.applyChanges) {
            await teacherCollection.updateOne(
              { _id: existingTeacher._id },
              { $set: { 'professionalInfo.instrument': teacherData.professionalInfo.instrument } }
            )
          }
          this.stats.teachersUpdated++
        }
      } else {
        console.log(`    + Creating new teacher`)

        if (this.applyChanges) {
          const newTeacher = {
            ...teacherData,
            teaching: {
              studentIds: [],
              schedule: [],
              timeBlocks: []
            },
            conducting: { orchestraIds: [] },
            schoolYears: this.schoolYearId ? [{ schoolYearId: this.schoolYearId, isActive: true }] : [],
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
          }

          const result = await teacherCollection.insertOne(newTeacher)
          newTeacher._id = result.insertedId
          this.teacherMap.set(fullName, newTeacher)
          console.log(`    ✓ Created (ID: ${result.insertedId})`)
        } else {
          console.log(`    [DRY RUN] Would create teacher`)
        }
        this.stats.teachersCreated++
      }
    }

    console.log(`\n  Summary: ${this.stats.teachersCreated} created, ${this.stats.teachersUpdated} updated`)
  }

  // ============================================================================
  // STEP 2: Create Students from Schedule Data
  // ============================================================================
  async seedStudents() {
    console.log('\n' + '='.repeat(60))
    console.log('STEP 2: Collecting and Creating Students')
    console.log('='.repeat(60))

    const studentCollection = this.db.collection('student')

    // Collect unique students from schedule data
    const uniqueStudents = new Map()

    for (const [teacherName, lessons] of Object.entries(ALL_SCHEDULES)) {
      const teacher = this.teacherMap.get(teacherName)
      const instrument = teacher?.professionalInfo?.instrument || 'כינור'

      for (const lesson of lessons) {
        const studentKey = `${lesson.familyName} ${lesson.firstName}`
        if (!uniqueStudents.has(studentKey)) {
          uniqueStudents.set(studentKey, {
            familyName: lesson.familyName,
            firstName: lesson.firstName,
            instrument: instrument,
            teacherName: teacherName
          })
        }
      }
    }

    console.log(`\n  Found ${uniqueStudents.size} unique students in schedule data`)

    for (const [studentKey, studentData] of uniqueStudents) {
      console.log(`\n  Processing: ${studentKey}`)

      // Try to find existing student with flexible name matching
      const searchPatterns = [
        { 'personalInfo.fullName': new RegExp(`${studentData.familyName}.*${studentData.firstName}`, 'i') },
        { 'personalInfo.fullName': new RegExp(`${studentData.firstName}.*${studentData.familyName}`, 'i') },
        { 'personalInfo.fullName': new RegExp(`^${studentData.firstName}\\s+${studentData.familyName}`, 'i') },
        { 'personalInfo.fullName': new RegExp(`^${studentData.familyName}\\s+${studentData.firstName}`, 'i') },
      ]

      let existingStudent = null
      for (const pattern of searchPatterns) {
        existingStudent = await studentCollection.findOne(pattern)
        if (existingStudent) break
      }

      if (existingStudent) {
        console.log(`    ✓ Found existing: ${existingStudent.personalInfo.fullName} (ID: ${existingStudent._id})`)
        this.studentMap.set(studentKey, existingStudent)
      } else {
        console.log(`    + Creating new student`)

        if (this.applyChanges) {
          // Students use "LastName FirstName" format to match existing database
          const fullName = `${studentData.familyName} ${studentData.firstName}`
          const newStudent = {
            personalInfo: {
              fullName: fullName,
              phone: '',
              age: 0,
              address: '',
              parentName: '',
              parentPhone: '',
              parentEmail: '',
              studentEmail: ''
            },
            academicInfo: {
              instrumentProgress: [{
                instrumentName: studentData.instrument,
                isPrimary: true,
                currentStage: 1,
                tests: {
                  stageTest: { status: 'לא נבחן', lastTestDate: null, nextTestDate: null, notes: '' },
                  technicalTest: { status: 'לא נבחן', lastTestDate: null, nextTestDate: null, notes: '' }
                }
              }],
              class: 'אחר'
            },
            enrollments: {
              orchestraIds: [],
              ensembleIds: [],
              theoryLessonIds: [],
              teacherIds: [],
              teacherAssignments: [],
              schoolYears: this.schoolYearId ? [{ schoolYearId: this.schoolYearId, isActive: true }] : []
            },
            teacherAssignments: [],
            teacherIds: [],
            scheduleInfo: {
              day: null,
              startTime: null,
              endTime: null,
              duration: null,
              location: null,
              notes: null,
              isActive: true
            },
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
          }

          const result = await studentCollection.insertOne(newStudent)
          newStudent._id = result.insertedId
          this.studentMap.set(studentKey, newStudent)
          console.log(`    ✓ Created: ${fullName} (ID: ${result.insertedId})`)
        } else {
          // Students use "LastName FirstName" format
          console.log(`    [DRY RUN] Would create student: ${studentData.familyName} ${studentData.firstName}`)
        }
        this.stats.studentsCreated++
      }
    }

    console.log(`\n  Summary: ${this.stats.studentsCreated} students to create`)
  }

  // ============================================================================
  // STEP 3: Create Teacher-Student Assignments
  // ============================================================================
  async createAssignments() {
    console.log('\n' + '='.repeat(60))
    console.log('STEP 3: Creating Teacher-Student Assignments')
    console.log('='.repeat(60))

    const studentCollection = this.db.collection('student')
    const teacherCollection = this.db.collection('teacher')

    for (const [teacherName, lessons] of Object.entries(ALL_SCHEDULES)) {
      console.log(`\n  Teacher: ${teacherName}`)

      const teacher = this.teacherMap.get(teacherName)
      if (!teacher) {
        console.log(`    ⚠ Teacher not found in map, skipping`)
        continue
      }

      const teacherId = teacher._id.toString()
      const assignedStudentIds = new Set()

      for (const lesson of lessons) {
        const studentKey = `${lesson.familyName} ${lesson.firstName}`
        const student = this.studentMap.get(studentKey)

        if (!student) {
          console.log(`    ⚠ Student not found: ${studentKey}`)
          this.stats.errors.push(`Student not found: ${studentKey}`)
          continue
        }

        const studentId = student._id.toString()
        const endTime = this.calculateEndTime(lesson.time, lesson.duration)

        // Create teacher assignment for student
        const assignment = {
          _id: new ObjectId(),
          teacherId: teacherId,
          day: lesson.day,
          time: lesson.time,
          duration: lesson.duration,
          location: lesson.room || '',
          isActive: true,
          isRecurring: true,
          startDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          scheduleInfo: {
            day: lesson.day,
            startTime: lesson.time,
            endTime: endTime,
            duration: lesson.duration,
            location: lesson.room || '',
            notes: null,
            isActive: true
          }
        }

        console.log(`    → ${student.personalInfo?.fullName || studentKey}: ${lesson.day} ${lesson.time} (${lesson.duration}min)`)

        if (this.applyChanges) {
          // Check if this exact assignment already exists
          const existingAssignment = await studentCollection.findOne({
            _id: student._id,
            'teacherAssignments': {
              $elemMatch: {
                teacherId: teacherId,
                day: lesson.day,
                time: lesson.time
              }
            }
          })

          if (!existingAssignment) {
            // Add assignment to student.teacherAssignments (THE SINGLE SOURCE OF TRUTH)
            await studentCollection.updateOne(
              { _id: student._id },
              {
                $push: { teacherAssignments: assignment },
                $addToSet: { teacherIds: teacherId },
                $set: { updatedAt: new Date() }
              }
            )
            this.stats.assignmentsCreated++
          }
        }

        assignedStudentIds.add(studentId)
      }

      // Update teacher's studentIds
      if (this.applyChanges && assignedStudentIds.size > 0) {
        await teacherCollection.updateOne(
          { _id: teacher._id },
          {
            $addToSet: { 'teaching.studentIds': { $each: Array.from(assignedStudentIds) } },
            $set: { updatedAt: new Date() }
          }
        )
      }

      console.log(`    ✓ Assigned ${assignedStudentIds.size} students to ${teacherName}`)
    }

    console.log(`\n  Summary: ${this.stats.assignmentsCreated} assignments created`)
  }

  // ============================================================================
  // MAIN RUN
  // ============================================================================
  async run() {
    try {
      console.log('\n' + '═'.repeat(70))
      console.log('  STRING DEPARTMENT SEEDER')
      console.log('  Mode: ' + (this.applyChanges ? 'APPLY CHANGES' : 'DRY RUN'))
      console.log('═'.repeat(70))

      await this.connect()
      await this.getSchoolYear()

      // Load existing teachers into map
      const teacherCollection = this.db.collection('teacher')
      for (const teacherData of STRING_TEACHERS) {
        const existing = await teacherCollection.findOne({
          'personalInfo.fullName': teacherData.personalInfo.fullName
        })
        if (existing) {
          this.teacherMap.set(teacherData.personalInfo.fullName, existing)
        }
      }

      await this.seedTeachers()
      await this.seedStudents()
      await this.createAssignments()

      // Final Summary
      console.log('\n' + '═'.repeat(70))
      console.log('  SEEDING COMPLETE')
      console.log('═'.repeat(70))
      console.log(`  Teachers created: ${this.stats.teachersCreated}`)
      console.log(`  Teachers updated: ${this.stats.teachersUpdated}`)
      console.log(`  Students created: ${this.stats.studentsCreated}`)
      console.log(`  Assignments created: ${this.stats.assignmentsCreated}`)

      if (this.stats.errors.length > 0) {
        console.log(`\n  Errors (${this.stats.errors.length}):`)
        this.stats.errors.forEach(e => console.log(`    - ${e}`))
      }

      if (!this.applyChanges) {
        console.log('\n  ⚠ DRY RUN MODE - No changes were applied')
        console.log('  Run with --apply to apply changes')
      }

      console.log('═'.repeat(70) + '\n')

    } catch (error) {
      console.error('Error:', error)
      process.exit(1)
    } finally {
      await this.disconnect()
    }
  }
}

// ============================================================================
// MAIN
// ============================================================================

const args = process.argv.slice(2)
const applyChanges = args.includes('--apply')

if (!args.includes('--apply') && !args.includes('--dry-run')) {
  console.log('Usage:')
  console.log('  node scripts/seed-strings-department.js --dry-run    # Preview changes')
  console.log('  node scripts/seed-strings-department.js --apply      # Apply changes')
  console.log('')
  console.log('Running in dry-run mode by default...\n')
}

const seeder = new StringsDepartmentSeeder(applyChanges)
seeder.run()
