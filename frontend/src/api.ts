// Typed client for the FakeHire FastAPI backend.

export type RiskLevel = 'Low' | 'Medium' | 'High'
export type Family = 'text' | 'meta' | 'ensemble'

export interface RedFlag { id: string; weight: number; message: string; tip: string; match: string }
export interface WordWeight { term: string; weight: number }

export interface PredictResult {
  risk_level: RiskLevel
  risk_score: number
  ml_probability: number
  rule_score: number
  threshold: number
  final_model: string
  base_models: Record<string, number>
  all_models: Record<string, number>
  red_flags: RedFlag[]
  fake_words: WordWeight[]
  real_words: WordWeight[]
  archetype: { id: number; name: string; similarity: number } | null
  tips: string[]
}

export interface JobPost {
  text: string
  title?: string
  company_profile?: string
  salary?: string
  has_logo?: boolean | null
  has_questions?: boolean | null
  telecommuting?: boolean | null
  employment_type?: string
  required_experience?: string
  required_education?: string
}

export interface Curve { x: number[]; y: number[] }
export interface TestMetrics {
  threshold: number; accuracy: number; precision: number; recall: number; f1: number
  roc_auc: number; pr_auc: number; confusion_matrix: number[][]; roc_curve: Curve; pr_curve: Curve
}
export interface ModelResult { group: Family; cv: { pr_auc: number; roc_auc: number; f1: number }; test: TestMetrics }
export interface ImbalanceRow { model: string; strategy: string; 'recall@0.5': number; 'f1@0.5': number; pr_auc: number }
export interface Metrics {
  dataset: { n_train: number; n_test: number; fake_train: number; fake_test: number }
  models: Record<string, ModelResult>
  final_model: string
  best_text: string
  best_meta: string
  top_words: { fake: [string, number][]; real: [string, number][] }
  feature_importance: Record<string, [string, number][]>
  imbalance_experiment: ImbalanceRow[]
}

export interface Cluster {
  id: number; name: string; size: number; top_terms: string[]; example_titles: string[]
  telecommuting_rate: number; no_logo_rate: number
}
export interface Clusters {
  k: number; k_range: number[]; inertia: number[]; silhouette: number[]; pca_explained_variance: number[]
  clusters: Cluster[]; points: { x: number; y: number; cluster: number; title: string }[]
}

export interface RateRow { value: string; fraud_rate: number; count: number }
export interface Eda {
  n_posts: number; n_fake: number; fake_share: number
  missing_share: Record<string, number>
  median_words: { real: number; fake: number }
  by: Record<string, RateRow[]>
  by_industry: RateRow[]; by_function: RateRow[]; by_country: RateRow[]
}

export interface BatchRow extends Record<string, unknown> {
  risk_level: RiskLevel; risk_score: number; ml_probability: number; red_flags: string
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    let detail = res.statusText
    try { detail = (await res.json()).detail ?? detail } catch { /* not JSON */ }
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
  }
  return res.json() as Promise<T>
}

export const api = {
  predict: (post: JobPost) =>
    request<PredictResult>('/api/predict', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(post),
    }),
  predictBatch: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<{ truncated: boolean; rows: BatchRow[] }>('/api/predict-batch', { method: 'POST', body: form })
  },
  metrics: () => request<Metrics>('/api/metrics'),
  clusters: () => request<Clusters>('/api/clusters'),
  eda: () => request<Eda>('/api/eda'),
}
