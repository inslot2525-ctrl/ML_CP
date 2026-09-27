# Devpost submission: FakeHire

## Project Title
**FakeHire: Spot fake job & internship offers before they cost you money**

## Tagline (short description)
An explainable ML app that checks any job post or recruiter message for scam signals using 7 machine-learning
models, a stacking ensemble and transparent red-flag rules.

---

## Inspiration / Problem Statement
Every placement season, students and freshers get messages like *"Congratulations! You are selected for a data
entry job without interview. Pay ₹1,499 registration fee on WhatsApp."* Fake job and internship offers are one of
the fastest-growing forms of online fraud. They hit people who are young, inexperienced and desperate for work, and
they cost them money, time and sometimes their identity documents.

Job seekers have no quick way to check whether an offer is real, and generic spam filters don't understand the
recruitment context. **We wanted a tool anyone can use in 5 seconds that doesn't just say "fake" but explains why.**

## Solution Overview
FakeHire is a web app where you paste a job post or recruiter message and get:
1. A **scam-risk score** (Low / Medium / High) from a **stacking ensemble** that combines a text model (TF-IDF +
   Logistic Regression) and a metadata model (Random Forest on 17 engineered features).
2. **Explanations**: the exact words that pushed the prediction towards "fake", highlighted in the post, plus
   **red-flag rules** for tactics like upfront fees, WhatsApp-only contact, OTP or Aadhaar requests, and "no
   interview" promises.
3. The **scam archetype** it most resembles, discovered with **unsupervised K-Means clustering** of 866 real fake
   posts (e.g. "Work-from-home typing", "Fake recruiter & signing bonus", "Oil & gas jobs abroad").
4. **Practical safety tips** and where to report fraud in India (cybercrime.gov.in · 1930).

## Key Features
- 📊 **Dashboard**: model-quality stats, your recent checks (risk mix, top red flags), model leaderboard and scam insights at a glance
- 🔍 **Instant check** of a single post, with one-click examples for demos
- 📊 **"What each model says"**: see the probability from all 9 models side by side
- 🖍️ **Highlighted explanation** of suspicious words, with the rule matches underlined
- 🧭 **Scam archetype** detection via clustering
- 📁 **Batch mode**: upload a CSV of job posts (useful for college placement cells)
- 🧪 **Model Lab**: transparent comparison of all models (ROC/PR curves, confusion matrices, feature importance)
- 🗺️ **Scam Patterns**: data insights, e.g. posts without a company logo are **8× more likely** to be fake

## How we built it (Technologies Used)
- **Data:** EMSCAD, 17,880 real job posts, 866 of them fake (4.8%)
- **ML (scikit-learn, XGBoost, imbalanced-learn):**
  - Text models on TF-IDF (1–2 grams): Multinomial Naive Bayes, Logistic Regression, Linear SVM
  - Metadata models on 17 engineered features (missing company profile, no logo, money and urgency word rates,
    contact-app mentions, capital-letter ratio, …): KNN, Decision Tree, Random Forest, XGBoost
  - Ensembles: soft voting and **stacking** (Logistic Regression meta-learner trained on out-of-fold predictions)
  - Unsupervised: TF-IDF → Truncated SVD → K-Means (k chosen with elbow + silhouette), PCA for visualisation
  - Class imbalance: class weights vs SMOTE experiment, decision threshold tuned with cross-validation
- **Backend:** FastAPI REST API (`/api/predict`, `/api/predict-batch`, …) serving the trained models
- **Frontend:** React + TypeScript (Vite) with the Mantine component library, Tabler icons, Motion animations, React Router and Recharts; light/dark themes and a responsive phone layout
- **Deployment:** a single Docker container (FastAPI serves the built React app)
- **Quality:** pytest test suite, reproducible training scripts, a fixed random seed

## Results
| | Precision | Recall | F1 | PR-AUC |
|---|---|---|---|---|
| Best single model (Logistic Regression) | 0.957 | 0.890 | 0.922 | 0.957 |
| **Stacking ensemble (final)** | **0.963** | **0.890** | **0.925** | **0.961** |

Measured on a held-out test set of 3,576 posts that was never used for training or tuning. On our hand-written set
of 28 Indian-style messages, **all 15 scams were flagged and all 13 genuine posts passed.**

## Challenges we ran into
- **Imbalanced data:** only 4.8% of posts are fake, so a useless "always real" model already scores 95% accuracy.
  We switched to precision, recall, F1 and PR-AUC, used class weights and tuned thresholds on out-of-fold
  predictions.
- **Domain shift:** the dataset is mostly US posts from 2012–14, while Indian scams (WhatsApp task jobs,
  registration fees) look different. We added a transparent rule layer and show ML and rule evidence separately.
- **Explainability:** a single score isn't enough to change behaviour, so we built per-word contributions from the
  Logistic Regression coefficients and highlight them directly in the text.

## Accomplishments we're proud of
- A stacking ensemble with **0.96 precision**: when FakeHire says "scam", it's almost always right
- Every prediction is explained
- An honest evaluation: the test set was used once, and everything was chosen with cross-validation

## What we learned
Why accuracy misleads on imbalanced data, how stacking avoids leakage with out-of-fold predictions, how clustering
can reveal patterns nobody labelled, and that explanations matter as much as scores for real users.

## What's next
- Hindi and Hinglish support, and a WhatsApp bot you can forward messages to
- Checking a company's domain against official websites
- Collecting a labelled Indian job-scam dataset with college placement cells

## Target Users
- **Students and freshers** looking for internships and first jobs
- **College placement cells**, which can check job posts in bulk before forwarding them
- **Job boards and community groups** (Telegram/WhatsApp channels that share openings)

## Built With
`python` `scikit-learn` `xgboost` `imbalanced-learn` `pandas` `fastapi` `react` `typescript` `mantine` `recharts` `vite` `docker` `machine-learning` `nlp`

## Links
- GitHub: _add repo URL_
- Live demo: _add Render / Hugging Face URL_
- Video: _add YouTube/Drive URL_

## Team
| Name | Role |
|---|---|
| _Your name_ | ML modelling, app development, documentation |

## Files to upload
`docs/screenshots/dashboard.png`, `dashboard_dark.png`, `check.png`, `check_red_flags.png`, `check_models.png`, `batch.png`, `lab.png`, `patterns.png`, `about.png`, `mobile_dashboard.png`
