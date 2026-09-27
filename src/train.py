"""Train and compare every FakeHire model.

Run from the project root:  python -m src.train

Method
------
1. Stratified 80/20 train/test split (the test set is touched only once, at the end).
2. For every model, 5-fold stratified cross-validation on the training set
   produces out-of-fold (OOF) probabilities. These are used to
   - report CV scores,
   - tune each model's decision threshold (max fraud-class F1),
   - pick the best text model and the best metadata model,
   - train the stacking combiner without leakage.
3. Every model is refit on the full training set and evaluated on the test set.
"""
import json
import time

import joblib
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from imblearn.over_sampling import SMOTE
from imblearn.pipeline import Pipeline as ImbPipeline
from sklearn.base import clone
from sklearn.calibration import CalibratedClassifierCV
from sklearn.compose import ColumnTransformer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (accuracy_score, average_precision_score, confusion_matrix, f1_score,
                             precision_recall_curve, precision_score, recall_score, roc_auc_score, roc_curve)
from sklearn.model_selection import StratifiedKFold, cross_val_predict, train_test_split
from sklearn.naive_bayes import MultinomialNB
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.svm import LinearSVC
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
from xgboost import XGBClassifier

from .config import (BINARY_FIELDS, CATEGORICAL_FIELDS, CV_FOLDS, FIGURES_DIR, METRICS_PATH, MODELS_DIR,
                     RANDOM_STATE, TEST_SIZE)
from .ensemble import TwoModelEnsemble
from .features import META_COLUMNS, NUMERIC_FEATURES, meta_features
from .preprocess import load_data

CV = StratifiedKFold(n_splits=CV_FOLDS, shuffle=True, random_state=RANDOM_STATE)


# ----------------------------------------------------------------------------- data
def build_xy():
    df = load_data()
    X = meta_features(df)
    X["text"] = df["text"]
    return X, df["fraudulent"].to_numpy()


# ----------------------------------------------------------------------------- models
def tfidf():
    return ColumnTransformer([("tfidf", TfidfVectorizer(ngram_range=(1, 2), min_df=2, max_df=0.9,
                                                        max_features=50000, sublinear_tf=True,
                                                        stop_words="english"), "text")])


def meta_prep():
    return ColumnTransformer([
        ("num", StandardScaler(), NUMERIC_FEATURES),
        ("cat", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL_FIELDS),
    ])


def text_models():
    return {
        "Naive Bayes": Pipeline([("prep", tfidf()), ("clf", MultinomialNB(alpha=0.05))]),
        "Logistic Regression": Pipeline([("prep", tfidf()), ("clf", LogisticRegression(
            C=10, class_weight="balanced", max_iter=3000, solver="liblinear"))]),
        "Linear SVM": Pipeline([("prep", tfidf()), ("clf", CalibratedClassifierCV(
            LinearSVC(C=0.5, class_weight="balanced"), cv=3, method="sigmoid"))]),
    }


def meta_models(pos_weight):
    return {
        "KNN": Pipeline([("prep", meta_prep()), ("clf", KNeighborsClassifier(n_neighbors=15, weights="distance"))]),
        "Decision Tree": Pipeline([("prep", meta_prep()), ("clf", DecisionTreeClassifier(
            max_depth=10, min_samples_leaf=5, class_weight="balanced", random_state=RANDOM_STATE))]),
        "Random Forest": Pipeline([("prep", meta_prep()), ("clf", RandomForestClassifier(
            n_estimators=300, min_samples_leaf=2, class_weight="balanced_subsample",
            n_jobs=-1, random_state=RANDOM_STATE))]),
        "XGBoost": Pipeline([("prep", meta_prep()), ("clf", XGBClassifier(
            n_estimators=400, max_depth=5, learning_rate=0.05, subsample=0.8, colsample_bytree=0.8,
            scale_pos_weight=pos_weight, eval_metric="logloss", n_jobs=-1, random_state=RANDOM_STATE))]),
    }


# ----------------------------------------------------------------------------- metrics
def best_threshold(y, p):
    prec, rec, thr = precision_recall_curve(y, p)
    f1 = 2 * prec * rec / np.clip(prec + rec, 1e-9, None)
    i = int(np.nanargmax(f1[:-1]))
    return float(thr[i])


def _curve(x, y, n=60):
    idx = np.unique(np.linspace(0, len(x) - 1, min(n, len(x))).astype(int))
    return {"x": np.round(x[idx], 4).tolist(), "y": np.round(y[idx], 4).tolist()}


