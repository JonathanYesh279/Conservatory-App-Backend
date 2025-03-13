import { MongoMemoryServer } from 'mongodb-memory-server'
import { MongoClient } from 'mongodb'

let mongoServer
let mongoClient
let db

// Connect to the in-memory database.
export async function connectDB() {
  try {
    console.log('Initializing in-memory MongoDB for tests...')
    mongoServer = await MongoMemoryServer.create()
    const uri = mongoServer.getUri()

    mongoClient = await MongoClient.connect(uri)
    db = mongoClient.db('test-db')

    console.log('In-memory MongoDB initialized successfully')
    return db
  } catch (error) {
    console.error('Failed to initialize in-memory MongoDB:', error)
    throw error
  }
}


// Disconnect and stop the in-memory database.
export async function clearDB() {
  try {
    if (db) {
      const collections = await db.collections()
      for (const collection of collections) {
        await collection.deleteMany({})
      }
    }
  } catch (error) {
    console.error('Error clearing database:', error)
  }
}

export async function closeDB() {
  try {
    if (mongoClient) {
      await mongoClient.close()
    }
    if (mongoServer) {
      await mongoServer.stop()
    }
  } catch (error) {
    console.error('Error closing database:', error)
  }
}

export function getCollection(collectionName) {
  if (!db) {
    throw new Error('Database not initialized - call connectDB() first')
  }
  return db.collection(collectionName)
}