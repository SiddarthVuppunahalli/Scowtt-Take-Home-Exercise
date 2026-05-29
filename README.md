# Movie Memory

Movie Memory is a small full-stack application for saving a user's favorite movie and showing a generated fun fact about it. I built it as a backend-focused take-home: the UI is intentionally simple, while most of the effort is in authentication, data modeling, caching, locking, and failure handling.

This submission uses the required stack:

- TypeScript
- Next.js App Router
- React
- TailwindCSS
- Postgres
- Prisma
- Google OAuth via Auth.js
- OpenAI API

Chosen variant: **Variant A - Backend-Focused caching and correctness**.

I chose Variant A because the most interesting part of this app is not generating a fact once. It is deciding when not to call OpenAI, making sure facts are scoped to the right user, and handling the awkward cases like refresh bursts, stale data, and provider failures.

## Setup

Install dependencies:

```powershell
npm install
```

Set up the `.env` file. See the environment variables section below.

Start Postgres:

```powershell
docker compose up -d db
```

Apply migrations:

```powershell
npx prisma migrate deploy
```

Generate Prisma Client:

```powershell
npm run prisma:generate
```

Run the app:

```powershell
npm run dev
```

Open:

```txt
http://localhost:3000
```

## Environment Variables

Create `.env` from `.env.example`.

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/movie_memory?schema=public"
AUTH_SECRET="replace-with-a-generated-auth-secret"
AUTH_GOOGLE_ID="replace-with-google-oauth-client-id"
AUTH_GOOGLE_SECRET="replace-with-google-oauth-client-secret"
OPENAI_API_KEY="replace-with-openai-api-key"
OPENAI_MODEL="gpt-4.1-mini"
```

Google OAuth callback URL for local development:

```txt
http://localhost:3000/api/auth/callback/google
```

Notes:

- `DATABASE_URL` is required for Prisma, Auth.js sessions, onboarding, facts, cache, and locks.
- `AUTH_SECRET`, `AUTH_GOOGLE_ID`, and `AUTH_GOOGLE_SECRET` are required for Google login.
- `OPENAI_API_KEY` is required for new fact generation.
- `OPENAI_MODEL` is optional; the code defaults to `gpt-4.1-mini`.
- The local Postgres container maps host port `5433` to container port `5432` to avoid conflicts with other local Postgres instances.

## Scripts

```powershell
npm run dev              # Start Next.js dev server
npm run db:migrate       # Create/apply Prisma dev migrations
npm run prisma:generate  # Generate Prisma Client
npm test                 # Run backend tests
npm run lint             # Run ESLint
npm run build            # Build production app
```

## Architecture Overview

Authentication is handled with Auth.js and Google OAuth. Auth.js stores authentication data in Postgres through the Prisma adapter using the standard `User`, `Account`, `Session`, and `VerificationToken` models.

Application-specific data is kept separate from authentication data:

- `MoviePreference` stores the current favorite movie for a user.
- `MovieFact` stores generated facts over time.
- `FactGenerationLock` stores database-backed generation locks for burst protection.

The main backend flow is:

```mermaid
flowchart TD
  Browser[Browser and React UI]
  Home[Home page]
  Auth[Auth.js and Google OAuth]
  Session[Server session]
  Onboarding[Onboarding server action]
  Dashboard[Dashboard server component]
  FactService[Fact service]
  OpenAI[OpenAI Responses API]

  subgraph Database
    AuthTables[Auth tables]
    Preference[MoviePreference]
    Facts[MovieFact]
    Locks[FactGenerationLock]
  end

  Browser --> Home
  Home --> Auth
  Auth --> AuthTables
  Auth --> Session
  Session -->|No movie saved| Onboarding
  Session -->|Movie exists| Dashboard
  Onboarding -->|Validate and normalize| Preference
  Onboarding --> Dashboard
  Dashboard --> Preference
  Dashboard --> FactService
  FactService -->|Fresh within 60 seconds| Facts
  FactService -->|Stale or missing| Locks
  Locks -->|Lock acquired| OpenAI
  OpenAI -->|Generated fact| Facts
  OpenAI -->|Timeout or error| Facts
  Facts -->|Cache generated or fallback| Dashboard
  Dashboard --> Browser
