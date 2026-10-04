from fastapi import FastAPI

app = FastAPI(title="VoyAgent AI Service", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"service": "voyagent-ai", "status": "ok"}


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "VoyAgent AI service is ready"}

