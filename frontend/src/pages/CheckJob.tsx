import {
  Accordion, Alert, Badge, Box, Button, Card, FileButton, Grid, Group, List, Paper, Progress, ScrollArea, SegmentedControl,
  Select, SimpleGrid, Stack, Table, Tabs, Text, TextInput, Textarea, ThemeIcon, Timeline, Title, Tooltip,
} from '@mantine/core'
import {
  IconAdjustmentsHorizontal, IconAlertTriangle, IconBrain, IconChartBar, IconCheck, IconDownload, IconEraser, IconFileSpreadsheet,
  IconFlag, IconHighlight, IconInfoCircle, IconListCheck, IconPhoneCall, IconRoute, IconSearch, IconShieldSearch, IconUpload,
} from '@tabler/icons-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts'
import { api, type BatchRow, type JobPost, type Metrics, type PredictResult, type RiskLevel } from '../api'
import { ErrorAlert, Legend, PageHeader, Reveal, RiskBadge, RiskGauge } from '../components/ui'
import { EXAMPLES } from '../examples'
import { addToHistory } from '../history'
import { tip, useAxis, useData } from '../hooks'
import { FAMILY_LABEL, RISK, RISK_ICON, pct, usePalette } from '../theme'

type YesNo = 'Not sure' | 'Yes' | 'No'
const YES_NO: YesNo[] = ['Not sure', 'Yes', 'No']
const EMPLOYMENT = ['Unknown', 'Full-time', 'Part-time', 'Contract', 'Temporary', 'Other']
const EXPERIENCE = ['Unknown', 'Internship', 'Entry level', 'Associate', 'Mid-Senior level', 'Director', 'Executive', 'Not Applicable']
const EDUCATION = ['Unknown', 'High School or equivalent', 'Some College Coursework Completed', 'Associate Degree',
  "Bachelor's Degree", "Master's Degree", 'Doctorate', 'Certification', 'Vocational', 'Unspecified']

export interface Form {
  text: string; title: string; company_profile: string; salary: string
  has_logo: YesNo; has_questions: YesNo; telecommuting: YesNo
  employment_type: string; required_experience: string; required_education: string
}
const EMPTY: Form = {
  text: '', title: '', company_profile: '', salary: '', has_logo: 'Not sure', has_questions: 'Not sure',
  telecommuting: 'Not sure', employment_type: 'Unknown', required_experience: 'Unknown', required_education: 'Unknown',
}
export interface CheckState { prefill?: Partial<Form>; autorun?: boolean; mode?: 'batch' }

const yn = (v: YesNo) => (v === 'Not sure' ? null : v === 'Yes')

// ---------------------------------------------------------------- highlighting
type Span = { start: number; end: number; kind: 'r' | 'w' }

function findSpans(text: string, ruleMatches: string[], words: string[]): Span[] {
  const spans: Span[] = []
  const lower = text.toLowerCase()
  for (const m of [...new Set(ruleMatches)].filter(Boolean).sort((a, b) => b.length - a.length)) {
    let i = lower.indexOf(m.toLowerCase())
    while (i !== -1) {
      spans.push({ start: i, end: i + m.length, kind: 'r' })
      i = lower.indexOf(m.toLowerCase(), i + m.length)
    }
  }
  const usable = words.filter((w) => /^[\x20-\x7e]+$/.test(w) && !w.includes('token') && !/^[\d\s]+$/.test(w))
  if (usable.length) {
    const esc = usable.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+'))
    const rx = new RegExp(`(?<![\\w])(${esc.join('|')})(?![\\w])`, 'gi')
    for (const m of text.matchAll(rx)) spans.push({ start: m.index!, end: m.index! + m[0].length, kind: 'w' })
  }
  spans.sort((a, b) => (a.kind === b.kind ? a.start - b.start : a.kind === 'r' ? -1 : 1))
  const kept: Span[] = []
  for (const s of spans) if (!kept.some((k) => s.start < k.end && k.start < s.end)) kept.push(s)
  return kept.sort((a, b) => a.start - b.start)
}

function Highlighted({ text, result }: { text: string; result: PredictResult }) {
  const spans = findSpans(text, result.red_flags.map((f) => f.match), result.fake_words.map((w) => w.term))
  const out: ReactNode[] = []
  let pos = 0
  spans.forEach((s, i) => {
    out.push(text.slice(pos, s.start))
    out.push(<mark key={i} className={s.kind}>{text.slice(s.start, s.end)}</mark>)
    pos = s.end
  })
  out.push(text.slice(pos))
  return <Paper withBorder p="md" radius="md" className="fh-post">{out}</Paper>
}

