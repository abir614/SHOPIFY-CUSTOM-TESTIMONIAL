import { MongoClient } from "mongodb";

// Single long-lived client for the Node.js server process.
// Connection is established once at startup via connectDb() and reused.
let client = null;
let db = null;

/**
 * Called once at server startup. Establishes the MongoDB connection and
 * ensures all indexes are in place before the server starts accepting traffic.
 */
export async function connectDb() {
  if (db) return db;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI environment variable is not set.");

  client = new MongoClient(uri, {
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 10_000,
    connectTimeoutMS: 10_000,
    socketTimeoutMS: 30_000,
  });

  await client.connect();
  db = client.db(process.env.MONGODB_DB_NAME || "formhub");
  await ensureIndexes(db);
  console.info("[db] Connected to MongoDB and indexes ensured.");
  return db;
}

/**
 * Returns the cached database instance. Must be called after connectDb().
 */
export function getDb() {
  if (!db) throw new Error("Database not initialised. Call connectDb() first.");
  return db;
}

async function ensureIndexes(database) {
  await Promise.all([
    database.collection("users").createIndex({ username: 1 }, { unique: true }),
    database.collection("users").createIndex({ email: 1 }, { unique: true }),
    database.collection("apps").createIndex({ ownerId: 1, appName: 1 }, { unique: true }),
    database.collection("submissions").createIndex({ appId: 1, createdAt: -1 }),
  ]);
}

export function getCollections() {
  const database = getDb();
  return {
    users: database.collection("users"),
    apps: database.collection("apps"),
    submissions: database.collection("submissions"),
  };
}

/** Gracefully close the connection on server shutdown. */
export async function closeDb() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.info("[db] MongoDB connection closed.");
  }
}
