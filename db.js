import { MongoClient, ServerApiVersion } from "mongodb";

let cachedClient;
let cachedDb;

export async function getMongoClient() {
  if (cachedClient) return cachedClient;

  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is not configured.");
  }

  cachedClient = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });

  await cachedClient.connect();

  return cachedClient;
}

export async function getDb() {
  if (cachedDb) return cachedDb;

  const client = await getMongoClient();
  cachedDb = client.db("Woodora-Furniture");

  return cachedDb;
}