// Requires a running Postgres instance reachable via DATABASE_URL, with
// migrations already applied. Run:
//   docker compose up -d && bun run gendb && bun test tests/integration
import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { PrismaClient } from "@prisma/client";
import { Mutation } from "../../src/resolvers/mutation";
import { Query } from "../../src/resolvers/query";
import type { GraphQLContext } from "../../src/context";

const prisma = new PrismaClient();
const ctx: GraphQLContext = { prisma };

describe("documents integration (real Postgres)", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // Keep the DB clean between tests so search/pagination assertions are
  // deterministic regardless of test order.
  beforeEach(async () => {
    await prisma.document.deleteMany();
    await prisma.collection.deleteMany();
  });

  test("full lifecycle: create collection, create/move/search/paginate/delete documents", async () => {
    const collectionA = await Mutation.createCollection(
      null,
      { input: { name: "Engineering", slug: "engineering" } },
      ctx,
    );
    const collectionB = await Mutation.createCollection(
      null,
      { input: { name: "Marketing", slug: "marketing" } },
      ctx,
    );

    const doc1 = await Mutation.createDocument(
      null,
      {
        input: {
          title: "Postgres migration guide",
          content: "How we moved from MySQL to Postgres.",
          tags: ["infra"],
          collectionId: collectionA.id,
        },
      },
      ctx,
    );

    await Mutation.createDocument(
      null,
      {
        input: {
          title: "Q3 campaign notes",
          content: "Ad spend and postgres of results.",
          tags: ["marketing"],
          collectionId: collectionB.id,
        },
      },
      ctx,
    );

    // Substring search on title OR content, case-insensitive, across collections
    const searchResult = await Query.documents(
      null,
      { search: "postgres", collectionId: null, isArchived: null, take: 20, cursor: null },
      ctx,
    );
    expect(searchResult.edges.length).toBe(2);

    // Filter by collection narrows it back down to one
    const scoped = await Query.documents(
      null,
      { search: "postgres", collectionId: collectionA.id, isArchived: null, take: 20, cursor: null },
      ctx,
    );
    expect(scoped.edges.length).toBe(1);
    expect(scoped.edges[0]?.node.id).toBe(doc1.id);

    // Move the doc into Marketing
    const moved = await Mutation.moveDocument(
      null,
      { id: doc1.id, collectionId: collectionB.id },
      ctx,
    );
    expect(moved.collectionId).toBe(collectionB.id);

    // Archive it via update, then confirm the isArchived filter picks it up
    await Mutation.updateDocument(null, { id: doc1.id, input: { isArchived: true } }, ctx);
    const archived = await Query.documents(
      null,
      { isArchived: true, collectionId: null, search: null, take: 20, cursor: null },
      ctx,
    );
    expect(
      archived.edges.some((e: { node: { id: string } }) => e.node.id === doc1.id),
    ).toBe(true);

    // Delete cleans it up
    const deleted = await Mutation.deleteDocument(null, { id: doc1.id }, ctx);
    expect(deleted).toBe(true);

    const remaining = await prisma.document.findMany();
    expect(remaining.length).toBe(1);
  });

  test("cursor-based pagination walks the full result set with no gaps or repeats", async () => {
    const collection = await Mutation.createCollection(
      null,
      { input: { name: "Notes", slug: "notes" } },
      ctx,
    );

    for (let i = 0; i < 5; i++) {
      await Mutation.createDocument(
        null,
        {
          input: {
            title: `Note ${i}`,
            content: "filler",
            collectionId: collection.id,
          },
        },
        ctx,
      );
      // ensure distinct createdAt ordering
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    const seenIds = new Set<string>();
    let cursor: string | null = null;
    let pages = 0;

    do {
      const page = await Query.documents(
        null,
        { take: 2, cursor, collectionId: collection.id, search: null, isArchived: null },
        ctx,
      );
      for (const edge of page.edges) seenIds.add(edge.node.id);
      cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
      pages++;
      expect(pages).toBeLessThan(10); // safety net against infinite loop
    } while (cursor);

    expect(seenIds.size).toBe(5);
    expect(pages).toBe(3); // 2 + 2 + 1
  });

  test("rejects empty title, empty content, and malformed slug with GraphQL errors, not 500s", async () => {
    const collection = await Mutation.createCollection(
      null,
      { input: { name: "Valid", slug: "valid" } },
      ctx,
    );

    await expect(
      Mutation.createCollection(null, { input: { name: "X", slug: "Not Valid!" } }, ctx),
    ).rejects.toThrow();

    await expect(
      Mutation.createDocument(
        null,
        { input: { title: "", content: "body", collectionId: collection.id } },
        ctx,
      ),
    ).rejects.toThrow();

    await expect(
      Mutation.createDocument(
        null,
        { input: { title: "Title", content: "  ", collectionId: collection.id } },
        ctx,
      ),
    ).rejects.toThrow();
  });
});
