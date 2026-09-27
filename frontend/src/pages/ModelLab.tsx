import {
  Accordion, Badge, Card, Chip, Grid, Group, List, Paper, SegmentedControl, Select, SimpleGrid, Stack, Table, Text, ThemeIcon, Title,
} from '@mantine/core'
import {
  IconBinaryTree, IconChartLine, IconFlask, IconGridDots, IconInfoCircle, IconScale, IconTarget, IconTrophy, IconWand,
} from '@tabler/icons-react'
import { useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
} from 'recharts'
import { api, type Family, type Metrics } from '../api'
import { ChartCard, ErrorAlert, Legend, Loading, PageHeader, Reveal, StatCard } from '../components/ui'
import { tip, useAxis, useData } from '../hooks'
import { FAMILY_LABEL, fmt3, pct, usePalette } from '../theme'

const METRICS = { F1: 'f1', 'PR-AUC': 'pr_auc', Precision: 'precision', Recall: 'recall', 'ROC-AUC': 'roc_auc' } as const
type MetricLabel = keyof typeof METRICS
const DASHES = ['', '7 4', '2 3', '10 3 2 3']

/** Each model keeps a fixed colour (its family) and a fixed dash (its position inside the family). */
function lineStyle(m: Metrics, name: string) {
  const group = m.models[name].group
  const siblings = Object.keys(m.models).filter((n) => m.models[n].group === group)
  return { group, dash: DASHES[siblings.indexOf(name) % DASHES.length] }
}

function SectionTitle({ n, icon: Icon, title, sub }: { n: number; icon: typeof IconFlask; title: string; sub: string }) {
  return (
    <Group gap="sm" mt="xl" mb="md" wrap="nowrap">
      <ThemeIcon size={36} radius="md" variant="light"><Icon size={20} /></ThemeIcon>
      <div>
        <Title order={2} fz={20}>{n} · {title}</Title>
        <Text size="sm" c="dimmed">{sub}</Text>
      </div>
    </Group>
  )
}

