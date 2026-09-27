"""Central paths and constants used across the project."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_RAW = ROOT / "data" / "raw" / "fake_job_postings.csv"
DEMO_SAMPLES = ROOT / "data" / "demo_samples.csv"
MODELS_DIR = ROOT / "models"
REPORTS_DIR = ROOT / "reports"
FIGURES_DIR = REPORTS_DIR / "figures"
METRICS_PATH = REPORTS_DIR / "metrics.json"
CLUSTERS_PATH = REPORTS_DIR / "clusters.json"
EDA_PATH = REPORTS_DIR / "eda.json"

RANDOM_STATE = 42
TEST_SIZE = 0.2
CV_FOLDS = 5

TEXT_FIELDS = ["title", "company_profile", "description", "requirements", "benefits"]
CATEGORICAL_FIELDS = ["employment_type", "required_experience", "required_education"]
BINARY_FIELDS = ["has_company_logo", "has_questions", "telecommuting"]

for _d in (MODELS_DIR, FIGURES_DIR):
    _d.mkdir(parents=True, exist_ok=True)
