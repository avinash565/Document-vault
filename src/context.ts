import type { PrismaClient } from "@prisma/client";
import { prisma } from "./db";

// Resolvers depend on this interface, not on `prisma` directly, so unit
// tests can inject a lightweight mock instead of hitting a real database.
export interface GraphQLContext {
  prisma: PrismaClient;
}

export function createContext(): GraphQLContext {
  return { prisma };
}
