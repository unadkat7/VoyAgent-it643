# Deployment

Free tiers: **MongoDB Atlas** (database), **Render** (backend and ai-service, Docker), **Vercel** (frontend).

## 1. MongoDB Atlas

1. Create a free M0 cluster and a database user.
2. Under Network Access, allow `0.0.0.0/0`, because Render's free tier has no fixed outbound IP.
3. Copy the connection string and add the database name: `mongodb+srv://USER:PASSWORD@CLUSTER/voyagent`.

## 2. Render (Blueprint)

1. In Render, choose **New > Blueprint**, pick this repository, and Render reads `render.yaml`.
2. Generate one long random string and use it as `INTERNAL_API_KEY` on **both** services.
3. Set these on **voyagent-ai-service**: `GROQ_API_KEY` and, optionally, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` and `SEARCHAPI_KEY`.
4. Set these on **voyagent-backend**:
   - `MONGO_DB_URI`
   - `AI_SERVICE_URL`: the ai-service's `https://…onrender.com` URL
   - `FRONTEND_URL`: the Vercel URL from step 3
   - `ADMIN_EMAILS`: who may open `/api/stats`
5. Check that `https://<service>.onrender.com/health` returns `{"status": "ok"}` on both services.

Free Render services sleep after about 15 minutes idle. The first request afterwards takes about 30–60 seconds. The backend waits up to 120 seconds for a plan, so a cold start still succeeds.

## 3. Vercel

1. Import the repository and set **Root Directory** to `frontend`.
2. Set the environment variable `NEXT_PUBLIC_API_URL=https://<backend>.onrender.com/api`.
3. Deploy, then put the Vercel URL into the backend's `FRONTEND_URL` and redeploy the backend.
4. Turn on **Analytics** in the Vercel project. The `<Analytics />` component is already in the layout.

## 4. After deploying

- Put the live URL at the top of `README.md`.
- Sign in with an `ADMIN_EMAILS` account and open `/api/stats` for sign-up and Trip counts. Record them in `USAGE_EVIDENCE.md`.

Cross-site cookies need HTTPS. That is why the backend sets `secure` and `SameSite=None` only when `NODE_ENV=production`.
