import "dotenv/config";
import express from "express";
import cors from "cors";
import { getAuth } from "./auth.js";
import { toNodeHandler } from "better-auth/node";
import { ObjectId } from "mongodb";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { getDb } from "./db.js";
import serverless from "serverless-http";

const app = express();
const port = process.env.PORT || 5000;

app.set("trust proxy", 1);

const getDefaultBaseUrl = () => {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  if (process.env.CLIENT_URL) return process.env.CLIENT_URL;
  if (process.env.VERCEL_BRANCH_URL) return `https://${process.env.VERCEL_BRANCH_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:5173";
};

const defaultBaseUrl = getDefaultBaseUrl();

const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.BETTER_AUTH_URL,
  defaultBaseUrl,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      const normalizedOrigin = origin.replace(/\/$/, "");
      const isAllowed = allowedOrigins.some(
        (allowed) => normalizedOrigin === allowed.replace(/\/$/, ""),
      );
      const isVercelOrigin = /https:\/\/.*\.(vercel\.app|vercel\.dev)$/.test(
        normalizedOrigin,
      );

      if (isAllowed || isVercelOrigin) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Cookie",
      "Set-Cookie",
    ],
    exposedHeaders: ["Set-Cookie"],
  }),
);

const authBaseUrl = defaultBaseUrl;

// better-auth handler MUST come before express.json()
// because better-auth handles its own body parsing
app.all("/api/auth/*splat", async (req, res, next) => {
  try {
    const auth = await Promise.race([
      getAuth(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Auth startup timeout")), 1500),
      ),
    ]);
    return toNodeHandler(auth)(req, res, next);
  } catch (error) {
    res.status(503).json({ message: "Auth service unavailable" });
  }
});

app.use(express.json());

const JWKS = createRemoteJWKSet(new URL("/api/auth/jwks", authBaseUrl));

const varifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      message: "user Unauthorizad",
    });
  }
  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }
  try {
    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload;
    next();
  } catch (error) {
    console.error("JWT verification failed:", error.message);
    return res.status(403).json({
      message: "Forbidden access",
    });
  }
};

let collectionsPromise;
let productsCollection;
let addToCartCollection;
let userCollection;

async function ensureCollections() {
  if (productsCollection && addToCartCollection && userCollection) {
    return { productsCollection, addToCartCollection, userCollection };
  }

  if (!collectionsPromise) {
    collectionsPromise = (async () => {
      const db = await Promise.race([
        getDb(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Database startup timeout")), 1500),
        ),
      ]);

      console.log("Successfully connected to MongoDB!");

      productsCollection = db.collection("Products");
      addToCartCollection = db.collection("Add_To_Cart");
      userCollection = db.collection("user");

      return { productsCollection, addToCartCollection, userCollection };
    })().catch((error) => {
      collectionsPromise = null;
      throw error;
    });
  }

  return collectionsPromise;
}

// Products Routes
app.get("/products/:id", async (req, res, next) => {
  try {
    const { productsCollection } = await ensureCollections();
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid product id" });
    }

    const result = await productsCollection.findOne({
      _id: new ObjectId(id),
    });
    return res.json(result);
  } catch (error) {
    res.status(503).json({ message: "Products service unavailable" });
  }
});

app.get("/products", async (req, res, next) => {
  try {
    const { productsCollection } = await ensureCollections();
    const search = req.query.search;
    const query = search ? { name: { $regex: search, $options: "i" } } : {};
    const result = await productsCollection.find(query).toArray();
    return res.json(result);
  } catch (error) {
    res.status(503).json({ message: "Products service unavailable" });
  }
});

// admin product delete
app.delete("/products/:id", varifyToken, async (req, res, next) => {
  try {
    const { productsCollection } = await ensureCollections();
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid product id" });
    }

    const result = await productsCollection.deleteOne({
      _id: new ObjectId(id),
    });
    return res.json(result);
  } catch (error) {
    next(error);
  }
});

app.patch("/products/:id", varifyToken, async (req, res, next) => {
  try {
    const { productsCollection } = await ensureCollections();
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid product id" });
    }

    const updateData = req.body;
    const result = await productsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData },
    );
    return res.json(result);
  } catch (error) {
    next(error);
  }
});

// Cart Routes
app.post("/cart", varifyToken, async (req, res, next) => {
  try {
    const { addToCartCollection } = await ensureCollections();
    const data = req.body;
    const result = await addToCartCollection.insertOne(data);
    return res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/cart", varifyToken, async (req, res, next) => {
  try {
    const { addToCartCollection } = await ensureCollections();
    const result = await addToCartCollection.find().toArray();
    return res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/customars-cart/:email", varifyToken, async (req, res, next) => {
  try {
    const { addToCartCollection } = await ensureCollections();
    const { email } = req.params;
    const result = await addToCartCollection.find({ email: email }).toArray();
    return res.json(result);
  } catch (error) {
    next(error);
  }
});

app.delete("/cart/:id", varifyToken, async (req, res, next) => {
  try {
    const { addToCartCollection } = await ensureCollections();
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid cart id" });
    }

    const result = await addToCartCollection.deleteOne({
      _id: new ObjectId(id),
    });
    return res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/user/:email", varifyToken, async (req, res, next) => {
  try {
    const { userCollection } = await ensureCollections();
    const { email } = req.params;
    const result = await userCollection.findOne({ email });
    return res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/user", varifyToken, async (req, res, next) => {
  try {
    const { userCollection } = await ensureCollections();
    const result = await userCollection.find().toArray();
    return res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/", async (req, res) => {
  res.json({ status: "ok", message: "Service is running" });
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Internal server error" });
});

if (process.env.NODE_ENV !== "production") {
  app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
  });
}

export { app };
export default process.env.VERCEL === "1" ? serverless(app) : app;
