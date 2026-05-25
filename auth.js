const { betterAuth } = require("better-auth");
const { MongoClient } = require("mongodb");
const { mongodbAdapter } = require("better-auth/adapters/mongodb");

const client = new MongoClient(process.env.MONGODB_URI);

let db;

async function initDB() {
  await client.connect();
  db = client.db("Woodora-user");
  console.log("Auth DB connected 🚀");
}

const auth = betterAuth({
  database: mongodbAdapter(client.db("Woodora-user"), {
    client,
  }),

  emailAndPassword: {
    enabled: true,
  },

  trustedOrigins: ["http://localhost:5173"],
});

// ✅ IMPORTANT: ensure DB connects before export usage
initDB();

module.exports = { auth };