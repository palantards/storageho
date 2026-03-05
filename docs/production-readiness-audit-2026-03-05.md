# Production Readiness Audit (Strict, Repo-Only)

- Date: 2026-03-05
- Scope: codebase-only verification (no staging/prod runtime checks)
- Policy: strict blocker model (`P0` blocks release)
- Decision: `NO-GO`

## 1. Baseline Gate Results

| Gate | Command | Result | Notes |
|---|---|---|---|
| Lint (strict) | `npx eslint . --max-warnings=0` | FAIL | 1 warning in `AdminTicketsSection.tsx` |
| Unit tests | `npm run test:unit` | PASS | 9 files, 24 tests |
| Build | `npm run build` | PASS | Next build + TS succeeded |
| E2E | `npm run test:e2e` | FAIL | Playwright browser binary missing (`npx playwright install` not run) |
| Security audit | `npm audit --audit-level=high --omit=dev` | FAIL | 1 high advisory (`next`), plus moderate/low transitives |
| Dependency drift | `npm outdated --long` | ATTENTION | `next` current `16.1.1`, latest `16.1.6` |
| DB migrations dry-run | `npm run db:migrate:dry-run` | PASS | 11 SQL migration files enumerated |
| Drizzle schema check | `npx drizzle-kit check` | PASS | "Everything's fine" |

## 2. Route/API Contract Audit (Code vs Docs)

### Implemented API routes

- `/api/admin`
- `/api/export`
- `/api/import/commit`
- `/api/jobs/run`
- `/api/photos/upload`
- `/api/search`
- `/api/storage/signed-url`
- `/api/stripe/webhook`
- `/api/suggestions`
- `/api/support`

Evidence: [route.ts inventory](d:/project/storageho/src/app/api).

### README endpoints/paths missing in code

- `/api/cron/ai-jobs` ([README.md:110](d:/project/storageho/README.md:110))
- `/api/ai/analyze-photo` ([README.md:114](d:/project/storageho/README.md:114))
- `/api/ai/embeddings/upsert` ([README.md:115](d:/project/storageho/README.md:115))
- `/api/suggestions/analyze-container` ([README.md:119](d:/project/storageho/README.md:119))
- `/{locale}/rooms/[roomId]/map` ([README.md:86](d:/project/storageho/README.md:86))
- `/{locale}/print/labels?floorId=...` ([README.md:93](d:/project/storageho/README.md:93))

Route search for those patterns returned no matches in `src/app` (`NO_MATCHES`).

## 3. AuthN/AuthZ and Role Enforcement Review

### Pass observations

- App-layer viewer write deny:
  - [roles.ts:12](d:/project/storageho/src/lib/inventory/roles.ts:12)
  - [guards.ts:13](d:/project/storageho/src/lib/inventory/guards.ts:13)
- DB-layer write deny for viewers via `can_write_household` and RLS policies:
  - [20260227110000_inventory_core.sql:468](d:/project/storageho/supabase/migrations/20260227110000_inventory_core.sql:468)
  - [20260227110000_inventory_core.sql:691](d:/project/storageho/supabase/migrations/20260227110000_inventory_core.sql:691)
- Mutating API handlers enforce session + membership/write checks in key flows:
  - upload: [photos/upload route](d:/project/storageho/src/app/api/photos/upload/route.ts:56), [write access check](d:/project/storageho/src/app/api/photos/upload/route.ts:118)
  - import commit: [import route](d:/project/storageho/src/app/api/import/commit/route.ts:27), [write access check](d:/project/storageho/src/app/api/import/commit/route.ts:49)
  - signed URL: [signed-url route](d:/project/storageho/src/app/api/storage/signed-url/route.ts:16), [membership check](d:/project/storageho/src/app/api/storage/signed-url/route.ts:33)
  - suggestion mutations: [suggestions action](d:/project/storageho/src/lib/actions/suggestions.ts:200)

### Risk observations

- Admin route throws on forbidden instead of returning explicit `401/403`, likely surfacing as `500`:
  - [api/admin/route.ts:8](d:/project/storageho/src/app/api/admin/route.ts:8)

## 4. Security Hardening Review

### Pass observations

- CSRF protection exists for cookie-authenticated API unsafe methods with same-origin checks:
  - [middleware.ts:129](d:/project/storageho/middleware.ts:129)
  - [middleware.ts:178](d:/project/storageho/middleware.ts:178)
- Explicit webhook exemption for Stripe:
  - [middleware.ts:10](d:/project/storageho/middleware.ts:10)
- Service-role usage limited to server-side contexts:
  - [supabaseServer.ts:22](d:/project/storageho/src/lib/supabaseServer.ts:22)
  - [photos/upload route.ts:156](d:/project/storageho/src/app/api/photos/upload/route.ts:156)
  - [storage/signed-url route.ts:38](d:/project/storageho/src/app/api/storage/signed-url/route.ts:38)
  - [actions/suggestions.ts:81](d:/project/storageho/src/lib/actions/suggestions.ts:81)

### Risks

- In-memory rate limits are per-process and non-distributed (weak under horizontal scaling):
  - [photos/upload route.ts:18](d:/project/storageho/src/app/api/photos/upload/route.ts:18)
  - [support route.ts:11](d:/project/storageho/src/app/api/support/route.ts:11)
- No explicit hardening headers configured in app config:
  - [next.config.ts:3](d:/project/storageho/next.config.ts:3)

## 5. Data/RLS/Migration Integrity Review

### Pass observations

- Core inventory tables enable RLS and define tenant policies:
  - [inventory_core.sql:511](d:/project/storageho/supabase/migrations/20260227110000_inventory_core.sql:511)
  - [inventory_core.sql:630](d:/project/storageho/supabase/migrations/20260227110000_inventory_core.sql:630)
