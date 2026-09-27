import { Anchor, Badge, Card, Grid, Group, List, Paper, SimpleGrid, Stack, Stepper, Table, Text, ThemeIcon, Title } from '@mantine/core'
import {
  IconAlertTriangle, IconBrain, IconBuildingCommunity, IconCode, IconFilter, IconInfoCircle, IconListSearch, IconPhoneCall,
  IconRoute, IconSchool, IconScale, IconShieldCheck, IconStack2, IconUsers, IconWand,
} from '@tabler/icons-react'
import { api } from '../api'
import { PageHeader, Reveal } from '../components/ui'
import { useData } from '../hooks'
import { fmt3 } from '../theme'

const TECHNIQUES = [
  ['Text classification', 'TF-IDF + supervised learning', 'Multinomial Naive Bayes, Logistic Regression, Linear SVM'],
  ['Tabular classification', 'Feature engineering + supervised learning', 'KNN, Decision Tree, Random Forest, XGBoost'],
  ['Ensemble learning', 'Soft voting and stacking', 'Logistic Regression meta-learner'],
  ['Unsupervised learning', 'Dimensionality reduction + clustering', 'Truncated SVD / PCA, K-Means (elbow + silhouette)'],
  ['Imbalanced learning', 'Cost-sensitive learning vs oversampling', 'Class weights, SMOTE, threshold tuning'],
  ['Explainability', 'Model coefficients and feature importance', 'Per-word LogReg contributions, tree importances'],
]

const STEPS = [
  { icon: IconListSearch, label: 'Input', desc: 'Post or recruiter message' },
  { icon: IconFilter, label: 'Clean', desc: 'Mask links, e-mails, phones' },
  { icon: IconStack2, label: 'Features', desc: 'TF-IDF + 17 engineered' },
  { icon: IconBrain, label: '7 models', desc: '3 text · 4 metadata' },
  { icon: IconWand, label: 'Stacking', desc: 'LogReg meta-learner' },
  { icon: IconAlertTriangle, label: 'Rules', desc: 'Fees, WhatsApp, OTP…' },
  { icon: IconRoute, label: 'K-Means', desc: 'Scam archetype' },
  { icon: IconShieldCheck, label: 'Result', desc: 'Score, reasons, tips' },
]

