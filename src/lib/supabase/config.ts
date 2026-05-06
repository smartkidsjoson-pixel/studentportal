function normalizeSupabaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '');
  let url: URL;

  try {
    url = new URL(trimmed);
  } catch (error) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL must be a valid URL.');
  }

  const pathname = url.pathname.toLowerCase();
  if (pathname.includes('/rest/v1') || pathname.includes('/auth/v1')) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL must be the base Supabase project URL without /rest/v1 or /auth/v1.');
  }

  return trimmed;
}

export function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is required but was not provided.');
  }

  return normalizeSupabaseUrl(url);
}

export function getSupabaseAnonKey() {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is required but was not provided.');
  }

  return key.trim();
}

export function getSupabaseServiceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin actions but was not provided.');
  }

  return key.trim();
}
