import { useEffect, useState, type ReactNode } from 'react'
import { usePalette } from './theme'

// ---------------------------------------------------------------- data loading (cached per URL)
const cache = new Map<string, Promise<unknown>>()

export function useData<T>(key: string, load: () => Promise<T>) {
  const [state, setState] = useState<{ data?: T; error?: string }>({})
  useEffect(() => {
    let alive = true
    if (!cache.has(key)) cache.set(key, load().catch((e) => { cache.delete(key); throw e }))
    ;(cache.get(key) as Promise<T>)
      .then((data) => alive && setState({ data }))
      .catch((e: Error) => alive && setState({ error: e.message }))
    return () => { alive = false }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return state
}

// ---------------------------------------------------------------- chart helpers
export function useAxis() {
  const p = usePalette()
  return {
    tick: { fill: p.ink3, fontSize: 12 },
    axisLine: { stroke: p.axis },
    tickLine: false as const,
    grid: p.grid,
    label: (value: string, pos: 'bottom' | 'left' = 'bottom') => ({
      value, position: pos === 'bottom' ? ('insideBottom' as const) : ('insideLeft' as const),
      angle: pos === 'left' ? -90 : 0, offset: pos === 'bottom' ? -4 : 10, fill: p.ink3, fontSize: 12,
      style: { textAnchor: 'middle' as const },
    }),
  }
}

/** Tooltip body for Recharts: `content={tip((d) => <>…</>)}` where d is the hovered datum. */
export function tip<D>(render: (d: D) => ReactNode) {
  return ({ active, payload }: { active?: boolean; payload?: readonly { payload?: unknown }[] }) =>
    active && payload?.[0]?.payload ? <div className="fh-tt">{render(payload[0].payload as D)}</div> : null
}
