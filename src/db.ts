import { PrismaClient } from "@prisma/client";

// A single shared PrismaClient instance. Re-used across requests so we
// don't exhaust Postgres connections in dev with hot-reload.
export const prisma = new PrismaClient();

export type Prisma = typeof prisma;
