import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { initializeApp, cert } from "firebase-admin/app";
import fs from "fs";
import profileRouter from "./routes/profile.js";
import authRouter from "./routes/auth.js";
import usersRouter from "./routes/users.js";
import tasksRouter from "./routes/tasks.js";
import eventsRouter from "./routes/events.js";
import sprintsRouter from "./routes/sprints.js";
import reportsRouter from "./routes/reports.js";
import { verifyFirebaseToken } from "./middleware/auth.js";
import { requireAdmin } from "./middleware/rbac.js";
import { startDeadlineCron } from "./cron/deadlines.js";

dotenv.config();

const {
  MONGODB_URI,
  PORT = 5000,
  FIREBASE_SERVICE_ACCOUNT_PATH,
  FIREBASE_SERVICE_ACCOUNT_JSON,
  FIREBASE_SERVICE_ACCOUNT_BASE64,
  FRONTEND_ORIGIN,
} = process.env;

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI is required in .env");
}

let serviceAccount;
if (FIREBASE_SERVICE_ACCOUNT_JSON) {
  serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON);
} else if (FIREBASE_SERVICE_ACCOUNT_BASE64) {
  const decoded = Buffer.from(FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf8");
  serviceAccount = JSON.parse(decoded);
} else if (FIREBASE_SERVICE_ACCOUNT_PATH) {
  const serviceAccountJson = fs.readFileSync(
    new URL(FIREBASE_SERVICE_ACCOUNT_PATH, import.meta.url),
    "utf8"
  );
  serviceAccount = JSON.parse(serviceAccountJson);
} else {
  throw new Error("Missing Firebase credentials. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH in environment.");
}

initializeApp({
  credential: cert(serviceAccount),
});

await mongoose.connect(MONGODB_URI);

const app = express();

// Trust proxy for deployment behind Render / Vercel reverse proxies
app.set("trust proxy", 1);

// Apply CORS FIRST, before helmet and other middleware
const rawOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  ...(FRONTEND_ORIGIN ? FRONTEND_ORIGIN.split(",") : []),
];

const allowedOrigins = rawOrigins
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

app.use(
  cors({
    origin: (requestOrigin, callback) => {
      if (!requestOrigin) return callback(null, true);
      if (allowedOrigins.includes(requestOrigin)) return callback(null, true);
      // Allow Vercel preview/production deployments
      if (/\.vercel\.app$/.test(requestOrigin)) return callback(null, true);
      console.warn(`CORS blocked for origin: ${requestOrigin}`);
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 200,
    preflightContinue: false,
  })
);

// Handle OPTIONS preflight explicitly
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    res.header("Access-Control-Allow-Origin", req.headers.origin);
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.sendStatus(200);
    return;
  }
  next();
});

// Apply helmet AFTER CORS
app.use(helmet());

app.use(express.json());

const errorHandler = (err, req, res, next) => {
  if (err?.message?.startsWith("CORS origin denied")) {
    return res.status(403).json({
      error: err.message,
      origin: req.headers.origin || null,
    });
  }
  return next(err);
};
app.use(errorHandler);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use(limiter);

const reportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
});

app.get("/", (req, res) => {
  res.json({ status: "ok", name: "KanbanKC API", version: "1.0.0" });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

app.use("/api/auth", verifyFirebaseToken, authRouter);
app.use("/api/users", verifyFirebaseToken, usersRouter);
app.use("/api/tasks", verifyFirebaseToken, tasksRouter);
app.use("/api/profile", verifyFirebaseToken, profileRouter);
app.use("/api/events", verifyFirebaseToken, eventsRouter);
app.use("/api/sprints", verifyFirebaseToken, sprintsRouter);
app.use("/api/reports", verifyFirebaseToken, reportLimiter, reportsRouter);

startDeadlineCron();

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
