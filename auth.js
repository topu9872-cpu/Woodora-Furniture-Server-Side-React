const { betterAuth } = require("better-auth");
const { MongoClient } = require("mongodb");
const { mongodbAdapter } = require("better-auth/adapters/mongodb");

const client = new MongoClient(process.env.MONGODB_URI);

async function initDB() {
    await client.connect();
}

const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  database: mongodbAdapter(client.db("Woodora-user"), {
    client,
  }),

  emailAndPassword: {
    enabled: true,
  },

  trustedOrigins: [
  "http://localhost:5173",
  "http://localhost:5000"
],
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },

    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    },
  },
});

initDB();

module.exports = { auth };