def evaluate(y, p, threshold):
    pred = (p >= threshold).astype(int)
    fpr, tpr, _ = roc_curve(y, p)
    prec, rec, _ = precision_recall_curve(y, p)
    return {
        "threshold": round(threshold, 4),
        "accuracy": accuracy_score(y, pred),
        "precision": precision_score(y, pred, zero_division=0),
        "recall": recall_score(y, pred),
        "f1": f1_score(y, pred),
        "roc_auc": roc_auc_score(y, p),
        "pr_auc": average_precision_score(y, p),
        "confusion_matrix": confusion_matrix(y, pred).tolist(),
        "roc_curve": _curve(fpr, tpr),
        "pr_curve": _curve(rec[::-1], prec[::-1]),
    }


def cv_summary(y, oof, threshold):
    return {"pr_auc": average_precision_score(y, oof), "roc_auc": roc_auc_score(y, oof),
            "f1": f1_score(y, (oof >= threshold).astype(int))}


def oof_proba(model, X, y, n_jobs=None):
    return cross_val_predict(model, X, y, cv=CV, method="predict_proba", n_jobs=n_jobs)[:, 1]


def shrink(model):
    """Drop TfidfVectorizer.stop_words_ (huge, only needed for debugging)."""
    prep = model.named_steps.get("prep")
    if prep is not None and "tfidf" in getattr(prep, "named_transformers_", {}):
        prep.named_transformers_["tfidf"].stop_words_ = None
    return model


# ----------------------------------------------------------------------------- experiments
def imbalance_experiment(X, y):
    """Compare 3 ways of handling the 1:20 class imbalance on two models."""
    lr = lambda cw: LogisticRegression(C=10, class_weight=cw, max_iter=3000, solver="liblinear")
    rf = lambda cw: RandomForestClassifier(n_estimators=200, min_samples_leaf=2, class_weight=cw,
                                           n_jobs=-1, random_state=RANDOM_STATE)
    smote = SMOTE(random_state=RANDOM_STATE)
    setups = {
        ("Logistic Regression (text)", "No balancing"): Pipeline([("prep", tfidf()), ("clf", lr(None))]),
        ("Logistic Regression (text)", "Class weights"): Pipeline([("prep", tfidf()), ("clf", lr("balanced"))]),
        ("Logistic Regression (text)", "SMOTE"): ImbPipeline([("prep", tfidf()), ("smote", smote), ("clf", lr(None))]),
        ("Random Forest (metadata)", "No balancing"): Pipeline([("prep", meta_prep()), ("clf", rf(None))]),
        ("Random Forest (metadata)", "Class weights"): Pipeline([("prep", meta_prep()), ("clf", rf("balanced_subsample"))]),
        ("Random Forest (metadata)", "SMOTE"): ImbPipeline([("prep", meta_prep()), ("smote", smote), ("clf", rf(None))]),
    }
    rows = []
    for (model, strategy), pipe in setups.items():
        oof = oof_proba(pipe, X, y, n_jobs=CV_FOLDS)
        at_half = (oof >= 0.5).astype(int)
        rows.append({"model": model, "strategy": strategy,
                     "recall@0.5": recall_score(y, at_half), "f1@0.5": f1_score(y, at_half),
                     "pr_auc": average_precision_score(y, oof)})
        print(f"  imbalance | {model:28s} {strategy:14s} recall@0.5={rows[-1]['recall@0.5']:.3f} "
              f"f1@0.5={rows[-1]['f1@0.5']:.3f} PR-AUC={rows[-1]['pr_auc']:.3f}")
    return rows