```

The app never trusts a client-provided `userId`. Server code always derives the current user from `auth()` and uses `session.user.id`. That is the main boundary I wanted to preserve throughout the implementation.

Important files:

- `src/auth.ts` configures Auth.js, Google OAuth, the Prisma adapter, and database sessions.
- `src/lib/prisma.ts` creates the shared Prisma client.
- `src/app/onboarding/actions.ts` validates and stores favorite movies server-side.
- `src/lib/facts/getFactForUser.ts` contains the core Variant A fact-generation logic.
- `src/lib/facts/factLock.ts` contains the database-backed generation lock.
- `src/lib/openai/generateMovieFact.ts` wraps OpenAI fact generation.

## Data Model

`MoviePreference` stores the movie in two forms:

- `displayTitle`, for example `The Matrix`
- `movieKey`, for example `the matrix`

The display title is for the UI. The normalized key is for cache and lock identity. This avoids treating `The Matrix`, ` the matrix `, and `THE MATRIX` as separate backend cache entries.

Each user has at most one current `MoviePreference`, enforced by:

```prisma
userId String @unique
```

Facts and locks are scoped by `userId + movieKey` because they belong to a specific user's fact-generation history for a specific movie. This matters even though the current UI only allows one favorite movie. Facts are historical, and the lock should protect the operation "generate a fact for this user and this movie," not just "generate anything for this user."

## Variant A: Caching And Correctness

### 60-second cache window

`getFactForUser()` first fetches the newest `MovieFact` for the authenticated `userId` and normalized `movieKey`.

If the newest fact is less than 60 seconds old, it returns that fact with:

```ts
source: "cache"
```

The cache window is fixed from `MovieFact.createdAt`. Refreshing the page within 60 seconds does not restart the timer.

### Database-backed burst protection

If the cached fact is missing or stale, the service tries to acquire a row in `FactGenerationLock`.

The lock is scoped by:

```txt
userId + movieKey
```

Each lock has:

- `ownerId`, a UUID for the request that owns the lock
- `lockedUntil`, so crashed requests do not block generation forever

I chose this DB-backed lock over an in-memory lock because refresh bursts can come from multiple tabs, and a real deployment may have more than one server instance. An in-memory lock would be simpler, but it would only protect one process. I also chose it over holding a long database transaction open, because OpenAI is an external network call and I did not want to keep database resources tied up while waiting for it.

The OpenAI call is therefore not made inside a long database transaction. The service only uses short database writes to acquire and release the lock.

If another request already owns the lock, the losing request waits briefly and checks for a fact newer than the stale fact it already knew about. This prevents the losing request from mistaking an old fact for the fact generated by the current lock owner. If no newer fact appears but an older fact exists, the service returns that older fact as a fallback instead of failing the request.

### Failure handling

OpenAI requests have a 10-second timeout.

If generation fails:

- If any previous fact exists, the service returns the latest saved fact with `source: "fallback"`.
- If no saved fact exists, the service throws `MovieFactUnavailableError`, and the dashboard shows a user-friendly error.

This keeps the dashboard usable when OpenAI is unavailable without pretending that fresh generation succeeded.

## Security And Correctness

- Movie input is validated server-side in a server action.
- The server trims input, collapses whitespace, and enforces a 2 to 120 character length.
- Users cannot fetch another user's facts because fact lookup is scoped by the authenticated `userId`.
- Secrets stay server-side in environment variables.
- Missing Google photos are handled with a fallback initial.
- Google profile images from `lh3.googleusercontent.com` are allowed in `next.config.ts`.
- OpenAI failures are caught and converted into fallback behavior or friendly UI errors.

## Tests

Start Postgres before running tests:

```powershell
docker compose up -d db
```

Run tests:

```powershell
npm test
```

Current backend tests cover:

- Fresh fact under 60 seconds returns from cache.
- The OpenAI generator is not called on a fresh cache hit.
- One user cannot receive another user's fact for the same movie key.
- Simultaneous requests for the same user/movie only generate one fact.
- A losing lock request returns the stale fallback fact if no newer fact appears.
- OpenAI failure returns a stale fallback fact when one exists.
- OpenAI failure with no saved fact throws a friendly domain error.

These tests run against the configured local Postgres database and clean up their own test rows using a unique test-run id.

## Key Tradeoffs

I used a database-backed lock instead of an in-memory lock. This is more code, but it works across refreshes, multiple browser tabs, and multiple server instances. It also aligns with the backend-focused correctness goal. A unique constraint per 60-second window was another possible approach, but I preferred a lock because it makes the "generation in progress" state explicit and lets the waiting request reuse the newly generated fact instead of discovering a constraint violation after the fact.

I store both `displayTitle` and `movieKey`. This is slightly redundant, but it makes the cache/lock identity explicit and avoids subtle bugs from inconsistent normalization. It also keeps the code easier to extend if users can edit their favorite movie later.

The cache is a fixed 60-second TTL from fact creation time, not a sliding window. That matches the exercise's wording: "most recent fact ... is less than 60 seconds old."

Tests currently use the local database from `DATABASE_URL`. They clean up only their own rows, so it will not interfere with real data, but a separate test database would be safer in a larger project.

The UI is intentionally minimal. I polished the layout enough to make the app pleasant to review, but I avoided spending time on visual complexity because the chosen variant is evaluated mainly on backend correctness.

## What I Would Improve With Two More Hours

- Add a dedicated `TEST_DATABASE_URL` and run tests against a separate test database or schema.
- Add a small environment validation module so missing auth/database variables fail with clearer startup messages.
- Add an inline "change favorite movie" flow and invalidate any currently displayed fact when the movie changes.
- Add an API route around fact generation if the UI later needs manual refresh, loading states, or richer client-side behavior.
- Add more explicit observability around lock acquisition, OpenAI failures, cache hits, and fallback hits.

## AI Usage

- Used AI assistance to sanity-check the implementation plan and identify edge cases.
- Used AI assistance while reasoning through Variant A tradeoffs, especially cache scoping, lock behavior, and fallback handling.
- Used AI assistance to review and refine code, then verified behavior with linting, production build, Prisma validation, and backend tests.
- Used official documentation for current Next.js/Auth.js/Prisma/OpenAI API patterns where version-specific behavior mattered.
