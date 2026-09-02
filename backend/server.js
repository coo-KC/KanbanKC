import dotenv from "dotenv";
import mongoose from "mongoose";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import fs from "fs";
import app from "./app.js";
import { startDeadlineCron } from "./cron/deadlines.js";

dotenv.config();

const {
  MONGODB_URI,
  PORT = 5000,
  FIREBASE_SERVICE_ACCOUNT_PATH,
  FIREBASE_SERVICE_ACCOUNT_JSON,
  FIREBASE_SERVICE_ACCOUNT_BASE64,
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

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

await mongoose.connect(MONGODB_URI);

startDeadlineCron();

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
