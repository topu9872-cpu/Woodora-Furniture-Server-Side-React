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

app.use(
  cors({
    origin: [process.env.CLIENT_URL, "http://localhost:5173"].filter(Boolean),
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

const authBaseUrl =
  process.env.BETTER_AUTH_URL || process.env.CLIENT_URL || "http://localhost:5173";

// better-auth handler MUST come before express.json()
// because better-auth handles its own body parsing
app.all("/api/auth/*splat", async (req, res, next) => {
  try {
    const auth = await getAuth();
    return toNodeHandler(auth)(req, res, next);
  } catch (error) {
    next(error);
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

async function run() {
  try {
    await getAuth();
    const db = await getDb();
    console.log("Successfully connected to MongoDB!");

    const productsCollection = db.collection("Products");
    const AddTocartCollection = db.collection("Add_To_Cart");
    const UserCollection = db.collection("user");

    // Products Routes
    app.get("/products/:id", async (req, res, next) => {
      try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ message: "Invalid product id" });
        }

        const result = await productsCollection.findOne({
          _id: new ObjectId(id),
        });
        return res.json(result);
      } catch (error) {
        next(error);
      }
    });

    app.get("/products", async (req, res) => {
      const search = req.query.search;
      const query = search ? { name: { $regex: search, $options: "i" } } : {};
      const result = await productsCollection.find(query).toArray();
      res.json(result);
    });

    // admin product delete
    app.delete("/products/:id", varifyToken, async (req, res, next) => {
      try {
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
    app.post("/cart", varifyToken, async (req, res) => {
      const data = req.body;
      const result = await AddTocartCollection.insertOne(data);
      res.json(result);
    });

    app.get("/cart", varifyToken, async (req, res) => {
      const result = await AddTocartCollection.find().toArray();
      res.json(result);
    });

    app.get("/customars-cart/:email", varifyToken, async (req, res) => {
      const { email } = req.params;
      const result = await AddTocartCollection.find({ email: email }).toArray();
      res.json(result);
    });

    app.delete("/cart/:id", varifyToken, async (req, res, next) => {
      try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ message: "Invalid cart id" });
        }

        const result = await AddTocartCollection.deleteOne({
          _id: new ObjectId(id),
        });
        return res.json(result);
      } catch (error) {
        next(error);
      }
    });

    app.get("/user/:email", varifyToken, async (req, res) => {
      const { email } = req.params;
      const result = await UserCollection.findOne({ email });
      res.json(result);
    });

    app.get("/user", varifyToken, async (req, res) => {
      const result = await UserCollection.find().toArray();
      res.json(result);
    });
  } catch (error) {
    console.error("Database connection error:", error);
  }
}

run().catch(console.dir);

app.get("/", async (req, res) => {
  res.json("hello world");
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
