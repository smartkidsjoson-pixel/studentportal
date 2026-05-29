-- Verify if username 'Joson' exists (case-insensitive)
SELECT id, username, email, role FROM public.profiles WHERE lower(username) = lower('Joson');

-- If no rows are returned, set the OWNER account's username to 'Joson'
-- This will update the first OWNER found that has no username or empty username.
-- Review results before running in production.

BEGIN;

-- Show owner rows and their current username/email
SELECT id, username, email, role FROM public.profiles WHERE role = 'OWNER';

-- Update OWNER without username to 'Joson' (only when safe)
UPDATE public.profiles
SET username = 'Joson'
WHERE role = 'OWNER'
  AND (username IS NULL OR trim(username) = '')
RETURNING id, email, username;

-- If multiple OWNER rows exist, or 'Joson' is already used, you should manually resolve conflicts.

-- Ensure the OWNER profile has an email; if empty, attempt to copy from auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE u.id = p.id
  AND p.role = 'OWNER'
  AND (p.email IS NULL OR p.email = '')
RETURNING p.id, p.email;

COMMIT;

-- Verify owner email exists now
SELECT id, username, email FROM public.profiles WHERE role = 'OWNER' AND lower(username) = lower('Joson');

-- Check for duplicate usernames (should be zero rows)
SELECT lower(username) AS username_lower, count(*)
FROM public.profiles
WHERE username IS NOT NULL
GROUP BY lower(username)
HAVING count(*) > 1;
