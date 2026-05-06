# School Management System

Production-ready school administration system built with `Next.js` App Router, `TypeScript`, and `Supabase`.

## Features

- Email/password authentication with `OWNER` and `TEACHER` roles
- Student registration with auto-generated admission numbers
- Class management from PG to Grade 9
- Fast student search by name and admission number
- Academic records with term-based marks, totals, and ranking
- Fee ledgers, payment history, balances, and arrears tracking
- Printable report card, fee statement, and class performance views
- Audit logging for marks and fees changes
- Row Level Security for role-based access
- Owner-only teacher account creation and class assignment management

## Stack

- Frontend: `Next.js` App Router + `TypeScript`
- Backend: `Supabase` (`PostgreSQL`, Auth, RLS)
- Styling: clean institutional admin UI with plain CSS
- Deployment: `Vercel`

## Project Structure

```text
src/
  app/
    (dashboard)/
    api/
    reports/
  components/
  lib/
supabase/
  schema.sql
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy the environment template:

```bash
cp .env.example .env.local
```

3. Fill in these values from your Supabase project:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_NAME=School Management System
```

4. Run the SQL in `supabase/schema.sql` inside the Supabase SQL editor.

5. Create users in Supabase Auth and assign roles through `raw_user_meta_data` or update the `profiles` table after signup.

5a. For the first administrator, use the app's initial setup page at `/setup` to create the first `OWNER` account.

6. Start the development server:

```bash
npm run dev
```

## Supabase Notes

- `profiles` stores the application role for each authenticated user.
- `teacher_class_assignments` scopes teacher access to assigned classes.
- `students.admission_number` is generated automatically with a sequence-backed function.
- Indexed search uses:
  - btree index on `admission_number`
  - trigram GIN index on `full_name`
- Database views power dashboard and reporting queries for better frontend simplicity.

## Role Model

- `OWNER`
  - Full access to students, classes, subjects, fees, marks, reports, and audit logs
- `TEACHER`
  - Access limited to assigned classes and their students
  - Can view scoped data and update marks
  - Can record payments only for accessible students

## Reporting

- Printable report card: `/reports/report-card/[studentId]`
- Printable fee statement: `/reports/fees/[studentId]`
- Class performance report: `/reports/class/[classId]`
- Owner-only teacher management: `/teachers`
- JSON report endpoints:
  - `/api/reports/report-card/[studentId]`
  - `/api/reports/fee-statement/[studentId]`

## Deployment

### Vercel

1. Push the repository to GitHub.
2. Import the project into Vercel.
3. Add the same environment variables from `.env.local`.
4. Deploy.

## Important Files

- `src/lib/data.ts`: dashboard, search, fees, merit list, and report queries
- `src/lib/actions.ts`: auth and server actions for create/update flows
- `src/app/(dashboard)/*`: operational school management screens
- `src/app/reports/*`: printable report pages
- `supabase/schema.sql`: schema, views, indexes, triggers, audit logging, and RLS

## Verification

- IDE diagnostics currently report no TypeScript or lint diagnostics in the workspace.
- If dependency installation succeeds in your environment, run:

```bash
npm run typecheck
npm run build
```
