function normalizeSupabaseUrl(value: string): string {
  let trimmed = value.trim().replace(/\/+$/, '');
  let url: URL;

  try {
    url = new URL(trimmed);
  } catch (error) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL must be a valid URL.');
  }

  const sanitizedPath = url.pathname.replace(/\/(rest|auth)\/v1$/i, '');
  const normalized = `${url.protocol}//${url.host}${sanitizedPath}`;

  return normalized.replace(/\/+$/, '');
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
