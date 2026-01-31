/**
 * Comprehensive Schedule Seeder for ALL Strings Department Teachers
 *
 * Day mapping:
 * - יום א' = ראשון (Sunday)
 * - יום ב' = שני (Monday)
 * - יום ג' = שלישי (Tuesday)
 * - יום ד' = רביעי (Wednesday)
 * - יום ה' = חמישי (Thursday)
 * - יום ו' = שישי (Friday)
 */

import 'dotenv/config'
import { MongoClient, ObjectId } from 'mongodb'

// ============================================================================
// COMPLETE SCHEDULE DATA FOR ALL TEACHERS
// ============================================================================

const ALL_SCHEDULES = {
  // -------------------------------------------------------------------------
  // סבטלנה אברהם - Svetlana Abram - כינור
  // -------------------------------------------------------------------------
  'סבטלנה אברהם': [
    // יום א' (Sunday) - Room 21
    { day: 'ראשון', time: '13:00', familyName: 'שורץ ציגלר', firstName: 'כחל', duration: 60, room: '21' },
    { day: 'ראשון', time: '14:15', familyName: 'אלחרט', firstName: 'שרה', duration: 30, room: '21' },
    { day: 'ראשון', time: '14:45', familyName: 'ויינר', firstName: 'אדר', duration: 30, room: '21' },
    { day: 'ראשון', time: '15:15', familyName: 'סורקין', firstName: 'שרה', duration: 60, room: '21' },
    { day: 'ראשון', time: '16:15', familyName: 'נייטס', firstName: 'אלה', duration: 60, room: '21' },
    { day: 'ראשון', time: '17:15', familyName: 'שראיזין', firstName: 'איתי', duration: 60, room: '21' },
    { day: 'ראשון', time: '18:15', familyName: 'סופיר', firstName: 'ליטל', duration: 30, room: '21' },
    { day: 'ראשון', time: '18:45', familyName: 'בן זמרה', firstName: 'אגם', duration: 30, room: '21' },
    // יום ב' (Monday) - Room 21
    { day: 'שני', time: '15:30', familyName: 'ויינר', firstName: 'אדר', duration: 30, room: '21' },
    { day: 'שני', time: '16:00', familyName: 'קאופמן', firstName: 'אלמוג', duration: 30, room: '21' },
    { day: 'שני', time: '16:30', familyName: 'אלטמן', firstName: 'אמה', duration: 30, room: '21' },
    { day: 'שני', time: '17:00', familyName: 'צדוק', firstName: 'ניתאי', duration: 60, room: '21' },
    // יום ג' (Tuesday) - Room 21
    { day: 'שלישי', time: '13:30', familyName: 'שורץ ציגלר', firstName: 'כחל', duration: 60, room: '21' },
    { day: 'שלישי', time: '14:30', familyName: 'נייטס', firstName: 'אלה', duration: 60, room: '21' },
    { day: 'שלישי', time: '15:30', familyName: 'סופיר', firstName: 'ליטל', duration: 30, room: '21' },
    { day: 'שלישי', time: '16:00', familyName: 'סורקין', firstName: 'שרה', duration: 60, room: '21' },
    { day: 'שלישי', time: '17:00', familyName: 'בן זמרה', firstName: 'אגם', duration: 30, room: '21' },
    { day: 'שלישי', time: '17:30', familyName: 'אלחרט', firstName: 'שרה', duration: 30, room: '21' },
    { day: 'שלישי', time: '18:00', familyName: 'שראיזין', firstName: 'איתי', duration: 60, room: '21' },
    // יום ו' (Friday) - Room 11
    { day: 'שישי', time: '11:30', familyName: 'צדוק', firstName: 'ניתאי', duration: 60, room: '11' },
    { day: 'שישי', time: '12:30', familyName: 'אלטמן', firstName: 'אמה', duration: 30, room: '11' },
    { day: 'שישי', time: '13:00', familyName: 'קאופמן', firstName: 'אלמוג', duration: 30, room: '11' },
  ],

  // -------------------------------------------------------------------------
  // אנה ארונזון - Anna Aronzon - כינור
  // -------------------------------------------------------------------------
  'אנה ארונזון': [
    // יום ב' (Monday) - Room 7
    { day: 'שני', time: '15:00', familyName: 'רויטמן', firstName: 'רוני', duration: 30, room: '7' },
    { day: 'שני', time: '15:30', familyName: 'מעוז', firstName: 'תהל', duration: 30, room: '7' },
    { day: 'שני', time: '16:00', familyName: 'כהן', firstName: 'פרל', duration: 45, room: '7' },
    { day: 'שני', time: '16:45', familyName: 'פאסי', firstName: 'יעל', duration: 45, room: '7' },
    { day: 'שני', time: '17:30', familyName: 'פרץ', firstName: 'ליהיא', duration: 60, room: '7' },
    { day: 'שני', time: '18:30', familyName: 'מעוז', firstName: 'היילי', duration: 30, room: '7' },
    { day: 'שני', time: '19:00', familyName: 'מעוז', firstName: 'מתן', duration: 30, room: '7' },
    { day: 'שני', time: '19:30', familyName: 'שמלה', firstName: 'חנה', duration: 45, room: '7' },
    // יום ה' (Thursday) - Room 7
    { day: 'חמישי', time: '15:30', familyName: 'רויטמן', firstName: 'רוני', duration: 30, room: '7' },
    { day: 'חמישי', time: '16:00', familyName: 'כהן', firstName: 'פרל', duration: 45, room: '7' },
    { day: 'חמישי', time: '16:45', familyName: 'פאסי', firstName: 'יעל', duration: 45, room: '7' },
    { day: 'חמישי', time: '17:30', familyName: 'פרץ', firstName: 'ליהיא', duration: 60, room: '7' },
    { day: 'חמישי', time: '18:30', familyName: 'מעוז', firstName: 'תהל', duration: 30, room: '7' },
    { day: 'חמישי', time: '19:00', familyName: 'מעוז', firstName: 'היילי', duration: 45, room: '7' },
    { day: 'חמישי', time: '19:45', familyName: 'מעוז', firstName: 'מתן', duration: 45, room: '7' },
    { day: 'חמישי', time: '20:30', familyName: 'שמלה', firstName: 'חנה', duration: 45, room: '7' },
  ],

  // -------------------------------------------------------------------------
  // מרסל ברגמן - Marcel Bergman - צ'לו מתקדמים
  // -------------------------------------------------------------------------
  'מרסל ברגמן': [
    // יום א' (Sunday) - Room תיאוריה ב'
    { day: 'ראשון', time: '15:15', familyName: 'קרבלניק', firstName: 'בן', duration: 30, room: 'תיאוריה ב' },
    { day: 'ראשון', time: '15:45', familyName: 'רוטקופ', firstName: 'שקד', duration: 45, room: 'תיאוריה ב' },
    { day: 'ראשון', time: '16:30', familyName: 'חן', firstName: 'מיקה', duration: 45, room: 'תיאוריה ב' },
    // יום ג' (Tuesday) - Room תיאוריה ב'
    { day: 'שלישי', time: '14:30', familyName: 'גרינפלד', firstName: 'אורי', duration: 45, room: 'תיאוריה ב' },
    // יום ה' (Thursday)
    { day: 'חמישי', time: '17:15', familyName: 'קרבלניק', firstName: 'בן', duration: 30, room: '' },
    { day: 'חמישי', time: '17:45', familyName: 'גרינפלד', firstName: 'אורי', duration: 45, room: '' },
    { day: 'חמישי', time: '18:30', familyName: 'חן', firstName: 'מיקה', duration: 45, room: '' },
    // יום ו' (Friday) - Room תיאוריה ב'
    { day: 'שישי', time: '13:00', familyName: 'רוטקופ', firstName: 'שקד', duration: 45, room: 'תיאוריה ב' },
  ],

  // -------------------------------------------------------------------------
  // סשה דולוב - Sasha Doulov - צ'לו
  // -------------------------------------------------------------------------
  'סשה דולוב': [
    // יום ב' (Monday) - Room סטודיו 1
    { day: 'שני', time: '13:15', familyName: 'שחר', firstName: 'זיו', duration: 30, room: 'סטודיו 1' },
    { day: 'שני', time: '13:45', familyName: 'פורת', firstName: 'לביא', duration: 30, room: 'סטודיו 1' },
    { day: 'שני', time: '15:15', familyName: 'גרפילד', firstName: 'נועם', duration: 30, room: 'סטודיו 1' },
    { day: 'שני', time: '17:30', familyName: 'מקובצקי', firstName: 'הלל', duration: 30, room: 'סטודיו 1' },
    { day: 'שני', time: '18:00', familyName: 'סויברט', firstName: 'ניאה', duration: 45, room: 'סטודיו 1' },
    { day: 'שני', time: '18:45', familyName: 'מילס', firstName: 'אביגיל', duration: 45, room: 'סטודיו 1' },
    // יום ו' (Friday)
    { day: 'שישי', time: '12:30', familyName: 'שחר', firstName: 'זיו', duration: 30, room: '' },
    { day: 'שישי', time: '13:00', familyName: 'פורת', firstName: 'לביא', duration: 30, room: '' },
    { day: 'שישי', time: '13:30', familyName: 'גרפילד', firstName: 'נועם', duration: 30, room: '' },
    { day: 'שישי', time: '14:00', familyName: 'סויברט', firstName: 'ניאה', duration: 45, room: '' },
    { day: 'שישי', time: '14:45', familyName: 'מילס', firstName: 'אביגיל', duration: 45, room: '' },
    { day: 'שישי', time: '15:30', familyName: 'מקובצקי', firstName: 'הלל', duration: 30, room: '' },
  ],

  // -------------------------------------------------------------------------
  // אלה סלטקין - Ella Slatkin - כינור
  // -------------------------------------------------------------------------
  'אלה סלטקין': [
    // יום ב' (Monday) - Room במה 2
    { day: 'שני', time: '15:00', familyName: 'שוורץ', firstName: 'אלה', duration: 45, room: 'במה 2' },
    { day: 'שני', time: '16:00', familyName: 'גולן', firstName: 'ליבי', duration: 30, room: 'במה 2' },
    { day: 'שני', time: '16:30', familyName: 'גל הדר', firstName: 'ארייה', duration: 30, room: 'במה 2' },
    { day: 'שני', time: '17:00', familyName: 'אלפרן', firstName: 'הלנה', duration: 45, room: 'במה 2' },
    { day: 'שני', time: '17:45', familyName: 'לוי', firstName: 'לילה', duration: 45, room: 'במה 2' },
    // יום ה' (Thursday) - Room 24
    { day: 'חמישי', time: '16:00', familyName: 'אלפרן', firstName: 'הלנה', duration: 45, room: '24' },
    { day: 'חמישי', time: '16:45', familyName: 'גל הדר', firstName: 'ארייה', duration: 30, room: '24' },
    { day: 'חמישי', time: '17:15', familyName: 'גולן', firstName: 'ליבי', duration: 30, room: '24' },
    { day: 'חמישי', time: '17:45', familyName: 'לוי', firstName: 'לילה', duration: 45, room: '24' },
  ],

  // -------------------------------------------------------------------------
  // ורוניקה לוין - Veronika Levin - כינור, ויולה
  // -------------------------------------------------------------------------
  'ורוניקה לוין': [
    // יום א' (Sunday) - Room דולב 2
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
    // יום ב' (Monday) - Room דולב 2
    { day: 'שני', time: '14:30', familyName: 'מזרחי', firstName: 'שיר', duration: 30, room: 'דולב 2' },
    { day: 'שני', time: '15:00', familyName: 'אהרוני', firstName: 'מיכאלה', duration: 30, room: 'דולב 2' },
    { day: 'שני', time: '15:30', familyName: 'גרפילד', firstName: 'בנימין', duration: 30, room: 'דולב 2' },
    { day: 'שני', time: '17:00', familyName: 'שקלוסקי', firstName: 'נעה', duration: 30, room: 'דולב 2' },
    { day: 'שני', time: '17:30', familyName: 'הולנד', firstName: 'יעל', duration: 45, room: 'דולב 2' },
    { day: 'שני', time: '18:15', familyName: 'יפעת', firstName: 'ליה', duration: 30, room: 'דולב 2' },
    { day: 'שני', time: '18:45', familyName: 'בן הרוש', firstName: 'שנה', duration: 45, room: 'דולב 2' },
    { day: 'שני', time: '19:30', familyName: 'יליזרוב', firstName: 'נועה', duration: 60, room: 'דולב 2' },
    // יום ד' (Wednesday) - Room דולב 2
    { day: 'רביעי', time: '14:15', familyName: 'אהרוני', firstName: 'מיכאלה', duration: 30, room: 'דולב 2' },
    { day: 'רביעי', time: '14:45', familyName: 'יפעת', firstName: 'ליה', duration: 30, room: 'דולב 2' },
    { day: 'רביעי', time: '15:15', familyName: 'סורקין', firstName: 'איתן', duration: 45, room: 'דולב 2' },
    { day: 'רביעי', time: '16:00', familyName: 'מזרחי', firstName: 'שיר', duration: 30, room: 'דולב 2' },
    { day: 'רביעי', time: '16:30', familyName: 'שם טוב', firstName: 'שירה', duration: 30, room: 'דולב 2' },
    { day: 'רביעי', time: '17:00', familyName: 'שמיר', firstName: 'גילי', duration: 30, room: 'דולב 2' },
    { day: 'רביעי', time: '17:30', familyName: 'שקלוסקי', firstName: 'נעה', duration: 30, room: 'דולב 2' },
    { day: 'רביעי', time: '18:00', familyName: 'יחזקאל', firstName: 'שרה', duration: 30, room: 'דולב 2' },
    // יום ה' (Thursday) - Room דולב 2
    { day: 'חמישי', time: '14:45', familyName: 'בן הרוש', firstName: 'שנה', duration: 45, room: 'דולב 2' },
    { day: 'חמישי', time: '15:30', familyName: 'שם טוב', firstName: 'הילה', duration: 45, room: 'דולב 2' },
    { day: 'חמישי', time: '16:15', familyName: 'גרפילד', firstName: 'בנימין', duration: 30, room: 'דולב 2' },
    { day: 'חמישי', time: '16:45', familyName: 'אליאב', firstName: 'שחר', duration: 30, room: 'דולב 2' },
    { day: 'חמישי', time: '17:15', familyName: 'הולנד', firstName: 'יעל', duration: 45, room: 'דולב 2' },
    { day: 'חמישי', time: '18:00', familyName: 'אליהו', firstName: 'שירה', duration: 30, room: 'דולב 2' },
    { day: 'חמישי', time: '18:30', familyName: 'אנטונוב', firstName: 'ליזה', duration: 45, room: 'דולב 2' },
    { day: 'חמישי', time: '19:15', familyName: 'יליזרוב', firstName: 'נועה', duration: 60, room: 'דולב 2' },
  ],

  // -------------------------------------------------------------------------
  // אלסיה פלדמן - Alesya Feldman - צ'לו
  // -------------------------------------------------------------------------
  'אלסיה פלדמן': [
    // יום א' (Sunday) - Room תאוריה ב
    { day: 'ראשון', time: '10:00', familyName: 'אקטע', firstName: 'תמיר', duration: 45, room: 'תאוריה ב' },
    { day: 'ראשון', time: '14:30', familyName: 'שם טוב', firstName: 'נעמי', duration: 45, room: 'תאוריה ב' },
    { day: 'ראשון', time: '15:15', familyName: 'עופר', firstName: 'מרים', duration: 30, room: 'תאוריה ב' },
    { day: 'ראשון', time: '15:45', familyName: 'פיינברג', firstName: 'נהורה', duration: 30, room: 'תאוריה ב' },
    // יום ב' (Monday) - Room 24
    { day: 'שני', time: '14:15', familyName: 'גומונוב', firstName: 'דין', duration: 45, room: '24' },
    { day: 'שני', time: '15:00', familyName: 'שטורך', firstName: 'אגם', duration: 30, room: '24' },
    { day: 'שני', time: '15:30', familyName: 'ריבולוב', firstName: 'פולינה', duration: 45, room: '24' },
    { day: 'שני', time: '16:15', familyName: 'לכמן', firstName: 'אמה', duration: 45, room: '24' },
    { day: 'שני', time: '17:00', familyName: 'נבו', firstName: 'נעמה', duration: 45, room: '24' },
    { day: 'שני', time: '17:45', familyName: 'זהבי', firstName: 'רננה', duration: 45, room: '24' },
    { day: 'שני', time: '18:30', familyName: 'גרונשטיין', firstName: 'אדל', duration: 30, room: '24' },
    { day: 'שני', time: '19:00', familyName: 'פישל', firstName: 'אליענה', duration: 45, room: '24' },
    // יום ד' (Wednesday) - Room 24
    { day: 'רביעי', time: '14:30', familyName: 'עופר', firstName: 'מרים', duration: 30, room: '24' },
    { day: 'רביעי', time: '15:15', familyName: 'נבו', firstName: 'נעמה', duration: 45, room: '24' },
    // יום ה' (Thursday) - Room 11
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

  // -------------------------------------------------------------------------
  // אלונה קוטליאר - Alona Kotlyar - כינור
  // -------------------------------------------------------------------------
  'אלונה קוטליאר': [
    // יום א' (Sunday) - Room 16
    { day: 'ראשון', time: '14:15', familyName: 'טיחונצ\'יק', firstName: 'אליסה', duration: 45, room: '16' },
    { day: 'ראשון', time: '15:00', familyName: 'דרור', firstName: 'מטע', duration: 45, room: '16' },
    { day: 'ראשון', time: '15:45', familyName: 'מרגולין', firstName: 'הדר', duration: 60, room: '16' },
    { day: 'ראשון', time: '16:45', familyName: 'לסר', firstName: 'שחר', duration: 45, room: '16' },
    // יום ב' (Monday) - Room 16
    { day: 'שני', time: '12:45', familyName: 'חופרי', firstName: 'יובל', duration: 45, room: '16' },
    { day: 'שני', time: '14:45', familyName: 'תמרקין', firstName: 'אורי', duration: 30, room: '16' },
    { day: 'שני', time: '15:15', familyName: 'בירמן', firstName: 'ביאנקה', duration: 30, room: '16' },
    { day: 'שני', time: '17:00', familyName: 'סויסה', firstName: 'אגם', duration: 45, room: '16' },
    { day: 'שני', time: '17:45', familyName: 'סויסה', firstName: 'פז', duration: 30, room: '16' },
    { day: 'שני', time: '18:15', familyName: 'מילס', firstName: 'מלאכי', duration: 45, room: '16' },
    { day: 'שני', time: '19:00', familyName: 'שטראוס', firstName: 'שושנה', duration: 45, room: '16' },
    { day: 'שני', time: '19:45', familyName: 'רזאל', firstName: 'בארי', duration: 60, room: '16' },
    // יום ד' (Wednesday) - Room 16
    { day: 'רביעי', time: '14:30', familyName: 'תמרקין', firstName: 'אורי', duration: 30, room: '16' },
    { day: 'רביעי', time: '15:30', familyName: 'לסר', firstName: 'שחר', duration: 45, room: '16' },
    { day: 'רביעי', time: '18:00', familyName: 'דרור', firstName: 'מטע', duration: 45, room: '16' },
    { day: 'רביעי', time: '19:45', familyName: 'רזאל', firstName: 'בארי', duration: 60, room: '16' },
    // יום ה' (Thursday) - Room 16
    { day: 'חמישי', time: '14:15', familyName: 'טיחונצ\'יק', firstName: 'אליסה', duration: 45, room: '16' },
    { day: 'חמישי', time: '15:00', familyName: 'חופרי', firstName: 'יובל', duration: 45, room: '16' },
    { day: 'חמישי', time: '15:45', familyName: 'מרגולין', firstName: 'הדר', duration: 60, room: '16' },
    { day: 'חמישי', time: '16:45', familyName: 'סויסה', firstName: 'פז', duration: 30, room: '16' },
    { day: 'חמישי', time: '17:15', familyName: 'סויסה', firstName: 'אגם', duration: 45, room: '16' },
    { day: 'חמישי', time: '18:00', familyName: 'בירמן', firstName: 'ביאנקה', duration: 30, room: '16' },
    { day: 'חמישי', time: '18:30', familyName: 'מילס', firstName: 'מלאכי', duration: 45, room: '16' },
    { day: 'חמישי', time: '19:15', familyName: 'שטראוס', firstName: 'שושנה', duration: 45, room: '16' },
  ],

  // -------------------------------------------------------------------------
  // לובה רבין - Luba Rabin - צ'לו
  // -------------------------------------------------------------------------
  'לובה רבין': [
    // יום ב' (Monday) - Room תיאוריה ב
    { day: 'שני', time: '14:30', familyName: 'יהודין', firstName: 'דוד', duration: 45, room: 'תיאוריה ב' },
    { day: 'שני', time: '15:15', familyName: 'מיכנובסקי', firstName: 'איתן', duration: 60, room: 'תיאוריה ב' },
    { day: 'שני', time: '16:15', familyName: 'ויינר', firstName: 'ציפורה', duration: 30, room: 'תיאוריה ב' },
    { day: 'שני', time: '16:45', familyName: 'עין צבי', firstName: 'גלעד', duration: 45, room: 'תיאוריה ב' },
    { day: 'שני', time: '17:45', familyName: 'פיש', firstName: 'יונתן', duration: 45, room: 'תיאוריה ב' },
    { day: 'שני', time: '18:30', familyName: 'שם טוב', firstName: 'שי', duration: 60, room: 'תיאוריה ב' },
    { day: 'שני', time: '19:30', familyName: 'זלצבורג', firstName: 'ברטה', duration: 45, room: 'תיאוריה ב' },
    { day: 'שני', time: '20:15', familyName: 'הרבר', firstName: 'מאיה', duration: 60, room: 'תיאוריה ב' },
    // יום ד' (Wednesday) - Room תיאוריה ב
    { day: 'רביעי', time: '14:30', familyName: 'יהודין', firstName: 'דוד', duration: 45, room: 'תיאוריה ב' },
    { day: 'רביעי', time: '15:15', familyName: 'גולוב', firstName: 'תום', duration: 30, room: 'תיאוריה ב' },
    { day: 'רביעי', time: '15:45', familyName: 'פיש', firstName: 'יונתן', duration: 30, room: 'תיאוריה ב' },
    { day: 'רביעי', time: '17:00', familyName: 'מיכנובסקי', firstName: 'איתן', duration: 60, room: 'תיאוריה ב' },
    { day: 'רביעי', time: '18:00', familyName: 'ויינר', firstName: 'ציפורה', duration: 30, room: 'תיאוריה ב' },
    { day: 'רביעי', time: '18:30', familyName: 'עין צבי', firstName: 'גלעד', duration: 45, room: 'תיאוריה ב' },
    { day: 'רביעי', time: '19:15', familyName: 'זלצבורג', firstName: 'ברטה', duration: 45, room: 'תיאוריה ב' },
    { day: 'רביעי', time: '20:00', familyName: 'הרבר', firstName: 'מאיה', duration: 60, room: 'תיאוריה ב' },
  ],
}

// ============================================================================
// SEEDER CLASS
// ============================================================================

class ComprehensiveScheduleSeeder {
  constructor() {
    this.client = null
    this.db = null
    this.stats = {
      teachersProcessed: 0,
      lessonsCreated: 0,
      lessonsSkipped: 0,
      studentsNotFound: [],
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

  calculateEndTime(startTime, duration) {
    const [hours, minutes] = startTime.split(':').map(Number)
    const totalMinutes = hours * 60 + minutes + duration
    const endHours = Math.floor(totalMinutes / 60)
    const endMins = totalMinutes % 60
    return `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`
  }

  async findStudent(familyName, firstName) {
    const studentCollection = this.db.collection('student')

    // Try multiple search patterns
    const patterns = [
      { 'personalInfo.fullName': new RegExp(`${familyName}.*${firstName}`, 'i') },
      { 'personalInfo.fullName': new RegExp(`${firstName}.*${familyName}`, 'i') },
      { 'personalInfo.fullName': new RegExp(`^${firstName}\\s+${familyName}`, 'i') },
      { 'personalInfo.fullName': new RegExp(`^${familyName}\\s+${firstName}`, 'i') },
    ]

    for (const pattern of patterns) {
      const student = await studentCollection.findOne(pattern)
      if (student) return student
    }

    // Try partial match on family name only
    const partialMatch = await studentCollection.findOne({
      'personalInfo.fullName': new RegExp(familyName, 'i')
    })

    return partialMatch
  }

  async findTeacher(teacherName) {
    const teacherCollection = this.db.collection('teacher')

    // Try exact match first
    let teacher = await teacherCollection.findOne({
      'personalInfo.fullName': teacherName
    })

    if (!teacher) {
      // Try partial match
      teacher = await teacherCollection.findOne({
        'personalInfo.fullName': new RegExp(teacherName.split(' ').join('.*'), 'i')
      })
    }

    return teacher
  }

  async clearTeacherSchedule(teacherId) {
    const teacherCollection = this.db.collection('teacher')
    await teacherCollection.updateOne(
      { _id: teacherId },
      { $set: { 'teaching.schedule': [] } }
    )
  }

  async processTeacher(teacherName, lessons) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`Processing: ${teacherName}`)
    console.log(`${'='.repeat(60)}`)

    const teacher = await this.findTeacher(teacherName)
    if (!teacher) {
      console.log(`  ⚠ Teacher not found: ${teacherName}`)
      this.stats.errors.push(`Teacher not found: ${teacherName}`)
      return
    }

    const teacherId = teacher._id.toString()
    console.log(`  Found teacher ID: ${teacherId}`)

    // Clear existing schedule
    await this.clearTeacherSchedule(teacher._id)
    console.log(`  Cleared existing schedule`)

    const studentCollection = this.db.collection('student')
    const teacherCollection = this.db.collection('teacher')

    let created = 0
    let notFound = []

    for (const lesson of lessons) {
      const student = await this.findStudent(lesson.familyName, lesson.firstName)

      if (!student) {
        notFound.push(`${lesson.familyName} ${lesson.firstName}`)
        continue
      }

      const studentId = student._id.toString()
      const studentName = student.personalInfo.fullName
      const endTime = this.calculateEndTime(lesson.time, lesson.duration)
      const instrument = student.academicInfo?.instrumentProgress?.[0]?.instrumentName || 'כינור'

      // Create schedule entry for teacher
      const scheduleEntry = {
        _id: new ObjectId().toString(),
        studentId: studentId,
        studentName: studentName,
        day: lesson.day,
        startTime: lesson.time,
        endTime: endTime,
        duration: lesson.duration,
        instrument: instrument,
        location: lesson.room,
        isRecurring: true,
        recurringType: 'weekly',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      // Add to teacher's schedule
      await teacherCollection.updateOne(
        { _id: teacher._id },
        {
          $push: { 'teaching.schedule': scheduleEntry },
          $addToSet: { 'teaching.studentIds': studentId }
        }
      )

      // Update student's teacherAssignments
      const assignmentData = {
        teacherId: teacherId,
        day: lesson.day,
        time: lesson.time,
        duration: lesson.duration,
        location: lesson.room,
        isActive: true,
        isRecurring: true,
        startDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }

      // Check if assignment exists for this day/time
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
        await studentCollection.updateOne(
          { _id: student._id },
          {
            $push: {
              teacherAssignments: assignmentData,
              'enrollments.teacherAssignments': assignmentData
            },
            $addToSet: { 'enrollments.teacherIds': teacherId }
          }
        )
      }

      created++
    }

    console.log(`  ✓ Created ${created} lessons`)
    if (notFound.length > 0) {
      console.log(`  ⚠ Students not found: ${notFound.join(', ')}`)
      this.stats.studentsNotFound.push(...notFound.map(n => `${teacherName}: ${n}`))
    }

    this.stats.teachersProcessed++
    this.stats.lessonsCreated += created
  }

  async run() {
    try {
      console.log('\n' + '='.repeat(70))
      console.log('  COMPREHENSIVE SCHEDULE SEEDER - ALL STRINGS TEACHERS')
      console.log('='.repeat(70))

      await this.connect()

      for (const [teacherName, lessons] of Object.entries(ALL_SCHEDULES)) {
        await this.processTeacher(teacherName, lessons)
      }

      // Summary
      console.log('\n' + '='.repeat(70))
      console.log('  SEEDING COMPLETE')
      console.log('='.repeat(70))
      console.log(`  Teachers processed: ${this.stats.teachersProcessed}`)
      console.log(`  Lessons created: ${this.stats.lessonsCreated}`)

      if (this.stats.studentsNotFound.length > 0) {
        console.log(`\n  Students not found (${this.stats.studentsNotFound.length}):`)
        this.stats.studentsNotFound.forEach(s => console.log(`    - ${s}`))
      }

      if (this.stats.errors.length > 0) {
        console.log(`\n  Errors:`)
        this.stats.errors.forEach(e => console.log(`    - ${e}`))
      }

      console.log('='.repeat(70) + '\n')

    } catch (error) {
      console.error('Error:', error)
      process.exit(1)
    } finally {
      await this.disconnect()
    }
  }
}

// Run
const seeder = new ComprehensiveScheduleSeeder()
seeder.run()
