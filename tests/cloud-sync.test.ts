import { describe, expect, it } from "vitest";

import { sameInstant } from "@/client/cloudSync";

describe("cloud sync timestamp comparison", () => {
  it("treats the same instant in different formats as equal", () => {
    // What we store (Date.toISOString) vs what Supabase/PostgREST returns.
    expect(sameInstant("2026-06-21T13:52:58.992Z", "2026-06-21T13:52:58.992+00:00")).toBe(true);
    expect(sameInstant("2026-06-21T13:52:58.992+00:00", "2026-06-21T13:52:58.992Z")).toBe(true);
  });

  it("treats different instants as not equal", () => {
    expect(sameInstant("2026-06-21T13:52:58.992Z", "2026-06-21T13:52:59.100Z")).toBe(false);
  });

  it("returns false for null or unparseable values", () => {
    expect(sameInstant(null, "2026-06-21T13:52:58.992Z")).toBe(false);
    expect(sameInstant("2026-06-21T13:52:58.992Z", null)).toBe(false);
    expect(sameInstant("not-a-date", "also-bad")).toBe(false);
  });
});
