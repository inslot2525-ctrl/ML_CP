import {
  Badge, Box, Button, Card, EmptyState, Grid, Group, Progress, ScrollArea, SimpleGrid, Stack, Text,
  Textarea, ThemeIcon, Title, Tooltip, UnstyledButton,
} from '@mantine/core'
import {
  IconArrowRight, IconBolt, IconBuildingSkyscraper, IconChartBar, IconCircleCheck, IconFileSpreadsheet, IconFlag,
  IconHistory, IconInfoCircle, IconSearch, IconShieldCheck, IconSparkles, IconTarget, IconTrash, IconTrophy, IconUsersGroup,
} from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip } from 'recharts'
import { api, type Family } from '../api'
import { ChartCard, ErrorAlert, Loading, Reveal, RiskBadge, StatCard } from '../components/ui'
import { clearHistory, timeAgo, useHistory } from '../history'
import { tip, useData } from '../hooks'
import { EXAMPLES } from '../examples'
import type { CheckState, Form } from './CheckJob'
import { FAMILY_LABEL, RISK, pct, usePalette } from '../theme'

function Hero({ precision, recall, f1, posts }: { precision: number; recall: number; f1: number; posts: number }) {
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const go = (prefill: Partial<Form>) => navigate('/check', { state: { prefill, autorun: true } satisfies CheckState })
  return (
    <div className="fh-hero">
      <Grid gap="xl" align="center">
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Badge variant="white" color="brand" size="lg" leftSection={<IconSparkles size={14} />} mb="md">
            Machine learning · 9 models · explainable
          </Badge>
          <Title order={1} fz={{ base: 30, sm: 42 }} lh={1.1} c="white">
            Don't let a fake job offer<br />cost you money.
          </Title>
          <Text size="lg" mt="sm" mb="lg" style={{ color: 'rgba(255,255,255,0.88)' }} maw={560}>
            Paste any job post, internship offer or recruiter message. FakeHire tells you how risky it is, and exactly why.
          </Text>
          <Stack gap="sm" maw={620}>
            <Textarea value={text} onChange={(e) => setText(e.currentTarget.value)} autosize minRows={3} maxRows={6} radius="md"
                      placeholder="e.g. “Selected without interview! Pay ₹1,499 registration fee on WhatsApp…”"
                      aria-label="Job post or message to check" />
            <Group gap="xs" wrap="wrap">
              <Button size="md" color="dark" variant="white" leftSection={<IconSearch size={18} />} disabled={!text.trim()}
                      onClick={() => go({ text })}>
                Check now
              </Button>
              <Text size="sm" style={{ color: 'rgba(255,255,255,0.8)' }}>or try:</Text>
              {EXAMPLES.map((ex) => (
                <Button key={ex.label} size="xs" variant="outline" color="white" radius="xl" onClick={() => go({ text: ex.text, title: ex.title ?? '', company_profile: ex.company_profile ?? '', has_logo: ex.has_logo ?? 'Not sure' })}
                        leftSection={<ex.icon size={14} />} styles={{ root: { borderColor: 'rgba(255,255,255,0.5)', color: '#fff' } }}>
                  {ex.label}
                </Button>
              ))}
            </Group>
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 5 }} visibleFrom="sm">
          <Box className="fh-glass" p="lg">
            <Group gap="xs" mb="md"><IconShieldCheck size={20} /><Text fw={600}>How good is the model?</Text></Group>
            <SimpleGrid cols={2} spacing="sm">
              {[
                { label: 'Precision', value: pct(precision, 1), note: 'flags that are real scams' },
                { label: 'Recall', value: pct(recall, 1), note: 'of scams caught' },
                { label: 'F1 score', value: f1.toFixed(3), note: 'stacking ensemble' },
                { label: 'Posts learned', value: posts.toLocaleString(), note: 'real job posts' },
              ].map((s) => (
                <Box key={s.label} className="fh-glass" p="sm">
                  <Text size="xs" tt="uppercase" fw={600} style={{ color: 'rgba(255,255,255,0.75)' }}>{s.label}</Text>
                  <Text fz={26} fw={800} lh={1.2}>{s.value}</Text>
                  <Text size="xs" style={{ color: 'rgba(255,255,255,0.7)' }}>{s.note}</Text>
                </Box>
              ))}
            </SimpleGrid>
          </Box>
        </Grid.Col>
      </Grid>
    </div>
  )
}

