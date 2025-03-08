import { ObjectId } from 'mongodb'


export const testBagruts = {
  bagrut1: {
    studentId: null, // Will be set in setup
    teacherId: null, // Will be set in setup
    program: [
      {
        pieceTitle: 'יצירה לדוגמה 1',
        composer: 'מלחין לדוגמה',
        duration: '5:30',
        youtubeLink: 'https://www.youtube.com/watch?v=example1',
      },
      {
        pieceTitle: 'יצירה לדוגמה 2',
        composer: 'מלחין אחר',
        duration: '4:45',
        youtubeLink: 'https://www.youtube.com/watch?v=example2',
      },
    ],
    accompaniment: {
      type: 'נגן מלווה',
      accompanists: [
        {
          name: 'מלווה לדוגמה',
          instrument: 'פסנתר',
          phone: '0501234567',
        },
      ],
    },
    presentations: [
      {
        completed: true,
        status: 'עבר/ה',
        date: new Date('2023-12-15'),
        review: 'מצוין, נגינה מדויקת',
        reviewedBy: null, // Will be set in setup
      },
      {
        completed: false,
        status: 'לא נבחן',
        date: null,
        review: null,
        reviewedBy: null,
      },
      {
        completed: false,
        status: 'לא נבחן',
        date: null,
        review: null,
        reviewedBy: null,
      },
    ],
    magenBagrut: {
      completed: true,
      status: 'עבר/ה',
      date: new Date('2023-11-01'),
      review: 'מוכן להמשיך לשלב הבא',
      reviewedBy: null, // Will be set in setup
    },
    documents: [],
    testDate: new Date('2024-05-15'),
    notes: 'יש להכין שלוש יצירות',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
}


export function setupTestBagruts(studentId, teacherId) {
  const bagruts = JSON.parse(JSON.stringify(testBagruts))

  // Add ObjectIds and update references
  for (const key in bagruts) {
    bagruts[key]._id = new ObjectId()
    bagruts[key].studentId = studentId
    bagruts[key].teacherId = teacherId

    // Add teacher ID to presentations
    bagruts[key].presentations[0].reviewedBy = teacherId
    bagruts[key].magenBagrut.reviewedBy = teacherId

    // Add IDs to program pieces and accompanists
    bagruts[key].program.forEach((piece) => {
      piece._id = new ObjectId();
    })

    bagruts[key].accompaniment.accompanists.forEach((accompanist) => {
      accompanist._id = new ObjectId()
    })
  }

  return bagruts
}
