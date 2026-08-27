import type { Document as DocumentRow } from "@prisma/client";
import type { GraphQLContext } from "../context";
import { clampTake, decodeCursor, encodeCursor } from "../pagination";

export const Query = {
  collections: async (_parent: unknown, _args: unknown, ctx: GraphQLContext) => {
    return ctx.prisma.collection.findMany({
      orderBy: { createdAt: "desc" },
    });
  },

  collection: async (
    _parent: unknown,
    args: { id: string },
    ctx: GraphQLContext,
  ) => {
    return ctx.prisma.collection.findUnique({
      where: { id: args.id },
    });
  },

  documents: async (
    _parent: unknown,
    args: {
      collectionId?: string | null;
      search?: string | null;
      isArchived?: boolean | null;
      take?: number | null;
      cursor?: string | null;
    },
    ctx: GraphQLContext,
  ) => {
    const take = clampTake(args.take);

    const where: Record<string, unknown> = {};
    if (args.collectionId) where.collectionId = args.collectionId;
    if (typeof args.isArchived === "boolean") where.isArchived = args.isArchived;
    if (args.search && args.search.trim().length > 0) {
      where.OR = [
        { title: { contains: args.search, mode: "insensitive" } },
        { content: { contains: args.search, mode: "insensitive" } },
      ];
    }

    const cursorId = args.cursor ? decodeCursor(args.cursor) : undefined;

    // Fetch one extra row to know whether another page exists.
    const rows = await ctx.prisma.document.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: take + 1,
      ...(cursorId
        ? { cursor: { id: cursorId }, skip: 1 }
        : {}),
    });

    const hasNextPage = rows.length > take;
    const page = hasNextPage ? rows.slice(0, take) : rows;

    const edges = page.map((doc: DocumentRow) => ({
      cursor: encodeCursor(doc.id),
      node: doc,
    }));

    return {
      edges,
      pageInfo: {
        hasNextPage,
        endCursor: edges.length > 0 ? edges[edges.length - 1]!.cursor : null,
      },
    };
  },
};
