import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from .clients import init_firebase
from .routes_ai import router as ai_router


load_dotenv()

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="TeamChat AI Backend")

# CORS for local dev and hosting
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "*",  # relax for now; tighten for production
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_firebase()


@app.get("/health")
async def health_check() -> dict:
    return {"status": "ok"}


@app.get("/")
async def root() -> dict:
    return {"message": "TeamChat AI Backend"}


app.include_router(ai_router)