# ----------------------------------------------------------------------------- figures
def plot_figures(results, text_lr, rf, imbalance):
    names = list(results)
    test = [results[n]["test"] for n in names]

    fig, ax = plt.subplots(figsize=(11, 4.5))
    w = 0.2
    for i, metric in enumerate(["precision", "recall", "f1", "pr_auc"]):
        ax.bar(np.arange(len(names)) + i * w, [t[metric] for t in test], w, label=metric.upper().replace("_", "-"))
    ax.set_xticks(np.arange(len(names)) + 1.5 * w, names, rotation=20, ha="right")
    ax.set_ylim(0, 1)
    ax.set_title("Test-set performance on the fraud class")
    ax.legend(ncol=4, loc="lower right")
    fig.tight_layout(); fig.savefig(FIGURES_DIR / "model_comparison.png", dpi=150); plt.close(fig)

    cols = 5
    rows = int(np.ceil(len(names) / cols))
    fig, axes = plt.subplots(rows, cols, figsize=(3.2 * cols, 3 * rows))
    for ax, n in zip(axes.flat, names):
        cm = np.array(results[n]["test"]["confusion_matrix"])
        ax.imshow(cm, cmap="Blues")
        for (r, c), v in np.ndenumerate(cm):
            ax.text(c, r, v, ha="center", va="center", color="white" if v > cm.max() / 2 else "black")
        ax.set_xticks([0, 1], ["Real", "Fake"]); ax.set_yticks([0, 1], ["Real", "Fake"])
        ax.set_title(n, fontsize=9); ax.set_xlabel("Predicted"); ax.set_ylabel("Actual")
    for ax in list(axes.flat)[len(names):]:
        ax.axis("off")
    fig.tight_layout(); fig.savefig(FIGURES_DIR / "confusion_matrices.png", dpi=150); plt.close(fig)

    fig, (a1, a2) = plt.subplots(1, 2, figsize=(12, 5))
    for n in names:
        t = results[n]["test"]
        a1.plot(t["roc_curve"]["x"], t["roc_curve"]["y"], label=f"{n} ({t['roc_auc']:.3f})")
        a2.plot(t["pr_curve"]["x"], t["pr_curve"]["y"], label=f"{n} ({t['pr_auc']:.3f})")
    a1.plot([0, 1], [0, 1], "k--", lw=0.8)
    a1.set(title="ROC curve", xlabel="False positive rate", ylabel="True positive rate")
    a2.set(title="Precision-Recall curve", xlabel="Recall", ylabel="Precision")
    a1.legend(fontsize=7); a2.legend(fontsize=7)
    fig.tight_layout(); fig.savefig(FIGURES_DIR / "roc_pr_curves.png", dpi=150); plt.close(fig)

    words = top_words(text_lr, 15)
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(11, 5))
    a1.barh([w for w, _ in words["fake"]][::-1], [c for _, c in words["fake"]][::-1], color="#d9534f")
    a1.set_title("Words pushing towards FAKE")
    a2.barh([w for w, _ in words["real"]][::-1], [-c for _, c in words["real"]][::-1], color="#5cb85c")
    a2.set_title("Words pushing towards REAL")
    fig.suptitle("Logistic Regression coefficients (TF-IDF)")
    fig.tight_layout(); fig.savefig(FIGURES_DIR / "top_words.png", dpi=150); plt.close(fig)

    imp = feature_importance(rf)[:15]
    fig, ax = plt.subplots(figsize=(8, 5))
    ax.barh([f for f, _ in imp][::-1], [v for _, v in imp][::-1], color="#337ab7")
    ax.set_title("Random Forest feature importance (metadata model)")
    fig.tight_layout(); fig.savefig(FIGURES_DIR / "meta_feature_importance.png", dpi=150); plt.close(fig)

    df = pd.DataFrame(imbalance)
    fig, ax = plt.subplots(figsize=(9, 4))
    labels = df["model"].str.replace(" ", "\n", n=2) + "\n" + df["strategy"]
    ax.bar(np.arange(len(df)) - 0.2, df["recall@0.5"], 0.4, label="Recall @ 0.5")
    ax.bar(np.arange(len(df)) + 0.2, df["pr_auc"], 0.4, label="PR-AUC")
    ax.set_xticks(np.arange(len(df)), df["strategy"])
    ax.set_title("Handling class imbalance  (left 3: LogReg text, right 3: Random Forest metadata)")
    ax.legend(); ax.set_ylim(0, 1)
    fig.tight_layout(); fig.savefig(FIGURES_DIR / "imbalance_experiment.png", dpi=150); plt.close(fig)


def top_words(lr_pipe, k=20):
    vec = lr_pipe.named_steps["prep"].named_transformers_["tfidf"]
    coef = lr_pipe.named_steps["clf"].coef_[0]
    vocab = vec.get_feature_names_out()
    order = np.argsort(coef)
    return {"fake": [(vocab[i], round(float(coef[i]), 3)) for i in order[::-1][:k]],
            "real": [(vocab[i], round(float(coef[i]), 3)) for i in order[:k]]}


def feature_importance(tree_pipe):
    names = [n.split("__", 1)[1] for n in tree_pipe.named_steps["prep"].get_feature_names_out()]
    imp = tree_pipe.named_steps["clf"].feature_importances_
    order = np.argsort(imp)[::-1]
    return [(names[i], round(float(imp[i]), 4)) for i in order]