function YourChecks() {
  const history = useHistory()
  const navigate = useNavigate()
  const p = usePalette()
  const counts = useMemo(() => {
    const c = { High: 0, Medium: 0, Low: 0 }
    history.forEach((h) => { c[h.risk_level] += 1 })
    return c
  }, [history])
  const flags = useMemo(() => {
    const m = new Map<string, number>()
    history.forEach((h) => h.flags.forEach((f) => m.set(f, (m.get(f) ?? 0) + 1)))
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [history])

  if (!history.length) {
    return (
      <Card>
        <EmptyState icon={<IconHistory size={28} />} title="No checks yet"
                    description="Every job post you check is summarised here: risk mix, most common red flags and your recent checks. Stored only in this browser.">
          <Button mt="md" leftSection={<IconSearch size={16} />} onClick={() => navigate('/check')}>Check your first job post</Button>
        </EmptyState>
      </Card>
    )
  }

  const data = (['High', 'Medium', 'Low'] as const).map((l) => ({ name: l, value: counts[l] })).filter((d) => d.value > 0)
  return (
    <Grid>
      <Grid.Col span={{ base: 12, md: 4 }}>
        <ChartCard title="Your checks" subtitle="Risk mix of posts you've checked">
          <Box pos="relative" h={200}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={62} outerRadius={88} paddingAngle={2}
                     stroke={p.surface} strokeWidth={2} isAnimationActive={false}>
                  {data.map((d) => <Cell key={d.name} fill={RISK[d.name].color} />)}
                </Pie>
                <RTooltip content={tip<{ name: 'High'; value: number }>((d) => <><b>{d.name} risk</b>: {d.value}</>)} />
              </PieChart>
            </ResponsiveContainer>
            <Stack gap={0} align="center" pos="absolute" top="50%" left="50%" style={{ transform: 'translate(-50%,-50%)', pointerEvents: 'none' }}>
              <Text fz={30} fw={800} lh={1}>{history.length}</Text>
              <Text size="xs" c="dimmed">checked</Text>
            </Stack>
          </Box>
          <Group justify="center" gap="xs" mt="xs">
            {(['High', 'Medium', 'Low'] as const).map((l) => (
              <Badge key={l} variant="light" color={RISK[l].mantine}>{l}: {counts[l]}</Badge>
            ))}
          </Group>
        </ChartCard>
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 4 }}>
        <ChartCard title="Top red flags you've seen" subtitle="How often each rule fired">
          {flags.length === 0 ? (
            <Stack align="center" py="xl"><ThemeIcon color="green" variant="light" size="xl" radius="xl"><IconCircleCheck /></ThemeIcon>
              <Text size="sm" c="dimmed">No red flags in your checks so far.</Text></Stack>
          ) : (
            <Stack gap="sm">
              {flags.map(([f, n]) => (
                <div key={f}>
                  <Group justify="space-between" gap="xs" wrap="nowrap" mb={4}>
                    <Text size="sm" lineClamp={1}>{f}</Text><Text size="sm" fw={600}>{n}</Text>
                  </Group>
                  <Progress value={(n / history.length) * 100} color="red" size="sm" radius="xl" />
                </div>
              ))}
            </Stack>
          )}
        </ChartCard>
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 4 }}>
        <ChartCard title="Recent checks" subtitle="Click one to open it again"
                   right={<Tooltip label="Clear history"><Button variant="subtle" color="gray" size="compact-sm" onClick={clearHistory}
                                                                  aria-label="Clear history"><IconTrash size={16} /></Button></Tooltip>}>
          <ScrollArea h={236} offsetScrollbars>
            <Stack gap={6}>
              {history.slice(0, 12).map((h) => (
                <UnstyledButton key={h.id} p="xs" style={{ borderRadius: 8, border: '1px solid var(--mantine-color-default-border)' }}
                                onClick={() => navigate('/check', { state: { prefill: { text: h.text, title: h.title }, autorun: true } satisfies CheckState })}>
                  <Group justify="space-between" wrap="nowrap" gap="xs">
                    <Text size="sm" fw={500} lineClamp={1}>{h.title || h.text}</Text>
                    <RiskBadge level={h.risk_level} size="sm" />
                  </Group>
                  <Text size="xs" c="dimmed">{timeAgo(h.at)} · {pct(h.risk_score)} risk</Text>
                </UnstyledButton>
              ))}
            </Stack>
          </ScrollArea>
        </ChartCard>
      </Grid.Col>
    </Grid>
  )
}

