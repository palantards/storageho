-- Add profile columns to users table (consolidating from profiles)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS company text,
  ADD COLUMN IF NOT EXISTS locale text;

-- Backfill from profiles (join on supabase_user_id = profiles.user_id)
UPDATE users u
SET
  display_name = COALESCE(u.display_name, p.display_name),
  name         = COALESCE(u.name, p.name),
  company      = COALESCE(u.company, p.company),
  locale       = COALESCE(u.locale, p.locale)
FROM profiles p
WHERE u.supabase_user_id = p.user_id;
