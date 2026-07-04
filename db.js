import { MongoClient, ServerApiVersion } from "mongodb";

let cachedClient;

export async function getMongoClient() {
  if (cachedClient) return cachedClient;

  cachedClient = new MongoClient(process.env.MONGODB_URI, {
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
  const client = await getMongoClient();
  return client.db("Woodora-Furniture");
}
