# Walkthrough — Document Vault GraphQL API

## What this is

A GraphQL API for organizing documents into collections, built with Bun,
TypeScript (strict), GraphQL Yoga (schema-first), Prisma, and PostgreSQL,
per the assignment spec. Auth, RBAC, federation, caching, and deployment
were left out deliberately — out of scope per the brief.

## How it's structured

- `prisma/schema.prisma` — the two models, `Collection` and `Document`.
  All schema changes go through `prisma migrate dev`; nothing here is
  hand-written SQL.
- `src/schema.graphql` — the GraphQL SDL (schema-first: this file is the
  contract, resolvers implement it separately).
- `src/resolvers/` — split into `query.ts`, `mutation.ts`, and
  `fields.ts` (nested `Collection.documents` / `Document.collection`).
- `src/validation.ts` — centralizes the "reject empty title/content,
  malformed slug" rules so both `create*` and `update*` mutations use
  the same checks instead of duplicating them.
- `src/pagination.ts` — cursor encode/decode and page-size clamping for
  the `documents` query.
- `src/context.ts` / `src/db.ts` — the Prisma client is injected into
  resolvers via `ctx.prisma` rather than imported as a singleton
  directly. This is the one piece of indirection the whole design leans
  on — it's what makes the unit tests possible without a real database.

## Key decisions and tradeoffs

**Cursor-based pagination, not offset/limit.** `documents` returns a
Relay-style connection (`edges { cursor, node }`, `pageInfo`). I sort by
`createdAt desc, id desc` — the `id` tiebreaker matters because sorting
by `createdAt` alone isn't stable when two documents share a timestamp,
which could skip or duplicate a row across pages. To know if there's a
next page without a separate `COUNT` query, I fetch `take + 1` rows and
slice off the extra one.

**Validate before touching the database.** Every mutation runs input
validation first, then (if applicable) checks that referenced entities
exist, then writes. `createDocument` won't call Prisma at all if the
title is empty — it fails fast with a `BAD_USER_INPUT` GraphQL error
rather than letting a bad write happen or crash as a 500.

**Two different error codes for two different failure classes.**
`BAD_USER_INPUT` for malformed input (empty title, bad slug — the
request itself is invalid). `NOT_FOUND` for well-formed input that
points at something that doesn't exist (e.g. moving a document into a
collection id that isn't real). Kept them distinct because a client
should handle these differently — one's a form validation error, the
other means the referenced resource is gone.

**Cascading delete on Collection → Document.** Deleting a collection
deletes its documents. This was a judgment call, not dictated by the
spec — the alternative (`Restrict`, blocking deletion of a non-empty
collection) avoids silent data loss but pushes the "move or delete your
documents first" UX onto the caller. I'd raise this as an open question
in a real product review rather than assume cascade is correct.

**Dependency injection for testability, not for its own sake.**
Resolvers take `ctx.prisma` instead of importing a Prisma singleton
directly. That single decision is why unit tests can mock the database
layer entirely — `tests/unit/mutation.test.ts` builds a fake Prisma
client and asserts things like "`createDocument` never calls `.create()`
if the collection doesn't exist," with no real database involved.

**Two testing layers on purpose.** Unit tests (mocked Prisma) check
resolver *logic* fast and in isolation. The integration test
(`tests/integration/`) runs against the actual Dockerized Postgres and
exercises a full lifecycle — create, search, move, archive, delete —
plus a dedicated test that walks cursor pagination page by page and
asserts no document is seen twice or missed.

## What I'd do differently with more time

- Add DataLoader batching for `Collection.documents` /
  `Document.collection` — currently each nested field issues its own
  Prisma query, which is fine at this scale but would N+1 under load.
- Wrap mutation writes in a try/catch for Prisma's "record not found"
  error (`P2025`) to handle races where a record is deleted between an
  existence check and the subsequent write — right now that surfaces as
  an unhandled error instead of a clean `NOT_FOUND`.
- Add a `tags` filter argument to the `documents` query (tags are
  stored but not yet queryable).
- If soft-delete or recovery mattered, separate "archived" (a
  user-facing state, already modeled) from an actual deletion marker,
  since `deleteDocument` today is a hard delete.

## Verifying it works

```bash
cp .env.example .env
docker compose up -d && bun install && bun run gendb && bun run dev
# in another terminal:
bun run sanity   # lint + typecheck + all tests, including the integration suite
```
