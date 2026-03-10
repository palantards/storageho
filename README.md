## Stowlio (Supabase-first, V2)

Stowlio is a shared household + storage inventory app built on:

- Next.js App Router + TypeScript
- Supabase Auth + Postgres + Storage (private bucket)
- Drizzle ORM (typed queries)

V2 highlights:

- Floor-first household setup: `/[locale]/households/[id]/canvas`
- Scan mode: `/[locale]/scan`
- AI capture suggestions (human approval required)
- AI find (fuzzy + semantic fused search)
- Room workspace: `/[locale]/rooms/[roomId]`
- Household setup-first canvas (read-only map preview): `/[locale]/households/[id]/canvas`

## 1) Prerequisites

- Node 20+
- npm
- Supabase project

## 2) Environment Setup

1. Copy `.env.example` -> `.env`
2. Fill required vars:

```env
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
DATABASE_URL=postgresql://...
DATABASE_URL_ADMIN=postgresql://...
DATABASE_URL_RLS=postgresql://...
DATABASE_SSL_CA=
DATABASE_SSL_CA_FILE=
DATABASE_SSL_ALLOW_SELF_SIGNED=false
```

3. For AI features:

```env
STORAGEHO_AI_ENABLED=1
AI_MOCK_MODE=1
OPENAI_API_KEY=...                 # required when AI_MOCK_MODE=0
OPENAI_MODEL_VISION=gpt-4o-mini
OPENAI_MODEL_EMBEDDING=text-embedding-3-small
AI_JOB_RUNNER_TOKEN=change-me
AI_DISPATCH_ON_ENQUEUE=1
INTERNAL_APP_URL=http://localhost:3000
```

Notes:

- `AI_MOCK_MODE=1` gives deterministic local suggestions/embeddings without external API calls.
- Set `AI_MOCK_MODE=0` in production when `OPENAI_API_KEY` is configured.
- `AI_DISPATCH_ON_ENQUEUE=1` triggers `/api/jobs/run` automatically when jobs are enqueued.
- `INTERNAL_APP_URL` should point to your deployed app base URL so dispatch calls reach the job runner endpoint.
- `DATABASE_URL_ADMIN` is used for migrations/admin/system jobs.
- `DATABASE_URL_RLS` is used for tenant-scoped application queries that must respect RLS.
- If your environment uses a private/corporate CA, set `DATABASE_SSL_CA` (PEM) or `DATABASE_SSL_CA_FILE`.
- Only use `DATABASE_SSL_ALLOW_SELF_SIGNED=true` as a local/dev fallback.

## 3) Install And Migrate

```bash
npm install
npm run db:migrate:dry-run
npm run db:migrate
```

Migrations are in `supabase/migrations`.

## 4) Run Locally

```bash
npm run dev
```

Main app routes:

- `/{locale}/dashboard`
- `/{locale}/scan`
- `/{locale}/canvas`
- `/{locale}/households/[id]/canvas`
- `/{locale}/rooms/[roomId]`
- `/{locale}/boxes/[boxId]`
- `/{locale}/items`
- `/{locale}/import`
- `/{locale}/export`
- `/{locale}/households/[id]/settings`

## 5) API Endpoints (Current)

These are the implemented `src/app/api/**/route.ts` endpoints:

- `GET /api/admin`
- `GET /api/export`
- `POST /api/import/commit`
- `GET /api/jobs/run`
- `POST /api/jobs/run`
- `POST /api/photos/upload`
- `GET /api/search`
- `POST /api/storage/signed-url`
- `POST /api/stripe/webhook`
- `GET /api/suggestions`
- `POST /api/support`

## 6) Server Actions (Current)

These are the exported server actions in the codebase:

- `src/lib/actions/auth.ts`
  - `resetPasswordAction`
- `src/lib/actions/households.ts`
  - `setActiveHouseholdAction`
- `src/lib/actions/householdSetup.ts`
  - `createFloorAction`
  - `updateFloorAction`
  - `deleteFloorAction`
  - `createSetupRoomAction`
  - `createSetupContainerAction`
- `src/lib/actions/items.ts`
  - `moveItemAction`
- `src/lib/actions/preferences.ts`
  - `setActivePreferenceAction`
- `src/lib/actions/scan.ts`
  - `quickAddAction`
- `src/lib/actions/suggestions.ts`
  - `analyzeContainerPhotosAction`
  - `updateSuggestionAction`
- `src/app/[locale]/(app)/admin/actions.ts`
  - `loadTicketsAction`
  - `updateTicketAction`
  - `loadSupportRequestsAction`
  - `updateSupportRequestAction`
  - `convertSupportRequestToTicketAction`
- `src/app/[locale]/(marketing)/support/action.ts`
  - `voteAction`
  - `loadPublicTicketsAction`

## 7) AI Job Runner

Photo analysis and embedding upserts are queued in `ai_jobs`.
Execution strategy:

- enqueue dispatch to `/api/jobs/run` when `AI_DISPATCH_ON_ENQUEUE=1`
- manual trigger via authenticated API call

Manual dev run:

```bash
curl -X POST "http://localhost:3000/api/jobs/run?limit=10" \
  -H "Authorization: Bearer $AI_JOB_RUNNER_TOKEN"
```

## 8) Search Model

Global search endpoint: `GET /api/search?q=...`

- Fuzzy source: trigram SQL search
- Semantic source: `search_documents` (pgvector)
- Final ranking: reciprocal-rank fusion
- AI answer mode: `GET /api/search?q=...&mode=ai`

## 9) Testing

Unit tests:

```bash
npm run test:unit
```

E2E smoke:

```bash
npx playwright install
npm run test:e2e
```

## 10) Household Canvas (Setup-first V2)

`/{locale}/canvas` redirects to your active household canvas.

Setup-first flow:

1. Create/select floor (name only).
2. Optionally create/select room.
3. Create container with floor + optional room (if omitted, system `Unassigned` room is used).
4. Add optional photo(s) and review AI suggestions.
5. Optionally quick-add items (`2 HDMI cables, 1 powerbank`) or open the box page.
6. Read-only map preview renders rooms and containers with deterministic non-overlapping layout.

Notes:

- Interactive draw/drag/resize/rotate is disabled in this iteration.
- Data model is floor-first: `household -> floor -> room -> container`.

## 11) Deploy (Vercel)

1. Push repo to GitHub.
2. Import in Vercel.
3. Add all env vars from `.env.example`.
4. Ensure Supabase migrations are applied to production DB before first deploy.
5. If you run background AI processing, trigger `/api/jobs/run` with `AI_JOB_RUNNER_TOKEN`.

## 12) Security Model

- RLS enabled across inventory and V2 tables.
- Multi-tenant isolation via household membership checks.
- Viewer role is read-only.
- Storage bucket is private; images are served via signed URLs.
- AI suggestions are never auto-committed to inventory without explicit user acceptance.
