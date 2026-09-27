"""Engineered (metadata) features and transparent red-flag rules.

`meta_features` turns a job post into the numeric/categorical columns used by
the tabular models (KNN, Decision Tree, Random Forest, XGBoost).
`red_flags` is a hand-written rule layer shown next to the ML score so users
can see *why* a message looks suspicious, even for scam styles (e.g. Indian
WhatsApp "task" jobs) that are rare in the training data.
"""
import re

import numpy as np
import pandas as pd

from .config import BINARY_FIELDS, CATEGORICAL_FIELDS

MONEY_WORDS = re.compile(
    r"\b(earn|earning|income|cash|payout|salary|fee|fees|deposit|payment|pay|paid|money|profit|bonus|investment|rupees|dollars)\b",
    re.I,
)
URGENCY_WORDS = re.compile(r"\b(urgent|urgently|immediate|immediately|hurry|asap|limited|now|today|quick|fast|instant)\b", re.I)
CONTACT_APPS = re.compile(r"\b(whatsapp|telegram|skype|signal|wechat|hangouts|text me|sms|dm)\b", re.I)

NUMERIC_FEATURES = [
    *BINARY_FIELDS,
    "salary_given",
    "company_profile_missing",
    "log_word_count",
    "money_words",
    "urgency_words",
    "contact_app_words",
    "url_count",
    "email_count",
    "phone_count",
    "caps_ratio",
    "exclamations",
]
META_COLUMNS = NUMERIC_FEATURES + CATEGORICAL_FIELDS


def _per_100_words(count, words):
    return 100.0 * count / words.clip(lower=1)


def meta_features(df: pd.DataFrame) -> pd.DataFrame:
    """Build the metadata feature table.

    Expects columns: raw_text, company_profile, salary_range, the binary
    fields and the categorical fields (see config).
    """
    raw = df["raw_text"].fillna("")
    words = raw.str.split().str.len().fillna(0)
    letters = raw.str.count(r"[A-Za-z]").clip(lower=1)
    out = pd.DataFrame(index=df.index)
    for col in BINARY_FIELDS:
        out[col] = df[col].astype(float)
    out["salary_given"] = (df["salary_range"].fillna("").str.strip() != "").astype(float)
    out["company_profile_missing"] = (df["company_profile"].fillna("").str.strip() == "").astype(float)
    out["log_word_count"] = np.log1p(words)
    out["money_words"] = _per_100_words(raw.str.count(MONEY_WORDS), words)
    out["urgency_words"] = _per_100_words(raw.str.count(URGENCY_WORDS), words)
    out["contact_app_words"] = raw.str.count(CONTACT_APPS).astype(float)
    out["url_count"] = raw.str.count(r"\burltoken\b").astype(float)
    out["email_count"] = raw.str.count(r"\bemailtoken\b").astype(float)
    out["phone_count"] = raw.str.count(r"\bphonetoken\b").astype(float)
    out["caps_ratio"] = raw.str.count(r"[A-Z]") / letters
    out["exclamations"] = raw.str.count("!").astype(float)
    for col in CATEGORICAL_FIELDS:
        out[col] = df[col].fillna("Unknown").astype(str)
    return out[META_COLUMNS]


