import { MongoClient } from 'mongodb'

let db = null;

export async function initializeMongoDB() {
  try {
    const client = await MongoClient.connect(process.env.MONGODB_URI)
    db = client.db('Conservatory-DB')
    console.log('Connected to MongoDB')
  } catch (err) {
    console.error('MongoDB connection error', err)
    process.exit(1)
  }
}

export function getDB() {
  if (!db) {
    throw new Error('Database not initialized')
  }
  return db
}