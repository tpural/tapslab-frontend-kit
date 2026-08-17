import { describe, expect, it } from "vitest";
import { formatBytes, formatRelative, truncate } from "../src/lib/format";

describe("formatBytes", () => {
  it("formats each magnitude", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1_572_864)).toBe("1.5 MB");
  });

  it("does not run off the end of the unit list", () => {
    expect(formatBytes(1024 ** 6)).toContain("TB");
  });
});

describe("formatRelative", () => {
  const now = new Date("2026-08-16T12:00:00Z");

  it("handles past and future", () => {
    expect(formatRelative("2026-08-13T12:00:00Z", now)).toBe("3 days ago");
    expect(formatRelative("2026-08-16T14:00:00Z", now)).toBe("in 2 hours");
  });

  it("says 'now' rather than '0 seconds ago'", () => {
    expect(formatRelative(now, now)).toBe("now");
  });
});

describe("truncate", () => {
  it("leaves short text alone", () => {
    expect(truncate("short", 20)).toBe("short");
  });

  it("cuts on a word boundary when there is a sensible one", () => {
    expect(truncate("the quick brown fox jumps", 20)).toBe("the quick brown…");
  });

  // A long unbroken token has no boundary worth using; a hard cut is correct.
  it("hard-cuts when the boundary would be too early", () => {
    expect(truncate("aaaaaaaaaaaaaaaaaaaaaa b", 10)).toBe("aaaaaaaaa…");
  });
});
