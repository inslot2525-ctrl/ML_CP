"""Loading and cleaning of job posts.

The Kaggle dataset masks URLs, e-mails and phone numbers as tokens like
``#URL_ab12...#``. Text typed into the app contains real links and numbers, so
both are normalised to the same placeholder words (urltoken, emailtoken,
phonetoken) to keep training and inference consistent.
"""
import html
import re

import pandas as pd

from .config import CATEGORICAL_FIELDS, DATA_RAW, TEXT_FIELDS

_MASKED = re.compile(r"#(URL|EMAIL|PHONE)_[0-9a-f]+#", re.IGNORECASE)
_HTML_TAG = re.compile(r"<[^>]+>")
# Bare domains are matched case-sensitively: the dataset glues sentences like
# "company.In our team", which must not be mistaken for a ".in" link.
_URL = re.compile(r"((?i:https?://\S+|www\.\S+)|\b[\w-]+\.(?:com|in|net|org|ly|me|io|co)\b(?:/\S*)?)")
_EMAIL = re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.]+\b")
_PHONE = re.compile(r"(?:\+?\d[\d\s-]{8,}\d)")
# The dataset glues sentences together ("...teamWe are"), split camel joins.
_GLUED = re.compile(r"([a-z])([A-Z])")
_SPACES = re.compile(r"\s+")


def normalise_raw(text) -> str:
    """Replace links / e-mails / phones with placeholder words, keep casing."""
    if not isinstance(text, str) or not text:
        return ""
    t = html.unescape(text)
    t = _HTML_TAG.sub(" ", t)
    t = _MASKED.sub(lambda m: f" {m.group(1).lower()}token ", t)
    t = _EMAIL.sub(" emailtoken ", t)
    t = _URL.sub(" urltoken ", t)
    t = _PHONE.sub(" phonetoken ", t)
    t = _GLUED.sub(r"\1 \2", t)
    return _SPACES.sub(" ", t).strip()


def clean_text(text) -> str:
    """Lower-cased version of :func:`normalise_raw` used for TF-IDF."""
    t = normalise_raw(text).lower()
    t = t.replace("₹", " rupees ").replace("$", " dollars ")
    return _SPACES.sub(" ", t).strip()


def load_data(path=DATA_RAW) -> pd.DataFrame:
    df = pd.read_csv(path)
    for col in TEXT_FIELDS + ["salary_range"]:
        df[col] = df[col].fillna("")
    for col in CATEGORICAL_FIELDS:
        df[col] = df[col].fillna("Unknown")
    df["raw_text"] = df[TEXT_FIELDS].agg(" ".join, axis=1).map(normalise_raw)
    df["text"] = df["raw_text"].map(clean_text)
    return df
