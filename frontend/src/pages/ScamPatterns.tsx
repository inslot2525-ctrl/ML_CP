import { Badge, Card, Grid, Group, List, Paper, Select, SimpleGrid, Table, Text, ThemeIcon, Title } from '@mantine/core'
import { IconChartDots3, IconFileText, IconFlag, IconHome, IconPhotoOff, IconRuler, IconTarget } from '@tabler/icons-react'
import { useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart,
  Tooltip as RTooltip, XAxis, YAxis,
} from 'recharts'
import { api, type RateRow } from '../api'
import { ChartCard, ErrorAlert, Legend, Loading, PageHeader, Reveal, StatCard } from '../components/ui'
import { tip, useAxis, useData } from '../hooks'
import { pct, usePalette } from '../theme'

const SHORT: Record<string, string> = { 'No company profile': 'No profile' }
const ATTRS: [string, string][] = [
  ['has_company_logo', 'Company logo'], ['company_profile_missing', 'Company profile'],
  ['salary_given', 'Salary'], ['telecommuting', 'Remote work'],
]

function AttrChart({ rows, title }: { rows: RateRow[]; title: string }) {
  const p = usePalette()
  const ax = useAxis()
  const data = [...rows].sort((a, b) => a.fraud_rate - b.fraud_rate).map((r) => ({ ...r, value: SHORT[r.value] ?? r.value, v: r.fraud_rate * 100 }))
  const ratio = data[data.length - 1].fraud_rate / data[0].fraud_rate
  return (
    <ChartCard title={title} right={<Badge color="red" variant="light">{ratio.toFixed(1)}×</Badge>}>
      <ResponsiveContainer width="100%" height={190}>
        <BarChart data={data} margin={{ top: 20, right: 4, left: -18, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke={ax.grid} />
          <XAxis dataKey="value" tick={{ ...ax.tick, fontSize: 11 }} axisLine={ax.axisLine} tickLine={ax.tickLine} interval={0} />
          <YAxis tick={ax.tick} axisLine={false} tickLine={ax.tickLine} unit="%" />
          <RTooltip cursor={{ fill: p.grid, opacity: 0.5 }} content={tip<(typeof data)[0]>((d) => <><b>{d.value}</b><br />{d.v.toFixed(1)}% fake · {d.count.toLocaleString()} posts</>)} />
          <Bar dataKey="v" radius={[6, 6, 0, 0]} isAnimationActive={false}>
            {data.map((d, i) => <Cell key={d.value} fill={i === data.length - 1 ? p.fake : p.real} />)}
            <LabelList dataKey="v" position="top" formatter={(v) => `${Number(v).toFixed(1)}%`} fill={p.ink2} fontSize={11} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

function TopRates({ rows, title }: { rows: RateRow[]; title: string }) {
  const p = usePalette()
  const ax = useAxis()
  const data = rows.slice(0, 10).map((r) => ({ ...r, v: r.fraud_rate * 100 }))
  return (
    <ChartCard title={title} subtitle="% of posts that are fake (min. 50 posts)">
      <ResponsiveContainer width="100%" height={330}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 4, bottom: 4 }} barCategoryGap={5}>
          <CartesianGrid horizontal={false} stroke={ax.grid} />
          <XAxis type="number" tick={ax.tick} axisLine={ax.axisLine} tickLine={ax.tickLine} unit="%" />
          <YAxis type="category" dataKey="value" width={150} tick={{ ...ax.tick, fill: p.ink2, fontSize: 11 }} axisLine={false} tickLine={ax.tickLine} />
          <RTooltip cursor={{ fill: p.grid, opacity: 0.5 }} content={tip<(typeof data)[0]>((d) => <><b>{d.value}</b><br />{d.v.toFixed(1)}% fake · {d.count.toLocaleString()} posts</>)} />
          <Bar dataKey="v" fill={p.fake} radius={[0, 6, 6, 0]} isAnimationActive={false}>
            <LabelList dataKey="v" position="right" formatter={(v) => `${Math.round(Number(v))}%`} fill={p.ink2} fontSize={11} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

function Section({ icon: Icon, color, title, sub }: { icon: typeof IconTarget; color: string; title: string; sub: string }) {
  return (
    <Group gap="sm" mt="xl" mb="md" wrap="nowrap">
      <ThemeIcon size={36} radius="md" variant="light" color={color}><Icon size={20} /></ThemeIcon>
      <div><Title order={2} fz={20}>{title}</Title><Text size="sm" c="dimmed">{sub}</Text></div>
    </Group>
  )
}

export default function ScamPatterns() {
  const p = usePalette()
  const ax = useAxis()
  const eda = useData('eda', api.eda)
  const cl = useData('clusters', api.clusters)
  const [picked, setPicked] = useState<number | null>(null)

  if (eda.error || cl.error) return <ErrorAlert message={(eda.error || cl.error)!} />
  if (!eda.data || !cl.data) return <Loading />
  const E = eda.data
  const C = cl.data

  const clusters = [...C.clusters].sort((a, b) => b.size - a.size)
  const chosen = clusters.find((c) => c.id === picked) ?? clusters[0]
  const others = C.points.filter((pt) => pt.cluster !== chosen.id)
  const mine = C.points.filter((pt) => pt.cluster === chosen.id)
  const kData = C.k_range.map((k, i) => ({ k, inertia: C.inertia[i], silhouette: C.silhouette[i] }))
  const ev = C.pca_explained_variance

  return (
    <>
      <PageHeader icon={IconChartDots3} title="Scam Patterns"
                  description="What 17,880 real job posts reveal about fake ones, and the scam “archetypes” discovered with unsupervised learning." />
      <Reveal>
        <SimpleGrid cols={{ base: 1, xs: 2, lg: 4 }}>
          <StatCard icon={IconFileText} label="Job posts analysed" value={E.n_posts} />
          <StatCard icon={IconFlag} label="Fake posts" value={E.n_fake} color="red" sub={`${pct(E.fake_share, 1)} of all posts`} />
          <StatCard icon={IconRuler} label="Median words · real" value={E.median_words.real} color="green" />
          <StatCard icon={IconRuler} label="Median words · fake" value={E.median_words.fake} color="orange" sub="fake posts are shorter" />
        </SimpleGrid>
      </Reveal>

      <Section icon={IconPhotoOff} color="red" title="1 · Warning signs in the data" sub="Share of posts that were fake, with vs without each attribute" />
      <SimpleGrid cols={{ base: 1, xs: 2, lg: 4 }}>
        {ATTRS.map(([k, t]) => <AttrChart key={k} rows={E.by[k]} title={t} />)}
      </SimpleGrid>
      <SimpleGrid cols={{ base: 1, md: 2 }} mt="md">
        <TopRates rows={E.by_industry} title="Industries with the most fake posts" />
        <TopRates rows={E.by_function} title="Job functions with the most fake posts" />
      </SimpleGrid>

      <Section icon={IconTarget} color="violet" title="2 · Scam archetypes (K-Means clustering)"
               sub={`TF-IDF → Truncated SVD (PCA for sparse text, 50 dims) → K-Means on the ${E.n_fake} fake posts`} />
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        {(['inertia', 'silhouette'] as const).map((key) => (
          <ChartCard key={key} title={key === 'inertia' ? 'Elbow method' : 'Silhouette score'}
                     subtitle={key === 'inertia' ? 'Within-cluster sum of squares' : `k = ${C.k}: best between 4 and 8 (capped for interpretability)`}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={kData} margin={{ top: 10, right: 16, left: 0, bottom: 16 }}>
                <CartesianGrid stroke={ax.grid} />
                <XAxis dataKey="k" tick={ax.tick} axisLine={ax.axisLine} tickLine={ax.tickLine} label={ax.label('k (number of clusters)')} />
                <YAxis tick={ax.tick} axisLine={false} tickLine={ax.tickLine} width={44} domain={['auto', 'auto']}
                       tickFormatter={(v) => (key === 'silhouette' ? Number(v).toFixed(2) : String(Math.round(Number(v))))} />
                <RTooltip content={tip<(typeof kData)[0]>((d) => <>k = {d.k}: {key} {key === 'silhouette' ? d.silhouette.toFixed(3) : d.inertia.toFixed(1)}</>)} />
                {key === 'silhouette' && <ReferenceLine x={C.k} stroke={p.ink3} strokeDasharray="4 4" label={{ value: `chosen k=${C.k}`, fill: p.ink3, fontSize: 11, position: 'insideTopLeft' }} />}
                <Line dataKey={key} stroke={p.violet} strokeWidth={2.5} dot={{ r: 4, fill: p.violet }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        ))}
      </SimpleGrid>

      <Grid mt="md">
        <Grid.Col span={{ base: 12, md: 7 }}>
          <ChartCard title="Fake posts projected to 2-D with PCA" subtitle="Pick an archetype to highlight it"
                     right={<Select w={250} size="xs" allowDeselect={false} value={String(chosen.id)} onChange={(v) => setPicked(Number(v))}
                                    data={clusters.map((c) => ({ value: String(c.id), label: `${c.name} (${c.size})` }))} aria-label="Highlight an archetype" />}>
            <ResponsiveContainer width="100%" height={380}>
              <ScatterChart margin={{ top: 8, right: 12, left: 0, bottom: 16 }}>
                <CartesianGrid stroke={ax.grid} />
                <XAxis type="number" dataKey="x" tick={ax.tick} axisLine={ax.axisLine} tickLine={ax.tickLine} tickFormatter={(v) => Number(v).toFixed(1)}
                       label={ax.label(`PC1 (${pct(ev[0], 1)} variance)`)} />
                <YAxis type="number" dataKey="y" tick={ax.tick} axisLine={false} tickLine={ax.tickLine} width={40} tickFormatter={(v) => Number(v).toFixed(1)} />
                <RTooltip content={tip<{ title: string; cluster: number }>((d) => (
                  <><b>{d.title}</b><br /><Text span size="xs" c="dimmed">{C.clusters.find((c) => c.id === d.cluster)?.name}</Text></>
                ))} />
                <Scatter data={others} fill={p.muted} fillOpacity={0.5} isAnimationActive={false} />
                <Scatter data={mine} fill={p.fake} stroke={p.surface} strokeWidth={1} isAnimationActive={false} />
              </ScatterChart>
            </ResponsiveContainer>
            <Legend items={[{ label: chosen.name, color: p.fake }, { label: 'Other fake posts', color: p.muted }]} />
          </ChartCard>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Card h="100%">
            <Badge variant="light" color="violet" mb="xs">Archetype</Badge>
            <Title order={3} fz={20}>{chosen.name}</Title>
            <SimpleGrid cols={3} my="md" spacing="xs">
              {[
                { l: 'posts', v: String(chosen.size), icon: IconFileText },
                { l: 'remote', v: pct(chosen.telecommuting_rate), icon: IconHome },
                { l: 'no logo', v: pct(chosen.no_logo_rate), icon: IconPhotoOff },
              ].map((s) => (
                <Paper key={s.l} withBorder p="xs" radius="md" ta="center">
                  <s.icon size={16} style={{ opacity: 0.6 }} />
                  <Text fw={800} fz="lg">{s.v}</Text><Text size="xs" c="dimmed">{s.l}</Text>
                </Paper>
              ))}
            </SimpleGrid>
            <Text size="sm" fw={600} mb={6}>Top terms</Text>
            <Group gap={6} mb="md">{chosen.top_terms.slice(0, 10).map((t) => <Badge key={t} variant="outline" color="gray" tt="none">{t}</Badge>)}</Group>
            <Text size="sm" fw={600} mb={6}>Typical titles</Text>
            <List size="sm" spacing={4}>{chosen.example_titles.slice(0, 5).map((t) => <List.Item key={t}>{t}</List.Item>)}</List>
          </Card>
        </Grid.Col>
      </Grid>

      <Card p={0} mt="md">
        <Table.ScrollContainer minWidth={720}>
          <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
            <Table.Thead><Table.Tr><Table.Th>Archetype</Table.Th><Table.Th ta="right">Posts</Table.Th><Table.Th>Top terms</Table.Th><Table.Th ta="right">Remote</Table.Th><Table.Th ta="right">No logo</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>{clusters.map((c) => (
              <Table.Tr key={c.id} onClick={() => setPicked(c.id)} style={{ cursor: 'pointer' }}
                        bg={c.id === chosen.id ? 'var(--mantine-color-violet-light)' : undefined}>
                <Table.Td fw={600}>{c.name}</Table.Td><Table.Td ta="right">{c.size}</Table.Td>
                <Table.Td><Text size="sm" c="dimmed">{c.top_terms.slice(0, 6).join(', ')}</Text></Table.Td>
                <Table.Td ta="right">{pct(c.telecommuting_rate)}</Table.Td><Table.Td ta="right">{pct(c.no_logo_rate)}</Table.Td>
              </Table.Tr>
            ))}</Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>
    </>
  )
}
