import {
  Alert, Badge, Card, Group, RollingNumber, SemiCircleProgress, Skeleton, SimpleGrid, Stack, Text, ThemeIcon, Title,
} from '@mantine/core'
import { IconCircleCheck, IconPlugConnectedX } from '@tabler/icons-react'
import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import type { RiskLevel } from '../api'
import { RISK, RISK_ICON } from '../theme'

/** Fade + rise into view (respects reduced-motion via the browser). */
export function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay, ease: 'easeOut' }}>
      {children}
    </motion.div>
  )
}

export function PageHeader({ icon: Icon, title, description, right }: {
  icon: typeof IconCircleCheck; title: string; description: string; right?: ReactNode
}) {
  return (
    <Group justify="space-between" align="flex-start" mb="xl" wrap="wrap" gap="md">
      <Group align="flex-start" gap="md" wrap="nowrap">
        <ThemeIcon size={48} radius="md" variant="gradient" gradient={{ from: 'brand.7', to: 'violet.7', deg: 135 }} className="fh-title-icon">
          <Icon size={26} stroke={1.8} />
        </ThemeIcon>
        <div>
          <Title order={1} fz={{ base: 26, sm: 32 }} lh={1.15}>{title}</Title>
          <Text c="dimmed" size="md" mt={4} maw={680}>{description}</Text>
        </div>
      </Group>
      {right}
    </Group>
  )
}

export function StatCard({ icon: Icon, label, value, decimals = 0, suffix, sub, color = 'brand' }: {
  icon: typeof IconCircleCheck; label: string; value: number; decimals?: number; suffix?: string; sub?: ReactNode; color?: string
}) {
  return (
    <Card className="fh-stat fh-lift" style={{ ['--fh-accent' as string]: `var(--mantine-color-${color}-5)` }}>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <div>
          <Text size="xs" tt="uppercase" fw={600} c="dimmed" lts={0.4}>{label}</Text>
          <RollingNumber value={value} decimalScale={decimals} fixedDecimalScale suffix={suffix} thousandSeparator
                         fz={28} fw={700} mt={4} lh={1.2} tabularNumbers={false} />
          {sub && <Text size="xs" c="dimmed" mt={4}>{sub}</Text>}
        </div>
        <ThemeIcon size={40} radius="md" variant="light" color={color}><Icon size={22} stroke={1.8} /></ThemeIcon>
      </Group>
    </Card>
  )
}

export function ChartCard({ title, subtitle, right, children, h = '100%' }: {
  title: string; subtitle?: ReactNode; right?: ReactNode; children: ReactNode; h?: string | number
}) {
  return (
    <Card h={h}>
      <Group justify="space-between" align="flex-start" mb="sm" wrap="wrap" gap="xs">
        <div>
          <Text fw={650}>{title}</Text>
          {subtitle && <Text size="sm" c="dimmed">{subtitle}</Text>}
        </div>
        {right}
      </Group>
      {children}
    </Card>
  )
}

export function RiskBadge({ level, size = 'md' }: { level: RiskLevel; size?: 'sm' | 'md' | 'lg' }) {
  const Icon = RISK_ICON[level]
  return (
    <Badge color={RISK[level].mantine} variant="light" size={size} leftSection={<Icon size={14} />}>{level} risk</Badge>
  )
}

export function RiskGauge({ score, level }: { score: number; level: RiskLevel }) {
  return (
    <Stack align="center" gap={0}>
      <SemiCircleProgress value={Math.round(score * 100)} size={250} thickness={20} filledSegmentColor={RISK[level].color}
                          transitionDuration={600} aria-label={`Overall scam risk ${Math.round(score * 100)} percent`} />
      <Text fz={46} fw={800} lh={1} mt={-58}>{Math.round(score * 100)}%</Text>
      <Text size="sm" c="dimmed" mt={6}>overall scam risk</Text>
    </Stack>
  )
}

export function Legend({ items }: { items: { label: string; color: string; dash?: string }[] }) {
  return (
    <Group gap="md" wrap="wrap">
      {items.map((i) => (
        <Group key={i.label} gap={6} wrap="nowrap">
          {i.dash ? (
            <svg width="22" height="10" aria-hidden><line x1="0" y1="5" x2="22" y2="5" stroke={i.color} strokeWidth="2.5" strokeDasharray={i.dash} /></svg>
          ) : (
            <span className="fh-swatch" style={{ background: i.color }} />
          )}
          <Text size="xs" c="dimmed">{i.label}</Text>
        </Group>
      ))}
    </Group>
  )
}

export function Loading() {
  return (
    <Stack>
      <Skeleton h={70} radius="lg" />
      <SimpleGrid cols={{ base: 2, md: 4 }}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={110} radius="lg" />)}</SimpleGrid>
      <Skeleton h={320} radius="lg" />
    </Stack>
  )
}

export function ErrorAlert({ message }: { message: string }) {
  return (
    <Alert color="red" icon={<IconPlugConnectedX />} title="Could not reach the FakeHire API" radius="lg">
      {message}. Make sure the backend is running (<code>uvicorn api.main:app</code>).
    </Alert>
  )
}
