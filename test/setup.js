import { beforeAll, afterAll, afterEach, vi } from 'vitest'
import { MongoClient, ObjectId } from 'mongodb'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.test' })

// Mock MongoDB service
vi.mock('../services/mongoDB.service.js', () => {
  const db = {
    collection: vi.fn(() => ({
      find: vi.fn(() => ({
        toArray: vi.fn(() => Promise.resolve([])),
      })),
      findOne: vi.fn(() => Promise.resolve(null)),
      insertOne: vi.fn(() => Promise.resolve({ insertedId: new ObjectId() })),
      updateOne: vi.fn(() => Promise.resolve({ modifiedCount: 1 })),
      findOneAndUpdate: vi.fn(() => Promise.resolve({})),
      deleteOne: vi.fn(() => Promise.resolve({ deletedCount: 1 })),
    })),
  }

  return {
    initializeMongoDB: vi.fn(() => Promise.resolve()),
    getDB: vi.fn(() => db),
    getCollection: vi.fn(() => db.collection()),
  }
})

// Mock JWT
vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(() => 'mocked-token'),
    verify: vi.fn(() => ({ _id: 'mock-user-id', roles: ['מנהל'] })),
  },
  sign: vi.fn(() => 'mocked-token'),
  verify: vi.fn(() => ({ _id: 'mock-user-id', roles: ['מנהל'] })),
}))

// Mock bcrypt
vi.mock('bcrypt', () => ({
  default: {
    compare: vi.fn(() => Promise.resolve(true)),
    hash: vi.fn(() => Promise.resolve('hashed-password')),
  },
  compare: vi.fn(() => Promise.resolve(true)),
  hash: vi.fn(() => Promise.resolve('hashed-password')),
}))

// Global test setup and teardown
let mongoClient = null

beforeAll(async () => {
  // You can add any setup logic here
  // For example, connect to a test database if needed
  if (process.env.USE_TEST_DB === 'true') {
    mongoClient = new MongoClient(process.env.TEST_MONGODB_URI)
    await mongoClient.connect()
  }
})

afterAll(async () => {
  // Cleanup after all tests
  if (mongoClient) {
    await mongoClient.close()
  }
})

afterEach(() => {
  // Reset all mocks after each test
  vi.resetAllMocks()
})
