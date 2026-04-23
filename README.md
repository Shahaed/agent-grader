## Agent Grader

Agent Grader is a rubric-aware written submission grading app built with Next.js, Supabase, and the OpenAI Node SDK.

This README is written for developers working on the codebase. It covers the app structure, how data moves through the system, and how Supabase is configured as the backend.

## What The App Does

The product flow is:

1. A teacher signs in.
2. The teacher creates an assignment by uploading a rubric and optional reading files.
3. The server extracts rubric text, asks OpenAI to normalize the rubric, and generates assignment context files.
4. The app stores assignment metadata in Supabase Postgres and uploaded files in private Supabase Storage.
5. The app builds an OpenAI vector store for assignment context.
6. The teacher uploads student submissions.
7. The server segments each submission by prompt, grades each prompt independently, generates feedback, and stores the grading results in Postgres.

The UI is split between two main workflows:

- `/assignments`: create and maintain assignment definitions
- `/grading`: upload submissions, review grades, and edit feedback

## Stack

- Next.js 16 App Router
- React 19
- Supabase Auth with `@supabase/ssr`
- Supabase Postgres
- Supabase Storage
- OpenAI Node SDK
- OpenAI Responses API with structured outputs
- OpenAI vector stores for assignment-level retrieval

## Project Layout

- [src/app](/Users/shahaedhasan/Documents/PowderLabs/agent-grader/src/app): routes, pages, route handlers, auth flows
- [src/components](/Users/shahaedhasan/Documents/PowderLabs/agent-grader/src/components): dashboards and shared UI
- [src/lib/assignment-service.ts](/Users/shahaedhasan/Documents/PowderLabs/agent-grader/src/lib/assignment-service.ts): assignment creation and context rebuild logic
- [src/lib/grading-service.ts](/Users/shahaedhasan/Documents/PowderLabs/agent-grader/src/lib/grading-service.ts): submission grading and feedback update logic
- [src/lib/storage.ts](/Users/shahaedhasan/Documents/PowderLabs/agent-grader/src/lib/storage.ts): Supabase-backed repository layer
- [src/lib/supabase](/Users/shahaedhasan/Documents/PowderLabs/agent-grader/src/lib/supabase): SSR auth clients and session refresh logic
- [supabase/migrations/20260422183000_supabase_backend.sql](/Users/shahaedhasan/Documents/PowderLabs/agent-grader/supabase/migrations/20260422183000_supabase_backend.sql): schema, RLS, trigger, and storage policies

## Setup

1. Install dependencies.

```bash
npm install
```

2. Copy the environment file.

```bash
cp .env.example .env.local
```

