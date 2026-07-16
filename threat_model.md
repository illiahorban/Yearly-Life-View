# Threat Model

## Project Overview

A monorepo containing three artifacts:

- **life-calendar** — a React/Vite single-page application (no backend calls) that lets users
  plan and track life weeks, sprints, quarters, goals, and notes. All data is persisted in
  `localStorage`; there is no account system and no server-side data storage.
- **api-server** — a Node.js/Express 5/TypeScript API server with Drizzle ORM and PostgreSQL.
  Currently exposes only `GET /api/healthz`. Intended to grow into the backend for future
  authenticated features.
- **mockup-sandbox** — a Vite-based component preview server used exclusively during
  development. Not exposed in production.

Users are individuals managing their own calendar in the browser. There is currently no
multi-user model, no authentication, and no personally identifiable information stored
server-side.

## Assets

- **Future user data** — as the api-server gains endpoints it will likely handle user-owned
  data (goals, notes, calendar state). This must be protected before any such endpoint ships.
- **Application secrets** — `DATABASE_URL`, `SESSION_SECRET`, and any future API keys stored
  in Replit Secrets. Leakage would give an attacker direct database access.
- **Client-side localStorage** — the life-calendar stores all calendar data locally. Data is
  scoped to the user's own browser; there is no cross-user exposure risk today.

## Trust Boundaries

- **Browser → api-server** — all HTTP requests cross this boundary. Until authentication is
  implemented the API must treat every caller as untrusted. No sensitive data may be returned
  without an auth check once user accounts exist.
- **api-server → PostgreSQL** — the application has direct database access via `DATABASE_URL`.
  Compromise of the application process would give an attacker full database access.
- **Public internet → mockup-sandbox** — the preview server is dev-only and must not be
  reachable in any production deployment.

## Scan Anchors

- **Production entry point**: `artifacts/api-server/src/index.ts` → `app.ts` → `routes/`
- **Highest-risk area when endpoints are added**: `artifacts/api-server/src/routes/` (auth
  checks, input validation, authorization guards)
- **Public surface today**: `GET /api/healthz` only — no auth required, no sensitive data
- **Dev-only surface**: `artifacts/mockup-sandbox/` — should be excluded from production scans
- **Client-side data store**: `artifacts/life-calendar/src/App.tsx` (localStorage reads/writes)

## Threat Categories

### Spoofing

No authentication exists today. When user accounts are introduced, every API route that
accesses user-owned data MUST validate a session token server-side before returning or
modifying any data. The `SESSION_SECRET` env var is already provisioned; use it to sign
session cookies with `express-session` or equivalent. Tokens MUST NOT be stored in
`localStorage` on the client (XSS exposure); use `HttpOnly` cookies.

### Tampering

The api-server uses `express.json()` and `express.urlencoded()`. All incoming request bodies
MUST be validated with Zod (already a project dependency in the frontend; add it to the
backend) before use. Client-supplied values MUST NOT influence query structure. All database
queries MUST use Drizzle's parameterized query builder — never raw string interpolation.

### Information Disclosure

**CORS**: `app.use(cors())` with no configuration allowed all origins (`*`). Fixed: CORS now
reads allowed origins from `CORS_ORIGIN` env var (comma-separated), falling back to the
Replit dev domain in development. In production, only the deployed domain is permitted.

**Security headers**: Helmet is now applied to set `X-Frame-Options`, `X-Content-Type-Options`,
`Content-Security-Policy`, and other protective headers.

**Error responses**: Express MUST NOT return stack traces in production. Error middleware
should return generic messages in `NODE_ENV=production`.

**Logs**: The Pino request serializer already strips query strings from logged URLs (good).
Ensure no future middleware logs request bodies (which may contain credentials).

### Denial of Service

The healthz endpoint has no rate limiting. For any future endpoint that performs database
queries or computation, add `express-rate-limit` before the route. Authentication endpoints
(login, registration) are the highest-risk targets and MUST be rate-limited to ≤10 req/min
per IP. Body size is bounded by Express defaults (100kb JSON); verify this remains appropriate
as endpoints are added.

### Elevation of Privilege

No role separation exists today. When admin functionality is introduced, admin checks MUST be
enforced server-side on every admin route — never rely on client-supplied role claims.
The mockup-sandbox uses dynamic Vite glob imports to load preview components by URL path
(flagged MEDIUM by SAST). The path is constructed by the Vite module graph, not from raw
user input, so arbitrary file access outside the component tree is not possible. This is
acceptable as a dev-only tool; it MUST remain unreachable in production.
