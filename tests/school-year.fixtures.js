import { ObjectId } from 'mongodb'


export const testSchoolYears = {
  current: {
    name: '2023-2024',
    startDate: new Date('2023-09-01'),
    endDate: new Date('2024-08-31'),
    isCurrent: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  previous: {
    name: '2022-2023',
    startDate: new Date('2022-09-01'),
    endDate: new Date('2023-08-31'),
    isCurrent: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  next: {
    name: '2024-2025',
    startDate: new Date('2024-09-01'),
    endDate: new Date('2025-08-31'),
    isCurrent: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
}

export function setupTestSchoolYears() {
  const schoolYears = JSON.parse(JSON.stringify(testSchoolYears))


  for (const key in schoolYears) {
    schoolYears[key]._id = new ObjectId()
  }

  return schoolYears
}