- Dry-run migration chain completes listing all expected files.
- Drizzle schema check returns clean.

### Risks

- Dual migration surfaces exist (`supabase/migrations` + `drizzle/` artifacts); source-of-truth is not enforced by tooling.

## 6. AI/Search Behavior Review

### Pass observations

- Suggestion accept/reject is explicit user action (no auto-commit path):
  - [actions/suggestions.ts:187](d:/project/storageho/src/lib/actions/suggestions.ts:187)
  - [service.ts:2698](d:/project/storageho/src/lib/inventory/service.ts:2698)
  - [service.ts:2871](d:/project/storageho/src/lib/inventory/service.ts:2871)
- Search results are grounded in DB entities and fused from fuzzy + semantic DB-backed queries:
  - [api/search route.ts:39](d:/project/storageho/src/app/api/search/route.ts:39)
  - [service.ts:2952](d:/project/storageho/src/lib/inventory/service.ts:2952)
  - [service.ts:3092](d:/project/storageho/src/lib/inventory/service.ts:3092)

### Risks

- `AI_RUN_ON_UPLOAD` is documented but unused in runtime code:
  - docs: [README.md:47](d:/project/storageho/README.md:47), [.env.example:31](d:/project/storageho/.env.example:31)
  - code search in `src` returns no usage

## 7. Test Adequacy and Gap Analysis

### Existing tests

- Unit: 9 files (permissions, search, suggestions, csv, setup map/canvas, quick-add)
- E2E: 1 smoke flow (`tests/e2e/inventory-smoke.spec.ts`)

### Gaps (high priority)

- No explicit API tests for unauthorized/forbidden matrix across protected endpoints.
- No explicit tests for cross-household access rejection on signed URLs/import/export/search.
- No explicit CSRF negative tests.
- No explicit tests for storage path traversal/format abuse beyond schema checks.
- E2E references room map flow and map placement expectations not aligned with implemented routes/docs:
  - [inventory-smoke.spec.ts:78](d:/project/storageho/tests/e2e/inventory-smoke.spec.ts:78)
  - [README.md:86](d:/project/storageho/README.md:86)

## 8. Prioritized Findings

## P0 (Release blockers)

1. Strict lint gate fails.
   - Evidence: `npx eslint . --max-warnings=0` failure with warning in `AdminTicketsSection.tsx`.
2. E2E gate not runnable in current repo environment.
   - Evidence: Playwright missing browser executable during `npm run test:e2e`.
3. High-severity dependency advisory present (`next`).
   - Evidence: `npm audit --audit-level=high --omit=dev` reports high severity for `next`.
4. Major code-vs-doc contract mismatches for documented routes/endpoints.
   - Evidence: README references missing `/api/cron/ai-jobs`, `/api/ai/*`, `/api/suggestions/analyze-container`, `/{locale}/rooms/[roomId]/map`, `/{locale}/print/labels`.

## P1 (High priority, should fix pre-release if possible)

1. Admin route returns unhandled error path for unauthorized users.
   - Evidence: [api/admin/route.ts:8](d:/project/storageho/src/app/api/admin/route.ts:8)
2. Rate limiting is in-memory only.
   - Evidence: [photos/upload route.ts:18](d:/project/storageho/src/app/api/photos/upload/route.ts:18), [support route.ts:11](d:/project/storageho/src/app/api/support/route.ts:11)
3. Missing explicit security headers baseline.
   - Evidence: [next.config.ts:3](d:/project/storageho/next.config.ts:3)
4. Documented env behavior drift (`AI_RUN_ON_UPLOAD` not wired).
   - Evidence: [README.md:47](d:/project/storageho/README.md:47), [.env.example:31](d:/project/storageho/.env.example:31)

## P2 (Cleanup/quality)

1. `.env.example` is ignored by `.gitignore`, reducing reproducibility in fresh clones.
   - Evidence: [.gitignore:34](d:/project/storageho/.gitignore:34)
2. Dual migration tracks not explicitly governed as single source of truth.

## 9. Remediation Plan (Owner / Effort)

1. Fix lint warning and enforce zero-warning lint in CI.
   - Owner: App engineer
   - Effort: XS
2. Install Playwright browsers in CI and local contributor setup (`npx playwright install`), then rerun e2e.
   - Owner: QA/platform engineer
   - Effort: XS
3. Upgrade `next` to patched line (`16.1.6` currently available), re-run full regression suite.
   - Owner: App engineer
   - Effort: S
4. Resolve route/docs contract mismatch: either implement missing endpoints/routes or remove/deprecate docs references.
   - Owner: App engineer + docs owner
   - Effort: M
5. Return explicit `401/403` JSON in admin API route instead of throwing.
   - Owner: App engineer
   - Effort: XS
6. Replace in-memory rate limiting with shared backend (Redis/upstash/Supabase table-based throttle).
   - Owner: Platform engineer
   - Effort: M
7. Add baseline security headers (`CSP`, `HSTS`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) with compatibility testing.
   - Owner: Security/app engineer
   - Effort: M
8. Align env docs with runtime (`AI_RUN_ON_UPLOAD` + missing/extra vars) and commit tracked template env docs.
   - Owner: Docs/app engineer
   - Effort: S
9. Add targeted API security tests (401/403, cross-household, CSRF, signed-url validation).
   - Owner: QA/app engineer
   - Effort: M

## 10. Final Decision

- Current status: `NO-GO`
- Release can move to `GO` only after all `P0` findings are remediated and gates re-run successfully under strict criteria.
