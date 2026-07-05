import "dotenv/config";
import express from "express";
import cors from "cors";
import { MongoClient, ServerApiVersion, ObjectId } from "mongodb";
import { toNodeHandler } from "better-auth/node";
import { getAuth } from "./auth.js";

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
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie", "Set-Cookie"],
    exposedHeaders: ["Set-Cookie"],
  }),
);

// Better-auth route handler
app.all("/api/auth/*splat", async (req, res, next) => {
  try {
    const auth = await getAuth();
    return toNodeHandler(auth)(req, res);
  } catch (error) {
    next(error);
  }
});

app.use(express.json());

// Database connection context
const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("CRITICAL ERROR: MONGODB_URI is not defined in environment variables.");
}

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const db = client.db("Woodora-Furniture");
const productsCollection = db.collection("Products");
const AddTocartCollection = db.collection("Add_To_Cart");
const UserCollection = db.collection("user");

// Middleware
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  req.user = { authorization: authHeader };
  next();
};

// --- Product Routes ---

app.get("/products/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }
    const result = await productsCollection.findOne({
      _id: new ObjectId(id),
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/products", async (req, res, next) => {
  try {
    const search = req.query.search;
    const query = search ? { name: { $regex: search, $options: "i" } } : {};
    const result = await productsCollection.find(query).toArray();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.delete("/products/:id", verifyToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }
    const result = await productsCollection.deleteOne({
      _id: new ObjectId(id),
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.patch("/products/:id", verifyToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }
    const updateData = req.body;
    delete updateData._id;

    const result = await productsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// --- Cart Routes ---

app.post("/cart", verifyToken, async (req, res, next) => {
  try {
    const data = req.body;
    const result = await AddTocartCollection.insertOne(data);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/cart", verifyToken, async (req, res, next) => {
  try {
    const result = await AddTocartCollection.find().toArray();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/customars-cart/:email", verifyToken, async (req, res, next) => {
  try {
    const { email } = req.params;
    const result = await AddTocartCollection.find({ email: email }).toArray();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.delete("/cart/:id", verifyToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }
    const result = await AddTocartCollection.deleteOne({
      _id: new ObjectId(id),
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// --- User Routes ---

app.get("/user/:email", verifyToken, async (req, res, next) => {
  try {
    const email = req.params.email;
    const result = await UserCollection.findOne({ email: email });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/user", verifyToken, async (req, res, next) => {
  try {
    const result = await UserCollection.find().toArray();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// --- System & Fallbacks ---

app.get("/", (req, res) => {
  res.json({ 
    status: "ok", 
    message: "Service is running", 
    mode: process.env.VERCEL ? "vercel" : "local" 
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Unhandled error context:", err.message || err);
  res.status(500).json({ message: err.message || "Internal server error" });
});

// Isolated lifecycle controller managing connection states and process hooks cleanly
async function connectDB() {
  try {
    await client.connect();
    console.log("MongoDB Connected Successfully");

    // Only boot listen thread when running in clean independent execution modes
    if (process.env.NODE_ENV !== "production") {
      app.listen(port, () => {
        console.log(`Server listening on port ${port}`);
      });
    }
  } catch (error) {
    console.error("CRITICAL DATABASE INITIALIZATION ERROR:", error);
    process.exit(1);
  }
}

connectDB();

export { app };
export default app;