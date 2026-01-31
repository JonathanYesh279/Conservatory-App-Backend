/**
 * Verify and Fix All Students
 *
 * Based on the complete Excel student list, this script:
 * 1. Verifies all students exist in the database
 * 2. Checks they're linked to the correct teacher
 * 3. Fixes any mismatches
 */

import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';

// Complete student list from Excel (שם חוג = teacher, שם משתתף = student)
const excelStudents = [
  { teacher: 'לוין ורוניקה', student: 'יליזרוב נועה', instrument: 'כינור' },
  { teacher: 'קוטליאר אלונה', student: 'רזאל בארי שולמית', instrument: 'כינור' },
  { teacher: 'פורמן נטליה', student: 'פריזה הראל', instrument: 'כינור' },
  { teacher: 'זיסקינד מרינה', student: 'דמבו בן יוחנה ללה', instrument: 'כינור' },
  { teacher: 'פורמן נטליה', student: 'אליהו אוריאל', instrument: 'כינור' },
  { teacher: 'זיסקינד מרינה', student: 'פיש דניאל', instrument: 'כינור' },
  { teacher: 'זיסקינד מרינה', student: 'רזאל זוהר ישעיהו', instrument: 'כינור' },
  { teacher: 'ארונזון אנה', student: 'פרץ ליהיא', instrument: 'כינור' },
  { teacher: 'אברהם סבטלנה', student: 'נייטס אלה', instrument: 'כינור' },
  { teacher: 'לוין ורוניקה', student: 'קאשני מזרחי שיר', instrument: 'כינור' },
  { teacher: 'פורמן נטליה', student: 'קסוטו מרים ברכה', instrument: 'כינור' },
  { teacher: 'לוין ורוניקה', student: 'בן הרוש שנה', instrument: 'כינור' },
  { teacher: 'אברהם סבטלנה', student: 'שראיזין איתי', instrument: 'כינור' },
  { teacher: 'ארונזון אנה', student: 'פאסי יעל', instrument: 'כינור' },
  { teacher: 'קוטליאר אלונה', student: 'לסר שחר', instrument: 'כינור' },
  { teacher: 'זיסקינד מרינה', student: 'שורץ ציגלר כחל', instrument: 'כינור' },
  { teacher: 'לוין ורוניקה', student: 'יעקב הכהן גאיה', instrument: 'כינור' },
  { teacher: 'אברהם סבטלנה', student: 'סורקין שרה ליה', instrument: 'כינור' },
  { teacher: 'קוטליאר אלונה', student: 'מילס טרכטנברג מלאכי ישראל', instrument: 'כינור' },
  { teacher: 'אברהם סבטלנה', student: 'אלחרט שרה', instrument: 'כינור' },
  { teacher: 'זיסקינד מרינה', student: 'תמרקין אורי', instrument: 'כינור' },
  { teacher: 'קוטליאר אלונה', student: 'אלטמן אמה', instrument: 'כינור' },
  { teacher: 'לוין ורוניקה', student: 'שם טוב שירה', instrument: 'כינור' },
  { teacher: 'קוטליאר אלונה', student: 'סויסה פז', instrument: 'כינור' },
  { teacher: 'לוין ורוניקה', student: 'שם טוב קרולין', instrument: 'כינור' },
  { teacher: 'סלטקין אלה', student: 'לוי לילה', instrument: 'כינור' },
  { teacher: 'ארונזון אנה', student: 'מעוז מתן', instrument: 'כינור' },
  { teacher: 'קוטליאר אלונה', student: 'שטראוס שושנה', instrument: 'כינור' },
  { teacher: 'קוטליאר אלונה', student: 'מרגולין הדר', instrument: 'כינור' },
  { teacher: 'זיסקינד מרינה', student: 'ברקוביץ אדם', instrument: 'כינור' },
  { teacher: 'קוטליאר אלונה', student: 'חופרי יובל', instrument: 'כינור' },
  { teacher: 'פורמן נטליה', student: 'קלין נועה', instrument: 'כינור' },
  { teacher: 'זיסקינד מרינה', student: 'גוטמן נעמי', instrument: 'כינור' },
  { teacher: 'פורמן נטליה', student: 'מירון יאיר', instrument: 'כינור' },
  { teacher: 'לוין ורוניקה', student: 'הולנד יעל אלישבע', instrument: 'כינור' },
  { teacher: 'זיסקינד מרינה', student: 'שוורץ אלה סופיה שרה', instrument: 'כינור' },
  { teacher: 'זיסקינד מרינה', student: 'רוזן יולי', instrument: 'כינור' },
  { teacher: 'אברהם סבטלנה', student: 'שינברג צדוק ניתאי', instrument: 'כינור' },
  { teacher: 'ארונזון אנה', student: 'מעוז היילי רבקה', instrument: 'כינור' },
  { teacher: 'זיסקינד מרינה', student: 'סויברט עלמה', instrument: 'כינור' },
  { teacher: 'זיסקינד מרינה', student: 'מירושניק איתמר', instrument: 'כינור' },
  { teacher: 'לוין ורוניקה', student: 'שם טוב הילה', instrument: 'כינור' },
  { teacher: 'לוין ורוניקה', student: 'אליהו שירה', instrument: 'כינור' },
  { teacher: 'זיסקינד מרינה', student: 'ויינברג שרה', instrument: 'כינור' },
  { teacher: 'קוטליאר אלונה', student: 'דרור מטע יובל', instrument: 'כינור' },
  { teacher: 'לוין ורוניקה', student: 'אנטונוב אליזבטה', instrument: 'כינור' },
  { teacher: 'ארונזון אנה', student: 'שמלה אנאיס חנה', instrument: 'כינור' },
  { teacher: 'לוין ורוניקה', student: 'סורקין איתן', instrument: 'כינור' },
  { teacher: 'ארונזון אנה', student: 'רויטמן רוני', instrument: 'כינור' },
  { teacher: 'קוטליאר אלונה', student: 'סויסה אגם', instrument: 'כינור' },
  { teacher: 'פורמן נטליה', student: 'אברהם רקפת', instrument: 'כינור' },
  { teacher: 'זיסקינד מרינה', student: 'כהן אביגיל', instrument: 'כינור' },
  { teacher: 'אברהם סבטלנה', student: 'ויינר אדר משה', instrument: 'כינור' },
  { teacher: 'אברהם סבטלנה', student: 'בן זמרה אגם שרה', instrument: 'כינור' },
  { teacher: 'קוטליאר אלונה', student: 'בירמן ויסוצקי ביאנקה', instrument: 'כינור' },
  { teacher: 'לוין ורוניקה', student: 'יחזקאל שרה', instrument: 'כינור' },
  { teacher: 'אברהם סבטלנה', student: 'סופיר ליטל', instrument: 'כינור' },
  { teacher: 'ארונזון אנה', student: 'מעוז תהל-אור ליה', instrument: 'כינור' },
  { teacher: 'זיסקינד מרינה', student: 'קרים אביטל', instrument: 'כינור' },
  { teacher: 'פורמן נטליה', student: 'ישעיה שירה זכה ישעיה', instrument: 'כינור' },
  { teacher: 'זיסקינד מרינה', student: 'גולדברג מארק', instrument: 'כינור' },
  { teacher: 'זיסקינד מרינה', student: 'בלנקי דמיטרי', instrument: 'כינור' },
  { teacher: 'ארונזון אנה', student: 'כהן פרל', instrument: 'כינור' },
  { teacher: 'קוטליאר אלונה', student: 'טיהונצ\'וק אליסה', instrument: 'כינור' },
  { teacher: 'פורמן נטליה', student: 'שמיר גילי', instrument: 'כינור' },
  // Viola
  { teacher: 'זיסקינד מרינה', student: 'איגוס איתן', instrument: 'ויולה' },
  { teacher: 'זיסקינד מרינה', student: 'מירושניק איתמר', instrument: 'ויולה' },
  // Harp
  { teacher: 'סוחובוק זינה', student: 'פיכמן טאיה', instrument: 'נבל' },
  { teacher: 'סוחובוק זינה', student: 'קליין אוראליה', instrument: 'נבל' },
  { teacher: 'סוחובוק זינה', student: 'אבן עזריה זהר', instrument: 'נבל' },
  { teacher: 'סוחובוק זינה', student: 'שחר אור', instrument: 'נבל' },
  { teacher: 'סוחובוק זינה', student: 'אבו אוו', instrument: 'נבל' },
  { teacher: 'סוחובוק זינה', student: 'עוז מוניקה', instrument: 'נבל' },
  // Cello
  { teacher: 'ברגמן מרסל', student: 'גרנצרז\' אוהד', instrument: "צ'לו" },
  { teacher: 'מלצר הרן', student: 'קבנור ירדן', instrument: "צ'לו" },
  { teacher: 'רבין לובה', student: 'עין צבי גלעד', instrument: "צ'לו" },
  { teacher: 'פלדמן אלסיה', student: 'זהבי רעננה', instrument: "צ'לו" },
  { teacher: 'רבין לובה', student: 'מיכנובסקי איתן', instrument: "צ'לו" },
  { teacher: 'רבין לובה', student: 'פיש יונתן', instrument: "צ'לו" },
  { teacher: 'פלדמן אלסיה', student: 'לכמן אמה גל', instrument: "צ'לו" },
  { teacher: 'פלדמן אלסיה', student: 'גיברה פיינברג נהורה', instrument: "צ'לו" },
  { teacher: 'רבין לובה', student: 'Yehudin David', instrument: "צ'לו" },
  { teacher: 'פלדמן אלסיה', student: 'גרונשטיין אדל', instrument: "צ'לו" },
  { teacher: 'רבין לובה', student: 'שם טוב שי', instrument: "צ'לו" },
  { teacher: 'ברגמן מרסל', student: 'רוטקופ שקד רחל', instrument: "צ'לו" },
  { teacher: 'ברגמן מרסל', student: 'חן מיקה', instrument: "צ'לו" },
  { teacher: 'רבין לובה', student: 'הרבר מאיה', instrument: "צ'לו" },
  { teacher: 'רבין לובה', student: 'זלצבורג ברטה', instrument: "צ'לו" },
  { teacher: 'פלדמן אלסיה', student: 'FISCHEL ELIANA', instrument: "צ'לו" },
  { teacher: 'רבין לובה', student: 'גולוב תום', instrument: "צ'לו" },
  { teacher: 'פלדמן אלסיה', student: 'שם טוב נעמי', instrument: "צ'לו" },
  { teacher: 'רבין לובה', student: 'ויינר צפורה', instrument: "צ'לו" },
  { teacher: 'פלדמן אלסיה', student: 'נבו נעמה', instrument: "צ'לו" },
  { teacher: 'ברגמן מרסל', student: 'קרבלניק בן', instrument: "צ'לו" },
  { teacher: 'פלדמן אלסיה', student: 'עופר מרים הדסה', instrument: "צ'לו" },
  { teacher: 'פלדמן אלסיה', student: 'ריבלוב פולינה', instrument: "צ'לו" },
  // Double Bass
  { teacher: 'גילנסון מרק', student: 'הולצר ראובן', instrument: 'קונטרבס' },
  { teacher: 'גילנסון מרק', student: 'מיכנובסקי אליסה', instrument: 'קונטרבס' },
  { teacher: 'גילנסון מרק', student: 'מנדה יונה', instrument: 'קונטרבס' },
  { teacher: 'גילנסון מרק', student: 'מויאל דניאל', instrument: 'קונטרבס' },
  { teacher: 'בן חורין דניאל', student: 'ביאליק איתמר', instrument: 'קונטרבס' },
  { teacher: 'גילנסון מרק', student: 'סלטקין דן', instrument: 'קונטרבס' },
  { teacher: 'גילנסון מרק', student: 'דרור קדם נצן', instrument: 'קונטרבס' },
  { teacher: 'גילנסון מרק', student: 'פטרוסיאן סופיה', instrument: 'קונטרבס' },
];

