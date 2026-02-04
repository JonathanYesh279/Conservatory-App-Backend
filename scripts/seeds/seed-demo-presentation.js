/**
 * DEMO PRESENTATION SEED SCRIPT
 * ==============================
 * Seeds the DEMO database with mock students and teachers for presentation.
 *
 * SAFETY FEATURES:
 * 1. Requires explicit DEMO_MONGODB_URI environment variable
 * 2. Validates database name contains "demo" (case-insensitive)
 * 3. Asks for confirmation before proceeding
 * 4. Will NOT touch production database
 *
 * USAGE:
 * ------
 * Set environment variable and run:
 *   DEMO_MONGODB_URI="mongodb+srv://...your-demo-connection-string..." node scripts/seeds/seed-demo-presentation.js
 *
 * Or create a .env.demo file and use:
 *   node --env-file=.env.demo scripts/seeds/seed-demo-presentation.js
 */

import { MongoClient, ObjectId } from 'mongodb';
import readline from 'readline';

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEMO_URI = process.env.DEMO_MONGODB_URI;
const DEMO_DB_NAME = process.env.DEMO_MONGODB_NAME || 'Demo-Conservatory-DB';

// Safety check patterns
const PRODUCTION_PATTERNS = ['conservatory-db', 'production', 'prod'];
const DEMO_REQUIRED_PATTERN = /demo/i;

// ============================================================================
// MOCK DATA GENERATORS
// ============================================================================

const VALID_INSTRUMENTS = [
  'חלילית', 'חליל צד', 'אבוב', 'בסון', 'סקסופון', 'קלרינט',
  'חצוצרה', 'קרן יער', 'טרומבון', 'טובה/בריטון', 'שירה',
  'כינור', 'ויולה', "צ'לו", 'קונטרבס', 'פסנתר', 'גיטרה', 'גיטרה בס', 'תופים'
];

const VALID_CLASSES = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'יא', 'יב'];
const VALID_STAGES = [1, 2, 3, 4, 5, 6, 7, 8];
const VALID_ROLES = ['מורה', 'מנצח', 'מדריך הרכב', 'מנהל', 'מורה תאוריה'];

// Hebrew first names (common Israeli names)
const FIRST_NAMES = [
  'נועה', 'תמר', 'מיכל', 'שירה', 'יעל', 'רוני', 'דנה', 'ליאור', 'מאיה', 'אביגיל',
  'יונתן', 'איתי', 'עומר', 'גיא', 'אורי', 'רועי', 'תומר', 'אדם', 'יובל', 'איתמר',
  'עדי', 'שקד', 'אלון', 'נועם', 'עמית', 'אריאל', 'רון', 'בר', 'טל', 'שחר'
];

// Hebrew last names (common Israeli surnames)
const LAST_NAMES = [
  'כהן', 'לוי', 'מזרחי', 'פרץ', 'ביטון', 'אברהם', 'פרידמן', 'דוד', 'שלום', 'יוסף',
  'אזולאי', 'שפירא', 'גולן', 'רוזנברג', 'אלון', 'בנימין', 'גבאי', 'דהן', 'הרוש', 'ועקנין',
  'זהבי', 'חדד', 'טובי', 'ישראלי', 'כץ', 'לביא', 'מלכה', 'נחום', 'סבג', 'עמר'
];

// Israeli cities/neighborhoods
const ADDRESSES = [
  'רחוב הרצל 12, תל אביב',
  'רחוב ויצמן 45, רעננה',
  'רחוב אחד העם 8, פתח תקווה',
  'רחוב ביאליק 23, רמת גן',
  'רחוב הגפן 5, הרצליה',
  'רחוב האלון 67, כפר סבא',
  'רחוב הזית 34, הוד השרון',
  'רחוב התמר 19, רמת השרון',
  'רחוב הברוש 42, גבעתיים',
  'רחוב הדקל 15, נתניה'
];

// Helper functions
function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomPhone() {
  const prefixes = ['050', '052', '053', '054', '055', '058'];
  const prefix = randomElement(prefixes);
  const number = Math.floor(Math.random() * 9000000) + 1000000;
  return `${prefix}${number}`;
}

function randomEmail(firstName, lastName) {
  const domains = ['gmail.com', 'walla.co.il', 'hotmail.com', 'yahoo.com'];
  const cleanFirst = firstName.replace(/[^א-ת]/g, '');
  const cleanLast = lastName.replace(/[^א-ת]/g, '');
  // Transliterate to simple latin for email
  const latinFirst = transliterate(cleanFirst);
  const latinLast = transliterate(cleanLast);
  return `${latinFirst}.${latinLast}${Math.floor(Math.random() * 100)}@${randomElement(domains)}`;
}

