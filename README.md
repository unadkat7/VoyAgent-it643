# VoyAgent

VoyAgent plans a Trip from a chat. Tell it where you start, where you want to go, for how long, how many of you are going, your Budget and your travel style. It asks for anything missing, then builds a day-by-day Itinerary with Hotel and Flight Recommendations that fit your Budget, plus an Estimated Cost in INR.

**Live:** _not deployed yet_ (all three services on one Vercel project). See [docs/deployment.md](docs/deployment.md).

## Run it locally (Docker, 4 commands)

```bash
git clone https://github.com/unadkat7/VoyAgent-it643.git
cd VoyAgent-it643
cp .env.example .env        # then set GROQ_API_KEY (free at console.groq.com)
docker compose up --build   # open http://localhost:3000
```

SearchApi.io and Cloudflare keys are optional. Without SearchApi.io, Hotels and Flights are AI-suggested and labelled *Estimated Cost*.

Each Trip Plan has a **Map** tab that pins the Destination, Hotels and Activities by day. It needs no key: places are found with free OpenStreetMap Nominatim (set `GEOCODER_ENABLED=false` to skip), and map tiles come from OpenStreetMap.

Usage evidence: set `ADMIN_EMAILS` and the two `ADMIN_SEED_*` values in `.env`, run `docker compose exec backend npm run seed:admin`, then sign in as the admin and open `/admin`. See [USAGE_EVIDENCE.md](USAGE_EVIDENCE.md).

## How it fits together

| Part | Stack | Owner |
|---|---|---|
| `frontend/` | Next.js 16, React 19, Tailwind | Sumit |
| `backend/` | Express 5, MongoDB (Mongoose), JWT cookie sessions, zod | Devam |
| `ai-service/` domain rules, Planning Engine graph | FastAPI, LangGraph, Pydantic, uv | Jay |
| `ai-service/` ports, LLM and search adapters, CI | Groq, Cloudflare Workers AI, SearchApi.io | Jeet |

The browser talks only to the backend. The backend calls the ai-service with a shared internal key. Design, rules and the boundary are in [DESIGN.md](DESIGN.md), tests in [TESTING.md](TESTING.md), and words in [UBIQUITOUS_LANGUAGE.md](UBIQUITOUS_LANGUAGE.md).

## Develop without Docker

```bash
cd ai-service && uv sync && uv run uvicorn app:create_app --factory --reload --port 8000
cd backend && npm install && npm run dev          # needs MongoDB on localhost:27017
cd frontend && npm install && npm run dev
```

Each service has its own `.env.example`.

## Tests

```bash
cd ai-service && uv run pytest
cd backend && npm test
cd frontend && npm test
python scripts/check_doc_refs.py
```
