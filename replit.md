# Life Calendar

A personal life-planning app that visualizes your year as a weekly calendar grid. Track days, set goals, and add notes — in Russian and English.

## Stack

- **Frontend** (`artifacts/life-calendar`): React + Vite, Tailwind CSS, Radix UI, Framer Motion
- **Backend** (`artifacts/api-server`): Express 5, Drizzle ORM, Pino logging
- **Shared packages** (workspace libs): `@workspace/api-zod`, `@workspace/db`, `@workspace/api-client-react`
- **Package manager**: pnpm workspaces

## How to run

Both workflows start automatically:

| Workflow | Command | Port |
|---|---|---|
| `artifacts/life-calendar: web` | `pnpm --filter @workspace/life-calendar run dev` | 22196 |
| `artifacts/api-server: API Server` | `pnpm --filter @workspace/api-server run dev` | 8080 |

## User preferences

- All UI text must be added in both Russian and English via the existing i18n system.
