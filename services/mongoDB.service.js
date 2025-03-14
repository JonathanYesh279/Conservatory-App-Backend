import { MongoClient } from 'mongodb'

let db = null

export async function initializeMongoDB(uri) {
  if (db) return db
  
  try {
    const client = await MongoClient.connect(uri || process.env.MONGODB_URI)
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