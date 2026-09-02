import serverless from "serverless-http";
import mongoose from "mongoose";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import app from "./app.js";
import { runDeadlineCheck } from "./cron/deadlines.js";

const serverlessHandler = serverless(app);

let isDbConnected = false;

async function setupEnvironment(env) {
  // Sync Cloudflare Worker environment bindings to process.env
  if (env) {
    for (const [key, value] of Object.entries(env)) {
      if (typeof value === "string" && !process.env[key]) {
        process.env[key] = value;
      }
    }
  }

  const mongodbUri = process.env.MONGODB_URI || env?.MONGODB_URI;
  if (!mongodbUri) {
    throw new Error("MONGODB_URI is not defined in worker environment bindings");
  }

  // Initialize Firebase Admin SDK if not initialized
  if (!getApps().length) {
    let serviceAccount;
    const jsonCreds = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || env?.FIREBASE_SERVICE_ACCOUNT_JSON;
    const b64Creds = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || env?.FIREBASE_SERVICE_ACCOUNT_BASE64;

    if (jsonCreds) {
      serviceAccount = typeof jsonCreds === "string" ? JSON.parse(jsonCreds) : jsonCreds;
    } else if (b64Creds) {
      const decoded = Buffer.from(b64Creds, "base64").toString("utf8");
      serviceAccount = JSON.parse(decoded);
    } else {
      throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_BASE64 in worker environment.");
    }

    initializeApp({
      credential: cert(serviceAccount),
    });
  }

  // Connect to MongoDB Atlas reuse connection pool
  if (!isDbConnected || mongoose.connection.readyState !== 1) {
    await mongoose.connect(mongodbUri, {
      bufferCommands: false,
    });
    isDbConnected = true;
  }
}

export default {
  async fetch(request, env, ctx) {
    try {
      await setupEnvironment(env);

      const url = new URL(request.url);
      const body = ['GET', 'HEAD'].includes(request.method)
        ? undefined
        : await request.text();
      const event = {
        version: '2.0',
        routeKey: '$default',
        rawPath: url.pathname,
        rawQueryString: url.search.slice(1),
        headers: Object.fromEntries(request.headers),
        requestContext: {
          http: {
            method: request.method,
            path: url.pathname,
            sourceIp: request.headers.get('cf-connecting-ip') || '0.0.0.0',
          },
          requestId: request.headers.get('cf-ray') || crypto.randomUUID(),
        },
        body,
        isBase64Encoded: false,
      };

      const result = await serverlessHandler(event, ctx);
      const responseHeaders = new Headers(result.headers || {});
      for (const cookie of result.cookies || []) responseHeaders.append('Set-Cookie', cookie);
      const responseBody = result.isBase64Encoded
        ? Uint8Array.from(atob(result.body), (character) => character.charCodeAt(0))
        : result.body || '';

      return new Response(responseBody, {
        status: result.statusCode || 200,
        headers: responseHeaders,
      });
    } catch (error) {
      console.error("Cloudflare Worker Request Error:", error);
      return new Response(
        JSON.stringify({ error: error.message || "Internal Worker Error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  },

  async scheduled(event, env, ctx) {
    try {
      await setupEnvironment(env);
      console.log(`Cloudflare Cron Trigger fired at ${new Date().toISOString()}`);
      ctx.waitUntil(runDeadlineCheck());
    } catch (error) {
      console.error("Cloudflare Cron Trigger Error:", error);
    }
  },
};
