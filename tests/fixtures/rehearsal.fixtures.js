import { ObjectId } from 'mongodb'

// Sample rehearsals for orchestras
export const testRehearsals = {
  monday: {
    groupId: null, // Will be set in setup
    type: 'תזמורת',
    date: new Date('2024-03-11T16:00:00'), // Monday
    dayOfWeek: 1, // Monday
    startTime: '16:00',
    endTime: '18:00',
    location: 'אולם ערן',
    attendance: {
      present: [],
      absent: [],
    },
    notes: 'חזרה ראשונה לסמסטר',
    schoolYearId: null, // Will be set in setup
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  wednesday: {
    groupId: null, // Will be set in setup
    type: 'תזמורת',
    date: new Date('2024-03-13T16:00:00'), // Wednesday
    dayOfWeek: 3, // Wednesday
    startTime: '16:00',
    endTime: '18:00',
    location: 'סטודיו קאמרי 1',
    attendance: {
      present: [],
      absent: [],
    },
    notes: '',
    schoolYearId: null, // Will be set in setup
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  ensemble: {
    groupId: null, // Will be set in setup
    type: 'הרכב',
    date: new Date('2024-03-14T15:00:00'), // Thursday
    dayOfWeek: 4, // Thursday
    startTime: '15:00',
    endTime: '16:30',
    location: 'חדר הרכבים',
    attendance: {
      present: [],
      absent: [],
    },
    notes: '',
    schoolYearId: null, // Will be set in setup
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
}

// Setup function to initialize rehearsals with proper IDs and references
export function setupTestRehearsals(
  orchestraId,
  schoolYearId,
  studentIds = []
) {
  const rehearsals = JSON.parse(JSON.stringify(testRehearsals)); // Deep clone

  for (const key in rehearsals) {
    rehearsals[key]._id = new ObjectId()
    rehearsals[key].groupId = orchestraId
    rehearsals[key].schoolYearId = schoolYearId


    if (studentIds && studentIds.length > 0) {
      // Make half present and half absent for testing
      const midpoint = Math.floor(studentIds.length / 2)
      rehearsals[key].attendance.present = studentIds.slice(0, midpoint)
      rehearsals[key].attendance.absent = studentIds.slice(midpoint)
    }
  }

  return rehearsals
}