// Simple Hebrew to Latin transliteration
function transliterate(hebrew) {
  const map = {
    'א': 'a', 'ב': 'b', 'ג': 'g', 'ד': 'd', 'ה': 'h', 'ו': 'v', 'ז': 'z',
    'ח': 'ch', 'ט': 't', 'י': 'y', 'כ': 'k', 'ך': 'k', 'ל': 'l', 'מ': 'm',
    'ם': 'm', 'נ': 'n', 'ן': 'n', 'ס': 's', 'ע': 'a', 'פ': 'p', 'ף': 'p',
    'צ': 'tz', 'ץ': 'tz', 'ק': 'k', 'ר': 'r', 'ש': 'sh', 'ת': 't'
  };
  return hebrew.split('').map(c => map[c] || c).join('');
}

// ============================================================================
// DATA GENERATORS
// ============================================================================

function generateStudent(index) {
  const firstName = randomElement(FIRST_NAMES);
  const lastName = randomElement(LAST_NAMES);
  const fullName = `${firstName} ${lastName}`;
  const instrument = randomElement(VALID_INSTRUMENTS);
  const studentClass = randomElement(VALID_CLASSES);
  const stage = randomElement(VALID_STAGES.slice(0, 5)); // Stages 1-5 more common

  return {
    _id: new ObjectId(),
    personalInfo: {
      fullName: fullName,
      phone: randomPhone(),
      age: Math.floor(Math.random() * 10) + 8, // Ages 8-17
      address: randomElement(ADDRESSES),
      parentName: `${randomElement(FIRST_NAMES)} ${lastName}`,
      parentPhone: randomPhone(),
      parentEmail: randomEmail(firstName, lastName),
      studentEmail: null
    },
    academicInfo: {
      instrumentProgress: [
        {
          instrumentName: instrument,
          isPrimary: true,
          currentStage: stage,
          tests: {
            stageTest: {
              status: 'לא נבחן',
              lastTestDate: null,
              nextTestDate: null,
              notes: ''
            },
            technicalTest: {
              status: 'לא נבחן',
              lastTestDate: null,
              nextTestDate: null,
              notes: ''
            }
          }
        }
      ],
      class: studentClass,
      tests: {}
    },
    enrollments: {
      orchestraIds: [],
      ensembleIds: [],
      theoryLessonIds: [],
      schoolYears: []
    },
    teacherIds: [],
    teacherAssignments: [],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

function generateTeacher(index, instrument = null) {
  const firstName = randomElement(FIRST_NAMES);
  const lastName = randomElement(LAST_NAMES);
  const fullName = `${firstName} ${lastName}`;
  const email = randomEmail(firstName, lastName);
  const phone = randomPhone();
  const teacherInstrument = instrument || randomElement(VALID_INSTRUMENTS);

  // Most teachers are regular teachers, some have additional roles
  const roles = ['מורה'];
  if (Math.random() > 0.7) {
    roles.push(randomElement(['מנצח', 'מדריך הרכב']));
  }

  return {
    _id: new ObjectId(),
    personalInfo: {
      fullName: fullName,
      phone: phone,
      email: email,
      address: randomElement(ADDRESSES)
    },
    roles: roles,
    professionalInfo: {
      instrument: teacherInstrument,
      isActive: true
    },
    teaching: {
      studentIds: [],
      schedule: [],
      timeBlocks: []
    },
    conducting: {
      orchestraIds: []
    },
    ensemblesIds: [],
    schoolYears: [],
    credentials: {
      email: email,
      password: null, // Will use invitation system
      isInvitationAccepted: false
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

// ============================================================================
// SAFETY CHECKS
// ============================================================================

function validateConnectionString(uri) {
  if (!uri) {
    console.error('\n❌ ERROR: DEMO_MONGODB_URI environment variable is not set!');
    console.error('\nUsage:');
    console.error('  DEMO_MONGODB_URI="your-demo-connection-string" node scripts/seeds/seed-demo-presentation.js');
    console.error('\nThis is a safety feature to prevent accidentally seeding production.');
    return false;
  }

  // Check if URI looks like production
  const uriLower = uri.toLowerCase();
  for (const pattern of PRODUCTION_PATTERNS) {
    if (uriLower.includes(pattern) && !uriLower.includes('demo')) {
      console.error(`\n❌ ERROR: Connection string appears to be PRODUCTION!`);
      console.error(`   Pattern found: "${pattern}"`);
      console.error('\nThis script only works with demo databases.');
      console.error('Please use a demo/staging connection string.');
      return false;
    }
  }

  return true;
}

function validateDatabaseName(dbName) {
  if (!DEMO_REQUIRED_PATTERN.test(dbName)) {
    console.warn(`\n⚠️  WARNING: Database name "${dbName}" does not contain "demo".`);
    console.warn('   This might not be the demo database!');
    return false;
  }
  return true;
}

async function askConfirmation(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

// ============================================================================
// MAIN SEEDING FUNCTION
// ============================================================================

async function seedDemoDatabase() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║       CONSERVATORY DEMO DATABASE SEEDING SCRIPT              ║');
  console.log('║                   (Safe Mode Enabled)                        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Step 1: Validate connection string
  if (!validateConnectionString(DEMO_URI)) {
    process.exit(1);
  }

  // Step 2: Connect to database
  console.log('📡 Connecting to database...');
  let client;
  try {
    client = new MongoClient(DEMO_URI);
    await client.connect();
    console.log('✅ Connected successfully!\n');
  } catch (error) {
    console.error('❌ Failed to connect:', error.message);
    process.exit(1);
  }

  const db = client.db(DEMO_DB_NAME);

  // Step 3: Validate database name
  const dbNameValid = validateDatabaseName(DEMO_DB_NAME);

  // Step 4: Show current database info
  console.log('📋 Database Information:');
  console.log(`   URI: ${DEMO_URI.substring(0, 50)}...`);
  console.log(`   Database: ${DEMO_DB_NAME}`);

  // Check existing data
  const existingStudents = await db.collection('student').countDocuments();
  const existingTeachers = await db.collection('teacher').countDocuments();
  console.log(`\n📊 Existing Data:`);
  console.log(`   Students: ${existingStudents}`);
  console.log(`   Teachers: ${existingTeachers}`);

  // Step 5: Confirm before proceeding
  console.log('\n⚠️  This script will INSERT new data (not replace existing).');
  console.log('   New records: 30 students, 10 teachers\n');

  if (!dbNameValid) {
    console.log('🔴 Database name does not contain "demo" - extra caution required!');
  }

  const confirmed = await askConfirmation('Do you want to proceed? (y/N): ');

  if (!confirmed) {
    console.log('\n❌ Seeding cancelled by user.');
    await client.close();
    process.exit(0);
  }

  // Step 6: Generate mock data
  console.log('\n🔄 Generating mock data...');

  // Generate teachers with varied instruments (ensure instrument coverage)
  const instrumentsForTeachers = [
    'כינור', 'ויולה', "צ'לו", 'פסנתר', 'חלילית',
    'קלרינט', 'חצוצרה', 'גיטרה', 'סקסופון', 'תופים'
  ];

  const teachers = instrumentsForTeachers.map((instrument, index) =>
    generateTeacher(index, instrument)
  );

  const students = Array.from({ length: 30 }, (_, index) => generateStudent(index));

  console.log(`   Generated ${teachers.length} teachers`);
  console.log(`   Generated ${students.length} students`);

  // Step 7: Insert data
  console.log('\n📥 Inserting teachers...');
  const teacherResult = await db.collection('teacher').insertMany(teachers);
  console.log(`   ✅ Inserted ${teacherResult.insertedCount} teachers`);

  console.log('\n📥 Inserting students...');
  const studentResult = await db.collection('student').insertMany(students);
  console.log(`   ✅ Inserted ${studentResult.insertedCount} students`);

  // Step 8: Summary
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    SEEDING COMPLETE!                         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('\n📊 Final Database State:');
  const finalStudents = await db.collection('student').countDocuments();
  const finalTeachers = await db.collection('teacher').countDocuments();
  console.log(`   Students: ${finalStudents} (added ${studentResult.insertedCount})`);
  console.log(`   Teachers: ${finalTeachers} (added ${teacherResult.insertedCount})`);

  // Print sample teacher IDs for reference (useful for manual relationships)
  console.log('\n📝 Teacher IDs for reference (use these for manual assignments):');
  teachers.forEach(t => {
    console.log(`   ${t._id} - ${t.personalInfo.fullName} (${t.professionalInfo.instrument})`);
  });

  await client.close();
  console.log('\n✅ Database connection closed.');
}

// ============================================================================
// RUN
// ============================================================================

seedDemoDatabase().catch(console.error);
