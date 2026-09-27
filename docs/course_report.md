# FakeHire: Detecting Fraudulent Job Postings with Machine Learning
*Machine Learning Course Project Report*

**Student:** _Your name_ · **Roll no.:** _…_ · **Course:** _…_ · **Instructor:** _…_

---

## 1. Introduction
Online recruitment fraud (fake job and internship offers) is a growing problem. Scammers post attractive jobs or
message candidates directly, then ask for "registration fees", personal documents or bank details. Students and
fresh graduates are the most vulnerable group.

**Objective.** Build and compare machine-learning models that classify a job post as *real* or *fake*, explain
their predictions, and discover common scam patterns. Then deploy the best model in a usable web application.

**ML problem types covered:**
- binary classification (supervised)
- text classification (NLP with TF-IDF)
- ensemble learning
- clustering and dimensionality reduction (unsupervised)
- learning from imbalanced data

## 2. Dataset
**EMSCAD** (Employment Scam Aegean Dataset, University of the Aegean; distributed on Kaggle as "Real or Fake Job
Posting Prediction").

| Property | Value |
|---|---|
| Posts | 17,880 |
| Fake posts | 866 (**4.84%**, highly imbalanced) |
| Text fields | title, company_profile, description, requirements, benefits |
| Binary fields | telecommuting, has_company_logo, has_questions |
| Categorical fields | employment_type, required_experience, required_education, industry, function |
| Target | `fraudulent` (0 = real, 1 = fake) |

Missing values are common: salary is missing in 84% of posts, benefits in 40%, the company profile in 18.5%.

## 3. Exploratory Data Analysis
*(Figures: `reports/figures/eda_*.png`, notebook `01_eda.ipynb`)*

| Attribute | % fake when present | % fake when absent |
|---|---|---|
| Company logo | 2.0% (has logo) | **15.9%** (no logo) |
| Company profile | 1.9% (has profile) | **17.7%** (no profile) |
| Salary shown | 7.8% | 4.3% |
| Remote job | 8.3% | 4.7% |

- Posts **without a logo are 8× more likely** to be fake, and posts without a company profile about 9× more likely.
- Fake posts are **shorter** (median 233 words vs 365).
- The riskiest industries are Oil & Energy (38% fake) and Accounting (36%). The riskiest function is Administrative (19%).

These findings motivated the engineered features in Section 4.2.

## 4. Methodology

### 4.1 Pre-processing
1. Concatenate the five text fields into one document.
2. Strip HTML and fix sentences that were glued together (e.g. `teamWe are` → `team We are`).
3. Replace URLs, e-mail addresses and phone numbers with placeholder tokens (`urltoken`, `emailtoken`,
   `phonetoken`). The dataset already masks them, and user input is normalised the same way.
4. Lower-case the text and map currency symbols to words.
5. Fill missing categorical values with "Unknown".

### 4.2 Feature engineering
**(a) Text features:** TF-IDF on unigrams and bigrams, English stop words removed, `min_df = 2`, `max_df = 0.9`, at
most 50,000 features, sub-linear TF.

**(b) Metadata features (17):**
- **Binary:** has_company_logo, has_questions, telecommuting, salary_given, company_profile_missing
- **Numeric:** log word count; money-word rate and urgency-word rate (per 100 words); counts of contact-app words,
  URLs, e-mails and phone numbers; capital-letter ratio; exclamation marks
- **Categorical (one-hot):** employment type, required experience, required education
- Numeric features are standardised, which matters for KNN.

### 4.3 Models
| Family | Model | Why it was chosen |
|---|---|---|
| Text | **Multinomial Naive Bayes** | Classic, fast baseline for word counts. Assumes words are conditionally independent. |
| Text | **Logistic Regression** | Linear model with interpretable coefficients (one weight per word). Class weights handle imbalance. |
| Text | **Linear SVM** | Maximum-margin classifier that works well in high-dimensional sparse spaces. Wrapped in sigmoid calibration to get probabilities. |
| Metadata | **K-Nearest Neighbours** (k = 15, distance-weighted) | Instance-based learning. Shows the effect of feature scaling. |
| Metadata | **Decision Tree** (depth ≤ 10) | Interpretable rules. Tends to overfit. |
| Metadata | **Random Forest** (300 trees) | Bagging of decorrelated trees. Reduces variance and gives feature importance. |
| Metadata | **XGBoost** (400 trees, depth 5) | Gradient boosting. `scale_pos_weight` handles imbalance. |
| Ensemble | **Soft Voting** | Average of the best text and best metadata probabilities. |
| Ensemble | **Stacking** | Logistic Regression meta-learner trained on the *out-of-fold* probabilities of the two base models. |

### 4.4 Experimental protocol
1. **Stratified 80/20 split:** 14,304 training posts (693 fake) and 3,576 test posts (173 fake). The test set is
   used **only once**.
2. **5-fold stratified cross-validation** on the training set gives out-of-fold (OOF) probabilities for every model.
3. The OOF probabilities are used to:
   - **tune the decision threshold** of each model (the threshold that maximises F1 for the fake class),
   - **select** the best text and the best metadata model (by CV PR-AUC),
   - **train the stacking meta-learner** without leakage.
4. **Metrics:** precision, recall, F1 (fake class), ROC-AUC and PR-AUC. **Accuracy is misleading here:** always
   predicting "real" scores 95.2% accuracy and catches zero scams.

## 5. Results

### 5.1 Model comparison (held-out test set)
| Model | CV PR-AUC | Precision | Recall | F1 | ROC-AUC | PR-AUC | Accuracy |
|---|---|---|---|---|---|---|---|
| Naive Bayes | 0.861 | 0.851 | 0.855 | 0.853 | 0.992 | 0.921 | 0.986 |
| Logistic Regression | 0.915 | 0.957 | 0.890 | 0.922 | 0.993 | 0.957 | 0.993 |
| Linear SVM | 0.914 | 0.962 | 0.884 | 0.922 | 0.993 | 0.955 | 0.993 |
| KNN | 0.695 | 0.675 | 0.636 | 0.655 | 0.947 | 0.747 | 0.968 |
| Decision Tree | 0.419 | 0.401 | 0.676 | 0.503 | 0.880 | 0.503 | 0.935 |
| Random Forest | 0.713 | 0.701 | 0.636 | 0.667 | 0.964 | 0.774 | 0.969 |
| XGBoost | 0.685 | 0.680 | 0.676 | 0.678 | 0.949 | 0.758 | 0.969 |
| Soft Voting | 0.914 | 0.956 | 0.884 | 0.919 | 0.995 | 0.957 | 0.992 |
| **Stacking** | **0.921** | **0.963** | **0.890** | **0.925** | **0.995** | **0.961** | **0.993** |

*(Figures: `model_comparison.png`, `roc_pr_curves.png`, `confusion_matrices.png`)*

**Stacking confusion matrix (test set):** 154 scams caught, 19 missed, 6 real jobs wrongly flagged, 3,397 real jobs
passed.

### 5.2 Discussion
- **Text beats metadata.** The words of a post carry far more signal (F1 about 0.92) than its structure
  (F1 about 0.67). Linear models (Logistic Regression and SVM) do best on high-dimensional sparse TF-IDF, as theory
  predicts. Naive Bayes is slightly weaker because of its independence assumption.
- Among the metadata models, the **ensembles of trees (Random Forest, XGBoost) beat a single Decision Tree**, which
  overfits (lowest PR-AUC, 0.503). KNN is competitive only because the features were scaled.
- **Stacking** gives a small but consistent gain over the best single model in both CV and test PR-AUC. The
  metadata model adds independent evidence (missing logo or profile) that the text model cannot see.
- ROC-AUC is above 0.99 for most text models. That is inflated by the many easy negatives, and **PR-AUC separates
  the models much better** on imbalanced data.

### 5.3 What the models learned
- **Logistic Regression, words that signal fake:** `link urltoken`, `apply using`, `phonetoken`, `money`,
  `receptionist`, `data entry`, `hospital`. These point to external application links, phone contact, money talk and
  administrative roles.
- **Words that signal real:** `english`, `companies`, `software`, `clients`, `team`, `digital`, `growing`.
  These words describe a real company.
- **Random Forest feature importance:** company_profile_missing (0.154) > has_company_logo (0.131) > log_word_count
  (0.112) > caps_ratio (0.087) > money_words (0.080). This matches the EDA.

### 5.4 Class-imbalance experiment (5-fold CV, training set)
| Model | Strategy | Recall @ 0.5 | F1 @ 0.5 | PR-AUC |
|---|---|---|---|---|
| Logistic Regression (text) | None | 0.680 | 0.798 | 0.913 |
| | Class weights | 0.827 | 0.860 | 0.915 |
| | SMOTE | 0.817 | 0.861 | 0.916 |
| Random Forest (metadata) | None | 0.382 | 0.546 | 0.738 |
| | Class weights | 0.645 | 0.631 | 0.711 |
| | SMOTE | 0.671 | 0.650 | 0.723 |

Balancing mostly **moves the operating point**: recall at the default threshold rises sharply, while ranking quality
(PR-AUC) barely changes. Class weights and SMOTE perform about the same. We chose class weights because they are
simpler and add no synthetic samples, and we tune the threshold anyway.

## 6. Unsupervised learning: scam archetypes
*(Notebook `03_clustering.ipynb`, figures `kmeans_selection.png`, `scam_clusters_pca.png`)*

The 866 fake posts were converted to TF-IDF, reduced to 50 dimensions with **Truncated SVD** (PCA for sparse
matrices) and L2-normalised, then clustered with **K-Means**. The elbow curve has no sharp knee, and the silhouette
score rises steadily with k (a common effect for text). We therefore took the best silhouette among k = 4…8 and
capped k at 8 so the clusters stay interpretable.

| Archetype | Posts | Top terms |
|---|---|---|
| Admin / data entry / accounting | 232 | administrative, assistant, entry, office, data |
| Income opportunity / MLM-style sales | 222 | sales, money, dollars, service, business, income |
| Professional roles (copied real ads) | 186 | management, project, engineering, quality |
| Fake recruiter & signing bonus | 73 | bonus, recruiting, signing, candidates, aptitude |
| Oil & gas jobs abroad | 52 | aker, gas, oil, global, engineering |
| Work-from-home typing / online jobs | 46 | typing, internet, home, start |
| Easy cash / get-rich-quick | 34 | cash, free, day, extra, zero, fee |
| Cruise ship & hospitality | 21 | cruise, board, luxury, free |

The "Professional roles" cluster is interesting: these fakes copy the language of real posts, and they are the
hardest for the text model to catch.

## 7. Deployment
The final stacking model is served by a **FastAPI** REST backend and used by a **React + TypeScript** web app with four
pages: Check a Job, Model Lab, Scam Patterns and About. For each input, the app shows:
- the ensemble probability,
- per-word contributions from the Logistic Regression coefficients,
- the output of every model,
- the nearest K-Means archetype,
- a separate, transparent **rule layer** for scam tactics that are rare in the 2012–14 US training data (upfront
  fees, WhatsApp/Telegram contact, OTP or Aadhaar requests).

The overall risk combines the two sources as $1 - (1 - p_{ML})(1 - p_{rules})$.

On 28 hand-written Indian-style messages (15 scam, 13 genuine), every scam was rated Medium or High and every
genuine post Low. For 9 of the 15 scams (mostly fee and "task" scams), the ML probability alone was below 30%, so
the rule layer was essential. This is an example of **domain shift**.

## 8. Limitations
- The dataset is old, US-centric and has only 866 fakes. Some learned tokens are dataset artefacts (company names
  such as "Accion" and "Aker").
- The rule weights are set by hand, not learned.
- A metadata model depends on fields (logo, screening questions) that pasted messages often don't have. The app
  fills those with the most common training value.

## 9. Conclusion and future work
Classic ML models are very effective at detecting fake job posts when they are evaluated properly on imbalanced
data. Text models dominate, and stacking them with a metadata model gives the best result (F1 0.925, precision
0.963). Clustering adds insight into how scams operate.

**Future work:**
- collect a labelled Indian job-scam dataset
- support Hindi and Hinglish text
- learn the rule weights from data
- verify company domains
- compare with transformer models such as DistilBERT

## References
1. Vidros, S., Kolias, C., Kambourakis, G., & Akoglu, L. (2017). *Automatic Detection of Online Recruitment Frauds:
   Characteristics, Methods, and a Public Dataset.* Future Internet, 9(1), 6.
2. Pedregosa, F. et al. (2011). *Scikit-learn: Machine Learning in Python.* JMLR 12.
3. Chen, T., & Guestrin, C. (2016). *XGBoost: A Scalable Tree Boosting System.* KDD.
4. Chawla, N. et al. (2002). *SMOTE: Synthetic Minority Over-sampling Technique.* JAIR 16.
5. Wolpert, D. (1992). *Stacked Generalization.* Neural Networks 5(2).
