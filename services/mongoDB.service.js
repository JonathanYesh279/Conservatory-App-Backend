import { MongoClient } from 'mongodb'
import { createLogger } from './logger.service.js'

const log = createLogger('mongodb')

let db = null
let client = null

export async function initializeMongoDB(uri) {
  if (db) return db

  try {
    const connectionString = uri || process.env.MONGODB_URI

    if (!connectionString) {
      throw new Error('MongoDB connection string is missing. Please set MONGODB_URI environment variable.')
    }

    log.info({ database: process.env.MONGODB_NAME || 'Conservatory-DB' }, 'Attempting MongoDB connection')

    client = await MongoClient.connect(connectionString, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
    })

    db = client.db(process.env.MONGODB_NAME || 'Conservatory-DB')
    log.info('Connected to MongoDB successfully')
    return db
  } catch (err) {
    log.error({ err: err.message }, 'MongoDB connection error')
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
    await initializeMongoDB(process.env.MONGODB_URI)
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