3. Fill in the required variables.

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
OPENAI_API_KEY=your_openai_key
```

Optional model overrides:

```bash
OPENAI_RUBRIC_MODEL=gpt-5.4-mini
OPENAI_SEGMENTATION_MODEL=gpt-5.4-mini
OPENAI_GRADING_MODEL=gpt-5.4
OPENAI_FEEDBACK_MODEL=gpt-5.4-mini
OPENAI_CALIBRATION_MODEL=gpt-5.4-mini
```

Optional development setting:

```bash
ALLOWED_DEV_ORIGINS=192.168.1.21,192.168.64.1
```

4. Apply the migration in [supabase/migrations/20260422183000_supabase_backend.sql](/Users/shahaedhasan/Documents/PowderLabs/agent-grader/supabase/migrations/20260422183000_supabase_backend.sql) to the Supabase project this app points to.

5. Start the dev server.

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Supabase Backend

Supabase is the system of record for authentication, relational data, and uploaded files.

### Auth

The app uses Supabase Auth with SSR cookies.

- Server client: [src/lib/supabase/server.ts](/Users/shahaedhasan/Documents/PowderLabs/agent-grader/src/lib/supabase/server.ts)
- Browser client: [src/lib/supabase/client.ts](/Users/shahaedhasan/Documents/PowderLabs/agent-grader/src/lib/supabase/client.ts)
- Proxy refresh logic: [src/lib/supabase/proxy.ts](/Users/shahaedhasan/Documents/PowderLabs/agent-grader/src/lib/supabase/proxy.ts)
- Next.js proxy entrypoint: [src/proxy.ts](/Users/shahaedhasan/Documents/PowderLabs/agent-grader/src/proxy.ts)

Important behavior:

- Protected pages call `supabase.auth.getUser()` through `getSessionUser()`
- The proxy refreshes auth cookies on incoming requests
- Unauthenticated users are redirected to `/login`
- Public self-service signup is disabled in the app
- New accounts should be created by an admin in Supabase Dashboard or via the admin API

Auth routes:

- `/login`
- `/forgot-password`
- `/reset-password`
- `/auth/confirm`
- `/auth/signout`

### Database Tables

The migration creates four application tables in `public`:

- `profiles`: one row per Supabase Auth user
- `assignments`: assignment metadata, rubric text, normalized rubric JSON, vector store id
- `assignment_assets`: uploaded files and generated context files
- `grading_results`: grading outputs and feedback

The `profiles` table is populated automatically by a database trigger:

- `private.handle_new_user()`
- `on_auth_user_created` on `auth.users`

That means when a user is created in Supabase Auth, a matching profile row is upserted automatically.

### Storage

The migration also creates a private bucket:

- `assignment-files`

Files are stored under a user-scoped path pattern:

```text
{auth.uid()}/{assignmentId}/{assetType}/{timestamp-safeName}
```

This is enforced in the app by [src/lib/storage.ts](/Users/shahaedhasan/Documents/PowderLabs/agent-grader/src/lib/storage.ts), and enforced in Supabase by storage policies on `storage.objects`.

### Row Level Security

RLS is enabled on all public tables.

The access model is simple:

- users can only read and write rows where `user_id = auth.uid()`
- profiles can only be accessed where `id = auth.uid()`
- storage objects can only be accessed inside the authenticated user’s own first path segment

This app does not use a shared workspace or org model. Isolation is per teacher account.

## Required Supabase Dashboard Settings

The codebase assumes the following are configured in the Supabase project:

- Email provider enabled if you want password-based login and password reset
- Site URL set to your app URL
- Redirect URLs include your local and deployed app URLs
- Email templates for auth flows point back to `/auth/confirm` when using token hash links

Notes:

- Password reset already uses `/auth/confirm?next=/reset-password` in [src/app/forgot-password/actions.ts](/Users/shahaedhasan/Documents/PowderLabs/agent-grader/src/app/forgot-password/actions.ts)
- The confirm handler exchanges `token_hash` for a session in [src/app/auth/confirm/route.ts](/Users/shahaedhasan/Documents/PowderLabs/agent-grader/src/app/auth/confirm/route.ts)
- Since signup is disabled in the UI, developer/admin onboarding should happen outside the public app

## How Data Flows Through The App

### 1. Assignment creation

The `POST /api/assignments` route in [src/app/api/assignments/route.ts](/Users/shahaedhasan/Documents/PowderLabs/agent-grader/src/app/api/assignments/route.ts) calls `createAssignmentFromFormData()` in [src/lib/assignment-service.ts](/Users/shahaedhasan/Documents/PowderLabs/agent-grader/src/lib/assignment-service.ts).

That service:

- requires an authenticated Supabase user
- uploads the rubric file to Supabase Storage
- extracts rubric text
- asks OpenAI to infer the prompt set and normalized rubric
- uploads optional reading files to Supabase Storage
- generates prompt and anchor text assets
- creates an OpenAI vector store and uploads prompt, anchor, and reading files into it
- saves assignment metadata and asset metadata to Postgres

Generated assets are also persisted as `assignment_assets`, not just kept in memory.

### 2. Assignment updates

When prompts or rubric JSON are edited, `updateAssignmentConfig()`:

- reloads the assignment from Postgres
- updates prompt/rubric JSON
- rebuilds the vector store
- updates the assignment row and related asset metadata

### 3. Submission grading

The submissions route calls `gradeSubmissionBatch()` in [src/lib/grading-service.ts](/Users/shahaedhasan/Documents/PowderLabs/agent-grader/src/lib/grading-service.ts).

For each uploaded submission, the service:

- uploads the submission file to Supabase Storage as a `submission` asset
- extracts plain text from the file
- segments the submission by prompt with OpenAI
- grades each prompt independently against the rubric
- uses OpenAI file search against the assignment vector store
- aggregates prompt results into an overall result
- generates teacher-facing and student-facing feedback
- saves the result row in `grading_results`

### 4. Feedback edits

Feedback edits do not rewrite files. `updateResultFeedback()` loads the result from Postgres, updates the JSON payload, and upserts the row again.

## Storage Layer Contract

[src/lib/storage.ts](/Users/shahaedhasan/Documents/PowderLabs/agent-grader/src/lib/storage.ts) is the boundary between the rest of the app and Supabase.

High-level functions used by the app:

- `listAssignmentBundles()`
- `loadAssignmentBundle()`
- `loadAssignment()`
- `saveAssignment()`
- `saveResult()`
- `loadResults()`

File helpers:

- `uploadStoredAsset()`
- `downloadStoredAsset()`
- `deleteStoredAsset()`

This file is the right place to extend if you need to change persistence behavior without rewriting the higher-level services.

## OpenAI Integration

The app uses different model calls for different stages:

- rubric analysis and normalization
- submission segmentation
- prompt-level grading
- feedback writing

Model names are centralized in [src/lib/openai.ts](/Users/shahaedhasan/Documents/PowderLabs/agent-grader/src/lib/openai.ts), with defaults controlled by environment variables.

OpenAI vector stores are used only for assignment context retrieval. Supabase remains the source of truth for app data.

## API Surface

Main authenticated API routes:

- `GET /api/assignments`
- `POST /api/assignments`
- `GET /api/assignments/[assignmentId]`
- `PATCH /api/assignments/[assignmentId]`
- `POST /api/assignments/[assignmentId]/submissions`
- `PATCH /api/assignments/[assignmentId]/results/[submissionId]`

These route handlers call `getSessionUser()` first and return `401` when the request is unauthenticated.

## Supported Upload Formats

- Rubrics: `.pdf`, `.docx`, `.txt`, `.md`, `.csv`, `.json`
- Readings and source packets: `.pdf`, `.docx`, `.txt`, `.md`, `.csv`, `.json`
- Student submissions: `.pdf`, `.docx`, `.txt`, `.md`

## Developer Notes

- The app is intentionally server-heavy. File processing, OpenAI calls, and persistence all happen on the server.
- The browser mostly orchestrates uploads and renders assignment or grading state returned by the API.
- The repo currently contains only the SQL migration under `supabase/`. There is no checked-in local Supabase config in this workspace.
- If you create users manually in Supabase Dashboard, the database trigger should create matching `profiles` rows automatically.

## Verification

```bash
npm run lint
npm run build
```

## Common Failure Modes

- Missing `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: the server client and proxy will throw immediately.
- Missing `OPENAI_API_KEY`: the dashboards load, but AI-backed assignment creation and grading cannot run.
- Auth session problems: check `src/proxy.ts` and `src/lib/supabase/proxy.ts` first.
- Password reset or email confirmation links failing: verify Supabase Site URL, redirect URLs, and auth email template links.
- RLS or storage permission errors: verify the migration was applied to the same Supabase project your env vars point to.
