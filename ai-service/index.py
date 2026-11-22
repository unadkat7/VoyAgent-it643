# Vercel entrypoint: its FastAPI runtime looks for a module-level `app`.
from app import create_app

app = create_app()
