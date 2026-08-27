import { describe, test, expect, mock, beforeEach } from "bun:test";
import { Mutation } from "../../src/resolvers/mutation";
import type { GraphQLContext } from "../../src/context";
import type { PrismaClient } from "@prisma/client";

// Minimal hand-rolled mock of the slice of PrismaClient our resolvers use.
// Cast to PrismaClient at the boundary so resolvers keep their real types.
function createMockPrisma() {
  return {
    collection: {
      create: mock(),
      findUnique: mock(),
    },
    document: {
      create: mock(),
      findUnique: mock(),
      update: mock(),
      delete: mock(),
    },
  };
}

let mockPrisma: ReturnType<typeof createMockPrisma>;
let ctx: GraphQLContext;

beforeEach(() => {
  mockPrisma = createMockPrisma();
  ctx = { prisma: mockPrisma as unknown as PrismaClient };
});

describe("createCollection", () => {
  test("creates a collection with valid input", async () => {
    mockPrisma.collection.create.mockResolvedValue?.({
      id: "c1",
      name: "Reports",
      slug: "reports",
      createdAt: new Date(),
    });

    await Mutation.createCollection(
      null,
      { input: { name: "Reports", slug: "reports" } },
      ctx,
    );

    expect(mockPrisma.collection.create).toHaveBeenCalledTimes(1);
  });

  test("rejects a malformed slug before touching the database", async () => {
    await expect(
      Mutation.createCollection(
        null,
        { input: { name: "Reports", slug: "Not A Slug" } },
        ctx,
      ),
    ).rejects.toThrow();

    expect(mockPrisma.collection.create).not.toHaveBeenCalled();
  });
});

describe("createDocument", () => {
  test("throws NOT_FOUND when the target collection does not exist", async () => {
    mockPrisma.collection.findUnique.mockResolvedValue?.(null);

    await expect(
      Mutation.createDocument(
        null,
        {
          input: {
            title: "Doc",
            content: "Body",
            collectionId: "missing-id",
          },
        },
        ctx,
      ),
    ).rejects.toThrow();

    expect(mockPrisma.document.create).not.toHaveBeenCalled();
  });

  test("rejects empty title before checking the collection", async () => {
    await expect(
      Mutation.createDocument(
        null,
        { input: { title: "", content: "Body", collectionId: "c1" } },
        ctx,
      ),
    ).rejects.toThrow();

    expect(mockPrisma.collection.findUnique).not.toHaveBeenCalled();
  });

  test("creates a document when collection exists and input is valid", async () => {
    mockPrisma.collection.findUnique.mockResolvedValue?.({ id: "c1" });
    mockPrisma.document.create.mockResolvedValue?.({ id: "d1" });

    await Mutation.createDocument(
      null,
      { input: { title: "Doc", content: "Body", collectionId: "c1" } },
      ctx,
    );

    expect(mockPrisma.document.create).toHaveBeenCalledTimes(1);
  });
});

describe("deleteDocument", () => {
  test("throws NOT_FOUND for a missing document", async () => {
    mockPrisma.document.findUnique.mockResolvedValue?.(null);

    await expect(Mutation.deleteDocument(null, { id: "missing" }, ctx)).rejects.toThrow();
    expect(mockPrisma.document.delete).not.toHaveBeenCalled();
  });

  test("deletes an existing document", async () => {
    mockPrisma.document.findUnique.mockResolvedValue?.({ id: "d1" });
    mockPrisma.document.delete.mockResolvedValue?.({ id: "d1" });

    const result = await Mutation.deleteDocument(null, { id: "d1" }, ctx);

    expect(result).toBe(true);
    expect(mockPrisma.document.delete).toHaveBeenCalledTimes(1);
  });
});

describe("moveDocument", () => {
  test("throws NOT_FOUND when target collection is missing", async () => {
    mockPrisma.document.findUnique.mockResolvedValue?.({ id: "d1" });
    mockPrisma.collection.findUnique.mockResolvedValue?.(null);

    await expect(
      Mutation.moveDocument(null, { id: "d1", collectionId: "missing" }, ctx),
    ).rejects.toThrow();

    expect(mockPrisma.document.update).not.toHaveBeenCalled();
  });

  test("moves a document to an existing collection", async () => {
    mockPrisma.document.findUnique.mockResolvedValue?.({ id: "d1" });
    mockPrisma.collection.findUnique.mockResolvedValue?.({ id: "c2" });
    mockPrisma.document.update.mockResolvedValue?.({ id: "d1", collectionId: "c2" });

    await Mutation.moveDocument(null, { id: "d1", collectionId: "c2" }, ctx);

    expect(mockPrisma.document.update).toHaveBeenCalledTimes(1);
  });
});
