import { MongoClient, ServerApiVersion } from "mongodb";

let cachedClient;
let cachedDb;

export async function getMongoClient() {
  if (cachedClient) return cachedClient;

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI is not configured.");
  }

  cachedClient = new MongoClient(mongoUri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
    connectTimeoutMS: 5000,
    socketTimeoutMS: 5000,
  });

  await Promise.race([
    cachedClient.connect(),
    new Promise((_, reject) => setTimeout(() => reject(new Error("MongoDB connection timeout")), 5000)),
  ]);
  return cachedClient;
}

export async function getDb() {
  if (cachedDb) return cachedDb;

  const client = await getMongoClient();
  cachedDb = client.db("Woodora-Furniture");
  return cachedDb;
}
