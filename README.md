# Wavelength

Conversational matchmaking monorepo ([system design](./matchmaker-system-design.md)).

## Stack

- **Turborepo** + **Bun** workspaces
- `apps/client` — Next.js UI
- `apps/server` — Express API
- `apps/worker` — BullMQ workers (stub)
- `packages/db` — Drizzle + PostgreSQL
- `packages/llm` — OpenAI client wrapper
- `packages/matching` — reciprocal matching logic (stubs)
- `evals/matchmaking` — benchmarks (placeholder)

## Setup

```bash
cp .env.example .env  # then set BETTER_AUTH_SECRET, e.g. openssl rand -base64 32
bun install
bun run services:up   # Postgres (pgvector) on 5433, Redis on 6380
bun run db:migrate
bun run build
```

After changing the schema in `packages/db/src/schema`:

```bash
bun run db:generate
bun run db:migrate
```

Stop the containers with `bun run services:down` (data is kept in Docker volumes).

## Dev

```bash
bun run dev
```

- Client: http://localhost:3000
- API health: http://localhost:3001/health
- Auth (Better Auth): http://localhost:3001/api/auth/\* — e.g. `POST /api/auth/sign-up/email`, `POST /api/auth/sign-in/email`
- Current user (requires session cookie): http://localhost:3001/me

Filter a single app:

```bash
bunx turbo dev --filter=client
bunx turbo dev --filter=server
```
