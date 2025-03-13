import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';

let mongoServer;
let mongoClient;
let db;

// Make sure we initialize the database once
let isInitialized = false;

export async function initializeMongoDB() {
  if (isInitialized) {
    return Promise.resolve(db);
  }

  console.log('Initializing in-memory MongoDB for tests...');
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  mongoClient = await MongoClient.connect(uri);
  db = mongoClient.db('test-db');

  isInitialized = true;
  console.log('In-memory MongoDB initialized successfully');

  return db;
}

export function getDB() {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

export function getCollection(collectionName) {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db.collection(collectionName);
}
