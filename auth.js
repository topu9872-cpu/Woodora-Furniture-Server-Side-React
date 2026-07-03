const { betterAuth } = require("better-auth");
const { MongoClient } = require("mongodb");
const { mongodbAdapter } = require("better-auth/adapters/mongodb");
const { jwt } = require("better-auth/plugins");

const client = new MongoClient(process.env.MONGODB_URI);

async function initDB() {
  await client.connect();
}

const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,

  database: mongodbAdapter(client.db("Woodora-Furniture"), {
    client,
  }),

  user: {
    additionalFields: {
      phone: {
        type: "string",
        required: false,
        input: true,
      },
      location: {
        type: "string",
        required: false,
        input: true,
      },
    },
  },

  emailAndPassword: {
    enabled: true,
  },

  trustedOrigins: [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5000",
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