export default function About() {
  const { data: m } = useData('metrics', api.metrics)
  const ft = m?.models[m.final_model].test
  return (
    <>
      <PageHeader icon={IconInfoCircle} title="About FakeHire" description="Machine learning that protects students and job seekers from recruitment fraud." />
      <Reveal>
        <SimpleGrid cols={{ base: 1, md: 2 }}>
          <Card>
            <ThemeIcon size={44} radius="md" color="red" variant="light" mb="sm"><IconAlertTriangle size={24} /></ThemeIcon>
            <Title order={3} fz={20} mb="xs">The problem</Title>
            <Text c="dimmed">Fake job and internship offers are one of the fastest-growing kinds of online fraud. Scammers pose as recruiters
              on WhatsApp, Telegram and job portals, promise easy money or guaranteed placement, then ask for “registration fees”,
              “training kits”, deposits or ID documents. The victims are usually students, freshers and people desperate for work.</Text>
          </Card>
          <Card>
            <ThemeIcon size={44} radius="md" color="green" variant="light" mb="sm"><IconShieldCheck size={24} /></ThemeIcon>
            <Title order={3} fz={20} mb="xs">Our solution</Title>
            <List spacing={6} c="dimmed">
              <List.Item>A <b>scam-risk score</b> from a stacked ML ensemble</List.Item>
              <List.Item>The <b>exact words and red flags</b> that triggered it</List.Item>
              <List.Item>The <b>scam pattern</b> it most resembles</List.Item>
              <List.Item><b>Practical safety advice</b> and where to report fraud</List.Item>
            </List>
          </Card>
        </SimpleGrid>
      </Reveal>

      <Title order={2} fz={20} mt="xl" mb="md">How it works</Title>
      <Card>
        <Stepper active={STEPS.length} orientation="horizontal" size="sm" iconSize={40} allowNextStepsSelect={false}
                 styles={{ steps: { flexWrap: 'wrap', rowGap: 16 }, separator: { minWidth: 12 } }}>
          {STEPS.map((s) => <Stepper.Step key={s.label} icon={<s.icon size={18} />} completedIcon={<s.icon size={18} />} label={s.label} description={s.desc} />)}
        </Stepper>
      </Card>

      <Title order={2} fz={20} mt="xl" mb="md">Machine-learning techniques used</Title>
      <Card p={0}>
        <Table.ScrollContainer minWidth={640}>
          <Table striped verticalSpacing="sm" horizontalSpacing="md">
            <Table.Thead><Table.Tr><Table.Th>Task</Table.Th><Table.Th>Technique</Table.Th><Table.Th>Models</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>{TECHNIQUES.map(([a, b, c]) => <Table.Tr key={a}><Table.Td fw={650}>{a}</Table.Td><Table.Td>{b}</Table.Td><Table.Td>{c}</Table.Td></Table.Tr>)}</Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>
      {m && ft && (
        <Paper p="md" radius="lg" mt="md" bg="var(--mantine-color-teal-light)">
          <Group gap="sm" wrap="nowrap"><IconScale size={20} />
            <Text size="sm"><b>Final model:</b> {m.final_model} of {m.best_text} + {m.best_meta} → test F1 <b>{fmt3(ft.f1)}</b>,
              precision <b>{fmt3(ft.precision)}</b>, recall <b>{fmt3(ft.recall)}</b>, PR-AUC <b>{fmt3(ft.pr_auc)}</b>.</Text></Group>
        </Paper>
      )}

      <Grid mt="xl">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card h="100%">
            <Title order={3} fz={18} mb="md">Who it helps</Title>
            <Stack gap="md">
              {[
                { icon: IconSchool, t: 'Students and freshers', d: 'looking for internships and first jobs' },
                { icon: IconBuildingCommunity, t: 'Placement cells and colleges', d: 'checking job posts in bulk with the CSV upload' },
                { icon: IconUsers, t: 'Job boards and community groups', d: 'screening posts before sharing them' },
              ].map((w) => (
                <Group key={w.t} wrap="nowrap"><ThemeIcon size={40} radius="md" variant="light"><w.icon size={22} /></ThemeIcon>
                  <div><Text fw={600}>{w.t}</Text><Text size="sm" c="dimmed">{w.d}</Text></div></Group>
              ))}
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card h="100%">
            <Title order={3} fz={18} mb="md">Limitations and ethics</Title>
            <List spacing="xs" size="sm" c="dimmed">
              <List.Item>The training data (EMSCAD) is mostly <b>US posts from 2012–14</b>. Indian-style scams are rare in it, so a transparent <b>rule layer</b> is added.</List.Item>
              <List.Item>A low score is <b>not a guarantee</b>. Always verify the employer.</List.Item>
              <List.Item>False positives can unfairly flag small or new companies, so FakeHire always shows its reasons.</List.Item>
              <List.Item>Checks are processed by the model and kept only in your browser's history.</List.Item>
            </List>
          </Card>
        </Grid.Col>
      </Grid>

      <SimpleGrid cols={{ base: 1, md: 2 }} mt="md">
        <Card bg="var(--mantine-color-red-light)" withBorder={false}>
          <Group wrap="nowrap"><ThemeIcon color="red" size={44} radius="md"><IconPhoneCall size={24} /></ThemeIcon>
            <div><Text fw={700}>Report fraud (India)</Text>
              <Text size="sm"><Anchor href="https://cybercrime.gov.in" target="_blank" rel="noreferrer">cybercrime.gov.in</Anchor> · helpline <b>1930</b></Text></div></Group>
        </Card>
        <Card>
          <Group gap="xs" mb="xs"><IconCode size={18} /><Text fw={700}>Tech stack</Text></Group>
          <Group gap={6}>{['Python', 'pandas', 'scikit-learn', 'XGBoost', 'imbalanced-learn', 'FastAPI', 'React', 'TypeScript', 'Mantine', 'Recharts', 'Vite']
            .map((t) => <Badge key={t} variant="light" tt="none">{t}</Badge>)}</Group>
        </Card>
      </SimpleGrid>
    </>
  )
}
