import { MongoClient } from 'mongodb'

let db = null
let client = null

export async function initializeMongoDB(uri) {
  if (db) return db
  
  try {
    client = await MongoClient.connect(uri || process.env.MONGODB_URI)
    db = client.db(process.env.MONGODB_NAME || 'Conservatory-DB')
    console.log('Connected to MongoDB')
    return db
  } catch (err) {
    console.error('MongoDB connection error', err)
    throw err
  }
}

export function getDB() {
  if (!db) {
    throw new Error('Database not initialized. Call initializeMongoDB first')
  }
  return db
}

export async function getCollection(collectionName) {
  if (!db) {
    await initializeMongoDB()
  }
  return db.collection(collectionName)
}

export function getClient() {
  if (!client) {
    throw new Error('Database client not initialized. Call initializeMongoDB first')
  }
  return client
}

/**
 * Execute a function within a MongoDB transaction
 * Ensures atomicity across multiple database operations
 */
export async function withTransaction(transactionFn) {
  if (!client) {
    throw new Error('Database client not initialized. Call initializeMongoDB first')
  }

  const session = client.startSession()
  
  try {
    return await session.withTransaction(async () => {
      return await transactionFn(session)
    })
  } finally {
    await session.endSession()
  }
}