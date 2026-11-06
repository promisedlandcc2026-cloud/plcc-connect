-- Connect Prayer Wall reads prayer_requests with the public anon key
-- (sessionless supabasePublic). RLS already allows status = 'Published',
-- but table privileges were missing — anon got:
--   42501 permission denied for table prayer_requests
-- Canaan still showed prayers because it uses the service_role API.
--
-- Run in Supabase SQL Editor (same project as Connect + Canaan).

grant usage on schema public to anon, authenticated;

grant select on table public.prayer_requests to anon, authenticated;

-- Connect members submit / agree while signed in (RLS still applies)
grant insert on table public.prayer_requests to authenticated;
grant update on table public.prayer_requests to authenticated;

-- Keep public read limited to Published (idempotent recreate)
drop policy if exists "Public requests are viewable by everyone" on public.prayer_requests;
create policy "Public requests are viewable by everyone"
  on public.prayer_requests
  for select
  to anon, authenticated
  using (status = 'Published');

-- Backfill Canaan-approved public rows so is_confidential is never null-mismatch
update public.prayer_requests
set is_confidential = false
where status = 'Published'
  and (is_confidential is null);
