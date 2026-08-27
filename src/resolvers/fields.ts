import type { GraphQLContext } from "../context";

interface CollectionParent {
  id: string;
  createdAt: Date;
}

interface DocumentParent {
  id: string;
  collectionId: string;
  createdAt: Date;
}

export const Collection = {
  createdAt: (parent: CollectionParent) => parent.createdAt.toISOString(),

  documents: async (parent: CollectionParent, _args: unknown, ctx: GraphQLContext) => {
    return ctx.prisma.document.findMany({
      where: { collectionId: parent.id },
      orderBy: { createdAt: "desc" },
    });
  },
};

export const Document = {
  createdAt: (parent: DocumentParent) => parent.createdAt.toISOString(),

  collection: async (parent: DocumentParent, _args: unknown, ctx: GraphQLContext) => {
    return ctx.prisma.collection.findUniqueOrThrow({
      where: { id: parent.collectionId },
    });
  },
};
