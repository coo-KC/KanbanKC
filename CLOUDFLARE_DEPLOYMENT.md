# 🚀 KanbanKC Cloudflare Workers Backend Deployment Guide

This guide details how to deploy the KanbanKC backend to Cloudflare Workers and update your Vercel frontend.

---

## 📋 Prerequisites
1. Free **Cloudflare** account ([cloudflare.com](https://dash.cloudflare.com)).
2. Node.js installed locally.

---

## 🛠️ Step 1: Install & Login to Cloudflare Wrangler CLI

Open a terminal in the `backend/` directory:

```bash
cd backend
npx wrangler login
```
*This will open your browser to authorize Wrangler with your Cloudflare account.*

---

## 🔑 Step 2: Set Environment Secrets in Cloudflare Workers

Set your MongoDB Atlas URI, Firebase Admin Service Account JSON, and Vercel Frontend Origin using Wrangler:

### 1. Set MongoDB Connection String:
```bash
npx wrangler secret put MONGODB_URI
```
*When prompted, paste your full MongoDB connection string (e.g., `mongodb+srv://username:password@cluster.mongodb.net/kanbankc?retryWrites=true&w=majority`).*

### 2. Set Firebase Credentials:
```bash
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT_JSON
```
*When prompted, paste the full JSON contents of your `serviceAccountKey.json` file.*

### 3. Set Allowed Vercel Frontend Origin:
```bash
npx wrangler secret put FRONTEND_ORIGIN
```
*When prompted, paste your Vercel frontend domain (e.g., `https://kanbankc.vercel.app`).*

---

## 🚀 Step 3: Deploy the Backend to Cloudflare Workers

Run the deployment command inside `backend/`:

```bash
npm run deploy
```

Once deployment completes, Wrangler will print your backend URL, for example:
```text
Published kanbankc-backend (1.52 sec)
  https://kanbankc-backend.<your-subdomain>.workers.dev
```

---

## 🧪 Step 4: Test Your Deployed Cloudflare Backend

You can test your deployed backend in your browser or curl:

```bash
curl https://kanbankc-backend.<your-subdomain>.workers.dev/health
```

Expected response:
```json
{ "status": "ok", "uptime": 0 }
```

---

## 🔗 Step 5: Connect Vercel Frontend to Cloudflare Backend

1. Go to your **Vercel Dashboard** -> select your `kanbankc` frontend project.
2. Go to **Settings** -> **Environment Variables**.
3. Add or update the variable:
   - **Key**: `VITE_BACKEND_URL`
   - **Value**: `https://kanbankc-backend.<your-subdomain>.workers.dev`
4. Redeploy your Vercel project (or trigger a new build) so Vercel picks up the new backend URL.

---

## 💻 Local Worker Development (Optional)

To test the worker locally before deploying:

1. Copy `.dev.vars.example` to `.dev.vars` inside `backend/`:
   ```bash
   cp .dev.vars.example .dev.vars
   ```
2. Populate `.dev.vars` with your actual MongoDB URI and Firebase JSON.
3. Run local Cloudflare Worker environment:
   ```bash
   npm run dev:worker
   ```
