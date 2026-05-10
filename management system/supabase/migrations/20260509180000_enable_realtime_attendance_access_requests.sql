-- Optional but recommended: lets Supabase Realtime emit postgres_changes for this table.
-- If you see "is already a member of publication", the table is already enabled (ignore).
-- The HR dashboard also polls every 5s so the list updates even without this.
alter publication supabase_realtime add table public.attendance_access_requests;