// ---------------------------------------------------------------- charts
function ModelsChart({ result, metrics }: { result: PredictResult; metrics?: Metrics }) {
  const p = usePalette()
  const ax = useAxis()
  const data = Object.entries(result.all_models).map(([name, prob]) => {
    const group = metrics?.models[name]?.group ?? 'text'
    return { name, prob: prob * 100, group, threshold: (metrics?.models[name]?.test.threshold ?? 0.5) * 100 }
  })
  return (
    <>
      <Legend items={(['text', 'meta', 'ensemble'] as const).map((f) => ({ label: FAMILY_LABEL[f], color: p.family[f] }))} />
      <ResponsiveContainer width="100%" height={340}>
        <BarChart data={data} layout="vertical" margin={{ top: 10, right: 44, left: 4, bottom: 18 }} barCategoryGap={6}>
          <CartesianGrid horizontal={false} stroke={ax.grid} />
          <XAxis type="number" domain={[0, 100]} tick={ax.tick} axisLine={ax.axisLine} tickLine={ax.tickLine} unit="%" label={ax.label('P(fake)')} />
          <YAxis type="category" dataKey="name" width={130} tick={{ ...ax.tick, fill: p.ink2 }} axisLine={ax.axisLine} tickLine={ax.tickLine} />
          <RTooltip cursor={{ fill: p.grid, opacity: 0.5 }} content={tip<(typeof data)[0]>((d) => (
            <><b>{d.name}</b><br />P(fake) {d.prob.toFixed(1)}%<br /><Text span size="xs" c="dimmed">flags fake above {d.threshold.toFixed(0)}%</Text></>
          ))} />
          <Bar dataKey="prob" radius={[0, 6, 6, 0]} isAnimationActive={false}>
            {data.map((d) => <Cell key={d.name} fill={p.family[d.group]} />)}
            <LabelList dataKey="prob" position="right" formatter={(v) => `${Math.round(Number(v))}%`} fill={p.ink2} fontSize={12} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </>
  )
}

function WordsChart({ result }: { result: PredictResult }) {
  const p = usePalette()
  const ax = useAxis()
  const data = [...result.fake_words.slice(0, 8), ...result.real_words.slice(0, 6)]
  if (!data.length) return <Text c="dimmed" size="sm">No known words in this text.</Text>
  return (
    <>
      <Legend items={[{ label: 'pushes towards FAKE', color: p.fake }, { label: 'pushes towards REAL', color: p.real }]} />
      <ResponsiveContainer width="100%" height={Math.max(180, data.length * 26 + 50)}>
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 30, left: 4, bottom: 8 }} barCategoryGap={4}>
          <CartesianGrid horizontal={false} stroke={ax.grid} />
          <XAxis type="number" tick={ax.tick} axisLine={ax.axisLine} tickLine={ax.tickLine} />
          <YAxis type="category" dataKey="term" width={120} tick={{ ...ax.tick, fill: p.ink2 }} axisLine={false} tickLine={ax.tickLine} />
          <ReferenceLine x={0} stroke={p.axis} />
          <RTooltip cursor={{ fill: p.grid, opacity: 0.5 }} content={tip<(typeof data)[0]>((d) => (
            <><b>{d.term}</b>: {d.weight > 0 ? '+' : ''}{d.weight.toFixed(2)}<br /><Text span size="xs" c="dimmed">TF-IDF value × coefficient</Text></>
          ))} />
          <Bar dataKey="weight" isAnimationActive={false} radius={4}>
            {data.map((d) => <Cell key={d.term} fill={d.weight > 0 ? p.fake : p.real} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </>
  )
}

