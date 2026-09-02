import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import profileRouter from "./routes/profile.js";
import authRouter from "./routes/auth.js";
import usersRouter from "./routes/users.js";
import tasksRouter from "./routes/tasks.js";
import eventsRouter from "./routes/events.js";
import sprintsRouter from "./routes/sprints.js";
import reportsRouter from "./routes/reports.js";
import { verifyFirebaseToken } from "./middleware/auth.js";

const app = express();

// Trust proxy for reverse proxies / Cloudflare / Vercel
app.set("trust proxy", 1);

// Configure CORS
const getOrigins = () => {
  const frontendOrigin = process.env.FRONTEND_ORIGIN || "";
  const rawOrigins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    ...(frontendOrigin ? frontendOrigin.split(",") : []),
  ];
  return rawOrigins
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
};

app.use(
  cors({
    origin: (requestOrigin, callback) => {
      if (!requestOrigin) return callback(null, true);
      const allowedOrigins = getOrigins();
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
    res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.sendStatus(200);
  }
  next();
});

// Apply helmet
app.use(helmet());

// Parse JSON without Express's body-parser dependency, which is not Worker-compatible.
app.use((req, res, next) => {
  if (!['POST', 'PUT', 'PATCH'].includes(req.method)) return next();

  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    if (chunks.length === 0) return next();

    try {
      req.body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      return next();
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  });
  req.on('error', next);
});

// CORS Error Handler
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

// Rate Limiters
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use(limiter);

const reportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
});

// Base Routes
app.get("/", (req, res) => {
  res.json({ status: "ok", name: "KanbanKC API", version: "1.0.0" });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime ? process.uptime() : 0 });
});

// API Routes
app.use("/api/auth", verifyFirebaseToken, authRouter);
app.use("/api/users", verifyFirebaseToken, usersRouter);
app.use("/api/tasks", verifyFirebaseToken, tasksRouter);
app.use("/api/profile", verifyFirebaseToken, profileRouter);
app.use("/api/events", verifyFirebaseToken, eventsRouter);
app.use("/api/sprints", verifyFirebaseToken, sprintsRouter);
app.use("/api/reports", verifyFirebaseToken, reportLimiter, reportsRouter);

export default app;
