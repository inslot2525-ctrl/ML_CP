"""FakeHire REST API + static host for the React frontend.

Run (dev):   uvicorn api.main:app --reload --port 8000
The React app (frontend/dist) is served at "/" when it has been built.
"""
import io
import json
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal, Optional

import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from src.config import CLUSTERS_PATH, DEMO_SAMPLES, EDA_PATH, METRICS_PATH, ROOT
from src.predict import load_artifacts, predict, predict_batch

DIST = ROOT / "frontend" / "dist"
MAX_BATCH_ROWS = 500


@asynccontextmanager
async def lifespan(_app):
    load_artifacts()  # load models once at startup
    yield


app = FastAPI(title="FakeHire API", version="1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"], allow_methods=["*"], allow_headers=["*"])


class JobPost(BaseModel):
    text: str = Field(min_length=1, max_length=20000)
    title: str = ""
    company_profile: str = ""
    salary: str = ""
    has_logo: Optional[bool] = None
    has_questions: Optional[bool] = None
    telecommuting: Optional[bool] = None
    employment_type: str = "Unknown"
    required_experience: str = "Unknown"
    required_education: str = "Unknown"


def _json(path: Path):
    return json.loads(path.read_text())


@app.get("/api/health")
def health() -> dict[Literal["status"], str]:
    return {"status": "ok"}


@app.post("/api/predict")
def predict_one(post: JobPost):
    fields = post.model_dump()
    text = fields.pop("text")
    if not text.strip():
        raise HTTPException(422, "text is empty")
    return predict(text, **fields)


@app.post("/api/predict-batch")
async def predict_many(file: UploadFile = File(...)):
    try:
        df = pd.read_csv(io.BytesIO(await file.read()))
    except Exception as err:  # malformed CSV
        raise HTTPException(400, f"Could not read CSV: {err}")
    truncated = len(df) > MAX_BATCH_ROWS
    try:
        out = predict_batch(df.head(MAX_BATCH_ROWS))
    except ValueError as err:
        raise HTTPException(400, str(err))
    return {"truncated": truncated, "rows": json.loads(out.to_json(orient="records"))}


@app.get("/api/metrics")
def metrics():
    return _json(METRICS_PATH)


@app.get("/api/clusters")
def clusters():
    return _json(CLUSTERS_PATH)


@app.get("/api/eda")
def eda():
    return _json(EDA_PATH)


@app.get("/api/demo-csv")
def demo_csv():
    return FileResponse(DEMO_SAMPLES, media_type="text/csv", filename="fakehire_demo.csv")


# ----------------------------------------------------------------------------- React build (single-page app)
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        file = DIST / path
        if path and file.is_file() and DIST in file.resolve().parents:
            return FileResponse(file)
        return FileResponse(DIST / "index.html")
