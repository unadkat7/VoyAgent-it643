# Deployment

Free tiers: **MongoDB Atlas** (database) and **Vercel** (frontend, backend and ai-service in one project).

`vercel.json` uses [Vercel Services](https://vercel.com/docs/services) to build the three apps into one deployment on one domain:

- `/api/*` goes to the Express backend, and every other path goes to the Next.js frontend. The browser calls the API on its own domain, so the login cookie is first-party and works in Safari, on iPhones and in Brave too.
- The FastAPI ai-service has no public route. The backend reaches it through `AI_SERVICE_URL`, which Vercel fills in through a service binding. It still checks `X-Internal-Key`, because Vercel does not authenticate calls between services.

## 1. MongoDB Atlas

1. Create a free M0 cluster and a database user. If the password was ever shared, change it first.
2. Under Network Access, allow `0.0.0.0/0`, because Vercel has no fixed outgoing IP.
3. Copy the connection string and add the database name: `mongodb+srv://USER:PASSWORD@CLUSTER/voyagent`.

## 2. Vercel

1. Import the repository. Leave **Root Directory** at the repository root, because `vercel.json` defines the services.
2. Under **Settings > Environment Variables** (Production), add the variables below. They are shared by all three services.

   | Variable | Value |
   |---|---|
   | `MONGO_DB_URI` | The Atlas URI from step 1 |
   | `JWT_SECRET` | A long random string |
   | `INTERNAL_API_KEY` | Another long random string, at least 16 characters |
   | `ADMIN_EMAILS` | Comma-separated emails that may open `/api/stats` |
   | `NODE_ENV` | `production` |
   | `ENVIRONMENT` | `production` |
   | `NEXT_PUBLIC_API_URL` | `/api` |
   | `GROQ_API_KEY` | Groq key (primary LLM) |
   | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` | Optional fallback LLM |
   | `SEARCHAPI_KEY` | Optional live Hotels and Flights |

3. Deploy. Check that `https://<domain>/api/health` returns `{"status":"ok"}`.
4. Turn on **Analytics** in the Vercel project. The `<Analytics />` component is already in the layout.

`FRONTEND_URL` is not needed in production. The backend accepts requests from its own domain, including preview URLs.

On the Hobby plan a function may run for up to 300 seconds. The backend waits up to 120 seconds for a plan, so that fits.

## 3. After deploying

- Put the live URL at the top of `README.md`.
- Sign in with an `ADMIN_EMAILS` account and open `/api/stats` for sign-up and Trip counts. Record them in `USAGE_EVIDENCE.md`.

## Known limits

- **Rate limits:** login, sign-up and plan limits are counted in memory, so each running copy of the backend counts on its own.
- **Nominatim:** the one-request-a-second spacing for Nominatim also applies per copy.
- **Beta:** Services is in beta. If it stops working, the fallback is to run the backend and ai-service on Render with their Dockerfiles, and add a Next.js rewrite of `/api` to the backend so the cookie stays first-party.