export default function Dashboard() {
  const p = usePalette()
  const navigate = useNavigate()
  const history = useHistory()
  const m = useData('metrics', api.metrics)
  const e = useData('eda', api.eda)
  const c = useData('clusters', api.clusters)
  if (m.error || e.error || c.error) return <ErrorAlert message={(m.error || e.error || c.error)!} />
  if (!m.data || !e.data || !c.data) return <Loading />
  const M = m.data, E = e.data, C = c.data
  const ft = M.models[M.final_model].test
  const [[, fp], [fn, tp]] = ft.confusion_matrix
  const highChecks = history.filter((h) => h.risk_level === 'High').length

  const leaderboard = Object.entries(M.models).sort((a, b) => b[1].test.f1 - a[1].test.f1)
  const signs = [
    { key: 'has_company_logo', risky: 'No logo', safe: 'Has logo', label: 'No company logo' },
    { key: 'company_profile_missing', risky: 'No company profile', safe: 'Has profile', label: 'No company profile' },
    { key: 'telecommuting', risky: 'Remote', safe: 'On-site', label: 'Remote / work-from-home' },
    { key: 'salary_given', risky: 'Salary shown', safe: 'No salary', label: 'Salary shown in post' },
  ].map((s) => {
    const rows = E.by[s.key]
    const r = rows.find((x) => x.value === s.risky)!.fraud_rate
    const safe = rows.find((x) => x.value === s.safe)!.fraud_rate
    return { ...s, r, safe, x: r / safe }
  })
  const maxSign = Math.max(...signs.map((s) => s.r))
  const archetypes = [...C.clusters].sort((a, b) => b.size - a.size)
  const industries = E.by_industry.slice(0, 6)

  return (
    <Stack gap="xl">
      <Reveal><Hero precision={ft.precision} recall={ft.recall} f1={ft.f1} posts={E.n_posts} /></Reveal>

      <Reveal delay={0.05}>
        <SimpleGrid cols={{ base: 1, xs: 2, lg: 4 }}>
          <StatCard icon={IconChartBar} label="Job posts analysed" value={E.n_posts} sub={`${E.n_fake} confirmed fakes (${pct(E.fake_share, 1)})`} />
          <StatCard icon={IconTarget} label="Scams caught (test set)" value={tp} color="green" sub={`of ${tp + fn} fakes · only ${fp} false alarms`} />
          <StatCard icon={IconTrophy} label="Precision" value={ft.precision * 100} decimals={1} suffix="%" color="violet" sub="when it says scam, it's right" />
          <StatCard icon={IconHistory} label="Your checks" value={history.length} color="orange" sub={history.length ? `${highChecks} flagged high risk` : 'none yet, try one!'} />
        </SimpleGrid>
      </Reveal>

      <Reveal delay={0.1}><YourChecks /></Reveal>

      <Reveal delay={0.15}>
        <Grid>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <ChartCard title="Model leaderboard" subtitle="F1 score on 3,576 unseen posts"
                       right={<Button variant="light" size="compact-sm" rightSection={<IconArrowRight size={14} />} onClick={() => navigate('/model-lab')}>Model Lab</Button>}>
              <Stack gap={10}>
                {leaderboard.map(([name, r], i) => (
                  <div key={name}>
                    <Group justify="space-between" mb={4} wrap="nowrap">
                      <Group gap={8} wrap="nowrap">
                        <Text size="sm" c="dimmed" w={18} ta="right">{i + 1}</Text>
                        <span className="fh-swatch" style={{ background: p.family[r.group as Family] }} />
                        <Text size="sm" fw={name === M.final_model ? 700 : 500}>{name}</Text>
                        {name === M.final_model && <Badge size="xs" variant="light" color="teal">final</Badge>}
                      </Group>
                      <Text size="sm" fw={600} ff="monospace">{r.test.f1.toFixed(3)}</Text>
                    </Group>
                    <Progress value={r.test.f1 * 100} color={p.family[r.group as Family]} size="sm" radius="xl" />
                  </div>
                ))}
              </Stack>
              <Group gap="md" mt="md">
                {(['text', 'meta', 'ensemble'] as const).map((f) => (
                  <Group key={f} gap={6}><span className="fh-swatch" style={{ background: p.family[f] }} /><Text size="xs" c="dimmed">{FAMILY_LABEL[f]}</Text></Group>
                ))}
              </Group>
            </ChartCard>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <ChartCard title="Warning signs in 17,880 posts" subtitle="Share of posts that turned out fake"
                       right={<Button variant="light" size="compact-sm" rightSection={<IconArrowRight size={14} />} onClick={() => navigate('/scam-patterns')}>Patterns</Button>}>
              <Stack gap="lg">
                {signs.map((s) => (
                  <div key={s.key}>
                    <Group justify="space-between" mb={6} wrap="nowrap">
                      <Group gap={8} wrap="nowrap">
                        <ThemeIcon size={26} radius="md" variant="light" color="red"><IconFlag size={15} /></ThemeIcon>
                        <Text size="sm" fw={600}>{s.label}</Text>
                      </Group>
                      <Badge color="red" variant="light">{s.x.toFixed(1)}× riskier</Badge>
                    </Group>
                    <Group gap="xs" wrap="nowrap">
                      <Text size="xs" c="dimmed" w={64}>with it</Text>
                      <Progress value={(s.r / maxSign) * 100} color={p.fake} size="lg" radius="xl" style={{ flex: 1 }} />
                      <Text size="xs" fw={600} w={44} ta="right">{pct(s.r, 1)}</Text>
                    </Group>
                    <Group gap="xs" wrap="nowrap" mt={4}>
                      <Text size="xs" c="dimmed" w={64}>without</Text>
                      <Progress value={(s.safe / maxSign) * 100} color={p.real} size="lg" radius="xl" style={{ flex: 1 }} />
                      <Text size="xs" fw={600} w={44} ta="right">{pct(s.safe, 1)}</Text>
                    </Group>
                  </div>
                ))}
              </Stack>
            </ChartCard>
          </Grid.Col>
        </Grid>
      </Reveal>

      <Reveal delay={0.2}>
        <Grid>
          <Grid.Col span={{ base: 12, md: 7 }}>
            <ChartCard title="Scam archetypes" subtitle={`${C.k} types of fake post found by K-Means clustering`}>
              <Stack gap={10}>
                {archetypes.map((a) => (
                  <Group key={a.id} gap="sm" wrap="nowrap">
                    <Text size="sm" w={{ base: 150, sm: 250 }} lineClamp={1} title={a.name}>{a.name}</Text>
                    <Progress value={(a.size / archetypes[0].size) * 100} color={p.violet} size="lg" radius="xl" style={{ flex: 1 }} />
                    <Text size="sm" fw={600} w={36} ta="right">{a.size}</Text>
                  </Group>
                ))}
              </Stack>
            </ChartCard>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 5 }}>
            <ChartCard title="Riskiest industries" subtitle="% of posts that are fake (≥50 posts)">
              <Stack gap="sm">
                {industries.map((r) => (
                  <Group key={r.value} gap="sm" wrap="nowrap">
                    <ThemeIcon size={30} radius="md" variant="light" color="red"><IconBuildingSkyscraper size={16} /></ThemeIcon>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Group justify="space-between" wrap="nowrap"><Text size="sm" lineClamp={1}>{r.value}</Text><Text size="sm" fw={700}>{pct(r.fraud_rate)}</Text></Group>
                      <Progress value={(r.fraud_rate / industries[0].fraud_rate) * 100} color={p.fake} size="sm" radius="xl" mt={4} />
                    </div>
                  </Group>
                ))}
              </Stack>
            </ChartCard>
          </Grid.Col>
        </Grid>
      </Reveal>

      <Reveal delay={0.25}>
        <SimpleGrid cols={{ base: 1, md: 3 }}>
          {[
            { icon: IconBolt, color: 'brand', title: 'Instant & explainable', text: 'Highlights the exact words and red flags behind every score.', to: '/check' },
            { icon: IconFileSpreadsheet, color: 'teal', title: 'Placement cells: check in bulk', text: 'Upload a CSV and screen up to 500 job posts at once.', to: '/check', state: { mode: 'batch' } },
            { icon: IconUsersGroup, color: 'violet', title: 'Built for students', text: 'Made for freshers facing fake internships and "registration fee" jobs.', to: '/about' },
          ].map((f) => (
            <Card key={f.title} className="fh-lift" component="button" onClick={() => navigate(f.to, { state: f.state })}
                  style={{ textAlign: 'left', cursor: 'pointer' }}>
              <Group wrap="nowrap" align="flex-start">
                <ThemeIcon size={44} radius="md" variant="light" color={f.color}><f.icon size={24} /></ThemeIcon>
                <div>
                  <Text fw={650}>{f.title}</Text>
                  <Text size="sm" c="dimmed">{f.text}</Text>
                </div>
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      </Reveal>

      <Group justify="center" gap={6}>
        <IconInfoCircle size={16} style={{ opacity: 0.6 }} />
        <Text size="xs" c="dimmed">
          Scores come from a held-out test set. A low score is not a guarantee; always verify employers through official channels.
        </Text>
      </Group>
    </Stack>
  )
}