// ---------------------------------------------------------------- result
function Result({ result, text, metrics }: { result: PredictResult; text: string; metrics?: Metrics }) {
  const risk = RISK[result.risk_level]
  const Icon = RISK_ICON[result.risk_level]
  return (
    <Stack gap="lg">
      <Grid>
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Card h="100%">
            <Stack align="center" justify="center" h="100%" gap="sm">
              <RiskGauge score={result.risk_score} level={result.risk_level} />
              <RiskBadge level={result.risk_level} size="lg" />
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Stack h="100%" gap="md">
            <Alert color={risk.mantine} variant="light" radius="lg" icon={<Icon size={26} />} title={<Text fw={750} fz="lg">{risk.label}</Text>}>
              Combines the ML ensemble (<b>{result.final_model}</b>) with <b>{result.red_flags.length}</b> rule-based red flag(s).
            </Alert>
            <SimpleGrid cols={{ base: 1, xs: 2 }}>
              <Card padding="md">
                <Group justify="space-between"><Group gap={6}><IconBrain size={18} /><Text size="sm" fw={600}>ML probability</Text></Group>
                  <Tooltip label={`Stacked ensemble output. Above ${pct(result.threshold)} the post is classified fake.`} multiline w={240}>
                    <IconInfoCircle size={16} style={{ opacity: 0.6 }} /></Tooltip></Group>
                <Text fz={30} fw={800}>{pct(result.ml_probability)}</Text>
                <Progress value={result.ml_probability * 100} color="brand" radius="xl" />
              </Card>
              <Card padding="md">
                <Group justify="space-between"><Group gap={6}><IconFlag size={18} /><Text size="sm" fw={600}>Rule score</Text></Group>
                  <Badge variant="light" color={result.red_flags.length ? 'red' : 'green'}>{result.red_flags.length} flags</Badge></Group>
                <Text fz={30} fw={800}>{pct(result.rule_score)}</Text>
                <Progress value={result.rule_score * 100} color="orange" radius="xl" />
              </Card>
            </SimpleGrid>
            {result.archetype && (
              <Paper p="md" radius="lg" bg="var(--mantine-color-violet-light)">
                <Group gap="sm" wrap="nowrap">
                  <ThemeIcon color="violet" variant="filled" radius="md" size="lg"><IconRoute size={20} /></ThemeIcon>
                  <div><Text size="xs" c="dimmed" tt="uppercase" fw={600}>Closest scam pattern (K-Means)</Text>
                    <Text fw={650}>{result.archetype.name}</Text></div>
                </Group>
              </Paper>
            )}
          </Stack>
        </Grid.Col>
      </Grid>

      <Card>
        <Tabs defaultValue="highlight" keepMounted={false}>
          <Tabs.List mb="md">
            <Tabs.Tab value="highlight" leftSection={<IconHighlight size={16} />}>Highlighted post</Tabs.Tab>
            <Tabs.Tab value="flags" leftSection={<IconFlag size={16} />}
                      rightSection={result.red_flags.length > 0 ? <Badge size="sm" color="red" circle>{result.red_flags.length}</Badge> : null}>
              Red flags
            </Tabs.Tab>
            <Tabs.Tab value="models" leftSection={<IconChartBar size={16} />}>What each model says</Tabs.Tab>
            <Tabs.Tab value="words" leftSection={<IconBrain size={16} />}>Word contributions</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="highlight">
            <Highlighted text={text} result={result} />
            <Group gap="lg" mt="sm">
              <Group gap={6}><Box component="mark" className="r" px={4} style={{ background: 'var(--fh-rule-soft)', borderBottom: '2px solid var(--fh-rule-line)', borderRadius: 4 }}>abc</Box><Text size="xs" c="dimmed">matched a red-flag rule</Text></Group>
              <Group gap={6}><Box component="mark" px={4} style={{ background: 'var(--fh-fake-soft)', borderRadius: 4, color: 'inherit' }}>abc</Box><Text size="xs" c="dimmed">word linked to fake posts (Logistic Regression)</Text></Group>
            </Group>
          </Tabs.Panel>
          <Tabs.Panel value="flags">
            {result.red_flags.length === 0 ? (
              <Alert color="green" icon={<IconCheck />} radius="md">No rule-based red flags found.</Alert>
            ) : (
              <Timeline bulletSize={28} lineWidth={2} color="red" active={result.red_flags.length}>
                {result.red_flags.map((f) => (
                  <Timeline.Item key={f.id} bullet={<IconAlertTriangle size={15} />}
                                 title={<Group gap="xs"><Text fw={650}>{f.message}</Text><Badge variant="outline" color="red" size="md" tt="none" fw={500}>“{f.match}”</Badge></Group>}>
                    <Text size="sm" c="dimmed" mt={2}>{f.tip}</Text>
                  </Timeline.Item>
                ))}
              </Timeline>
            )}
          </Tabs.Panel>
          <Tabs.Panel value="models">
            <Text size="sm" c="dimmed" mb="xs">Probability of “fake” from every model trained in this project. Hover a bar for its tuned threshold.</Text>
            <ModelsChart result={result} metrics={metrics} />
          </Tabs.Panel>
          <Tabs.Panel value="words">
            <Text size="sm" c="dimmed" mb="xs">How much each word in the post moved the Logistic Regression model.</Text>
            <WordsChart result={result} />
          </Tabs.Panel>
        </Tabs>
      </Card>

      <Grid>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Card h="100%">
            <Group gap="xs" mb="sm"><ThemeIcon variant="light" color="green"><IconListCheck size={18} /></ThemeIcon><Text fw={650}>Stay safe</Text></Group>
            <List spacing="xs" icon={<ThemeIcon color="green" size={20} radius="xl"><IconCheck size={13} /></ThemeIcon>}>
              {[...new Set(result.tips)].map((t) => <List.Item key={t}><Text size="sm">{t}</Text></List.Item>)}
            </List>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card h="100%" bg="var(--mantine-color-red-light)" withBorder={false}>
            <ThemeIcon color="red" size={44} radius="md" mb="sm"><IconPhoneCall size={24} /></ThemeIcon>
            <Text fw={700} fz="lg">Already paid or shared documents?</Text>
            <Text size="sm" mt={4}>Report it immediately at <b>cybercrime.gov.in</b> or call the national helpline <b>1930</b>.</Text>
            <Text size="xs" c="dimmed" mt="md">FakeHire gives a risk estimate, not a guarantee.</Text>
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  )
}

