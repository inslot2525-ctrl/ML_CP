# FakeHire frontend

React 19 + TypeScript app built with Vite, using [Mantine](https://mantine.dev) components, Tabler icons, Motion
animations, React Router and Recharts. See the [main README](../README.md) for the full project.

```bash
npm install
npm run dev      # http://localhost:5173 (API calls to /api are proxied to http://localhost:8000)
npm run build    # production build in dist/ (served by the FastAPI backend)
npm run lint     # oxlint
```

| Path | What it is |
|---|---|
| `src/pages/` | Dashboard, CheckJob, ModelLab, ScamPatterns, About |
| `src/components/ui.tsx` | Shared UI: page header, stat and chart cards, risk gauge and badge, legend |
| `src/api.ts` | Typed client for the FastAPI backend |
| `src/theme.ts` | Mantine theme and the chart palette (light and dark) |
| `src/history.ts` | Recent checks kept in `localStorage` for the dashboard |
| `src/hooks.tsx` | Data loading and chart helpers |
