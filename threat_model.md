# Threat Model

## Project Overview

This repository is a pnpm workspace monorepo with a small production footprint. The likely production application is the `artifacts/life-calendar` React/Vite frontend plus the `artifacts/api-server` Express 5 API server. The API currently exposes only `/api/healthz`, and the shared database package (`lib/db`) provides a PostgreSQL/Drizzle connection but no defined tables or production query logic yet.

The current deployment is publicly reachable, so the static frontend and `/api/healthz` should be treated as internet-accessible production surface rather than private infrastructure.

Production assumptions for future scans:
- `NODE_ENV=production` in deployed environments.
- Replit-managed TLS protects browser-to-server traffic.
- `artifacts/mockup-sandbox` is a development-only mockup environment and should be ignored unless future evidence shows it is reachable in production.

## Assets

- **Application availability** — the primary backend asset today is service availability for the health endpoint and any future API routes.
- **Environment secrets** — `DATABASE_URL` and any future API keys or session secrets loaded from environment variables.
- **User-authored local data** — the life-calendar frontend stores milestones, notes, goals, and life settings in browser localStorage. This data is local to the user’s browser rather than stored server-side, but still represents private user information on the client.
- **Server logs** — request metadata is logged by the API server. Auth and cookie headers are redacted and must remain redacted as the API grows.

## Trust Boundaries

- **Browser to API** — all requests from the frontend to `/api/*` cross from an untrusted client into the Express server. Any future sensitive route will require explicit authentication, authorization, input validation, and rate limiting.
- **API to PostgreSQL** — the API server can connect directly to PostgreSQL through `lib/db`. Any future raw SQL or unsafe query construction would become high risk.
- **Client local storage boundary** — the frontend persists user state in browser localStorage. This data is readable by any script executing in the origin, so future XSS would expose it.
- **Production vs dev-only boundary** — `artifacts/mockup-sandbox` contains dynamic preview functionality and looser assumptions intended for development. It is out of scope for production unless deployed reachability is demonstrated.

## Scan Anchors

- **Production entry points**
  - `artifacts/api-server/src/index.ts`
  - `artifacts/api-server/src/app.ts`
  - `artifacts/api-server/src/routes/`
  - `artifacts/life-calendar/src/main.tsx`
  - `artifacts/life-calendar/src/App.tsx`
- **Highest-risk shared areas if the app grows**
  - `lib/db/src/index.ts`
  - `lib/api-client-react/src/custom-fetch.ts`
  - `lib/api-spec/openapi.yaml`
- **Public surface today**
  - `GET /api/healthz`
  - Static life-calendar frontend
- **Dev-only area to usually ignore**
  - `artifacts/mockup-sandbox/**`

## Threat Categories

### Spoofing

The production API currently has no authenticated routes. If authentication is introduced later, all non-public API routes must require server-side verification of the caller’s identity. Client-only auth state or bearer-token attachment helpers in shared client code are not sufficient by themselves.

### Tampering

All future client input reaching Express or PostgreSQL must be treated as untrusted. Database operations must continue to use safe Drizzle/query-parameter mechanisms rather than string-built SQL. Any business rules introduced in the frontend must also be enforced server-side.

### Information Disclosure

The current API surface is low sensitivity, but future expansion must preserve secret handling and avoid exposing internal errors, tokens, cookies, or database details in logs and responses. The frontend stores personal planning data in localStorage, so any future XSS in the `life-calendar` origin would expose that local data.

### Denial of Service

The current service is small, but future public endpoints must not allow unbounded request bodies, expensive unauthenticated work, or unlimited brute-force traffic. As the API expands beyond `/healthz`, rate limiting and request-size controls may become mandatory for public routes.

### Elevation of Privilege

There is currently no role boundary or privileged functionality in production. If the API adds user-specific or admin behavior later, authorization must be enforced in server-side route handlers and data access layers rather than assumed from the frontend or generated client code.