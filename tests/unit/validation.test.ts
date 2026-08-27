import { describe, test, expect } from "bun:test";
import {
  assertValidSlug,
  validateCreateCollectionInput,
  validateCreateDocumentInput,
  validateUpdateDocumentInput,
} from "../../src/validation";
import { GraphQLError } from "graphql";

describe("assertValidSlug", () => {
  test("accepts a well-formed slug", () => {
    expect(() => assertValidSlug("quarterly-reports-2024")).not.toThrow();
  });

  test("rejects an empty slug", () => {
    expect(() => assertValidSlug("")).toThrow(GraphQLError);
  });

  test("rejects uppercase characters", () => {
    expect(() => assertValidSlug("Quarterly-Reports")).toThrow(GraphQLError);
  });

  test("rejects spaces", () => {
    expect(() => assertValidSlug("quarterly reports")).toThrow(GraphQLError);
  });

  test("rejects double hyphens", () => {
    expect(() => assertValidSlug("quarterly--reports")).toThrow(GraphQLError);
  });

  test("rejects leading/trailing hyphens", () => {
    expect(() => assertValidSlug("-quarterly-")).toThrow(GraphQLError);
  });
});

describe("validateCreateCollectionInput", () => {
  test("passes for valid input", () => {
    expect(() =>
      validateCreateCollectionInput({ name: "Reports", slug: "reports" }),
    ).not.toThrow();
  });

  test("rejects empty name", () => {
    expect(() =>
      validateCreateCollectionInput({ name: "  ", slug: "reports" }),
    ).toThrow(GraphQLError);
  });
});

describe("validateCreateDocumentInput", () => {
  test("passes for valid input", () => {
    expect(() =>
      validateCreateDocumentInput({ title: "Q1 Report", content: "Numbers went up." }),
    ).not.toThrow();
  });

  test("rejects empty title", () => {
    expect(() =>
      validateCreateDocumentInput({ title: "", content: "Body text" }),
    ).toThrow(GraphQLError);
  });

  test("rejects empty content", () => {
    expect(() =>
      validateCreateDocumentInput({ title: "Title", content: "   " }),
    ).toThrow(GraphQLError);
  });
});

describe("validateUpdateDocumentInput", () => {
  test("allows partial updates with fields omitted", () => {
    expect(() => validateUpdateDocumentInput({})).not.toThrow();
  });

  test("rejects an explicitly empty title", () => {
    expect(() => validateUpdateDocumentInput({ title: "" })).toThrow(GraphQLError);
  });

  test("allows null fields to mean 'not updating this field'", () => {
    expect(() =>
      validateUpdateDocumentInput({ title: null, content: null }),
    ).not.toThrow();
  });
});