# ----------------------------------------------------------------------------- main
def main():
    t0 = time.time()
    X, y = build_xy()
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=TEST_SIZE, stratify=y, random_state=RANDOM_STATE)
    print(f"Train {len(y_tr)} ({y_tr.sum()} fake) | Test {len(y_te)} ({y_te.sum()} fake)")

    pos_weight = float((y_tr == 0).sum() / (y_tr == 1).sum())
    groups = {"text": text_models(), "meta": meta_models(pos_weight)}
    results, fitted, oof = {}, {}, {}

    for group, models in groups.items():
        for name, model in models.items():
            s = time.time()
            oof[name] = oof_proba(model, X_tr, y_tr, n_jobs=CV_FOLDS if group == "text" else None)
            thr = best_threshold(y_tr, oof[name])
            fitted[name] = shrink(clone(model).fit(X_tr, y_tr))
            p_te = fitted[name].predict_proba(X_te)[:, 1]
            results[name] = {"group": group, "cv": cv_summary(y_tr, oof[name], thr),
                             "test": evaluate(y_te, p_te, thr), "train_seconds": round(time.time() - s, 1)}
            r = results[name]
            print(f"{name:20s} CV PR-AUC={r['cv']['pr_auc']:.3f} | test F1={r['test']['f1']:.3f} "
                  f"P={r['test']['precision']:.3f} R={r['test']['recall']:.3f} PR-AUC={r['test']['pr_auc']:.3f}")

    # Best base model of each family, chosen on CV (never on the test set).
    best_text = max(groups["text"], key=lambda n: results[n]["cv"]["pr_auc"])
    best_meta = max(groups["meta"], key=lambda n: results[n]["cv"]["pr_auc"])
    base_oof = np.column_stack([oof[best_text], oof[best_meta]])
    print(f"Ensemble uses: {best_text} + {best_meta}")

    for label, mode in [("Soft Voting", "vote"), ("Stacking", "stack")]:
        combiner = None
        if mode == "stack":
            # Unweighted so the output stays a calibrated probability (threshold is tuned anyway).
            combiner = LogisticRegression()
            ens_oof = cross_val_predict(combiner, base_oof, y_tr, cv=CV, method="predict_proba")[:, 1]
            combiner.fit(base_oof, y_tr)
        else:
            ens_oof = base_oof.mean(axis=1)
        ens = TwoModelEnsemble(fitted[best_text], fitted[best_meta], best_text, best_meta, mode, combiner)
        thr = best_threshold(y_tr, ens_oof)
        results[label] = {"group": "ensemble", "cv": cv_summary(y_tr, ens_oof, thr),
                          "test": evaluate(y_te, ens.predict_proba(X_te)[:, 1], thr), "train_seconds": 0.0}
        fitted[label] = ens
        r = results[label]
        print(f"{label:20s} CV PR-AUC={r['cv']['pr_auc']:.3f} | test F1={r['test']['f1']:.3f} "
              f"P={r['test']['precision']:.3f} R={r['test']['recall']:.3f} PR-AUC={r['test']['pr_auc']:.3f}")

    final = max(["Soft Voting", "Stacking"], key=lambda n: results[n]["cv"]["pr_auc"])
    print(f"Final model: {final}")

    print("Class-imbalance experiment (5-fold CV on train):")
    imbalance = imbalance_experiment(X_tr, y_tr)

    # Values used when the app user leaves a yes/no field as "Not sure".
    defaults = {c: float(X_tr[c].mode()[0]) for c in BINARY_FIELDS}

    joblib.dump(fitted, MODELS_DIR / "models.joblib", compress=3)
    meta = {
        "final_model": final, "best_text": best_text, "best_meta": best_meta,
        "threshold": results[final]["test"]["threshold"], "binary_defaults": defaults,
        "meta_columns": META_COLUMNS,
    }
    (MODELS_DIR / "model_info.json").write_text(json.dumps(meta, indent=2))

    metrics = {
        "dataset": {"n_train": int(len(y_tr)), "n_test": int(len(y_te)),
                    "fake_train": int(y_tr.sum()), "fake_test": int(y_te.sum())},
        "models": results, "final_model": final, "best_text": best_text, "best_meta": best_meta,
        "top_words": top_words(fitted["Logistic Regression"], 20),
        "feature_importance": {"Random Forest": feature_importance(fitted["Random Forest"]),
                               "Decision Tree": feature_importance(fitted["Decision Tree"]),
                               "XGBoost": feature_importance(fitted["XGBoost"])},
        "imbalance_experiment": imbalance,
    }
    METRICS_PATH.write_text(json.dumps(metrics, indent=2, default=float))
    plot_figures(results, fitted["Logistic Regression"], fitted["Random Forest"], imbalance)
    print(f"Done in {time.time() - t0:.0f}s. Saved models/, reports/metrics.json, reports/figures/")


if __name__ == "__main__":
    main()
