## StorageHo (Supabase-first, V2)

StorageHo is a shared household + storage inventory app built on:
- Next.js App Router + TypeScript
- Supabase Auth + Postgres + Storage (private bucket)
- Drizzle ORM (typed queries)

V2 wedge highlights:
- Floor-first household setup: `/[locale]/households/[id]/canvas`
- Scan Mode (mobile loop): `/[locale]/scan`
- AI capture suggestions (human approval required)
- AI Find (fuzzy + semantic fused search)
- Spatial room map: `/[locale]/rooms/[roomId]/map`
- Household setup-first canvas (read-only map preview): `/[locale]/households/[id]/canvas`

## 1) Prerequisites

- Node 20+
- npm
- Supabase project

## 2) Environment setup

1. Copy `.env.example` -> `.env`
2. Fill required vars:

```env
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
DATABASE_URL=postgresql://...
```

3. For AI features (recommended):

```env
STORAGEHO_AI_ENABLED=1
AI_MOCK_MODE=1
OPENAI_API_KEY=...                 # required when AI_MOCK_MODE=0
OPENAI_MODEL_VISION=gpt-4o-mini
OPENAI_MODEL_EMBEDDING=text-embedding-3-small
AI_JOB_RUNNER_TOKEN=change-me
AI_CRON_TOKEN=change-me
AI_INTERNAL_TOKEN=change-me
AI_RUN_ON_UPLOAD=1
AI_DISPATCH_ON_ENQUEUE=1
INTERNAL_APP_URL=http://localhost:3000
```

Notes:
- `AI_MOCK_MODE=1` gives deterministic local suggestions/embeddings without external API calls.
- Set `AI_MOCK_MODE=0` in production when `OPENAI_API_KEY` is configured.
- `AI_RUN_ON_UPLOAD=1` runs photo analyze immediately in upload request for faster UX. Set `0` to rely only on background workers.
- `AI_DISPATCH_ON_ENQUEUE=1` triggers `/api/jobs/run` automatically when jobs are enqueued (event-like push).
- `INTERNAL_APP_URL` should point to your deployed app base URL so dispatch calls reach the job runner endpoint.

## 3) Install and migrate

```bash
npm install
npm run db:migrate:dry-run
npm run db:migrate
```

Migrations are in `supabase/migrations` and now include:
- `20260228190000_inventory_v2_wedge.sql` (pgvector + V2 tables + RLS)
- `20260301093000_household_canvas.sql` (multi-floor household canvas tables + RLS)
- `20260301120000_household_canvas_shapes.sql` (shape types + floor/location 1:1 backfill)
- `20260301143000_rooms_system_flag.sql` (`rooms.is_system` + single `Unassigned` room per floor)
- `20260301190000_remove_locations_table.sql` (drops `locations`; floors are now `household_canvas_layers`)

## 4) Run locally

```bash
npm run dev
```

Main app routes:
- `/{locale}/dashboard`
- `/{locale}/scan`
- `/{locale}/households/[id]/canvas` (floor-first setup)
- `/{locale}/rooms/[roomId]`
- `/{locale}/rooms/[roomId]/map`
- `/{locale}/canvas`
- `/{locale}/households/[id]/canvas`
- `/{locale}/boxes/[boxId]`
- `/{locale}/items`
- `/{locale}/import`
- `/{locale}/export`
- `/{locale}/print/labels?floorId=...`
- `/{locale}/households/[id]/settings`

## 5) AI job runner

Photo analysis + embedding upserts are queued in `ai_jobs`.
Default execution strategy:
- direct: run photo analyze immediately on upload (`AI_RUN_ON_UPLOAD=1`)
- push-dispatch: enqueue also triggers `/api/jobs/run` (`AI_DISPATCH_ON_ENQUEUE=1`)
- fallback: cron endpoint still available for retries/recovery

Manual dev run:
```bash
curl "http://localhost:3000/api/jobs/run?token=$AI_JOB_RUNNER_TOKEN"
```

Cron-compatible endpoint:
- `GET/POST /api/cron/ai-jobs`
- pass `Authorization: Bearer $AI_CRON_TOKEN` (or `?token=...`)

Internal AI endpoints:
- `POST /api/ai/analyze-photo`
- `POST /api/ai/embeddings/upsert`
- authorize with `AI_INTERNAL_TOKEN` (or runner token fallback)

Batch capture endpoint:
- `POST /api/suggestions/analyze-container`
- analyzes up to 4 latest container photos in one prompt and writes a deduplicated pending suggestion set

## 6) Search model

Global search endpoint: `GET /api/search?q=...`
- Fuzzy source: existing trigram SQL search
- Semantic source: `search_documents` (pgvector)
- Final ranking: reciprocal-rank fusion
- AI answer mode: `GET /api/search?q=...&mode=ai`

## 7) Testing

Unit tests:
```bash
npm run test:unit
```

E2E smoke:
```bash
npx playwright install
npm run test:e2e
```

Current smoke flow covers:
- signup -> onboarding -> scan -> suggestions accept -> search -> room map -> household setup-first canvas create flow

## 10) Household canvas (Setup-first V2)

`/{locale}/canvas` redirects to your active household canvas.

Setup-first flow:
1. Create/select floor (name only).
2. Optionally create/select room.
3. Create container with floor + optional room (if omitted, system `Unassigned` room is used).
4. Immediately add optional photo(s) and review AI suggestions.
5. Optionally quick-add items (`2 HDMI cables, 1 powerbank`) or open the box page.
6. Read-only map preview renders rooms and containers with deterministic non-overlapping layout.

Notes:
- Interactive draw/drag/resize/rotate is disabled in this iteration.
- The data model is now floor-first: `household -> floor -> room -> container`.

## 8) Deploy (Vercel)

1. Push repo to GitHub.
2. Import in Vercel.
3. Add all env vars from `.env.example`.
4. Ensure Supabase migrations are applied to production DB before first deploy.
5. Configure a scheduled request to `/api/cron/ai-jobs` (with bearer token).

## 9) Security model

- RLS enabled across inventory + V2 tables.
- Multi-tenant isolation via household membership checks.
- Viewer role is read-only.
- Storage bucket is private; images are served via signed URLs.
- AI suggestions are never auto-committed to inventory without explicit user accept.
