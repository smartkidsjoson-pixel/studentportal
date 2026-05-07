# Vercel Deployment Checklist

Use this checklist to ensure your app is production-ready before deploying to Vercel.

---

## ✅ Pre-Deployment Tasks

### 1. Database Setup
- [ ] Created a Supabase project (free tier OK for testing)
- [ ] Copied SQL from `SUPABASE_MIGRATION.sql`
- [ ] Ran SQL in Supabase SQL Editor (paste all and click **Run**)
- [ ] No SQL errors appear; all tables created successfully
- [ ] Verified tables exist: `profiles`, `classes`, `students`, `teacher_class_assignments`, `promotion_logs`

### 2. Local Environment
- [ ] Created `.env.local` with 3 Supabase variables
- [ ] Ran `npm install` (all dependencies installed)
- [ ] Ran `npm run build` (build succeeds with no errors)
- [ ] Ran `npm run dev` and tested login locally

### 3. Code Quality
- [ ] Ran `npm run typecheck` (no TypeScript errors)
- [ ] Ran `npm run lint` (no lint errors)
- [ ] Reviewed `.next` build output (no critical warnings)

### 4. Git & GitHub
- [ ] All changes committed: `git status` shows clean working tree
- [ ] Pushed to main: `git push origin main`
- [ ] Verified on GitHub: Changes visible in `github.com/your-username/studentportal`

### 5. Vercel Setup
- [ ] Created Vercel account (free tier)
- [ ] Project linked to GitHub repo
- [ ] Added 3 environment variables in Vercel UI
- [ ] Verified deployment environment is "Production"

### 6. Security Review
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is NOT in `.env.local` file on GitHub (only locally)
- [ ] Vercel environment variables are set (not pulled from .env files)
- [ ] Database RLS policies enabled and tested

---

## 🚀 Deployment Steps

### Step 1: Prepare Code
```bash
cd /workspaces/studentportal
git status  # Should be clean
npm run build  # Should complete with no errors
```

### Step 2: Add to Vercel
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click **Add New** → **Project**
3. Select your GitHub repository
4. Click **Import**

### Step 3: Configure Environment
1. Click **Environment Variables**
2. Add:
   ```
   Name: NEXT_PUBLIC_SUPABASE_URL
   Value: https://yxpypgkmefrbxcvbqnoh.supabase.co
   ```
3. Add:
   ```
   Name: NEXT_PUBLIC_SUPABASE_ANON_KEY
   Value: eyJhbGc...
   ```
4. Add (🔒 Keep Secret):
   ```
   Name: SUPABASE_SERVICE_ROLE_KEY
   Value: eyJhbGc...
   ```
5. Click **Save** (wait for "✓ Saved")

### Step 4: Deploy
1. Click **Deploy**
2. Wait 3-5 minutes
3. When done, you'll see: **✓ Deployed to Production**
4. Copy your project URL → `https://your-project.vercel.app`

### Step 5: Test Live
1. Visit your Vercel URL
2. Continue with **Testing Flows** (see DEPLOYMENT.md)

---

## 🧪 Quick Smoke Tests (After Deploy)

Before considering deployment successful, verify:

1. **Landing Page Loads**
   - Visit your Vercel URL
   - See landing page (no 404)

2. **Setup Route Works**
   - Visit `/setup`
   - Create admin account
   - Get success message

3. **Login Works**
   - Visit `/login`
   - Enter admin email & password
   - Redirect to `/dashboard`

4. **Dashboard Loads**
   - Sidebar visible with: Classes, Students, Teachers, Promotions
   - No console errors (open DevTools: F12)

5. **Student Creation**
   - Click Students → Add new student
   - Fill form and submit
   - Student appears in list with admission number

---

## 🔧 Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| **"Cannot find Supabase"** | Env vars not set in Vercel | Verify in Vercel > Settings > Environment Variables |
| **"Database error on login"** | SQL migration not run | Run SUPABASE_MIGRATION.sql in Supabase SQL editor |
| **Build fails with "command not found"** | Node modules not installed | Run `npm install` locally, push to main, redeploy |
| **TypeScript errors in Vercel logs** | Type mismatch in code | Run `npm run typecheck` locally, fix errors, push to main |
| **Blank page or 500 error** | Check Vercel function logs (⌘/Ctrl+Shift+L in Vercel dashboard) | View logs to see actual error message |
| **"RLS policy violation"** | Database security blocking query | Verify RLS policies in SUPABASE_MIGRATION.sql were created |

---

## 📱 Cross-Browser Testing (Optional)

For extra validation, test in:
- [ ] Chrome (Desktop)
- [ ] Safari (Desktop & Mobile)
- [ ] Firefox (Desktop)
- [ ] Mobile (iOS & Android)

---

## 🎉 Success Criteria

Your deployment is successful when:
- ✅ Landing page loads and is responsive
- ✅ Admin account creation works
- ✅ Login is secure
- ✅ All RBAC flows work (Owner vs Teacher)
- ✅ Student/class/teacher CRUD operations work
- ✅ No console errors (F12 → Console tab)
- ✅ Database queries are fast (< 2 seconds)

---

## 🔐 Post-Deployment Security

1. **Enable Supabase Auth Email**
   - Go to Supabase > Authentication > Providers > Email
   - Toggle OFF "Confirm email" (optional for testing)
   - Or configure SMTP for production emails

2. **Review Supabase Network Policies**
   - Supabase > Settings > Database
   - Add IP allowlist if needed (optional)

3. **Enable HTTPS**
   - Vercel auto-enables HTTPS (no action needed)

4. **Monitor Errors**
   - Vercel > Monitoring
   - Review error trends weekly

---

## 📞 Support

If stuck:
1. Check browser console for errors (F12)
2. Check Vercel function logs (Vercel dashboard)
3. Check Supabase activity (Supabase > Logs)
4. See DEPLOYMENT.md for detailed testing flows

