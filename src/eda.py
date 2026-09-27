"""Exploratory data analysis: summary numbers + figures for the report and app.

Run from the project root:  python -m src.eda
"""
import json

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd

from .config import EDA_PATH, FIGURES_DIR
from .features import meta_features
from .preprocess import load_data


def fraud_rate(df, col, min_count=50, top=12):
    g = df.groupby(col)["fraudulent"].agg(["mean", "count"])
    g = g[g["count"] >= min_count].sort_values("mean", ascending=False).head(top)
    return [{"value": str(i), "fraud_rate": round(float(r["mean"]), 4), "count": int(r["count"])} for i, r in g.iterrows()]


def main():
    df = load_data()
    meta = meta_features(df)
    df = df.join(meta[["salary_given", "company_profile_missing", "log_word_count", "money_words"]])
    df["country"] = df["location"].fillna("").str.split(",").str[0].replace("", "Unknown")
    df["word_count"] = df["raw_text"].str.split().str.len()
    df["has_company_logo"] = df["has_company_logo"].map({1: "Has logo", 0: "No logo"})
    df["company_profile_missing"] = df["company_profile_missing"].map({1.0: "No company profile", 0.0: "Has profile"})
    df["salary_given"] = df["salary_given"].map({1.0: "Salary shown", 0.0: "No salary"})
    df["telecommuting"] = df["telecommuting"].map({1: "Remote", 0: "On-site"})

    eda = {
        "n_posts": int(len(df)), "n_fake": int(df["fraudulent"].sum()),
        "fake_share": round(float(df["fraudulent"].mean()), 4),
        "missing_share": {c: round(float((df[c] == "").mean()), 3)
                          for c in ["company_profile", "requirements", "benefits", "salary_range"]},
        "median_words": {"real": int(df.loc[df.fraudulent == 0, "word_count"].median()),
                         "fake": int(df.loc[df.fraudulent == 1, "word_count"].median())},
        "by": {c: fraud_rate(df, c, min_count=20) for c in
               ["has_company_logo", "company_profile_missing", "salary_given", "telecommuting",
                "employment_type", "required_experience", "required_education"]},
        "by_industry": fraud_rate(df, "industry"),
        "by_function": fraud_rate(df, "function"),
        "by_country": fraud_rate(df, "country", min_count=40),
    }
    EDA_PATH.write_text(json.dumps(eda, indent=1))

    fig, axes = plt.subplots(2, 2, figsize=(11, 7))
    for ax, col in zip(axes.flat, ["has_company_logo", "company_profile_missing", "salary_given", "telecommuting"]):
        d = pd.DataFrame(eda["by"][col])
        ax.bar(d["value"], d["fraud_rate"] * 100, color=["#d9534f", "#5bc0de"][: len(d)])
        ax.set_ylabel("% fake"); ax.set_title(col.replace("_", " ").title())
    fig.suptitle(f"Fraud rate by post attributes (overall {eda['fake_share'] * 100:.1f}% fake)")
    fig.tight_layout(); fig.savefig(FIGURES_DIR / "eda_attributes.png", dpi=150); plt.close(fig)

    fig, ax = plt.subplots(figsize=(9, 5))
    d = pd.DataFrame(eda["by_industry"])
    ax.barh(d["value"][::-1], d["fraud_rate"][::-1] * 100, color="#d9534f")
    ax.set_xlabel("% fake"); ax.set_title("Industries with the highest share of fake posts (≥50 posts)")
    fig.tight_layout(); fig.savefig(FIGURES_DIR / "eda_industry.png", dpi=150); plt.close(fig)

    fig, ax = plt.subplots(figsize=(8, 4))
    for label, color in [(0, "#5cb85c"), (1, "#d9534f")]:
        ax.hist(df.loc[df.fraudulent == label, "word_count"].clip(upper=1500), bins=60, alpha=0.6, density=True,
                color=color, label="Fake" if label else "Real")
    ax.set(title="Post length (words)", xlabel="Words", ylabel="Density"); ax.legend()
    fig.tight_layout(); fig.savefig(FIGURES_DIR / "eda_length.png", dpi=150); plt.close(fig)

    fig, ax = plt.subplots(figsize=(4, 4))
    ax.pie([len(df) - eda["n_fake"], eda["n_fake"]], labels=["Real", "Fake"], autopct="%1.1f%%",
           colors=["#5cb85c", "#d9534f"], startangle=90)
    ax.set_title("Class balance")
    fig.tight_layout(); fig.savefig(FIGURES_DIR / "eda_class_balance.png", dpi=150); plt.close(fig)
    print(json.dumps({k: eda[k] for k in ["n_posts", "n_fake", "fake_share", "missing_share", "median_words"]}))


if __name__ == "__main__":
    main()
