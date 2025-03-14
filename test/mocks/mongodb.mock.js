import { vi } from 'vitest'
import { ObjectId } from 'mongodb'

// Create a mock database with collections for testing
const createMockDB = () => {
  // Mock data storage
  const collections = {
    teacher: [],
    student: [],
    orchestra: [],
    rehearsal: [],
    bagrut: [],
    school_year: [],
    activity_attendance: [],
  }

  // Mock collection methods
  const createMockCollection = (collectionName) => ({
    find: vi.fn((query = {}) => ({
      toArray: vi.fn(() => {
        return Promise.resolve(
          collections[collectionName].filter((doc) => {
            // Basic query filtering
            return Object.entries(query).every(([key, value]) => {
              if (key === '_id') {
                return doc._id.toString() === value.toString()
              }

              // Handle nested fields with dot notation
              if (key.includes('.')) {
                const parts = key.split('.')
                let current = doc
                for (const part of parts.slice(0, -1)) {
                  if (!current[part]) return false
                  current = current[part]
                }
                const lastPart = parts[parts.length - 1]

                // Handle special MongoDB operators
                if (value && typeof value === 'object') {
                  if (value.$in && Array.isArray(value.$in)) {
                    return value.$in.includes(current[lastPart])
                  }

                  if (value.$regex) {
                    const regex = new RegExp(
                      value.$regex,
                      value.$options || ''
                    )
                    return regex.test(current[lastPart])
                  }
                }

                return current[lastPart] === value
              }

              return doc[key] === value
            })
          })
        )
      }),
      sort: vi.fn(() => ({
        toArray: vi.fn(() => Promise.resolve(collections[collectionName])),
      })),
      limit: vi.fn(() => ({
        toArray: vi.fn(() =>
          Promise.resolve(collections[collectionName].slice(0, 10))
        ),
      })),
    })),
    findOne: vi.fn((query = {}) => {
      const results = collections[collectionName].filter((doc) => {
        // Basic query filtering
        return Object.entries(query).every(([key, value]) => {
          if (key === '_id') {
            return doc._id.toString() === value.toString()
          }

          // Handle nested fields with dot notation
          if (key.includes('.')) {
            const parts = key.split('.')
            let current = doc;
            for (const part of parts.slice(0, -1)) {
              if (!current[part]) return false
              current = current[part]
            }
            return current[parts[parts.length - 1]] === value
          }

          return doc[key] === value
        })
      })

      return Promise.resolve(results.length > 0 ? { ...results[0] } : null)
    }),
    insertOne: vi.fn((doc) => {
      const newDoc = { ...doc }
      if (!newDoc._id) {
        newDoc._id = new ObjectId()
      }
      collections[collectionName].push(newDoc)
      return Promise.resolve({ insertedId: newDoc._id })
    }),
    insertMany: vi.fn((docs) => {
      const insertedIds = {}
      docs.forEach((doc, index) => {
        const newDoc = { ...doc }
        if (!newDoc._id) {
          newDoc._id = new ObjectId()
        }
        insertedIds[index] = newDoc._id
        collections[collectionName].push(newDoc)
      })
      return Promise.resolve({ insertedCount: docs.length, insertedIds })
    }),
    updateOne: vi.fn((query, update) => {
      const index = collections[collectionName].findIndex((doc) => {
        if (query._id) {
          return doc._id.toString() === query._id.toString()
        }
        return Object.entries(query).every(
          ([key, value]) => doc[key] === value
        )
      })

      if (index !== -1) {
        // Handle $set operator
        if (update.$set) {
          collections[collectionName][index] = {
            ...collections[collectionName][index],
            ...update.$set,
          }
        }

        // Handle $push operator
        if (update.$push) {
          Object.entries(update.$push).forEach(([key, value]) => {
            if (!collections[collectionName][index][key]) {
              collections[collectionName][index][key] = []
            }

            if (value.$each) {
              collections[collectionName][index][key].push(...value.$each)
            } else {
              collections[collectionName][index][key].push(value)
            }
          })
        }

        // Handle $pull operator
        if (update.$pull) {
          Object.entries(update.$pull).forEach(([key, value]) => {
            if (Array.isArray(collections[collectionName][index][key])) {
              collections[collectionName][index][key] = collections[
                collectionName
              ][index][key].filter((item) => item !== value)
            }
          })
        }

        return Promise.resolve({ modifiedCount: 1 })
      }

      return Promise.resolve({ modifiedCount: 0 })
    }),
    updateMany: vi.fn((query, update) => {
      // Similar to updateOne but for multiple documents
      const matches = collections[collectionName].filter((doc) => {
        return Object.entries(query).every(
          ([key, value]) => doc[key] === value
        )
      })

      matches.forEach((match) => {
        const index = collections[collectionName].findIndex(
          (doc) => doc._id.toString() === match._id.toString()
        )
        if (index !== -1 && update.$set) {
          collections[collectionName][index] = {
            ...collections[collectionName][index],
            ...update.$set,
          }
        }
      })

      return Promise.resolve({ modifiedCount: matches.length })
    }),
    findOneAndUpdate: vi.fn((query, update, options = {}) => {
      const index = collections[collectionName].findIndex((doc) => {
        if (query._id) {
          return doc._id.toString() === query._id.toString()
        }
        return Object.entries(query).every(
          ([key, value]) => doc[key] === value
        )
      })

      if (index !== -1) {
        const originalDoc = { ...collections[collectionName][index] }

        // Handle $set operator
        if (update.$set) {
          collections[collectionName][index] = {
            ...collections[collectionName][index],
            ...update.$set,
          }
        }

        // Handle other operators similar to updateOne if needed

        if (options.returnDocument === 'after') {
          return Promise.resolve(collections[collectionName][index])
        }

        return Promise.resolve(originalDoc)
      }

      return Promise.resolve(null)
    }),
    deleteOne: vi.fn((query) => {
      const initialLength = collections[collectionName].length;
      collections[collectionName] = collections[collectionName].filter(
        (doc) => {
          if (query._id) {
            return doc._id.toString() !== query._id.toString()
          }
          return !Object.entries(query).every(
            ([key, value]) => doc[key] === value
          )
        }
      )

      return Promise.resolve({
        deletedCount: initialLength - collections[collectionName].length,
      })
    }),
    deleteMany: vi.fn((query) => {
      const initialLength = collections[collectionName].length;
      collections[collectionName] = collections[collectionName].filter(
        (doc) => {
          return !Object.entries(query).every(
            ([key, value]) => doc[key] === value
          )
        }
      )

      return Promise.resolve({
        deletedCount: initialLength - collections[collectionName].length,
      })
    }),
  })

  // Add methods to initialize mock data
  const initializeCollection = (collectionName, initialData = []) => {
    collections[collectionName] = initialData.map((doc) => ({
      ...doc,
      _id: doc._id || new ObjectId(),
    }))
  }

  // Return MongoDB service mock implementation
  return {
    initializeMongoDB: vi.fn(() => Promise.resolve()),
    getDB: vi.fn(() => ({ collection: (name) => createMockCollection(name) })),
    getCollection: vi.fn((collectionName) => {
      if (!collections[collectionName]) {
        collections[collectionName] = []
      }
      return createMockCollection(collectionName)
    }),
    // Utility functions for tests
    _collections: collections,
    _initializeCollection: initializeCollection,
    _clearCollections: () => {
      Object.keys(collections).forEach((key) => {
        collections[key] = []
      })
    },
  }
}

// Export a function to create the mock
export const mockMongoDB = () => {
  const mockDB = createMockDB()

  // Replace the actual MongoDB service with our mock
  vi.mock('../../services/mongoDB.service.js', () => mockDB, { virtual: true })

  return mockDB
}
