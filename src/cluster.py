"""Unsupervised discovery of scam "archetypes" among the fake job posts.

Run from the project root:  python -m src.cluster

TF-IDF (fake posts only) -> TruncatedSVD (PCA for sparse text, 50 dims) ->
L2 normalise -> K-Means. k is chosen with the elbow curve + silhouette score,
and a 2-D PCA projection is saved for plotting.
"""
import json

import joblib
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA, TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import silhouette_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import Normalizer

from .config import CLUSTERS_PATH, FIGURES_DIR, MODELS_DIR, RANDOM_STATE
from .preprocess import load_data

K_RANGE = range(2, 11)
# Human-readable archetype names, matched against each cluster's top terms.
NAME_HINTS = [
    ({"cash", "free", "extra", "zero", "day", "fast", "easy"}, "Easy cash / get-rich-quick"),
    ({"sales", "money", "income", "business", "people", "opportunity"}, "Income opportunity / MLM-style sales"),
    ({"recruiting", "candidates", "aptitude", "signing", "referral", "bonus"}, "Fake recruiter & signing bonus"),
    ({"typing", "internet", "home", "started", "start", "computer", "online"}, "Work-from-home typing / online jobs"),
    ({"oil", "gas", "offshore", "rig", "energy", "aker"}, "Oil & gas jobs abroad"),
    ({"administrative", "assistant", "data", "entry", "office", "clerical", "accounting", "duties"},
     "Admin / data entry / accounting"),
    ({"management", "project", "engineering", "technical", "manager", "years", "quality", "software"},
     "Professional roles (copied real ads)"),
    ({"cruise", "board", "luxury", "hotel", "ship"}, "Cruise ship & hospitality"),
    ({"nurse", "medical", "healthcare", "hospital", "patient", "clinical"}, "Healthcare"),
    ({"customer", "service", "call", "representative"}, "Customer service"),
]
GENERIC = {"urltoken", "emailtoken", "phonetoken", "job", "work", "position", "company", "team", "experience",
           "ability", "skills", "required", "requirements", "benefits", "including", "new", "time", "working", "able"}


def name_clusters(term_lists):
    """Assign each hint to at most one cluster, best keyword overlap first."""
    pairs = sorted(((len(keys & set(terms[:15])), c, name)
                    for c, terms in enumerate(term_lists) for keys, name in NAME_HINTS), reverse=True)
    names, used = {}, set()
    for score, c, name in pairs:
        if score > 0 and c not in names and name not in used:
            names[c] = name
            used.add(name)
    return [names.get(c, " / ".join(t.title() for t in terms[:3])) for c, terms in enumerate(term_lists)]


def main():
    df = load_data()
    fake = df[df["fraudulent"] == 1].reset_index(drop=True)

    pipe = Pipeline([
        ("tfidf", TfidfVectorizer(stop_words="english", min_df=3, max_df=0.5, max_features=5000,
                                  token_pattern=r"(?u)\b[a-z][a-z]+\b", sublinear_tf=True)),
        ("svd", TruncatedSVD(n_components=50, random_state=RANDOM_STATE)),
        ("norm", Normalizer()),
    ])
    Z = pipe.fit_transform(fake["text"])

    inertias, silhouettes = [], []
    for k in K_RANGE:
        km = KMeans(n_clusters=k, n_init=20, random_state=RANDOM_STATE).fit(Z)
        inertias.append(float(km.inertia_))
        silhouettes.append(float(silhouette_score(Z, km.labels_)))
    candidates = [k for k in K_RANGE if 4 <= k <= 8]  # keep archetypes interpretable
    k_best = max(candidates, key=lambda k: silhouettes[k - K_RANGE.start])
    km = KMeans(n_clusters=k_best, n_init=20, random_state=RANDOM_STATE).fit(Z)
    labels = km.labels_

    # Top terms per cluster: centroid back-projected into TF-IDF space.
    vocab = pipe.named_steps["tfidf"].get_feature_names_out()
    centroid_terms = km.cluster_centers_ @ pipe.named_steps["svd"].components_
    term_lists = [[vocab[i] for i in np.argsort(row)[::-1] if vocab[i] not in GENERIC][:12]
                  for row in centroid_terms]
    clusters = []
    for c, (terms, name) in enumerate(zip(term_lists, name_clusters(term_lists))):
        members = fake[labels == c]
        clusters.append({
            "id": c, "name": name, "size": int(len(members)), "top_terms": terms,
            "example_titles": members["title"].value_counts().head(6).index.tolist(),
            "telecommuting_rate": float(members["telecommuting"].mean()),
            "no_logo_rate": float(1 - members["has_company_logo"].mean()),
        })
        print(f"Cluster {c} ({len(members)}): {name} | {', '.join(terms[:8])}")

    pca = PCA(n_components=2, random_state=RANDOM_STATE)
    xy = pca.fit_transform(Z)
    points = [{"x": round(float(a), 4), "y": round(float(b), 4), "cluster": int(l), "title": t}
              for (a, b), l, t in zip(xy, labels, fake["title"])]

    joblib.dump({"pipeline": pipe, "kmeans": km, "names": [c["name"] for c in clusters]},
                MODELS_DIR / "clusters.joblib", compress=3)
    CLUSTERS_PATH.write_text(json.dumps({
        "k": k_best, "k_range": list(K_RANGE), "inertia": inertias, "silhouette": silhouettes,
        "pca_explained_variance": pca.explained_variance_ratio_.round(4).tolist(),
        "clusters": clusters, "points": points,
    }, indent=1))

    fig, (a1, a2) = plt.subplots(1, 2, figsize=(11, 4))
    a1.plot(list(K_RANGE), inertias, "o-"); a1.set(title="Elbow method", xlabel="k", ylabel="Inertia")
    a2.plot(list(K_RANGE), silhouettes, "o-", color="orange"); a2.axvline(k_best, ls="--", c="grey")
    a2.set(title=f"Silhouette score (chosen k = {k_best})", xlabel="k", ylabel="Silhouette")
    fig.tight_layout(); fig.savefig(FIGURES_DIR / "kmeans_selection.png", dpi=150); plt.close(fig)

    fig, ax = plt.subplots(figsize=(8, 6))
    for c in clusters:
        m = labels == c["id"]
        ax.scatter(xy[m, 0], xy[m, 1], s=12, alpha=0.7, label=f"{c['name']} ({c['size']})")
    ax.set(title="Scam archetypes among fake job posts (PCA 2-D)", xlabel="PC1", ylabel="PC2")
    ax.legend(fontsize=8)
    fig.tight_layout(); fig.savefig(FIGURES_DIR / "scam_clusters_pca.png", dpi=150); plt.close(fig)
    print(f"k={k_best}. Saved models/clusters.joblib, reports/clusters.json")


if __name__ == "__main__":
    main()
