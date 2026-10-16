# VoyAgent

VoyAgent is an AI-powered travel-planning academic project.

## Project structure

```text
voyagent/
|-- frontend/      Next.js user interface
|-- backend/       Express REST API
|-- ai-service/    FastAPI AI microservice
|-- docs/          Project documentation
|-- .env.example   Shared local configuration reference
`-- docker-compose.yml
```

## Local setup

1. Copy `.env.example` to `.env` and update values when integrations are added.
2. Install JavaScript dependencies:
   - `cd frontend && npm install`
   - `cd ../backend && npm install`
3. Install Python dependencies:
   - `cd ../ai-service`
   - `python -m venv .venv`
   - `.venv\\Scripts\\activate`
   - `pip install -r requirements.txt`
4. Run each service in a separate terminal with `npm run dev` or `uvicorn main:app --reload`.

## Initial endpoints

- Frontend: `http://localhost:3000`
- Backend health check: `http://localhost:5000/api/health`
- AI service health check: `http://localhost:8000/health`