// Name matching utilities
function normalizeName(name) {
  if (!name) return '';
  return name
    .toString()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\u0590-\u05FFa-zA-Z\s\-\']/g, '')
    .toLowerCase();
}

function getNameParts(name) {
  return normalizeName(name).split(' ').filter(p => p.length > 1);
}

function namesMatch(name1, name2) {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);

  if (n1 === n2) return true;

  const parts1 = getNameParts(name1);
  const parts2 = getNameParts(name2);

  // Check if main parts match (allowing for reversed order)
  if (parts1.length >= 2 && parts2.length >= 2) {
    const matches = parts1.filter(p => parts2.some(p2 => p2.includes(p) || p.includes(p2)));
    if (matches.length >= 2) return true;
  }

  return false;
}

async function verifyAndFix() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db(process.env.MONGODB_NAME || 'Conservatory-DB');

  console.log('============================================================');
  console.log('  VERIFY AND FIX ALL STUDENTS');
  console.log('============================================================\n');

  // Get all teachers
  const teachers = await db.collection('teacher').find({}).toArray();
  const teacherMap = new Map();

  teachers.forEach(t => {
    const name = t.personalInfo?.fullName;
    if (name) {
      teacherMap.set(normalizeName(name), t._id.toString());
      // Also map reversed names
      const parts = name.split(' ');
      if (parts.length === 2) {
        teacherMap.set(normalizeName(`${parts[1]} ${parts[0]}`), t._id.toString());
      }
    }
  });

  console.log(`Loaded ${teachers.length} teachers\n`);

  // Get school year
  const schoolYear = await db.collection('school_year').findOne({ isCurrent: true });
  const schoolYearId = schoolYear?._id?.toString();

  // Process each student from Excel
  let studentsCreated = 0;
  let studentsUpdated = 0;
  let studentsCorrect = 0;
  let studentsFailed = 0;

  console.log('--- Processing Students ---\n');

  for (const excelStudent of excelStudents) {
    const { teacher: teacherName, student: studentName, instrument } = excelStudent;

    // Skip "מורה אחר"
    if (teacherName === 'מורה אחר') continue;

    // Find teacher ID
    let teacherId = teacherMap.get(normalizeName(teacherName));
    if (!teacherId) {
      // Try reversed
      const parts = teacherName.split(' ');
      if (parts.length === 2) {
        teacherId = teacherMap.get(normalizeName(`${parts[1]} ${parts[0]}`));
      }
    }

    if (!teacherId) {
      console.log(`⚠️ Teacher not found: ${teacherName} (for student: ${studentName})`);
      studentsFailed++;
      continue;
    }

    // Search for student in database
    const studentParts = getNameParts(studentName);
    let dbStudent = null;

    // Try exact match first
    dbStudent = await db.collection('student').findOne({
      'personalInfo.fullName': { $regex: studentParts[0], $options: 'i' }
    });

    // If found, verify it's the right student
    if (dbStudent && !namesMatch(dbStudent.personalInfo?.fullName, studentName)) {
      // Search more specifically
      const allMatches = await db.collection('student').find({
        'personalInfo.fullName': { $regex: studentParts[0], $options: 'i' }
      }).toArray();

      dbStudent = allMatches.find(s => namesMatch(s.personalInfo?.fullName, studentName));
    }

    if (!dbStudent) {
      // Student doesn't exist - create them
      console.log(`Creating: ${studentName} -> ${teacherName}`);

      // Reverse name for DB (FirstName LastName format)
      const nameParts = studentName.trim().split(/\s+/);
      let fullName = studentName;
      if (nameParts.length === 2) {
        fullName = `${nameParts[1]} ${nameParts[0]}`;
      } else if (nameParts.length >= 3) {
        fullName = `${nameParts[nameParts.length - 1]} ${nameParts.slice(0, -1).join(' ')}`;
      }

      const newStudent = {
        personalInfo: {
          fullName: fullName,
          phone: '',
          age: null,
          address: '',
          parentName: '',
          parentPhone: '',
          parentEmail: '',
          studentEmail: ''
        },
        academicInfo: {
          instrumentProgress: [{
            instrumentName: instrument,
            isPrimary: true,
            currentStage: 1
          }],
          class: 'אחר',
          tests: {
            stageTest: { status: 'לא נבחן', lastTestDate: null, nextTestDate: null, notes: '' },
            technicalTest: { status: 'לא נבחן', lastTestDate: null, nextTestDate: null, notes: '' }
          }
        },
        teacherIds: [teacherId],
        teacherAssignments: [{
          teacherId: teacherId,
          day: null,
          time: null,
          duration: 45,
          isActive: true,
          startDate: new Date(),
          isRecurring: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }],
        enrollments: {
          orchestraIds: [],
          ensembleIds: [],
          schoolYears: [{ schoolYearId: schoolYearId, isActive: true }],
          theoryLessonIds: [],
          teacherIds: [teacherId],
          teacherAssignments: [{
            teacherId: teacherId,
            day: null,
            time: null,
            duration: 45,
            isActive: true,
            startDate: new Date(),
            isRecurring: true,
            createdAt: new Date(),
            updatedAt: new Date()
          }]
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await db.collection('student').insertOne(newStudent);

      // Add to teacher's studentIds
      await db.collection('teacher').updateOne(
        { _id: new ObjectId(teacherId) },
        { $addToSet: { 'teaching.studentIds': result.insertedId.toString() } }
      );

      studentsCreated++;
      continue;
    }

    // Student exists - check if linked to correct teacher
    const currentTeacherIds = dbStudent.teacherIds || [];

    if (currentTeacherIds.includes(teacherId)) {
      // Already correct
      studentsCorrect++;
      continue;
    }

    // Need to update - student is linked to wrong teacher or not linked
    console.log(`Updating: ${dbStudent.personalInfo?.fullName}`);
    console.log(`  Current teacher: ${currentTeacherIds.join(', ') || 'none'}`);
    console.log(`  Should be: ${teacherId} (${teacherName})`);

    // Update student's teacherIds and teacherAssignments
    await db.collection('student').updateOne(
      { _id: dbStudent._id },
      {
        $set: {
          teacherIds: [teacherId],
          teacherAssignments: [{
            teacherId: teacherId,
            day: null,
            time: null,
            duration: 45,
            isActive: true,
            startDate: new Date(),
            isRecurring: true,
            createdAt: new Date(),
            updatedAt: new Date()
          }],
          'enrollments.teacherIds': [teacherId],
          'enrollments.teacherAssignments': [{
            teacherId: teacherId,
            day: null,
            time: null,
            duration: 45,
            isActive: true,
            startDate: new Date(),
            isRecurring: true,
            createdAt: new Date(),
            updatedAt: new Date()
          }]
        }
      }
    );

    // Remove from old teacher(s)
    for (const oldTeacherId of currentTeacherIds) {
      if (oldTeacherId !== teacherId) {
        await db.collection('teacher').updateOne(
          { _id: new ObjectId(oldTeacherId) },
          { $pull: { 'teaching.studentIds': dbStudent._id.toString() } }
        );
      }
    }

    // Add to new teacher
    await db.collection('teacher').updateOne(
      { _id: new ObjectId(teacherId) },
      { $addToSet: { 'teaching.studentIds': dbStudent._id.toString() } }
    );

    studentsUpdated++;
  }

  // Sync all teacher studentIds
  console.log('\n--- Syncing Teacher StudentIds ---\n');

  const stringsInstruments = ['כינור', 'ויולה', 'נבל', "צ'לו", 'צלו', 'קונטרבס'];
  const stringsTeachers = await db.collection('teacher').find({
    'professionalInfo.instrument': { $in: stringsInstruments }
  }).toArray();

  for (const teacher of stringsTeachers) {
    const teacherId = teacher._id.toString();

    const linkedStudents = await db.collection('student').find({
      teacherIds: teacherId
    }).toArray();

    const correctStudentIds = linkedStudents.map(s => s._id.toString());

    await db.collection('teacher').updateOne(
      { _id: teacher._id },
      { $set: { 'teaching.studentIds': correctStudentIds } }
    );
  }

  // Final summary
  console.log('\n============================================================');
  console.log('  SUMMARY');
  console.log('============================================================\n');

  console.log(`Students created: ${studentsCreated}`);
  console.log(`Students updated: ${studentsUpdated}`);
  console.log(`Students already correct: ${studentsCorrect}`);
  console.log(`Students failed: ${studentsFailed}`);

  // Final teacher counts
  console.log('\n--- Final Teacher Student Counts ---\n');

  for (const teacher of stringsTeachers) {
    const count = await db.collection('student').countDocuments({
      teacherIds: teacher._id.toString()
    });
    console.log(`${teacher.personalInfo?.fullName}: ${count} students`);
  }

  await client.close();

  console.log('\n============================================================');
  console.log('  COMPLETE');
  console.log('============================================================');
}

verifyAndFix().catch(console.error);
