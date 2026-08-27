import { badInput } from "./validation";

// Opaque cursor = base64("document:<id>"). We paginate ordered by
// (createdAt desc, id desc), and Prisma's cursor pagination just needs
// the id of the last-seen row plus a `skip: 1` to exclude it.
const CURSOR_PREFIX = "document:";

export function encodeCursor(id: string): string {
  return Buffer.from(`${CURSOR_PREFIX}${id}`, "utf8").toString("base64");
}

export function decodeCursor(cursor: string): string {
  let decoded: string;
  try {
    decoded = Buffer.from(cursor, "base64").toString("utf8");
  } catch {
    return badInput("cursor is malformed", "cursor");
  }
  if (!decoded.startsWith(CURSOR_PREFIX)) {
    return badInput("cursor is malformed", "cursor");
  }
  return decoded.slice(CURSOR_PREFIX.length);
}

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export function clampTake(take: number | null | undefined): number {
  if (take === null || take === undefined) return DEFAULT_PAGE_SIZE;
  if (take <= 0) return badInput("take must be a positive integer", "take");
  return Math.min(take, MAX_PAGE_SIZE);
}
