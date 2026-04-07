import { describe, expect, it } from "vitest";

import { findSimilarNames, maskKey, messageOf, pickWindow, sanitizeEmail, truncate } from "./utils.js";

describe("maskKey", () => {
  it("returns (not set) for empty string", () => {
    expect(maskKey("")).toBe("(not set)");
  });

  it("masks keys of 4 chars or fewer entirely", () => {
    expect(maskKey("ab")).toBe("**");
    expect(maskKey("abcd")).toBe("****");
  });

  it("shows first 4 chars then masks the rest", () => {
    expect(maskKey("sk-abcdefgh")).toBe("sk-a*******");
    expect(maskKey("12345")).toBe("1234*");
  });
});

describe("truncate", () => {
  it("returns value unchanged when at or under max", () => {
    expect(truncate("hello", 10)).toBe("hello");
    expect(truncate("hello", 5)).toBe("hello");
  });

  it("truncates and appends ellipsis when over max", () => {
    expect(truncate("hello world", 8)).toBe("hello w...");
  });

  it("handles empty string", () => {
    expect(truncate("", 5)).toBe("");
  });
});

describe("pickWindow", () => {
  it("returns empty rows for empty array", () => {
    expect(pickWindow([], 0)).toEqual({ start: 0, rows: [] });
  });

  it("returns all items when count is under limit", () => {
    const items = [1, 2, 3];
    const result = pickWindow(items, 1);
    expect(result.rows).toEqual([1, 2, 3]);
    expect(result.start).toBe(0);
  });

  it("centers window around selected index", () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    const result = pickWindow(items, 10, 6);
    expect(result.rows).toHaveLength(6);
    expect(result.rows).toContain(10);
  });

  it("clamps to start when selected index is near beginning", () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    const result = pickWindow(items, 0, 6);
    expect(result.start).toBe(0);
    expect(result.rows[0]).toBe(0);
  });

  it("clamps to end when selected index is near end", () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    const result = pickWindow(items, 19, 6);
    expect(result.start).toBe(14);
    expect(result.rows[result.rows.length - 1]).toBe(19);
  });

  it("clamps out-of-bounds selected index", () => {
    const items = [1, 2, 3];
    expect(pickWindow(items, -1).rows).toEqual([1, 2, 3]);
    expect(pickWindow(items, 100).rows).toEqual([1, 2, 3]);
  });
});

describe("sanitizeEmail", () => {
  it("replaces @ with -", () => {
    expect(sanitizeEmail("user@example.com")).toBe("user-example-com");
  });

  it("replaces multiple dots", () => {
    expect(sanitizeEmail("first.last@sub.domain.org")).toBe("first-last-sub-domain-org");
  });

  it("leaves strings without special chars unchanged", () => {
    expect(sanitizeEmail("nodots")).toBe("nodots");
  });
});

describe("messageOf", () => {
  it("extracts message from Error", () => {
    expect(messageOf(new Error("oops"))).toBe("oops");
  });

  it("converts non-Error to string", () => {
    expect(messageOf("raw string")).toBe("raw string");
    expect(messageOf(42)).toBe("42");
  });
});

describe("findSimilarNames", () => {
  it("returns exact match", () => {
    expect(findSimilarNames("openai", ["openai", "azure", "ollama"])).toContain("openai");
  });

  it("returns names within edit distance 3", () => {
    const result = findSimilarNames("openia", ["openai", "azure", "ollama"]);
    expect(result).toContain("openai");
    expect(result).not.toContain("azure");
  });

  it("returns empty array when no names are similar", () => {
    expect(findSimilarNames("xyz", ["alpha", "beta", "gamma"])).toEqual([]);
  });

  it("returns at most 3 suggestions", () => {
    const candidates = ["ab", "ac", "ad", "ae", "af"];
    expect(findSimilarNames("aa", candidates).length).toBeLessThanOrEqual(3);
  });

  it("is case-insensitive", () => {
    expect(findSimilarNames("OPENAI", ["openai"])).toContain("openai");
  });

  it("sorts by edit distance (closest first)", () => {
    const result = findSimilarNames("openai", ["openai", "opnai", "opn"]);
    expect(result[0]).toBe("openai"); // exact match first
  });
});
