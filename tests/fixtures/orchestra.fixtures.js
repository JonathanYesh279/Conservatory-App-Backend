import { ObjectId } from 'mongodb'

export const testOrchestras = {
  beginners: {
    name: 'תזמורת מתחילים נשיפה',
    type: 'תזמורת',
    conductorId: null, // Will be set in setup
    memberIds: [], // Will be populated in setup
    rehearsalIds: [],
    schoolYearId: null, // Will be set in setup
    isActive: true,
    createdAt: new Date('2023-09-01'),
    updatedAt: new Date('2023-09-01'),
  },
  advanced: {
    name: 'תזמורת יצוגית נשיפה',
    type: 'תזמורת',
    conductorId: null, // Will be set in setup
    memberIds: [], // Will be populated in setup
    rehearsalIds: [],
    schoolYearId: null, // Will be set in setup
    isActive: true,
    createdAt: new Date('2023-09-01'),
    updatedAt: new Date('2023-09-01'),
  },
  symphonic: {
    name: 'תזמורת סימפונית',
    type: 'תזמורת',
    conductorId: null, // Will be set in setup
    memberIds: [], // Will be populated in setup
    rehearsalIds: [],
    schoolYearId: null, // Will be set in setup
    isActive: true,
    createdAt: new Date('2023-09-01'),
    updatedAt: new Date('2023-09-01'),
  },
  ensemble: {
    name: 'הרכב',
    type: 'הרכב',
    conductorId: null, // Will be set in setup
    memberIds: [], // Will be populated in setup
    rehearsalIds: [],
    schoolYearId: null, // Will be set in setup
    isActive: true,
    createdAt: new Date('2023-09-01'),
    updatedAt: new Date('2023-09-01'),
  },
}

export function setupTestOrchestras(conductorId, schoolYearId, studentIds = []) {
  const orchestras = JSON.parse(JSON.stringify(testOrchestras))

  for (const key in orchestras) {
    orchestras[key]._id = new ObjectId()
    orchestras[key].conductorId = conductorId
    orchestras[key].schoolYearId = schoolYearId

    if (studentIds && studentIds.length > 0) {
      orchestras[key].memberIds = [...studentIds]
    }
  }
  
  return orchestras
}