# --------------------------------------------------------------------------
# Red-flag rules: (id, regex, weight, what we found, safety tip)
# Weights are hand-set "how suspicious is this on its own" values in [0, 1].
# --------------------------------------------------------------------------
RULES = [
    ("upfront_fee",
     r"(registration|training|joining|processing|security|kit|document|verification|refundable|interview)\s*(fee|fees|charge|charges|amount|deposit)"
     r"|(have|need|required)\s+to\s+(pay|deposit)|(kindly|please|just|only)\s+(pay|deposit)"
     r"|pay\s*(rs\.?|₹|inr)\s*\d+|(fee|deposit)\s*(of)?\s*(rs\.?|₹|inr|\$)\s*\d+",
     0.60, "Asks you to pay a fee or deposit",
     "Real employers never charge you to apply, train or join. Do not pay."),
    ("task_scam",
     r"like\s+(videos|posts|pages)|rate\s+(hotels|products|apps|movies)|youtube\s+(likes|subscribe)|prepaid\s+task|telegram\s+task|review\s+tasks?|simple\s+tasks?",
     0.50, "Describes a 'simple online task' job (likes, ratings, reviews)",
     "'Like and earn' or rating tasks are a well-known scam that ends with you depositing money."),
    ("no_interview",
     r"no\s+interview|without\s+(any\s+)?interview|direct\s+(joining|selection)|100\s*%\s*(job|placement|guarantee)|guaranteed\s+(job|income|placement|selection)|selected\s+without",
     0.35, "Promises a job without an interview or guarantees selection",
     "Genuine hiring involves screening. Guaranteed selection is a warning sign."),
    ("personal_info",
     r"aadhaa?r|pan\s*card|bank\s*(account|details)|account\s+number|\botp\b|\bcvv\b|\bssn\b|social\s+security|passport\s+(copy|details)",
     0.35, "Asks for ID, bank details or OTP",
     "Never share OTPs, bank details or ID copies before a verified offer letter."),
    ("unrealistic_pay",
     r"earn\s*(up\s*to\s*)?(rs\.?|₹|inr|\$)?\s*\d[\d,]*\s*(k\b)?\s*(\+)?\s*(per|/|a|every)\s*(day|week|hour)"
     r"|daily\s+(payout|payment|income)|(earn|income).{0,30}from\s+home|part[- ]time.{0,40}(earn|income|payout)",
     0.30, "Promises unusually high or daily earnings",
     "High pay for little work is the most common hook in job scams."),
    ("messaging_app",
     r"whats\s*app|telegram|wa\.me|t\.me|signal\s+app|wechat|skype\s+(interview|id)",
     0.25, "Moves the conversation to WhatsApp / Telegram",
     "Recruiters from real companies use official e-mail and career portals."),
    ("payment_method",
     r"crypto|bitcoin|\busdt\b|gift\s*card|western\s+union|money\s*gram|wire\s+transfer|\bupi\s*id\b"
     r"|(send|transfer|pay).{0,25}(paytm|google\s*pay|gpay|phonepe|\bupi\b)",
     0.30, "Mentions crypto, gift cards or UPI transfers",
     "Legit employers pay salaries by bank transfer and never ask you to send money."),
    ("free_email",
     r"@(gmail|yahoo|hotmail|outlook|rediffmail|ymail|protonmail)\.",
     0.20, "Recruiter uses a free e-mail address (Gmail, Yahoo, ...)",
     "Check that the recruiter's e-mail domain matches the company's website."),
    ("short_link",
     r"bit\.ly|tinyurl|goo\.gl|cutt\.ly|rb\.gy|is\.gd|forms\.gle",
     0.20, "Contains a shortened or form link",
     "Short links hide the real destination. Apply only through the official careers page."),
    ("urgency",
     r"\burgent(ly)?\b|limited\s+(seats|slots|vacancies|time)|hurry|today\s+only|act\s+now|last\s+date\s+today|join\s+immediately",
     0.15, "Pressures you to act urgently",
     "Scammers create urgency so you don't have time to verify."),
    ("no_experience",
     r"no\s+(experience|qualification|skills?)\s+(needed|required|necessary)|anyone\s+can\s+(apply|do)|housewives|students\s+can\s+earn",
     0.10, "Says no experience or qualification is needed",
     "Not a scam on its own, but combined with high pay it is a red flag."),
]
_COMPILED = [(rid, re.compile(pat, re.I), w, msg, tip) for rid, pat, w, msg, tip in RULES]


def red_flags(text: str) -> list[dict]:
    """Return every triggered rule with the matched snippet."""
    hits = []
    for rid, rx, weight, msg, tip in _COMPILED:
        m = rx.search(text or "")
        if m:
            hits.append({"id": rid, "weight": weight, "message": msg, "tip": tip, "match": m.group(0).strip()})
    return hits


def rule_score(hits: list[dict]) -> float:
    """Combine rule weights like independent evidence: 1 - prod(1 - w)."""
    return float(1.0 - np.prod([1.0 - h["weight"] for h in hits])) if hits else 0.0