function Comparison({ m }: { m: Metrics }) {
  const p = usePalette()
  const ax = useAxis()
  const [metric, setMetric] = useState<MetricLabel>('F1')
  const names = Object.keys(m.models)
  const cols = [['CV PR-AUC', (n: string) => m.models[n].cv.pr_auc], ['Precision', (n: string) => m.models[n].test.precision],
    ['Recall', (n: string) => m.models[n].test.recall], ['F1', (n: string) => m.models[n].test.f1],
    ['ROC-AUC', (n: string) => m.models[n].test.roc_auc], ['PR-AUC', (n: string) => m.models[n].test.pr_auc],
    ['Accuracy', (n: string) => m.models[n].test.accuracy], ['Threshold', (n: string) => m.models[n].test.threshold]] as const
  const best = Object.fromEntries(cols.map(([c, f]) => [c, Math.max(...names.map(f))]))
  const data = names.map((n) => ({ name: n, group: m.models[n].group, v: m.models[n].test[METRICS[metric]] }))

  return (
    <Stack gap="lg">
      <Card p={0}>
        <Table.ScrollContainer minWidth={900}>
          <Table striped highlightOnHover verticalSpacing="sm" horizontalSpacing="md" style={{ whiteSpace: 'nowrap' }}>
            <Table.Thead>
              <Table.Tr><Table.Th>Model</Table.Th><Table.Th>Family</Table.Th>{cols.map(([c]) => <Table.Th key={c} ta="right">{c}</Table.Th>)}</Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {names.map((n) => (
                <Table.Tr key={n} bg={n === m.final_model ? 'var(--mantine-color-teal-light)' : undefined}>
                  <Table.Td><Group gap={6} wrap="nowrap"><Text fw={650} size="sm">{n}</Text>
                    {n === m.final_model && <Badge size="xs" color="teal" leftSection={<IconTrophy size={10} />}>final</Badge>}</Group></Table.Td>
                  <Table.Td><Group gap={6} wrap="nowrap"><span className="fh-swatch" style={{ background: p.family[m.models[n].group] }} />
                    <Text size="sm">{FAMILY_LABEL[m.models[n].group]}</Text></Group></Table.Td>
                  {cols.map(([c, f]) => (
                    <Table.Td key={c} ta="right" ff="monospace" fz="sm"
                              fw={c !== 'Threshold' && c !== 'Accuracy' && f(n) === best[c] ? 800 : 400}>{fmt3(f(n))}</Table.Td>
                  ))}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>
      <Text size="sm" c="dimmed">
        Bold = best in column. The ensemble combines the best text model (<b>{m.best_text}</b>) and the best metadata model
        (<b>{m.best_meta}</b>), chosen by cross-validated PR-AUC, never by the test set.
      </Text>
      <ChartCard title="Test-set score by model" subtitle="Fraud (fake) class"
                 right={<SegmentedControl size="xs" data={Object.keys(METRICS)} value={metric} onChange={(v) => setMetric(v as MetricLabel)} />}>
        <Legend items={(['text', 'meta', 'ensemble'] as Family[]).map((f) => ({ label: FAMILY_LABEL[f], color: p.family[f] }))} />
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={data} margin={{ top: 24, right: 8, left: 0, bottom: 40 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke={ax.grid} />
            <XAxis dataKey="name" tick={{ ...ax.tick, fill: p.ink2 }} axisLine={ax.axisLine} tickLine={ax.tickLine} interval={0} angle={-20} textAnchor="end" />
            <YAxis domain={[0, 1]} tick={ax.tick} axisLine={false} tickLine={ax.tickLine} width={36} />
            <RTooltip cursor={{ fill: p.grid, opacity: 0.5 }} content={tip<(typeof data)[0]>((d) => <><b>{d.name}</b><br />{metric} {fmt3(d.v)}</>)} />
            <Bar dataKey="v" radius={[6, 6, 0, 0]} isAnimationActive={false}>
              {data.map((d) => <Cell key={d.name} fill={p.family[d.group]} />)}
              <LabelList dataKey="v" position="top" formatter={(v) => Number(v).toFixed(3)} fill={p.ink2} fontSize={11} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </Stack>
  )
}

function Curves({ m }: { m: Metrics }) {
  const p = usePalette()
  const ax = useAxis()
  const names = Object.keys(m.models)
  const [sel, setSel] = useState<string[]>([m.best_text, m.best_meta, m.final_model])
  const series = names.filter((n) => sel.includes(n))

  const chart = (kind: 'roc' | 'pr') => (
    <ChartCard title={kind === 'roc' ? 'ROC curve' : 'Precision-Recall curve'}
               subtitle={kind === 'roc' ? 'Higher and further left is better' : 'Better for imbalanced data: top-right is best'}>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart margin={{ top: 8, right: 12, left: 0, bottom: 20 }}>
          <CartesianGrid stroke={ax.grid} />
          <XAxis type="number" dataKey="x" domain={[0, 1]} tick={ax.tick} axisLine={ax.axisLine} tickLine={ax.tickLine}
                 label={ax.label(kind === 'roc' ? 'False positive rate' : 'Recall')} allowDuplicatedCategory={false} />
          <YAxis type="number" domain={[0, 1]} tick={ax.tick} axisLine={false} tickLine={ax.tickLine} width={36} />
          <RTooltip content={tip<{ x: number; y: number; model: string }>((d) => (
            <><b>{d.model}</b><br />{kind === 'roc' ? `FPR ${fmt3(d.x)} · TPR ${fmt3(d.y)}` : `Recall ${fmt3(d.x)} · Precision ${fmt3(d.y)}`}</>
          ))} />
          {kind === 'roc' && (
            <Line data={[{ x: 0, y: 0, model: 'Random guess' }, { x: 1, y: 1, model: 'Random guess' }]} dataKey="y" stroke={p.muted}
                  strokeDasharray="4 4" dot={false} strokeWidth={1} isAnimationActive={false} activeDot={false} />
          )}
          {series.map((n) => {
            const c = m.models[n].test[kind === 'roc' ? 'roc_curve' : 'pr_curve']
            const { group, dash } = lineStyle(m, n)
            return (
              <Line key={n} data={c.x.map((x, i) => ({ x, y: c.y[i], model: n }))} dataKey="y" stroke={p.family[group]}
                    strokeDasharray={dash} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
            )
          })}
        </LineChart>
      </ResponsiveContainer>
      <Legend items={series.map((n) => {
        const { group, dash } = lineStyle(m, n)
        const t = m.models[n].test
        return { label: `${n} (${fmt3(kind === 'roc' ? t.roc_auc : t.pr_auc)})`, color: p.family[group], dash: dash || '100' }
      })} />
    </ChartCard>
  )

  return (
    <Stack gap="md">
      <Chip.Group multiple value={sel} onChange={setSel}>
        <Group gap="xs">
          {names.map((n) => (
            <Chip key={n} value={n} size="sm" variant="light" color={lineStyle(m, n).group === 'text' ? 'brand' : lineStyle(m, n).group === 'meta' ? 'orange' : 'teal'}>{n}</Chip>
          ))}
        </Group>
      </Chip.Group>
      <SimpleGrid cols={{ base: 1, md: 2 }}>{chart('roc')}{chart('pr')}</SimpleGrid>
      <Text size="sm" c="dimmed">Colour = model family; line style tells models of the same family apart. AUC in brackets.</Text>
    </Stack>
  )
}

function Confusion({ m }: { m: Metrics }) {
  const p = usePalette()
  const [name, setName] = useState(m.final_model)
  const t = m.models[name].test
  const [[tn, fp], [fn, tp]] = t.confusion_matrix
  const max = Math.max(tn, fp, fn, tp)
  // Sequential blue ramp on a log scale so the small cells stay visible next to ~3,400 true negatives.
  const cell = (v: number, label: string) => {
    const step = Math.min(p.seq.length - 1, Math.round((Math.log1p(v) / Math.log1p(max)) * (p.seq.length - 1)))
    return (
      <Paper radius="md" p="lg" ta="center" title={`${label}: ${v}`} style={{ background: p.seq[step], color: step >= 3 ? '#fff' : '#0b0b0b' }}>
        <Text fz={30} fw={800} lh={1.1} c="inherit">{v.toLocaleString()}</Text>
        <Text size="xs" c="inherit" opacity={0.85}>{label}</Text>
      </Paper>
    )
  }
  return (
    <Grid>
      <Grid.Col span={{ base: 12, md: 6 }}>
        <ChartCard title="Confusion matrix" subtitle="Test set, at the tuned threshold"
                   right={<Select size="xs" w={180} data={Object.keys(m.models)} value={name} allowDeselect={false} onChange={(v) => v && setName(v)} aria-label="Model" />}>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: 6, alignItems: 'center' }}>
            <span /><Text size="xs" c="dimmed" ta="center">Predicted real</Text><Text size="xs" c="dimmed" ta="center">Predicted fake</Text>
            <Text size="xs" c="dimmed">Actually real</Text>{cell(tn, 'true negatives')}{cell(fp, 'false positives')}
            <Text size="xs" c="dimmed">Actually fake</Text>{cell(fn, 'false negatives')}{cell(tp, 'true positives')}
          </div>
        </ChartCard>
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 6 }}>
        <Card h="100%">
          <Text fw={650} mb="sm">{name} at threshold {t.threshold.toFixed(2)}</Text>
          <Stack gap="sm">
            {[
              { v: tp, label: 'scams caught', color: 'green', note: 'true positives' },
              { v: fn, label: 'scams missed', color: 'red', note: 'false negatives: the costly error for a job seeker' },
              { v: fp, label: 'real jobs wrongly flagged', color: 'orange', note: 'false positives' },
              { v: tn, label: 'real jobs correctly passed', color: 'green', note: 'true negatives' },
            ].map((r) => (
              <Group key={r.label} wrap="nowrap" gap="sm">
                <Badge color={r.color} variant="light" size="xl" w={86} radius="md">{r.v.toLocaleString()}</Badge>
                <div><Text size="sm" fw={600}>{r.label}</Text><Text size="xs" c="dimmed">{r.note}</Text></div>
              </Group>
            ))}
          </Stack>
        </Card>
      </Grid.Col>
    </Grid>
  )
}

function Learned({ m }: { m: Metrics }) {
  const p = usePalette()
  const ax = useAxis()
  const [which, setWhich] = useState(Object.keys(m.feature_importance)[0])
  const words = m.top_words.fake.slice(0, 12).map(([term, v]) => ({ term, v }))
  const imp = m.feature_importance[which].slice(0, 12).map(([f, v]) => ({ f, v }))
  return (
    <SimpleGrid cols={{ base: 1, md: 2 }}>
      <ChartCard title="Words that signal FAKE" subtitle="Logistic Regression coefficients on TF-IDF">
        <ResponsiveContainer width="100%" height={380}>
          <BarChart data={words} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }} barCategoryGap={4}>
            <CartesianGrid horizontal={false} stroke={ax.grid} />
            <XAxis type="number" tick={ax.tick} axisLine={ax.axisLine} tickLine={ax.tickLine} />
            <YAxis type="category" dataKey="term" width={112} tick={{ ...ax.tick, fill: p.ink2 }} axisLine={false} tickLine={ax.tickLine} />
            <RTooltip cursor={{ fill: p.grid, opacity: 0.5 }} content={tip<(typeof words)[0]>((d) => <><b>{d.term}</b>: {d.v.toFixed(2)}</>)} />
            <Bar dataKey="v" fill={p.fake} radius={[0, 6, 6, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
        <Text size="xs" c="dimmed">Strongest REAL signals: {m.top_words.real.slice(0, 8).map(([w]) => w).join(', ')}. “urltoken” / “phonetoken” stand for a link / phone number.</Text>
      </ChartCard>
      <ChartCard title="Metadata feature importance" subtitle="What the tree models rely on"
                 right={<SegmentedControl size="xs" data={Object.keys(m.feature_importance)} value={which} onChange={setWhich} />}>
        <ResponsiveContainer width="100%" height={380}>
          <BarChart data={imp} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }} barCategoryGap={4}>
            <CartesianGrid horizontal={false} stroke={ax.grid} />
            <XAxis type="number" tick={ax.tick} axisLine={ax.axisLine} tickLine={ax.tickLine} />
            <YAxis type="category" dataKey="f" width={170} tick={{ ...ax.tick, fill: p.ink2, fontSize: 11 }} axisLine={false} tickLine={ax.tickLine} />
            <RTooltip cursor={{ fill: p.grid, opacity: 0.5 }} content={tip<(typeof imp)[0]>((d) => <><b>{d.f}</b>: {d.v.toFixed(3)}</>)} />
            <Bar dataKey="v" fill={p.family.meta} radius={[0, 6, 6, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </SimpleGrid>
  )
}

function Imbalance({ m }: { m: Metrics }) {
  const p = usePalette()
  const ax = useAxis()
  const rows = m.imbalance_experiment
  const strategies = ['No balancing', 'Class weights', 'SMOTE']
  const colors = [p.muted, p.family.text, p.family.meta]
  const models = [...new Set(rows.map((r) => r.model))]
  const data = models.map((model) => Object.fromEntries([['model', model],
    ...strategies.map((s) => [s, rows.find((r) => r.model === model && r.strategy === s)?.['recall@0.5'] ?? 0])]))
  return (
    <Grid>
      <Grid.Col span={{ base: 12, md: 6 }}>
        <ChartCard title="Recall at the default 0.5 threshold" subtitle="5-fold cross-validation on the training set">
          <Legend items={strategies.map((s, i) => ({ label: s, color: colors[i] }))} />
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} margin={{ top: 22, right: 8, left: 0, bottom: 4 }} barGap={3}>
              <CartesianGrid vertical={false} stroke={ax.grid} />
              <XAxis dataKey="model" tick={{ ...ax.tick, fill: p.ink2 }} axisLine={ax.axisLine} tickLine={ax.tickLine} />
              <YAxis domain={[0, 1]} tick={ax.tick} axisLine={false} tickLine={ax.tickLine} width={36} />
              <RTooltip cursor={{ fill: p.grid, opacity: 0.5 }} content={tip<Record<string, number | string>>((d) => (
                <><b>{d.model}</b>{strategies.map((s) => <div key={s}>{s}: {Number(d[s]).toFixed(3)}</div>)}</>
              ))} />
              {strategies.map((s, i) => (
                <Bar key={s} dataKey={s} fill={colors[i]} radius={[6, 6, 0, 0]} isAnimationActive={false}>
                  <LabelList dataKey={s} position="top" formatter={(v) => Number(v).toFixed(2)} fill={p.ink2} fontSize={11} />
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 6 }}>
        <Stack h="100%">
          <Card p={0}>
            <Table.ScrollContainer minWidth={460}>
              <Table striped verticalSpacing="xs" horizontalSpacing="md" fz="sm" style={{ whiteSpace: 'nowrap' }}>
                <Table.Thead><Table.Tr><Table.Th>Model</Table.Th><Table.Th>Strategy</Table.Th><Table.Th ta="right">Recall@0.5</Table.Th><Table.Th ta="right">F1@0.5</Table.Th><Table.Th ta="right">PR-AUC</Table.Th></Table.Tr></Table.Thead>
                <Table.Tbody>{rows.map((r) => (
                  <Table.Tr key={r.model + r.strategy}><Table.Td>{r.model}</Table.Td><Table.Td>{r.strategy}</Table.Td>
                    <Table.Td ta="right" ff="monospace">{fmt3(r['recall@0.5'])}</Table.Td><Table.Td ta="right" ff="monospace">{fmt3(r['f1@0.5'])}</Table.Td>
                    <Table.Td ta="right" ff="monospace">{fmt3(r.pr_auc)}</Table.Td></Table.Tr>
                ))}</Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Card>
          <Paper p="md" radius="lg" bg="var(--mantine-color-brand-light)">
            <Group gap="xs" mb={4}><IconWand size={18} /><Text fw={650}>Takeaway</Text></Group>
            <Text size="sm">Without balancing, the models miss many scams at the default threshold. Class weights and SMOTE lift recall
              by a similar amount while ranking quality (PR-AUC) barely changes, so we use the simpler class weights and tune the threshold.</Text>
          </Paper>
        </Stack>
      </Grid.Col>
    </Grid>
  )
}

export default function ModelLab() {
  const { data: m, error } = useData('metrics', api.metrics)
  if (error) return <ErrorAlert message={error} />
  if (!m) return <Loading />
  const ft = m.models[m.final_model].test
  const ds = m.dataset
  const total = ds.n_train + ds.n_test
  return (
    <>
      <PageHeader icon={IconFlask} title="Model Lab" description="Every model trained for FakeHire, compared on the same held-out test set of 3,576 posts." />
      <Reveal>
        <SimpleGrid cols={{ base: 1, xs: 2, lg: 4 }}>
          <StatCard icon={IconTrophy} label={`F1 · ${m.final_model}`} value={ft.f1} decimals={3} color="teal" sub="balance of precision & recall" />
          <StatCard icon={IconTarget} label="Precision" value={ft.precision * 100} decimals={1} suffix="%" sub="flags that really were fake" />
          <StatCard icon={IconScale} label="Recall" value={ft.recall * 100} decimals={1} suffix="%" color="violet" sub="fake posts that were caught" />
          <StatCard icon={IconChartLine} label="PR-AUC" value={ft.pr_auc} decimals={3} color="orange" sub="1.0 = perfect ranking" />
        </SimpleGrid>
      </Reveal>

      <Accordion variant="separated" radius="lg" mt="lg">
        <Accordion.Item value="how">
          <Accordion.Control icon={<IconInfoCircle size={20} />}>How the models were trained and evaluated</Accordion.Control>
          <Accordion.Panel>
            <List spacing="xs" size="sm">
              <List.Item><b>Data:</b> {total.toLocaleString()} job posts (EMSCAD), of which only <b>{pct((ds.fake_train + ds.fake_test) / total, 1)} are fake</b>.</List.Item>
              <List.Item><b>Split:</b> stratified 80/20 → {ds.n_train.toLocaleString()} train ({ds.fake_train} fake), {ds.n_test.toLocaleString()} test ({ds.fake_test} fake). The test set is used once.</List.Item>
              <List.Item><b>Cross-validation:</b> 5-fold stratified CV gives out-of-fold probabilities used to tune each threshold, pick the best base models and train the stacker without leakage.</List.Item>
              <List.Item><b>Class imbalance:</b> class weights (or <code>scale_pos_weight</code> for XGBoost); SMOTE is compared below.</List.Item>
              <List.Item><b>Why not accuracy?</b> Always answering “real” already scores <b>{pct(1 - ds.fake_test / ds.n_test, 1)}</b> and catches zero scams.</List.Item>
            </List>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>

      <SectionTitle n={1} icon={IconTrophy} title="Comparison" sub="3 text models · 4 metadata models · 2 ensembles" />
      <Comparison m={m} />
      <SectionTitle n={2} icon={IconChartLine} title="ROC and precision-recall curves" sub="Pick the models to compare" />
      <Curves m={m} />
      <SectionTitle n={3} icon={IconGridDots} title="Confusion matrix" sub="Where each model gets it right and wrong" />
      <Confusion m={m} />
      <SectionTitle n={4} icon={IconBinaryTree} title="What the models learned" sub="Explainability" />
      <Learned m={m} />
      <SectionTitle n={5} icon={IconScale} title="Experiment: handling class imbalance" sub="No balancing vs class weights vs SMOTE" />
      <Imbalance m={m} />
    </>
  )
}
