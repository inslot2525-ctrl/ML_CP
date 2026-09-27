// Recent checks, kept only in this browser (localStorage) so the dashboard can summarise them.
import { useSyncExternalStore } from 'react'
import type { PredictResult, RiskLevel } from './api'

export interface HistoryItem {
  id: string
  at: number
  title: string
  text: string
  risk_level: RiskLevel
  risk_score: number
  ml_probability: number
  flags: string[]
  archetype: string | null
}

const KEY = 'fakehire-history-v1'
const MAX = 50
const listeners = new Set<() => void>()
let cache: HistoryItem[] | null = null

function read(): HistoryItem[] {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(KEY)
    cache = raw ? (JSON.parse(raw) as HistoryItem[]) : []
  } catch {
    cache = []
  }
  return cache
}

function write(items: HistoryItem[]) {
  cache = items
  try { localStorage.setItem(KEY, JSON.stringify(items)) } catch { /* storage blocked or full */ }
  listeners.forEach((l) => l())
}

export function addToHistory(text: string, title: string, r: PredictResult) {
  const item: HistoryItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: Date.now(), title, text: text.slice(0, 2000),
    risk_level: r.risk_level, risk_score: r.risk_score, ml_probability: r.ml_probability,
    flags: r.red_flags.map((f) => f.message), archetype: r.archetype?.name ?? null,
  }
  write([item, ...read()].slice(0, MAX))
}

export function clearHistory() {
  write([])
}

export function useHistory(): HistoryItem[] {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb) } },
    read,
    () => [],
  )
}

export function timeAgo(ts: number) {
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  return `${Math.round(h / 24)} d ago`
}
