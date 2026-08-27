# Document Vault

A GraphQL API for organizing documents into collections. Built with Bun,
TypeScript (strict), GraphQL Yoga (schema-first), Prisma, and PostgreSQL.

## Stack

- **Runtime:** Bun + TypeScript (`strict: true`, no `any`)
- **API layer:** GraphQL Yoga, schema-first (`src/schema.graphql` + resolvers)
- **Database:** PostgreSQL, run via Docker Compose
- **ORM / migrations:** Prisma (`prisma migrate dev` — no hand-written SQL)

## Setup

```bash
cp .env.example .env
docker compose up -d && bun install && bun run gendb && bun run dev
```

That's it — `docker compose up -d` starts Postgres, `bun install` pulls
dependencies, `bun run gendb` generates the Prisma client and applies
migrations (creating them from `prisma/schema.prisma` on first run), and
`bun run dev` starts the server with hot reload at
`http://localhost:4000/graphql`.

> **Note:** `bun run gendb` creates a `prisma/migrations/` folder the
> first time it runs. Commit that folder to the repo — CI (see below)
> runs `prisma migrate deploy`, which applies existing migrations rather
> than generating new ones, so it needs them checked in to work.

## Running tests

```bash
bun test              # everything
bun run test:unit     # resolver logic against a mocked Prisma client
bun run test:integration  # requires the Dockerized Postgres to be up + migrated
```

## Sanity check / CI

```bash
bun run sanity   # lint + typecheck + tests in one command
```

`.github/workflows/ci.yml` runs the same checks (lint, typecheck, unit
tests, integration tests) on every PR into `main`, spinning up a real
Postgres service container so the integration test runs against an
actual database rather than being skipped.

## Running the service itself in Docker

The documented setup (`docker compose up -d && bun run dev`) only
containerizes Postgres — the API runs directly via `bun run dev` for a
fast local dev loop. A standalone `Dockerfile` is also included for
running the API itself in a container, independent of the app's dev
DATABASE_URL:

```bash
docker build -t document-vault .
docker run -p 4000:4000 --env DATABASE_URL=postgresql://vault:vault@host.docker.internal:5432/document_vault document-vault
```

Migrations still need to be applied against the target database
separately (`bun run gendb` or `prisma migrate deploy`) — the image
doesn't run migrations on startup, since doing so implicitly on
container boot is a common source of production incidents (concurrent
containers racing to migrate, or a bad migration silently applying on
every restart).

## API overview

**Queries**
- `collections` — list all collections
- `collection(id)` — a single collection with its nested `documents`
- `documents(collectionId, search, isArchived, take, cursor)` — substring
  search on title/content, optional filters, cursor-based pagination

**Mutations**
- `createCollection(input)`
- `createDocument(input)`
- `updateDocument(id, input)`
- `deleteDocument(id)`
- `moveDocument(id, collectionId)`

### Pagination

`documents` returns a `DocumentConnection` (`edges { cursor, node }`,
`pageInfo { hasNextPage, endCursor }`). Pass the previous page's
`endCursor` as the next `cursor` to keep walking the result set. Results
are ordered by `createdAt desc, id desc` for a stable sort even when
multiple documents share a timestamp. Cursors are opaque base64 strings —
treat them as tokens, not IDs.

### Validation

Empty titles, empty content, and malformed slugs are rejected before
they ever reach the database, as real GraphQL errors
(`extensions.code: "BAD_USER_INPUT"`) rather than unhandled 500s.
Referencing a missing collection or document returns a `NOT_FOUND` error
the same way.

## Design notes

- Resolvers take `ctx.prisma` rather than importing a singleton directly,
  so unit tests can swap in a mock Prisma client without touching a
  database.
- Validation lives in one module (`src/validation.ts`) so the rules are
  defined once and reused by both `create*` and `update*` mutations.
- Field resolvers (`Collection.documents`, `Document.collection`) are
  separate from the root Query/Mutation resolvers to keep the "how do I
  fetch nested data" concern isolated from "how do I handle a top-level
  operation."

## How I'd extend this

- **N+1 queries:** `Collection.documents` and `Document.collection` each
  issue their own query per parent. Fine at this scale, but with larger
  result sets I'd add DataLoader batching per-request.
- **Auth:** there's currently no notion of a user/owner. I'd add a
  `User` model, scope collections/documents to an owner, and enforce it
  in the context/resolvers.
- **Full-text search:** substring `contains` matching is fine for a
  small corpus; for real search-quality matching I'd move to Postgres
  `tsvector`/`tsquery` (or an external search index) once content
  volume grows.
- **Soft delete:** `deleteDocument` is a hard delete. An `archivedAt`-style
  soft delete (distinct from the existing `isArchived` flag, which is a
  user-facing state, not a deletion marker) would make recovery possible.
- **Tag querying:** tags are stored but not yet filterable/searchable in
  `documents` — I'd add a `tags: [String!]` filter arg backed by Postgres
  array containment (`hasSome`/`hasEvery` in Prisma).
