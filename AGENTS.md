# Stowlio Agent Context

## Project purpose

Stowlio is a shared household inventory app for tracking where things are:

- household -> location -> room/zone -> container/box (supports nesting) -> items
- photos, QR labels, search, move history, sharing with roles
- map-first workflows (room map + household multi-floor canvas)

## Core stack

- Next.js App Router + TypeScript
- Supabase Auth + Postgres + Storage (private)
- Drizzle ORM for typed DB access
- Tailwind + shadcn/ui
- zod validation
- Playwright (e2e), Vitest (unit)

## Non-negotiables

- Supabase-first only (no self-hosted postgres)
- RLS must stay enforced for multi-tenant isolation
- Viewer role is read-only
- Do not weaken role checks in app layer
- Do not auto-commit AI suggestions to inventory without explicit user acceptance
- Do not rely on Supabase image transformations for core thumbnail flow

## Key domains and data model

- Membership model:
  - `households`, `household_members` (owner/admin/member/viewer)
  - `user_preferences` stores active household/location/room
- Inventory model:
  - `locations`, `rooms`, `containers`, `items`, `container_items`
  - tags via `tags`, `item_tags`, `container_tags`
- Media/history:
  - `photos` (private storage paths + signed URL usage)
  - `activity_log`
- AI/search:
  - `ai_jobs`, `photo_suggestions`, `search_documents` (pgvector)
- Spatial:
  - Room map: `room_layouts`, `placements`
  - Household canvas: `household_canvas_layouts`, `household_canvas_layers`, `household_canvas_placements`
  - Canvas placement `shape_type`: `rectangle | square | triangle`

## Important routes

- Dashboard: `/{locale}/dashboard`
- Onboarding: `/{locale}/onboarding`
- Scan mode: `/{locale}/scan`
- Room map: `/{locale}/rooms/[roomId]/map`
- Household canvas: `/{locale}/households/[id]/canvas`
- Canvas shortcut: `/{locale}/canvas`
- Box details: `/{locale}/boxes/[boxId]`

## Search behavior

- Global search combines fuzzy SQL + semantic vector ranking
- Results should stay grounded in DB entities (no hallucinated locations/items)

## Photo/AI pipeline

- Client creates compressed original + thumbnail
- Upload to private Supabase storage
- Persist photo row in DB
- AI suggestions are created as pending
- User accepts/rejects suggestions

## Map/canvas interaction rules

- Zoom must apply to map/canvas viewport only (not whole page)
- Canvas floors are 1:1 with locations and auto-managed
- Drawing room shapes creates real room entities
- Container placements are rectangle only
- Moving a room should move its mapped child container placements on same layer

## Migrations and setup

- SQL migrations are in `supabase/migrations`
- Use:
  - `npm run db:migrate:dry-run`
  - `npm run db:migrate`
- If schema mismatch errors occur, apply pending migrations before app debugging

## Quality bar for changes

- Validate all inputs with zod
- Keep UI loading/error states explicit
- Preserve i18n consistency (`src/i18n/messages/en.json`, `sv.json`)
- Add/adjust tests for behavior changes
- Prefer minimal, safe, backward-compatible migrations

## Test commands

- Unit: `npm run test:unit`
- E2E: `npx playwright install` then `npm run test:e2e`

## Current known caveat

- Repository may contain unrelated pre-existing lint/build issues; do not assume every failure comes from the current change.
