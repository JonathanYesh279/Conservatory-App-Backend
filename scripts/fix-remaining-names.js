/**
 * Fix Remaining Student Names
 * Reverses names from "LastName FirstName" to "FirstName LastName"
 */

import 'dotenv/config';
import { MongoClient } from 'mongodb';
import XLSX from 'xlsx';

const STUDENT_FILE = '/mnt/c/Projects/conservatory-app/מידע/תלמידים -כלי קשת.xlsx';
const stringsInstruments = ['כינור', 'ויולה', 'נבל', "צ'לו", 'צלו', 'קונטרבס'];

function reverseName(name) {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 2) {
    return `${parts[1]} ${parts[0]}`;
  } else if (parts.length === 3) {
    return `${parts[2]} ${parts[0]} ${parts[1]}`;
  } else if (parts.length === 4) {
    return `${parts[3]} ${parts[0]} ${parts[1]} ${parts[2]}`;
  }
  return name;
}

async function fixNames() {
  // Read Excel to get the original names (LastName FirstName format)
  const workbook = XLSX.readFile(STUDENT_FILE);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const excelData = XLSX.utils.sheet_to_json(sheet);

  const excelNames = new Set(excelData.map(r => r['שם משתתף']).filter(Boolean));

  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db(process.env.MONGODB_NAME || 'Conservatory-DB');

  console.log('=== Reversing Student Names ===\n');

  const students = await db.collection('student').find({
    'academicInfo.instrumentProgress.instrumentName': { $in: stringsInstruments }
  }).toArray();

  let fixed = 0;
  for (const student of students) {
    const dbName = student.personalInfo?.fullName;
    if (excelNames.has(dbName)) {
      const newName = reverseName(dbName);
      await db.collection('student').updateOne(
        { _id: student._id },
        { $set: { 'personalInfo.fullName': newName } }
      );
      console.log(`  ✓ "${dbName}" -> "${newName}"`);
      fixed++;
    }
  }

  console.log(`\nFixed ${fixed} student names`);
  await client.close();
}

fixNames().catch(console.error);
