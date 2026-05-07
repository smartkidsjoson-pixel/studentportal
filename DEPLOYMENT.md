# School Portal - Deployment & Testing Guide

## 📋 Pre-Deployment Checklist (Vercel + Supabase)

### 1. Supabase Database Setup

Follow these steps to configure your Supabase database:

#### Step 1: Create the Database Schema
Open your Supabase SQL editor and run the SQL migration below (see SUPABASE_MIGRATION.sql in this guide).

#### Step 2: Configure Environment Variables
In Supabase, get your credentials from **Settings > API**:
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (keep secret)

### 2. Vercel Deployment

#### Step 1: Connect Repository
1. Go to [vercel.com](https://vercel.com)
2. Click **"New Project"**
3. Import your `studentportal` GitHub repository
4. Select **Next.js** framework (Vercel auto-detects)

#### Step 2: Configure Environment Variables
Add to Vercel project settings:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

#### Step 3: Deploy
- Click **Deploy**
- Vercel will run `npm install`, `npm run build`, and start the app
- Your app is live at `https://your-project.vercel.app`

---

## 🧪 Testing Guide for Beginners

Each **flow** is a complete user journey. Test all flows below to ensure everything works.

### **FLOW 1: Initial Setup (Owner Account Creation)**

**Goal:** Create the first administrator account.

**Steps:**
1. Visit: `https://your-vercel-url/setup`
2. Fill the form:
   - **Full Name:** `John Doe`
   - **Email:** `owner@school.com`
   - **Password:** `SecurePass123!`
   - **Role:** Select `OWNER`
3. Click **"Create Administrator"**
4. ✅ You should see: "Administrator account created successfully. You can now log in."

---

### **FLOW 2: Owner Login**

**Goal:** Log in as the school administrator.

**Steps:**
1. Visit: `https://your-vercel-url/login`
2. Enter credentials from **FLOW 1**:
   - Email: `owner@school.com`
   - Password: `SecurePass123!`
3. Click **"Sign In"**
4. ✅ You should be redirected to Dashboard with menu showing: Classes, Students, Teachers, Promotions

---

### **FLOW 3: Create a Class**

**Goal:** Add a class to the system.

**Steps:**
1. From Dashboard, click **"Classes"** in sidebar
2. Click **"Create new class"** button
3. Fill the form:
   - **Class Name:** `Grade 4A`
   - **Section:** `A` (optional)
   - **Level Order:** `4`
   - **Capacity:** `40`
4. Click **"Create class"**
5. ✅ You should see the new class in the Classes list

---

### **FLOW 4: Create a Teacher Account**

**Goal:** Add a teacher to the system.

**Steps:**
1. From Dashboard, click **"Teachers"** in sidebar
2. Click **"Add new teacher"** button
3. Fill the form:
   - **Full Name:** `Jane Smith`
   - **Email:** `teacher1@school.com`
   - **Password:** `TeacherPass123!`
   - **Role:** Select `TEACHER`
4. Click **"Create teacher"**
5. ✅ You should see "Jane Smith" with status "Active" in the Staff list

---

### **FLOW 5: Assign Teacher to Class**

**Goal:** Link a teacher to a class so they can manage students in that class.

**Steps:**
1. Stay on **Teachers** page (from FLOW 4)
2. Scroll to **"Assign class"** section
3. Fill the form:
   - **Teacher:** Select `Jane Smith`
   - **Class:** Select `Grade 4A`
4. Click **"Assign"**
5. ✅ In the Staff table, Jane Smith's "Assigned classes" should show `Grade 4A`

---

### **FLOW 6: Create a Student**

**Goal:** Register a student in the system.

**Steps:**
1. From Dashboard, click **"Students"** in sidebar
2. Click **"Add new student"** button
3. Fill the form:
   - **Full Name:** `Ahmed Hassan`
   - **Class:** Select `Grade 4A`
   - **Date Joined:** `2026-01-15`
   - **Gender:** `Male`
   - **Date of Birth:** `2015-06-20`
   - **Parent Name:** `Ibrahim Hassan`
   - **Parent Phone:** `+254712345678`
4. Click **"Create student"**
5. ✅ You should see the student in the Students list with an **Admission Number** (auto-generated like `ADM-0001`)

---

### **FLOW 7: Edit Student Profile**

**Goal:** Update student information.

**Steps:**
1. From **Students** page, click on a student's name (e.g., Ahmed Hassan)
2. You'll see the student's profile with all details
3. Scroll to **"Edit student record"** card
4. Change one field (e.g., Parent Phone from `+254712345678` to `+254712999999`)
5. Click **"Save changes"**
6. ✅ You should see "Student record updated successfully." and the change saved

---

### **FLOW 8: Search & Filter Students**

**Goal:** Find students quickly by name or admission number.

**Steps:**
1. From Dashboard, click **"Students"**
2. In the filter section at the top:
   - **Search:** Type `Ahmed` → should show only Ahmed Hassan
   - **Class Filter:** Select `Grade 4A` → shows only students in that class
   - **Status Filter:** Select `Active` → shows only active students
3. ✅ The table updates to show matching results

---

### **FLOW 9: Promote Students**

**Goal:** Move students from one class to the next level.

**Steps:**
1. From Dashboard, click **"Promotions"** in sidebar
2. Fill the promotion form:
   - **From Class:** Select `Grade 4A`
   - **To Class:** Create another class first (FLOW 3), e.g., `Grade 5A`
   - Check the checkbox for **Ahmed Hassan** to promote him
3. Click **"Promote selected students"**
4. ✅ You should see "Selected students have been promoted successfully."
5. **Verify:** Go to **Students** → Click Ahmed Hassan's profile → Scroll to **"Promotion History"** → You should see the transfer logged with date and promoted by (Owner name)

---

### **FLOW 10: Teacher Role - Limited Access**

**Goal:** Verify teachers can only see their own assigned classes.

**Steps:**
1. Open a private/incognito browser window
2. Visit: `https://your-vercel-url/login`
3. Log in as teacher:
   - Email: `teacher1@school.com`
   - Password: `TeacherPass123!` (from FLOW 4)
4. ✅ Verify:
   - **Dashboard** shows only `Grade 4A` students (their assigned class)
   - **Students** page shows only students in `Grade 4A`
   - **Classes** page is hidden (redirect)
   - **Teachers** page is hidden (redirect)
   - **Promotions** page is hidden (redirect)
5. Click **"Add new student"** button
6. Create a student in `Grade 4A`:
   - **Full Name:** `Zainab Ali`
   - **Class:** Must select `Grade 4A` (or error if trying others)
7. ✅ Student appears in the teacher's Students list

---

### **FLOW 11: Deactivate Teacher**

**Goal:** Disable a teacher account.

**Steps:**
1. Log back in as **OWNER** (close private window or use original browser)
2. Go to **Teachers** page
3. Find Jane Smith's row
4. Click **"Deactivate"** button
5. ✅ Button changes to **"Activate"** and Jane Smith's Status shows "Inactive"

---

### **FLOW 12: Prevent Deactivated User Login**

**Goal:** Confirm disabled accounts cannot log in.

**Steps:**
1. Open private window again
2. Try to log in as the deactivated teacher:
   - Email: `teacher1@school.com`
   - Password: `TeacherPass123!`
3. ✅ Login should fail with error (or redirect away if account disabled in DB)

---

## ✅ Final Validation Checklist

Run through these to confirm production readiness:

- [ ] **FLOW 1** - Setup page works; Owner account created
- [ ] **FLOW 2** - Owner logs in; Dashboard loads
- [ ] **FLOW 3** - Classes created; appear in list
- [ ] **FLOW 4** - Teachers created; appear in staff directory
- [ ] **FLOW 5** - Teacher assigned to class; assignment shown
- [ ] **FLOW 6** - Student created; admission number auto-generated
- [ ] **FLOW 7** - Edit student; changes save
- [ ] **FLOW 8** - Search & filters work; correct results shown
- [ ] **FLOW 9** - Promotion works; history logs in profile
- [ ] **FLOW 10** - Teacher sees only their class; cannot access owner pages
- [ ] **FLOW 11** - Teacher deactivated; status toggles
- [ ] **FLOW 12** - Deactivated account blocked on login
- [ ] **Build** - `npm run build` completes with no errors
- [ ] **No Console Errors** - Open browser DevTools (F12) → Console tab → No red errors

---

## 🚀 Deployment Steps (Quick)

1. **Push to GitHub** (already done: `git push origin main`)
2. **Link Vercel:**
   - Go to [vercel.com/new](https://vercel.com/new)
   - Choose your GitHub repo → `studentportal`
3. **Add Env Vars:** In Vercel settings, add the 3 Supabase variables
4. **Deploy:** Click Deploy → Wait 2-3 minutes
5. **Test:** Visit your Vercel URL and run FLOW 1-12

---

## 📝 Troubleshooting

| Issue | Solution |
|-------|----------|
| **"Cannot find Supabase URL"** | Verify env vars in Vercel match `.env.local` exactly |
| **"Authentication failed"** | Run SQL migration in Supabase first (step 1) |
| **"404 on /teachers"** | Log in as OWNER (teacher role auto-redirects) |
| **"Student admission number is null"** | Ensure `supabase/schema.sql` DB function `generate_admission_number` is created |
| **"Vercel build fails"** | Run `npm run build` locally first to catch TypeScript errors |

