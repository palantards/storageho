## Storage Home Inventory (Supabase-First)

Detta repo är nu uppsatt för **Supabase-first**:
- Supabase Auth
- Supabase Postgres
- Supabase Storage
- SQL-migrationer i `supabase/migrations`

Drizzle används i appen för typed queries, men schema deployas via Supabase-migrationer.

## Snabbstart
1. Kopiera `.env.example` till `.env`.
2. Fyll i Supabase-variablerna:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (använd publishable key)
   - `SUPABASE_ANON_KEY` (samma publishable key)
   - `SUPABASE_SERVICE_ROLE_KEY` (använd secret key)
   - `DATABASE_URL` (Supabase Postgres connection string)
3. Installera dependencies:
   ```bash
   npm install
   ```
4. Kör migrationer:
   ```bash
   npm run db:migrate:dry-run
   npm run db:migrate
   ```
5. Starta appen:
   ```bash
   npm run dev
   ```

## Migrationsflöde (Supabase)
Migrationer läses från:
- `supabase/migrations/*.sql`

Aktivt script:
- `npm run db:migrate` -> kör alla SQL-filer i ordning mot `DATABASE_URL`
- `npm run db:migrate:dry-run` -> listar vad som kommer köras
- `npm run db:migrate:file -- <filnamn.sql>` -> kör en enskild migration

## Verifiera tabeller
Efter migrering kan du verifiera att tabeller finns:
```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

## Viktiga routes
- `/[locale]/dashboard`
- `/[locale]/locations`
- `/[locale]/locations/[locationId]`
- `/[locale]/rooms/[roomId]`
- `/[locale]/boxes/[boxId]`
- `/[locale]/items`
- `/[locale]/import`
- `/[locale]/export`
- `/[locale]/print/labels?locationId=...`
- `/[locale]/households/[id]/settings`

## Test
```bash
npm run test:unit
npm run test:e2e
```

## Notering
Legacy Stripe-sidor/filstrukturer kan finnas kvar i repo:t, men inventory-flödet kräver inte Stripe.