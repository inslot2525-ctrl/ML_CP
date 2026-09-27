"""Ensembles that combine the best text model and the best metadata model."""
import numpy as np


class TwoModelEnsemble:
    """Combine P(fraud) from a text model and a metadata model.

    mode="stack": a Logistic Regression (``combiner``) trained on out-of-fold
    probabilities learns how much to trust each base model.
    mode="vote":  plain soft voting (average of the two probabilities).
    """

    def __init__(self, text_model, meta_model, text_name, meta_name, mode="stack", combiner=None):
        self.text_model = text_model
        self.meta_model = meta_model
        self.text_name = text_name
        self.meta_name = meta_name
        self.mode = mode
        self.combiner = combiner

    def base_probas(self, X):
        return np.column_stack([
            self.text_model.predict_proba(X)[:, 1],
            self.meta_model.predict_proba(X)[:, 1],
        ])

    def combine(self, base):
        if self.mode == "stack":
            return self.combiner.predict_proba(base)[:, 1]
        return base.mean(axis=1)

    def predict_proba(self, X):
        p = self.combine(self.base_probas(X))
        return np.column_stack([1 - p, p])
