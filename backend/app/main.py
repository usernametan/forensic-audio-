from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from .db import Base, engine
from . import models  # noqa: F401 — register tables
from .routers import evidence, pipeline_status, review, export
from .config import settings

app = FastAPI(title=settings.app_name)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
Base.metadata.create_all(bind=engine)

app.include_router(evidence.router)
app.include_router(pipeline_status.router)
app.include_router(review.router)
app.include_router(export.router)


@app.get("/health")
def health():
    return {"ok": True}


outputs = Path(settings.storage_dir) / "outputs"
outputs.mkdir(parents=True, exist_ok=True)
app.mount("/outputs", StaticFiles(directory=str(outputs)), name="outputs")
