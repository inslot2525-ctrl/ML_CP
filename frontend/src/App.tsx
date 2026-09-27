import {
  ActionIcon, AppShell, Badge, Box, Burger, Card, Group, NavLink, ScrollArea, Stack, Text, ThemeIcon, Title, Tooltip,
  useComputedColorScheme, useMantineColorScheme,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
  IconBrandGithub, IconChartDots3, IconFlask, IconInfoCircle, IconLayoutDashboard, IconMoon, IconPhoneCall, IconShieldCheck,
  IconShieldSearch, IconSun,
} from '@tabler/icons-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect } from 'react'
import { NavLink as RouterLink, Route, Routes, useLocation } from 'react-router-dom'
import About from './pages/About'
import CheckJob from './pages/CheckJob'
import Dashboard from './pages/Dashboard'
import ModelLab from './pages/ModelLab'
import ScamPatterns from './pages/ScamPatterns'

const REPO = 'https://github.com/inslot2525-ctrl/ML_CP'

const PAGES = [
  { path: '/', label: 'Dashboard', desc: 'Overview & your checks', icon: IconLayoutDashboard, element: <Dashboard /> },
  { path: '/check', label: 'Check a Job', desc: 'Scan a post or message', icon: IconShieldSearch, element: <CheckJob /> },
  { path: '/model-lab', label: 'Model Lab', desc: 'Compare all 9 models', icon: IconFlask, element: <ModelLab /> },
  { path: '/scam-patterns', label: 'Scam Patterns', desc: 'Data insights & clusters', icon: IconChartDots3, element: <ScamPatterns /> },
  { path: '/about', label: 'About & Impact', desc: 'How it works', icon: IconInfoCircle, element: <About /> },
]

function ThemeToggle() {
  const { setColorScheme } = useMantineColorScheme()
  const scheme = useComputedColorScheme('light', { getInitialValueInEffect: true })
  const next = scheme === 'dark' ? 'light' : 'dark'
  return (
    <Tooltip label={`Switch to ${next} mode`}>
      <ActionIcon variant="default" size="lg" radius="md" onClick={() => setColorScheme(next)} aria-label={`Switch to ${next} mode`}>
        {scheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
      </ActionIcon>
    </Tooltip>
  )
}

export default function App() {
  const [opened, { toggle, close }] = useDisclosure()
  const location = useLocation()

  useEffect(() => {
    const page = PAGES.find((p) => p.path === location.pathname)
    document.title = page && page.path !== '/' ? `${page.label} · FakeHire` : 'FakeHire: Job Scam Detector'
    window.scrollTo(0, 0)
    close()
  }, [location.pathname, close])

  return (
    <AppShell header={{ height: 64 }} navbar={{ width: 264, breakpoint: 'sm', collapsed: { mobile: !opened } }} padding={{ base: 'md', md: 'xl' }}>
      <AppShell.Header px="md">
        <Group h="100%" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" aria-label="Toggle navigation" />
            <RouterLink to="/" style={{ textDecoration: 'none', color: 'inherit' }}><Group gap={10} wrap="nowrap">
              <ThemeIcon size={36} radius="md" variant="gradient" gradient={{ from: 'brand.6', to: 'violet.7', deg: 135 }}>
                <IconShieldCheck size={22} />
              </ThemeIcon>
              <div>
                <Title order={3} fz={19} lh={1}>FakeHire</Title>
                <Text size="xs" c="dimmed" visibleFrom="xs">Job scam detector</Text>
              </div>
              <Badge variant="light" size="sm" visibleFrom="md">ML Empowerment 3.0</Badge>
            </Group></RouterLink>
          </Group>
          <Group gap="xs" wrap="nowrap">
            <Tooltip label="Source code on GitHub">
              <ActionIcon component="a" href={REPO} target="_blank" rel="noreferrer" variant="default" size="lg" radius="md" aria-label="GitHub repository">
                <IconBrandGithub size={18} />
              </ActionIcon>
            </Tooltip>
            <ThemeToggle />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <AppShell.Section grow component={ScrollArea} className="fh-nav">
          <Text size="xs" tt="uppercase" fw={700} c="dimmed" mb="xs" px="xs" lts={0.6}>Navigate</Text>
          {PAGES.map((p) => (
            <NavLink key={p.path} component={RouterLink} to={p.path} label={p.label} description={p.desc}
                     active={location.pathname === p.path} variant="light"
                     leftSection={<ThemeIcon variant="light" size={32} radius="md"><p.icon size={18} stroke={1.8} /></ThemeIcon>} />
          ))}
        </AppShell.Section>
        <AppShell.Section>
          <Card p="md" radius="md" withBorder={false} bg="var(--mantine-color-red-light)" shadow="none">
            <Group gap="sm" wrap="nowrap" align="flex-start">
              <ThemeIcon color="red" variant="filled" radius="md"><IconPhoneCall size={16} /></ThemeIcon>
              <Stack gap={0}>
                <Text size="sm" fw={600}>Scammed? Report it</Text>
                <Text size="xs" c="dimmed">cybercrime.gov.in · helpline <b>1930</b></Text>
              </Stack>
            </Group>
          </Card>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        <Box maw={1240} mx="auto">
          <AnimatePresence mode="wait">
            <motion.div key={location.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22 }}>
              <Routes location={location}>
                {PAGES.map((p) => <Route key={p.path} path={p.path} element={p.element} />)}
                <Route path="*" element={<Stack align="center" py={80}><Title>Page not found</Title>
                  <Text component={RouterLink} to="/" c="brand">Back to the dashboard</Text></Stack>} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </Box>
      </AppShell.Main>
    </AppShell>
  )
}
