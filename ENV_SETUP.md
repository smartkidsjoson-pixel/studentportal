# Environment Variables Guide

## Overview
Your app needs 3 environment variables from Supabase to connect to the database and authenticate users.

---

## Where to Find These Values

### Step 1: Go to Supabase Dashboard
1. Visit [app.supabase.com](https://app.supabase.com)
2. Click on your project
3. Go to **Settings** (bottom left)
4. Click **API** in the menu

### Step 2: Find Your Credentials
On the **API** settings page, you'll see:

- **Project URL** - Copy this → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public key** - Copy this → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role key** - Copy this → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ **Keep Secret!**

---

## Local Development (.env.local)

Create or update `.env.local` in your project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Note:** `NEXT_PUBLIC_*` variables are exposed in the browser (use public API key). The `SUPABASE_SERVICE_ROLE_KEY` is secret and only used on the server.

---

## Vercel Deployment

### Method 1: GUI (Recommended)
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click your project → **Settings** → **Environment Variables**
3. Add each variable:
   - **Name:** `NEXT_PUBLIC_SUPABASE_URL`
   - **Value:** (paste your Supabase URL)
   - Click **Add**
4. Repeat for the other 2 variables
5. Redeploy: Click **Deployments** → Latest → **Redeploy** (or push new commit to main)

### Method 2: Vercel CLI
```bash
# From your project root
vercel env add NEXT_PUBLIC_SUPABASE_URL
# Paste your URL when prompted
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
# Paste your anon key
vercel env add SUPABASE_SERVICE_ROLE_KEY
# Paste your service role key (keep this safe!)

vercel redeploy
```

---

## Example Values (Replace with Your Own)

```env
NEXT_PUBLIC_SUPABASE_URL=https://yxpypgkmefrbxcvbqnoh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4cHlwZ2ttZWZyYnhjdmJxbm9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NzE2MjQsImV4cCI6MjA5MzU0NzYyNH0.GVW85OOzcCur10tANaiG0K2vEkkEV6Z68oNyaxEW0Ds
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4cHlwZ2ttZWZyYnhjdmJxbm9oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk3MTYyNCwiZXhwIjoyMDkzNTQ3NjI0fQ.0TGGHgQpJs_Ji1wYqcgCO0rDApDRJGHsy-3ps7jOpAI
```

---

## Security Notes

⚠️ **ALWAYS:**
- Keep `SUPABASE_SERVICE_ROLE_KEY` secret (never commit to GitHub)
- Use Vercel's environment variables, not `.env.local` in production
- Rotate keys if compromised

✅ **OK to expose:**
- `NEXT_PUBLIC_SUPABASE_URL` (visible in all browsers)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public API key with RLS protection)

---

## Testing Locally

After setting up `.env.local`:
```bash
npm run dev
```

Visit `http://localhost:3000` and verify Supabase connection (if login page loads with no console errors, you're good!).

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| **"Could not find Supabase"** | Ensure all 3 env vars are in `.env.local` and spelled correctly |
| **"Authentication failed"** | Check `SUPABASE_URL` and `ANON_KEY` match your Supabase project |
| **"Permission denied" on page load** | Run the SQL migration (SUPABASE_MIGRATION.sql) first |
| **Environment vars not working on Vercel** | Wait ~2 min after adding env vars on Vercel, then redeploy |

