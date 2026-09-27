"""Inference API used by the FastAPI backend (api/main.py) and the tests.

    from src.predict import predict
    result = predict("Earn Rs 3000 daily from home, pay Rs 499 registration fee on WhatsApp")
"""
import json
from functools import lru_cache

import joblib
import numpy as np
import pandas as pd

from .config import BINARY_FIELDS, CATEGORICAL_FIELDS, MODELS_DIR
from .features import meta_features, red_flags, rule_score
from .preprocess import clean_text, normalise_raw

GENERIC_TIPS = [
    "Look up the company on its official website and LinkedIn. Apply only through its careers page.",
    "Ask for a written offer letter and verify it by calling the company's official number.",
    "Never pay money, share OTPs or send ID documents before you have verified the employer.",
    "In India, report job fraud at cybercrime.gov.in or call 1930.",
]


@lru_cache(maxsize=1)
def load_artifacts():
    info = json.loads((MODELS_DIR / "model_info.json").read_text())
    models = joblib.load(MODELS_DIR / "models.joblib")
    clusters = joblib.load(MODELS_DIR / "clusters.joblib")
    return info, models, clusters


def build_frame(text, title="", company_profile="", salary="", has_logo=None, has_questions=None,
                telecommuting=None, employment_type="Unknown", required_experience="Unknown",
                required_education="Unknown", defaults=None):
    """Turn app inputs into the same feature frame the models were trained on.

    Yes/no fields left as None ("Not sure") use the most common training value.
    """
    defaults = defaults or {}
    raw = normalise_raw(" ".join(p for p in [title, company_profile, text] if p))
    row = {
        "raw_text": raw, "company_profile": company_profile or "", "salary_range": salary or "",
        "employment_type": employment_type or "Unknown", "required_experience": required_experience or "Unknown",
        "required_education": required_education or "Unknown",
    }
    for col, val in zip(BINARY_FIELDS, [has_logo, has_questions, telecommuting]):
        row[col] = float(defaults.get(col, 0.0)) if val is None else float(bool(val))
    X = meta_features(pd.DataFrame([row]))
    X["text"] = clean_text(raw)
    return X


def explain_words(lr_pipe, X, k=8):
    """Per-word contribution = TF-IDF value x Logistic Regression coefficient."""
    vec = lr_pipe.named_steps["prep"].named_transformers_["tfidf"]
    coef = lr_pipe.named_steps["clf"].coef_[0]
    x = vec.transform(X["text"]).tocsr()
    if x.nnz == 0:
        return [], []
    vocab = vec.get_feature_names_out()
    contrib = x.data * coef[x.indices]
    order = np.argsort(contrib)
    fake = [{"term": vocab[x.indices[i]], "weight": round(float(contrib[i]), 3)} for i in order[::-1][:k] if contrib[i] > 0]
    real = [{"term": vocab[x.indices[i]], "weight": round(float(contrib[i]), 3)} for i in order[:k] if contrib[i] < 0]
    return fake, real


def risk_level(combined, ml_prob, threshold):
    if combined >= 0.6 or ml_prob >= threshold:
        return "High"
    if combined >= 0.3:
        return "Medium"
    return "Low"


def predict(text, **fields):
    info, models, clusters = load_artifacts()
    X = build_frame(text, defaults=info["binary_defaults"], **fields)

    final = models[info["final_model"]]
    base = final.base_probas(X)[0]
    ml_prob = float(final.combine(base[None, :])[0])
    all_models = {name: float(m.predict_proba(X)[0, 1]) for name, m in models.items()}

    full_text = " ".join(p for p in [fields.get("title", ""), fields.get("company_profile", ""), text] if p)
    flags = red_flags(full_text)
    r_score = rule_score(flags)
    combined = 1.0 - (1.0 - ml_prob) * (1.0 - r_score)
    level = risk_level(combined, ml_prob, info["threshold"])

    fake_words, real_words = explain_words(models["Logistic Regression"], X)

    archetype = None
    if level != "Low" and X["text"].iloc[0]:
        z = clusters["pipeline"].transform(X["text"])
        c = int(clusters["kmeans"].predict(z)[0])
        centroid = clusters["kmeans"].cluster_centers_[c]
        sim = float(z[0] @ centroid / (np.linalg.norm(centroid) + 1e-9))
        archetype = {"id": c, "name": clusters["names"][c], "similarity": round(sim, 3)}

    return {
        "risk_level": level,
        "risk_score": round(combined, 4),
        "ml_probability": round(ml_prob, 4),
        "rule_score": round(r_score, 4),
        "threshold": info["threshold"],
        "final_model": info["final_model"],
        "base_models": {info["best_text"]: round(float(base[0]), 4), info["best_meta"]: round(float(base[1]), 4)},
        "all_models": {k: round(v, 4) for k, v in all_models.items()},
        "red_flags": flags,
        "fake_words": fake_words,
        "real_words": real_words,
        "archetype": archetype,
        "tips": [f["tip"] for f in flags] + GENERIC_TIPS,
    }


def predict_batch(df: pd.DataFrame) -> pd.DataFrame:
    """Score a CSV-style frame. Uses the columns that exist, text column required."""
    text_col = next((c for c in ["text", "description", "message", "post"] if c in df.columns), None)
    if text_col is None:
        raise ValueError("CSV needs a 'text', 'description', 'message' or 'post' column")
    rows = []
    for _, r in df.iterrows():
        kw = {k: str(r[k]) for k in ["title", "company_profile"] if k in df.columns and pd.notna(r[k])}
        if "salary_range" in df.columns and pd.notna(r["salary_range"]):
            kw["salary"] = str(r["salary_range"])
        for col, arg in zip(BINARY_FIELDS, ["has_logo", "has_questions", "telecommuting"]):
            if col in df.columns and pd.notna(r[col]):
                kw[arg] = int(r[col])
        for col in CATEGORICAL_FIELDS:
            if col in df.columns and pd.notna(r[col]):
                kw[col] = str(r[col])
        res = predict(str(r[text_col]), **kw)
        rows.append({"risk_level": res["risk_level"], "risk_score": res["risk_score"],
                     "ml_probability": res["ml_probability"],
                     "red_flags": "; ".join(f["message"] for f in res["red_flags"])})
    return pd.concat([df.reset_index(drop=True), pd.DataFrame(rows)], axis=1)
