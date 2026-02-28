# DB Init Flow (Supabase-first)

## 1) Fyll `.env`
Sätt minst:
- `DATABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## 2) Installera
```bash
npm install
```

## 3) Lista migrationer
```bash
npm run db:migrate:dry-run
```

## 4) Applicera migrationer
```bash
npm run db:migrate
```

## 5) Verifiera
I Supabase SQL Editor:
```sql
select table_name
from information_schema.tables
where table_schema='public'
order by table_name;
```