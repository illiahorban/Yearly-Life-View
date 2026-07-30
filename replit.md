# Life Calendar

A personal life-calendar / year-planner app. Displays the current year as a weekly/daily grid, lets you log notes, goals, and milestones for each day, and tracks yearly progress.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + TypeScript (Tailwind CSS, Radix UI, Framer Motion) |
| Backend | Express 5 + TypeScript (built with esbuild) |
| Workspace | pnpm monorepo |

### Packages
- `artifacts/life-calendar` — React frontend, port **22196** in dev
- `artifacts/api-server` — Express API, port **8080** in dev
- `packages/` — shared workspace packages (`api-zod`, `api-client-react`, `db`, …)

## Running locally

Both services start together via the **Project** run button (parallel workflows):

```
pnpm install && PORT=8080 pnpm --filter @workspace/api-server run dev
pnpm install && PORT=22196 BASE_PATH=/ pnpm --filter @workspace/life-calendar run dev
```

## User preferences

- All new UI text must be added in both Russian and English via the existing i18n system.
