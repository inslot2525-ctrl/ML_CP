from fastapi.testclient import TestClient

from api.main import app
from src.config import DEMO_SAMPLES

client = TestClient(app)
SCAM = "Selected without interview! Pay Rs 1499 registration fee and send Aadhaar on WhatsApp. Hurry!"


def test_health():
    assert client.get("/api/health").json() == {"status": "ok"}


def test_predict_scam():
    r = client.post("/api/predict", json={"text": SCAM, "has_logo": False})
    assert r.status_code == 200
    body = r.json()
    assert body["risk_level"] == "High"
    assert {f["id"] for f in body["red_flags"]} >= {"upfront_fee", "no_interview"}


def test_predict_validates_input():
    assert client.post("/api/predict", json={"text": ""}).status_code == 422
    assert client.post("/api/predict", json={"title": "no text"}).status_code == 422


def test_predict_batch_with_demo_csv():
    with open(DEMO_SAMPLES, "rb") as f:
        r = client.post("/api/predict-batch", files={"file": ("demo.csv", f, "text/csv")})
    assert r.status_code == 200
    rows = r.json()["rows"]
    assert len(rows) == 28 and {"risk_level", "risk_score", "red_flags"} <= rows[0].keys()


def test_predict_batch_rejects_bad_csv():
    r = client.post("/api/predict-batch", files={"file": ("x.csv", b"foo\nbar\n", "text/csv")})
    assert r.status_code == 400


def test_static_json_endpoints():
    assert client.get("/api/metrics").json()["final_model"] == "Stacking"
    assert client.get("/api/clusters").json()["k"] == 8
    assert client.get("/api/eda").json()["n_posts"] == 17880
    assert client.get("/api/demo-csv").status_code == 200