// ---------------------------------------------------------------- single post
function SingleCheck({ initial }: { initial?: CheckState }) {
  const [form, setForm] = useState<Form>({ ...EMPTY, ...initial?.prefill })
  const [state, setState] = useState<{ loading?: boolean; error?: string; result?: PredictResult; text?: string }>({})
  const { data: metrics } = useData('metrics', api.metrics)
  const resultRef = useRef<HTMLDivElement>(null)
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }))

  async function run(f: Form) {
    if (!f.text.trim()) return
    setState((s) => ({ ...s, loading: true, error: undefined }))
    const post: JobPost = { ...f, has_logo: yn(f.has_logo), has_questions: yn(f.has_questions), telecommuting: yn(f.telecommuting) }
    try {
      const result = await api.predict(post)
      setState({ result, text: f.text })
      addToHistory(f.text, f.title, result)
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
    } catch (err) {
      setState({ error: (err as Error).message })
    }
  }

  // Arriving from the dashboard with a post to check.
  const autorun = useRef(initial?.autorun)
  useEffect(() => {
    if (autorun.current) { autorun.current = false; run({ ...EMPTY, ...initial?.prefill }) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadExample = (i: number) => {
    const ex = EXAMPLES[i]
    setForm({ ...EMPTY, text: ex.text, title: ex.title ?? '', company_profile: ex.company_profile ?? '', has_logo: ex.has_logo ?? 'Not sure' })
  }

  return (
    <Stack gap="xl">
      <Card p={{ base: 'md', sm: 'xl' }}>
        <form onSubmit={(e) => { e.preventDefault(); run(form) }}>
          <Stack gap="md">
            <Group justify="space-between" wrap="wrap" gap="xs">
              <Text fw={650}>Paste the job post or recruiter message</Text>
              <Group gap={6} wrap="wrap">
                <Text size="sm" c="dimmed">Try:</Text>
                {EXAMPLES.map((ex, i) => (
                  <Button key={ex.label} size="compact-sm" variant="light" radius="xl" leftSection={<ex.icon size={14} />} onClick={() => loadExample(i)}>
                    {ex.label}
                  </Button>
                ))}
              </Group>
            </Group>
            <Textarea value={form.text} onChange={(e) => set('text', e.currentTarget.value)} autosize minRows={5} maxRows={14} size="md"
                      placeholder="e.g. “Earn ₹5000/day from home, pay ₹499 registration fee, contact on WhatsApp…”" aria-label="Job post or message" />
            <Accordion variant="contained" radius="md">
              <Accordion.Item value="more">
                <Accordion.Control icon={<IconAdjustmentsHorizontal size={18} />}>
                  More details <Text span size="sm" c="dimmed">(optional, improves the metadata model)</Text>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="md">
                    <SimpleGrid cols={{ base: 1, sm: 2 }}>
                      <TextInput label="Job title" value={form.title} onChange={(e) => set('title', e.currentTarget.value)} />
                      <TextInput label="Salary shown in the post" value={form.salary} onChange={(e) => set('salary', e.currentTarget.value)} />
                    </SimpleGrid>
                    <Textarea label="Company description / “About us”" description="Leave empty if the post has none" autosize minRows={2}
                              value={form.company_profile} onChange={(e) => set('company_profile', e.currentTarget.value)} />
                    <SimpleGrid cols={{ base: 1, sm: 3 }}>
                      {([['has_logo', 'Company logo / verified page?'], ['has_questions', 'Screening questions asked?'],
                        ['telecommuting', 'Remote / work-from-home?']] as const).map(([k, label]) => (
                        <Stack key={k} gap={4}>
                          <Text size="sm" fw={500}>{label}</Text>
                          <SegmentedControl data={YES_NO} value={form[k]} onChange={(v) => set(k, v as YesNo)} size="xs" aria-label={label} />
                        </Stack>
                      ))}
                    </SimpleGrid>
                    <SimpleGrid cols={{ base: 1, sm: 3 }}>
                      <Select label="Employment type" data={EMPLOYMENT} value={form.employment_type} allowDeselect={false} onChange={(v) => set('employment_type', v ?? 'Unknown')} />
                      <Select label="Experience" data={EXPERIENCE} value={form.required_experience} allowDeselect={false} onChange={(v) => set('required_experience', v ?? 'Unknown')} />
                      <Select label="Education" data={EDUCATION} value={form.required_education} allowDeselect={false} onChange={(v) => set('required_education', v ?? 'Unknown')} />
                    </SimpleGrid>
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
            <Group>
              <Button type="submit" size="md" leftSection={<IconShieldSearch size={20} />} loading={state.loading} disabled={!form.text.trim()}
                      variant="gradient" gradient={{ from: 'brand.6', to: 'violet.7', deg: 135 }}>
                Check this job
              </Button>
              {form.text && <Button variant="default" size="md" leftSection={<IconEraser size={18} />} onClick={() => { setForm(EMPTY); setState({}) }}>Clear</Button>}
              <Text size="xs" c="dimmed">Nothing you paste leaves this app except to the FakeHire model. Recent checks stay in this browser.</Text>
            </Group>
          </Stack>
        </form>
      </Card>
      {state.error && <ErrorAlert message={state.error} />}
      <div ref={resultRef} style={{ scrollMarginTop: 80 }}>
        {state.result && state.text && <Reveal key={state.text + state.result.risk_score}><Result result={state.result} text={state.text} metrics={metrics} /></Reveal>}
      </div>
    </Stack>
  )
}

// ---------------------------------------------------------------- batch
function BatchCheck() {
  const [state, setState] = useState<{ loading?: boolean; error?: string; rows?: BatchRow[]; truncated?: boolean; name?: string }>({})
  const counts = useMemo(() => {
    const c: Record<RiskLevel, number> = { High: 0, Medium: 0, Low: 0 }
    state.rows?.forEach((r) => { c[r.risk_level] += 1 })
    return c
  }, [state.rows])

  async function upload(file: File | null) {
    if (!file) return
    setState({ loading: true, name: file.name })
    try {
      setState({ ...(await api.predictBatch(file)), name: file.name })
    } catch (err) {
      setState({ error: (err as Error).message })
    }
  }

  function download() {
    if (!state.rows?.length) return
    const cols = Object.keys(state.rows[0])
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csv = [cols.join(','), ...state.rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'fakehire_results.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const textCol = state.rows?.length ? ['text', 'description', 'message', 'post'].find((c) => c in state.rows![0]) : undefined
  const total = state.rows?.length ?? 0

  return (
    <Stack gap="lg">
      <Card p="xl" style={{ borderStyle: 'dashed', borderWidth: 2 }}>
        <Stack align="center" gap="sm" ta="center">
          <ThemeIcon size={64} radius="xl" variant="light"><IconFileSpreadsheet size={34} /></ThemeIcon>
          <Title order={3}>Check many job posts at once</Title>
          <Text c="dimmed" maw={620}>Upload a CSV with a <b>text</b> (or description / message / post) column. Optional columns: title,
            company_profile, salary_range, has_company_logo, has_questions, telecommuting. Up to 500 rows.</Text>
          <Group>
            <FileButton onChange={upload} accept=".csv,text/csv">
              {(props) => <Button {...props} size="md" leftSection={<IconUpload size={18} />} loading={state.loading}>Upload CSV</Button>}
            </FileButton>
            <Button component="a" href="/api/demo-csv" download variant="default" size="md" leftSection={<IconDownload size={18} />}>
              Sample CSV (28 messages)
            </Button>
          </Group>
          {state.name && !state.loading && <Text size="xs" c="dimmed">Last file: {state.name}</Text>}
        </Stack>
      </Card>
      {state.error && <ErrorAlert message={state.error} />}
      {state.rows && (
        <Reveal>
          <Stack gap="lg">
            {state.truncated && <Alert color="yellow" icon={<IconInfoCircle />}>Only the first 500 rows were checked.</Alert>}
            <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }}>
              {(['High', 'Medium', 'Low'] as const).map((l) => {
                const Icon = RISK_ICON[l]
                return (
                  <Card key={l} padding="md">
                    <Group justify="space-between"><Text size="sm" fw={600} c="dimmed">{l} risk</Text>
                      <ThemeIcon variant="light" color={RISK[l].mantine}><Icon size={18} /></ThemeIcon></Group>
                    <Text fz={30} fw={800}>{counts[l]}</Text>
                    <Progress value={total ? (counts[l] / total) * 100 : 0} color={RISK[l].color} radius="xl" size="sm" />
                  </Card>
                )
              })}
              <Card padding="md">
                <Stack justify="center" h="100%" gap="xs">
                  <Text size="sm" c="dimmed">{total} posts checked</Text>
                  <Button leftSection={<IconDownload size={16} />} onClick={download}>Download results</Button>
                </Stack>
              </Card>
            </SimpleGrid>
            <Card p={0}>
              <ScrollArea h={520}>
                <Table striped highlightOnHover stickyHeader verticalSpacing="sm" horizontalSpacing="md" miw={760}>
                  <Table.Thead>
                    <Table.Tr>
                      {'title' in state.rows[0] && <Table.Th>Title</Table.Th>}
                      <Table.Th>Post</Table.Th><Table.Th>Risk</Table.Th><Table.Th w={140}>Score</Table.Th><Table.Th>Red flags</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {state.rows.map((r, i) => {
                      const post = String(textCol ? r[textCol] : '')
                      return (
                        <Table.Tr key={i}>
                          {'title' in r && <Table.Td fw={600}>{String(r.title ?? '')}</Table.Td>}
                          <Table.Td maw={360}><Text size="sm" lineClamp={2}>{post}</Text></Table.Td>
                          <Table.Td><RiskBadge level={r.risk_level} size="sm" /></Table.Td>
                          <Table.Td>
                            <Group gap="xs" wrap="nowrap"><Progress value={r.risk_score * 100} color={RISK[r.risk_level].color} w={70} radius="xl" />
                              <Text size="sm" fw={600}>{pct(r.risk_score)}</Text></Group>
                          </Table.Td>
                          <Table.Td><Text size="xs" c="dimmed" lineClamp={2}>{r.red_flags || '—'}</Text></Table.Td>
                        </Table.Tr>
                      )
                    })}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </Card>
          </Stack>
        </Reveal>
      )}
    </Stack>
  )
}

// ---------------------------------------------------------------- page
export default function CheckJob() {
  const location = useLocation()
  const initial = (location.state ?? undefined) as CheckState | undefined
  const [mode, setMode] = useState<'single' | 'batch'>(initial?.mode === 'batch' ? 'batch' : 'single')
  return (
    <>
      <PageHeader icon={IconSearch} title="Is this job offer real?"
                  description="FakeHire checks a post with 7 machine-learning models, a stacking ensemble and scam red-flag rules, then explains every score."
                  right={<SegmentedControl value={mode} onChange={(v) => setMode(v as 'single' | 'batch')} radius="md" size="md"
                                           data={[{ value: 'single', label: 'One post' }, { value: 'batch', label: 'Many (CSV)' }]} />} />
      {/* Both stay mounted so switching keeps each one's results. */}
      <div hidden={mode !== 'single'}><SingleCheck initial={initial} /></div>
      <div hidden={mode !== 'batch'}><BatchCheck /></div>
    </>
  )
}
