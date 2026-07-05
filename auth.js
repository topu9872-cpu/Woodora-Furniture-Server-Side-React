import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { jwt } from "better-auth/plugins";
import { getMongoClient, getDb } from "./db.js";

const isProduction = process.env.NODE_ENV === "production";

export let auth = null;
let authPromise;

export async function getAuth() {
  if (auth) return auth;

  if (!authPromise) {
    authPromise = (async () => {
      const secret = process.env.BETTER_AUTH_SECRET;
      if (!secret) {
        throw new Error("BETTER_AUTH_SECRET is not configured.");
      }

      // Ensure DB references are cleanly awaited and instantiated
      const client = await getMongoClient();
      const db = await getDb();

      const getDefaultBaseUrl = () => {
        if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
        if (process.env.CLIENT_URL) return process.env.CLIENT_URL;
        if (process.env.VERCEL_BRANCH_URL)
          return `https://${process.env.VERCEL_BRANCH_URL}`;
        if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
        return "http://localhost:5173";
      };

      const defaultBaseUrl = getDefaultBaseUrl();

      auth = betterAuth({
        baseURL: defaultBaseUrl,
        secret,

        // Fix: Pass the database instance context correctly
        database: mongodbAdapter(db),

        plugins: [jwt()],

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
          process.env.CLIENT_URL,
          "http://localhost:5173",
        ].filter(Boolean),

        socialProviders: {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            redirectURL: process.env.CLIENT_URL,
          },
          github: {
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
            redirectURL: process.env.CLIENT_URL,
          },
        },

        advanced: {
          useSecureCookies: isProduction,
          defaultCookieAttributes: {
            sameSite: isProduction ? "none" : "lax",
            secure: isProduction,
            httpOnly: true,
          },
        },
      });

      return auth;
    })();
  }

  return authPromise;
}
