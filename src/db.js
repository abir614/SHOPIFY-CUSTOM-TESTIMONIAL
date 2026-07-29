import { MongoClient } from "mongodb";
let client = null;
let db = null;
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
    tls: true,
    tlsAllowInvalidCertificates: false,
    tlsAllowInvalidHostnames: false,
  });
  await client.connect();
  db = process.env.MONGODB_DB_NAME ? client.db(process.env.MONGODB_DB_NAME) : client.db();
  await ensureIndexes(db);
  console.info("[db] Connected to MongoDB and indexes ensured.");
  return db;
}
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
    database.collection("submissions").createIndex({ bundleId: 1, createdAt: -1 }),
    database.collection("apikeys").createIndex({ key: 1 }, { unique: true }),
    database.collection("apikeys").createIndex({ userId: 1, createdAt: -1 }),
    database.collection("bundles").createIndex({ ownerId: 1, bundleName: 1 }, { unique: true }),
    database.collection("bundles").createIndex({ ownerUsername: 1, bundleName: 1 }, { unique: true }),
  ]);
}
export function getCollections() {
  const database = getDb();
  return {
    users: database.collection("users"),
    apps: database.collection("apps"),
    submissions: database.collection("submissions"),
    apikeys: database.collection("apikeys"),
    bundles: database.collection("bundles"),
  };
}
export async function closeDb() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.info("[db] MongoDB connection closed.");
  }
}
