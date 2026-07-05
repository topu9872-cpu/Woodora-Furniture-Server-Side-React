import "dotenv/config";
import express from "express";
import cors from "cors";

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
    allowedHeaders: ["Content-Type", "Authorization", "Cookie", "Set-Cookie"],
    exposedHeaders: ["Set-Cookie"],
  }),
);

app.all("/api/auth/*splat", (req, res) => {
  res.status(503).json({ message: "Auth service unavailable in this deployment" });
});

app.use(express.json());

const varifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  req.user = { authorization: authHeader };
  next();
};

app.get("/products/:id", (req, res) => {
  res.json({ status: "ok", message: "Products service is temporarily unavailable", id: req.params.id });
});

app.get("/products", (req, res) => {
  res.json({ status: "ok", message: "Products endpoint ready", data: [] });
});

app.delete("/products/:id", varifyToken, (req, res) => {
  res.status(503).json({ message: "Products service unavailable in this deployment" });
});

app.patch("/products/:id", varifyToken, (req, res) => {
  res.status(503).json({ message: "Products service unavailable in this deployment" });
});

app.post("/cart", varifyToken, (req, res) => {
  res.status(503).json({ message: "Cart service unavailable in this deployment" });
});

app.get("/cart", varifyToken, (req, res) => {
  res.status(503).json({ message: "Cart service unavailable in this deployment" });
});

app.get("/customars-cart/:email", varifyToken, (req, res) => {
  res.status(503).json({ message: "Cart service unavailable in this deployment" });
});

app.delete("/cart/:id", varifyToken, (req, res) => {
  res.status(503).json({ message: "Cart service unavailable in this deployment" });
});

app.get("/user/:email", varifyToken, (req, res) => {
  res.status(503).json({ message: "User service unavailable in this deployment" });
});

app.get("/user", varifyToken, (req, res) => {
  res.status(503).json({ message: "User service unavailable in this deployment" });
});

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Service is running", mode: process.env.VERCEL ? "vercel" : "local" });
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
export default app;
