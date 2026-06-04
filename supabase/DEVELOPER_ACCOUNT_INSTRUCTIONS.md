# Developer account setup

This repository requires a developer account with permanent access. Follow these steps using a service-role key (supabase admin client / `gh`/server-side script):

1. Create the auth user (service role / admin client):

```js
const admin = createAdminClient();
await admin.auth.admin.createUser({
  email: 'dev@yourdomain.test',
  password: 'A-very-strong-password',
  user_metadata: { full_name: 'Developer', role: 'DEVELOPER' },
  email_confirm: true,
});
```

2. Insert the corresponding profile in `public.profiles` (service role SQL or admin client):

```sql
INSERT INTO public.profiles (id, full_name, role, email, username, is_protected, is_active)
VALUES ('<user-uuid>', 'Developer', 'DEVELOPER', 'dev@yourdomain.test', 'developer', true, true);
```

3. Verify the `is_protected` flag is set. Deleting protected profiles will fail due to a trigger added in the migration.

Notes:
- Owner password changes do not affect developer accounts because developer is a separate auth user.
- Keep the service-role key secure and only run admin operations from trusted servers.
