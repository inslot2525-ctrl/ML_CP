import pandas as pd
import pytest

from src.config import DEMO_SAMPLES
from src.features import red_flags, rule_score
from src.predict import predict, predict_batch
from src.preprocess import clean_text, normalise_raw

SCAM = ("Congratulations! You are selected for Data Entry job without interview. Pay Rs 1499 "
        "registration fee and send Aadhaar copy on WhatsApp +91 98765 43210. Limited seats, hurry!")
REAL = ("Infosys is hiring Software Engineering Interns in Bengaluru. Requirements: B.Tech in Computer "
        "Science, knowledge of Java or Python. Selection includes an online test and two technical interviews.")


def test_normalise_masks_links_emails_phones():
    t = normalise_raw("Mail hr@gmail.com or visit https://x.com/jobs, call +91 98765 43210 #URL_ab12cd#")
    assert "emailtoken" in t and "urltoken" in t and "phonetoken" in t
    assert "gmail" not in t and "http" not in t


def test_glued_sentences_are_not_links():
    assert "urltoken" not in normalise_raw("We build great software for our company.In our team you will")


def test_clean_text_lowercases_and_maps_currency():
    assert clean_text("Earn ₹500 Daily") == "earn rupees 500 daily"


def test_rules_trigger_on_fee_scam_and_not_on_real_post():
    ids = {h["id"] for h in red_flags(SCAM)}
    assert {"upfront_fee", "no_interview", "personal_info", "messaging_app", "urgency"} <= ids
    assert red_flags(REAL) == []
    assert rule_score([]) == 0.0
    assert 0.8 < rule_score(red_flags(SCAM)) < 1.0


def test_salary_mention_is_not_a_fee():
    assert not any(h["id"] == "upfront_fee" for h in red_flags("We pay $60,000 per year plus benefits."))


def test_predict_output_structure():
    r = predict(REAL)
    for key in ["risk_level", "risk_score", "ml_probability", "rule_score", "all_models", "red_flags",
                "fake_words", "real_words", "tips", "base_models"]:
        assert key in r
    assert r["risk_level"] in {"Low", "Medium", "High"}
    for key in ["risk_score", "ml_probability", "rule_score"]:
        assert 0.0 <= r[key] <= 1.0
    assert len(r["all_models"]) == 9  # 3 text + 4 metadata + 2 ensembles


def test_scam_is_high_and_real_is_low():
    assert predict(SCAM)["risk_level"] == "High"
    real = predict(REAL, company_profile="Infosys is a global IT services company.", has_logo=True)
    assert real["risk_level"] == "Low"
    assert real["ml_probability"] < 0.2


def test_optional_fields_change_metadata_model():
    base = predict("Work from home, earn money fast", company_profile="", has_logo=False)
    safer = predict("Work from home, earn money fast", company_profile="Acme Corp, founded 1990.", has_logo=True)
    assert safer["ml_probability"] < base["ml_probability"]


def test_demo_samples_are_separated():
    d = pd.read_csv(DEMO_SAMPLES)
    flagged = d.apply(lambda r: predict(r.text, title=r.title)["risk_level"] != "Low", axis=1)
    accuracy = (flagged == (d.label == "scam")).mean()
    assert accuracy >= 0.9


def test_predict_batch():
    out = predict_batch(pd.DataFrame({"title": ["A", "B"], "text": [SCAM, REAL]}))
    assert list(out["risk_level"]) == ["High", "Low"]
    with pytest.raises(ValueError):
        predict_batch(pd.DataFrame({"foo": ["x"]}))
