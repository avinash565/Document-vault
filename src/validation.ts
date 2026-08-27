import { GraphQLError } from "graphql";

// lowercase letters/digits, words separated by single hyphens: "my-doc-2"
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function badInput(message: string, field: string): never {
  throw new GraphQLError(message, {
    extensions: { code: "BAD_USER_INPUT", field },
  });
}

export function notFound(message: string): never {
  throw new GraphQLError(message, {
    extensions: { code: "NOT_FOUND" },
  });
}

export function assertNonEmpty(value: string, field: string): void {
  if (value.trim().length === 0) {
    badInput(`${field} must not be empty`, field);
  }
}

export function assertValidSlug(slug: string): void {
  assertNonEmpty(slug, "slug");
  if (!SLUG_PATTERN.test(slug)) {
    badInput(
      "slug must be lowercase alphanumeric words separated by single hyphens (e.g. 'quarterly-reports')",
      "slug",
    );
  }
}

export function validateCreateCollectionInput(input: {
  name: string;
  slug: string;
}): void {
  assertNonEmpty(input.name, "name");
  assertValidSlug(input.slug);
}

export function validateCreateDocumentInput(input: {
  title: string;
  content: string;
}): void {
  assertNonEmpty(input.title, "title");
  assertNonEmpty(input.content, "content");
}

export function validateUpdateDocumentInput(input: {
  title?: string | null;
  content?: string | null;
}): void {
  if (input.title !== undefined && input.title !== null) {
    assertNonEmpty(input.title, "title");
  }
  if (input.content !== undefined && input.content !== null) {
    assertNonEmpty(input.content, "content");
  }
}
