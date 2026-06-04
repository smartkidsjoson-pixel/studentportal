// Usage:
// SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_SUPABASE_URL=... node scripts/create_developer_account.js

const { createClient } = require('@supabase/supabase-js');

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars');
    process.exit(1);
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });

  const email = 'developer@example.local';
  const password = '2349';
  const username = 'developer';
  const role = 'OWNER';

  try {
    console.log('Creating auth user...');
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      user_metadata: { username, role, full_name: 'Developer Account' },
      email_confirm: true,
    });

    if (error) {
      console.error('Auth create error:', error);
      process.exit(1);
    }

    const userId = data.user.id;
    console.log('Auth user created with id:', userId);

    console.log('Creating profile row...');
    const { error: profileError } = await admin
      .from('profiles')
      .insert({ id: userId, full_name: 'Developer Account', role, is_active: true, email, username });

    if (profileError) {
      console.error('Profile insert error:', profileError);
      process.exit(1);
    }

    console.log('Profile created for developer account.');
    console.log('Developer account ready. Username:', username, 'Password:', password, 'Email:', email);
  } catch (e) {
    console.error('Unexpected error:', e);
    process.exit(1);
  }
}

main();
