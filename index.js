require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { toNodeHandler } = require("better-auth/node");
const { auth } = require("./auth");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json());

app.use("/api/auth", toNodeHandler(auth));

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.VITE_SERVER_PUBLIC_URL}/api/auth/jwks`),
);

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
    return res.status(403).json({
      message: "Forbidden access",
    });
  }
};

async function run() {
  try {
    await client.connect();
    console.log("Successfully connected to MongoDB!");

    const db = client.db("Woodora-Furniture");
    const productsCollection = db.collection("Products");
    const AddTocartCollection = db.collection("Add_To_Cart");
    const UserCollection = db.collection("user");

    // Products Routes
    app.get("/products/:id", async (req, res) => {
      const id = req.params.id;
      const result = await productsCollection.findOne({
        _id: new ObjectId(id),
      });
      res.json(result);
    });

    app.get("/products", async (req, res) => {
      const search = req.query.search;
      const query = search ? { name: { $regex: search, $options: "i" } } : {};
      const result = await productsCollection.find(query).toArray();
      res.json(result);
    });

    // admin product delete
    app.delete("/products/:id", async (req, res) => {
      const { id } = req.params;
      const result = await productsCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.json(result);
    });

    app.patch("/products/:id", async (req, res) => {
      const { id } = req.params;
      const updateData = req.body;
      const result = await productsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData },
      );
      res.json(result);
    });

    // Cart Routes
    app.post("/cart", async (req, res) => {
      const data = req.body;
      const result = await AddTocartCollection.insertOne(data);
      res.json(result);
    });

    app.get("/cart", async (req, res) => {
      const result = await AddTocartCollection.find().toArray();
      res.json(result);
    });
    app.get("/customars-cart/:email", async (req, res) => {
        const {email}=req.params
      const result = await AddTocartCollection.find({email:email}).toArray();
            

      res.json(result);
    });

    app.delete("/cart/:id", async (req, res) => {
      const { id } = req.params;
      const result = await AddTocartCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.json(result);
    });

    app.get("/user/:email", async (req, res) => {
      const email = req.params;
      const result = await UserCollection.findOne(email);
      res.json(result);
    });

    app.get("/user", async (req, res) => {
      const result = await UserCollection.find().toArray();
      res.json(result);
    });

    await client.db("admin").command({ ping: 1 });
  } catch (error) {
    console.error("Database connection error:", error);
  }
}

run().catch(console.dir);

app.get("/", async (req, res) => {
  res.json("hello world");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
