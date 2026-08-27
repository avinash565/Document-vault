import type { GraphQLContext } from "../context";
import { notFound, validateCreateCollectionInput, validateCreateDocumentInput, validateUpdateDocumentInput } from "../validation";

export const Mutation = {
  createCollection: async (
    _parent: unknown,
    args: { input: { name: string; slug: string } },
    ctx: GraphQLContext,
  ) => {
    validateCreateCollectionInput(args.input);
    return ctx.prisma.collection.create({
      data: { name: args.input.name, slug: args.input.slug },
    });
  },

  createDocument: async (
    _parent: unknown,
    args: {
      input: {
        title: string;
        content: string;
        tags?: string[] | null;
        collectionId: string;
      };
    },
    ctx: GraphQLContext,
  ) => {
    validateCreateDocumentInput(args.input);

    const collection = await ctx.prisma.collection.findUnique({
      where: { id: args.input.collectionId },
    });
    if (!collection) {
      notFound(`Collection ${args.input.collectionId} does not exist`);
    }

    return ctx.prisma.document.create({
      data: {
        title: args.input.title,
        content: args.input.content,
        tags: args.input.tags ?? [],
        collectionId: args.input.collectionId,
      },
    });
  },

  updateDocument: async (
    _parent: unknown,
    args: {
      id: string;
      input: {
        title?: string | null;
        content?: string | null;
        tags?: string[] | null;
        isArchived?: boolean | null;
      };
    },
    ctx: GraphQLContext,
  ) => {
    validateUpdateDocumentInput(args.input);

    const existing = await ctx.prisma.document.findUnique({ where: { id: args.id } });
    if (!existing) {
      notFound(`Document ${args.id} does not exist`);
    }

    return ctx.prisma.document.update({
      where: { id: args.id },
      data: {
        ...(args.input.title !== undefined && args.input.title !== null
          ? { title: args.input.title }
          : {}),
        ...(args.input.content !== undefined && args.input.content !== null
          ? { content: args.input.content }
          : {}),
        ...(args.input.tags !== undefined && args.input.tags !== null
          ? { tags: args.input.tags }
          : {}),
        ...(args.input.isArchived !== undefined && args.input.isArchived !== null
          ? { isArchived: args.input.isArchived }
          : {}),
      },
    });
  },

  deleteDocument: async (
    _parent: unknown,
    args: { id: string },
    ctx: GraphQLContext,
  ) => {
    const existing = await ctx.prisma.document.findUnique({ where: { id: args.id } });
    if (!existing) {
      notFound(`Document ${args.id} does not exist`);
    }
    await ctx.prisma.document.delete({ where: { id: args.id } });
    return true;
  },

  moveDocument: async (
    _parent: unknown,
    args: { id: string; collectionId: string },
    ctx: GraphQLContext,
  ) => {
    const [document, targetCollection] = await Promise.all([
      ctx.prisma.document.findUnique({ where: { id: args.id } }),
      ctx.prisma.collection.findUnique({ where: { id: args.collectionId } }),
    ]);

    if (!document) {
      notFound(`Document ${args.id} does not exist`);
    }
    if (!targetCollection) {
      notFound(`Collection ${args.collectionId} does not exist`);
    }

    return ctx.prisma.document.update({
      where: { id: args.id },
      data: { collectionId: args.collectionId },
    });
  },
};
