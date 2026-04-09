-- supabase/migrations/003_make_commissioner.sql
-- Run this ONCE after you create your own account to give yourself commissioner access.
-- Replace 'your-email@example.com' with the email you signed up with.

update public.profiles
set is_commissioner = true
where email = 'your-email@example.com';

-- Verify it worked — should return 1 row with is_commissioner = true
select email, is_commissioner from public.profiles where email = 'your-email@example.com';
