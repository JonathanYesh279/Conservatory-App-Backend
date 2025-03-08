import { getCollection as getTestCollection } from '../test-db-config.js'

export function getCollection(collectionName) {
  return getTestCollection(collectionName)
}

export async function initializeMongoDB() {
  return Promise.resolve()
}

export function getDB() {
  return {
    collection: getCollection
  }
}