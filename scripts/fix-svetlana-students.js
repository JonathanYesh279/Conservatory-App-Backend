/**
 * Fix Students for סבטלנה אברהם
 *
 * These students are incorrectly linked to אנה ארונזון
 * but should be under סבטלנה אברהם according to the Excel file.
 */

import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';

// Students that should be under סבטלנה אברהם (based on Excel)
const svetlanaStudents = [
  { search: 'אלחרט', fullSearch: 'שרה' },
  { search: 'ויינר אדר', fullSearch: null },
  { search: 'סורקין שרה', fullSearch: null },
  { search: 'נייטס', fullSearch: 'אלה' },
  { search: 'שראיזין', fullSearch: 'איתי' },
  { search: 'סופיר', fullSearch: 'ליטל' },
  { search: 'בן זמרה', fullSearch: 'אגם' },
  { search: 'צדוק', fullSearch: 'ניתאי' }
];

async function fix() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db(process.env.MONGODB_NAME || 'Conservatory-DB');

  console.log('=== Fixing Students for סבטלנה אברהם ===\n');

  // Get סבטלנה אברהם
  const svetlana = await db.collection('teacher').findOne({
    'personalInfo.fullName': { $regex: 'סבטלנה', $options: 'i' }
  });

  if (!svetlana) {
    console.log('ERROR: סבטלנה אברהם not found');
    await client.close();
    return;
  }

  const svetlanaId = svetlana._id.toString();
  console.log(`סבטלנה אברהם ID: ${svetlanaId}`);
  console.log(`Current students: ${svetlana.teaching?.studentIds?.length || 0}\n`);

  // Get אנה ארונזון (to remove students from her)
  const anna = await db.collection('teacher').findOne({
    'personalInfo.fullName': { $regex: 'אנה ארונזון', $options: 'i' }
  });
  const annaId = anna?._id.toString();

  let fixed = 0;

  for (const { search, fullSearch } of svetlanaStudents) {
    // Build search query
    let query = { 'personalInfo.fullName': { $regex: search, $options: 'i' } };
    if (fullSearch) {
      query = {
        $and: [
          { 'personalInfo.fullName': { $regex: search, $options: 'i' } },
          { 'personalInfo.fullName': { $regex: fullSearch, $options: 'i' } }
        ]
      };
    }

    const student = await db.collection('student').findOne(query);

    if (!student) {
      console.log(`⚠ Student not found: ${search} ${fullSearch || ''}`);
      continue;
    }

    const currentTeacherId = student.teacherIds?.[0];

    // Skip if already linked to Svetlana
    if (currentTeacherId === svetlanaId) {
      console.log(`✓ Already correct: ${student.personalInfo?.fullName}`);
      continue;
    }

    console.log(`Fixing: ${student.personalInfo?.fullName}`);
    console.log(`  From: ${currentTeacherId} -> To: ${svetlanaId}`);

    // Update student's teacherIds
    await db.collection('student').updateOne(
      { _id: student._id },
      {
        $set: {
          teacherIds: [svetlanaId],
          'teacherAssignments.0.teacherId': svetlanaId,
          'enrollments.teacherIds': [svetlanaId]
        }
      }
    );

    // Remove from old teacher's studentIds
    if (currentTeacherId) {
      await db.collection('teacher').updateOne(
        { _id: new ObjectId(currentTeacherId) },
        { $pull: { 'teaching.studentIds': student._id.toString() } }
      );
    }

    // Add to Svetlana's studentIds
    await db.collection('teacher').updateOne(
      { _id: svetlana._id },
      { $addToSet: { 'teaching.studentIds': student._id.toString() } }
    );

    console.log(`  ✓ Fixed\n`);
    fixed++;
  }

  // Verify final counts
  const updatedSvetlana = await db.collection('teacher').findOne({ _id: svetlana._id });
  const updatedAnna = await db.collection('teacher').findOne({ _id: anna._id });

  console.log('\n=== Results ===\n');
  console.log(`Students moved: ${fixed}`);
  console.log(`סבטלנה אברהם now has: ${updatedSvetlana?.teaching?.studentIds?.length || 0} students`);
  console.log(`אנה ארונזון now has: ${updatedAnna?.teaching?.studentIds?.length || 0} students`);

  await client.close();
}

fix().catch(console.error);
