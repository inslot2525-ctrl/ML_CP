// Mantine theme + chart palette.
// Chart colours come from the validated reference palette; each colour scheme has its own selected steps.
import { createTheme, useComputedColorScheme, type MantineColorsTuple } from '@mantine/core'
import { IconAlertOctagon, IconAlertTriangle, IconCircleCheck } from '@tabler/icons-react'
import type { Family, RiskLevel } from './api'

const brand: MantineColorsTuple = [
  '#e8f1fc', '#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#0d366b',
]
// Warm neutral dark ramp so dark surfaces match the chart palette (#1a1a19 chart surface).
const dark: MantineColorsTuple = [
  '#e4e3dc', '#c3c2b7', '#a3a29a', '#898781', '#5f5e5a', '#383835', '#2c2c2a', '#1a1a19', '#131312', '#0d0d0d',
]

export const theme = createTheme({
  primaryColor: 'brand',
  primaryShade: { light: 5, dark: 4 },
  colors: { brand, dark },
  fontFamily: "'Inter Variable', system-ui, -apple-system, 'Segoe UI', sans-serif",
  headings: { fontFamily: "'Inter Variable', system-ui, sans-serif", fontWeight: '700' },
  defaultRadius: 'md',
  cursorType: 'pointer',
  components: {
    Card: { defaultProps: { withBorder: true, radius: 'lg', padding: 'lg', shadow: 'xs' } },
    Paper: { defaultProps: { radius: 'lg' } },
    Button: { defaultProps: { radius: 'md' } },
    Badge: { defaultProps: { radius: 'sm' } },
    Tooltip: { defaultProps: { withArrow: true } },
  },
})

export const HERO_GRADIENT = 'linear-gradient(135deg, #184f95 0%, #2a78d6 48%, #4a3aa7 100%)'

const PALETTE = {
  light: {
    family: { text: '#2a78d6', meta: '#eb6834', ensemble: '#1baf7a' } as Record<Family, string>,
    fake: '#e34948', real: '#2a78d6', violet: '#4a3aa7', muted: '#b9b8b1',
    grid: '#e1e0d9', axis: '#c3c2b7', ink: '#0b0b0b', ink2: '#52514e', ink3: '#898781', surface: '#ffffff',
    seq: ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95'],
  },
  dark: {
    family: { text: '#3987e5', meta: '#d95926', ensemble: '#199e70' } as Record<Family, string>,
    fake: '#e66767', real: '#3987e5', violet: '#9085e9', muted: '#5f5e5a',
    grid: '#2c2c2a', axis: '#383835', ink: '#ffffff', ink2: '#c3c2b7', ink3: '#898781', surface: '#1a1a19',
    seq: ['#184f95', '#1c5cab', '#256abf', '#2a78d6', '#5598e7', '#86b6ef'],
  },
}
export type Palette = (typeof PALETTE)['light']

/** Chart palette for the current (computed) colour scheme. */
export function usePalette(): Palette {
  return PALETTE[useComputedColorScheme('light', { getInitialValueInEffect: false })]
}

export const FAMILY_LABEL: Record<Family, string> = {
  text: 'Text model (TF-IDF)', meta: 'Metadata model', ensemble: 'Ensemble',
}

// Status colours are fixed across schemes and always shown with an icon + label.
export const RISK: Record<RiskLevel, { color: string; mantine: string; label: string; short: string }> = {
  High: { color: '#d03b3b', mantine: 'red', label: 'High risk: likely a scam', short: 'Likely a scam' },
  Medium: { color: '#ec835a', mantine: 'orange', label: 'Medium risk: verify carefully', short: 'Verify carefully' },
  Low: { color: '#0ca30c', mantine: 'green', label: 'Low risk: no strong scam signals', short: 'Looks genuine' },
}

export const RISK_ICON: Record<RiskLevel, typeof IconCircleCheck> = {
  High: IconAlertOctagon, Medium: IconAlertTriangle, Low: IconCircleCheck,
}

export const pct = (v: number, digits = 0) => `${(v * 100).toFixed(digits)}%`
export const fmt3 = (v: number) => v.toFixed(3)
