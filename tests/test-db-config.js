import { MongoMemoryServer } from 'mongodb-memory-server'
import { MongoClient } from 'mongodb'

let mongoServer
let mongoClient
let db

// Connect to the in-memory database.
export async function connectDB() {
  mongoServer = await MongoMemoryServer.create()
  const uri = mongoServer.getUri()

  mongoClient = await MongoClient.connect(uri)
  db = mongoClient.db('test-db')

  return db
}

// Disconnect and stop the in-memory database.
export async function clearDB() {
  if (db) {
    const collections = await db.collections()
    for (const collection of collections) {
      await collection.deleteMany({})
    }
  }
}

export async function closeDB() {
  if (mongoClient) {
    await mongoClient.close()
  }
  if (mongoServer) {
    await mongoServer.stop()
  }
}

export function getCollection(collectionName) {
  return db.collection(collectionName)
}