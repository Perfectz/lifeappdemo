import { describe, expect, it } from "vitest";

import {
  formatParsedDate,
  formatParsedRecurrence,
  parseQuickAdd
} from "@/domain/naturalLanguageQuest";

// 2026-07-09 is a Thursday.
const today = "2026-07-09";

describe("parseQuickAdd — date phrases", () => {
  it("parses 'today' and plans it for today", () => {
    expect(parseQuickAdd("buy milk today", today)).toEqual({
      title: "buy milk",
      dueDate: "2026-07-09",
      plannedForDate: "2026-07-09",
      matchedPhrase: "today"
    });
  });

  it("parses 'tonight' as today", () => {
    expect(parseQuickAdd("wrap gifts tonight", today)).toEqual({
      title: "wrap gifts",
      dueDate: "2026-07-09",
      plannedForDate: "2026-07-09",
      matchedPhrase: "tonight"
    });
  });

  it("parses 'tomorrow' without planning it for today", () => {
    expect(parseQuickAdd("call mom tomorrow", today)).toEqual({
      title: "call mom",
      dueDate: "2026-07-10",
      matchedPhrase: "tomorrow"
    });
  });

  it("parses the 'tmrw' abbreviation", () => {
    expect(parseQuickAdd("call mom tmrw", today)).toEqual({
      title: "call mom",
      dueDate: "2026-07-10",
      matchedPhrase: "tmrw"
    });
  });

  it("is case-insensitive", () => {
    const result = parseQuickAdd("Call Mom TOMORROW", today);
    expect(result.title).toBe("Call Mom");
    expect(result.dueDate).toBe("2026-07-10");
  });

  it("parses a weekday name as its next occurrence", () => {
    expect(parseQuickAdd("submit report friday", today)).toEqual({
      title: "submit report",
      dueDate: "2026-07-10",
      matchedPhrase: "friday"
    });
  });

  it("parses weekday abbreviations", () => {
    expect(parseQuickAdd("submit report fri", today).dueDate).toBe("2026-07-10");
    expect(parseQuickAdd("standup mon", today).dueDate).toBe("2026-07-13");
    expect(parseQuickAdd("dentist tues", today).dueDate).toBe("2026-07-14");
    expect(parseQuickAdd("dentist weds", today).dueDate).toBe("2026-07-15");
    expect(parseQuickAdd("dentist thurs", today).dueDate).toBe("2026-07-16");
  });

  it("never resolves a weekday to today — same weekday means next week", () => {
    // Today is a Thursday.
    expect(parseQuickAdd("gym thursday", today).dueDate).toBe("2026-07-16");
  });

  it("consumes a 'next'/'this' qualifier before a weekday", () => {
    expect(parseQuickAdd("dentist next friday", today)).toEqual({
      title: "dentist",
      dueDate: "2026-07-10",
      matchedPhrase: "next friday"
    });
    expect(parseQuickAdd("dentist this friday", today).title).toBe("dentist");
  });

  it("parses 'next week' as next Monday", () => {
    expect(parseQuickAdd("review notes next week", today)).toEqual({
      title: "review notes",
      dueDate: "2026-07-13",
      matchedPhrase: "next week"
    });
  });

  it("parses 'in N days'", () => {
    expect(parseQuickAdd("renew passport in 3 days", today)).toEqual({
      title: "renew passport",
      dueDate: "2026-07-12",
      matchedPhrase: "in 3 days"
    });
    expect(parseQuickAdd("follow up in 10 days", today).dueDate).toBe("2026-07-19");
    expect(parseQuickAdd("check back in 1 day", today).dueDate).toBe("2026-07-10");
  });

  it("parses month-name dates and strips the 'on' preposition", () => {
    expect(parseQuickAdd("party on jul 20", today)).toEqual({
      title: "party",
      dueDate: "2026-07-20",
      matchedPhrase: "jul 20"
    });
    expect(parseQuickAdd("party july 20", today).dueDate).toBe("2026-07-20");
    expect(parseQuickAdd("party jul 20th", today).dueDate).toBe("2026-07-20");
  });

  it("parses numeric month/day dates", () => {
    expect(parseQuickAdd("party 7/20", today)).toEqual({
      title: "party",
      dueDate: "2026-07-20",
      matchedPhrase: "7/20"
    });
  });

  it("rolls a past calendar date into next year", () => {
    expect(parseQuickAdd("do taxes on apr 15", today).dueDate).toBe("2027-04-15");
    expect(parseQuickAdd("kickoff 1/5", today).dueDate).toBe("2027-01-05");
  });

  it("keeps a still-upcoming calendar date in the current year", () => {
    expect(parseQuickAdd("send cards dec 31", today).dueDate).toBe("2026-12-31");
  });

  it("treats a month/day equal to today as today", () => {
    const result = parseQuickAdd("pay bill jul 9", today);
    expect(result.dueDate).toBe("2026-07-09");
    expect(result.plannedForDate).toBe("2026-07-09");
  });

  it("ignores impossible calendar dates", () => {
    expect(parseQuickAdd("meet feb 30", today)).toEqual({ title: "meet feb 30" });
    expect(parseQuickAdd("score was 24/40", today)).toEqual({ title: "score was 24/40" });
  });
});

describe("parseQuickAdd — recurrence phrases", () => {
  it("parses 'every day' and 'daily'", () => {
    expect(parseQuickAdd("water plants every day", today)).toEqual({
      title: "water plants",
      recurrence: { frequency: "daily" },
      matchedPhrase: "every day"
    });
    expect(parseQuickAdd("journal daily", today)).toEqual({
      title: "journal",
      recurrence: { frequency: "daily" },
      matchedPhrase: "daily"
    });
  });

  it("parses 'every weekday'", () => {
    expect(parseQuickAdd("standup every weekday", today)).toEqual({
      title: "standup",
      recurrence: { frequency: "weekdays" },
      matchedPhrase: "every weekday"
    });
  });

  it("parses 'every week' and 'weekly'", () => {
    expect(parseQuickAdd("plan sprint every week", today).recurrence).toEqual({
      frequency: "weekly"
    });
    expect(parseQuickAdd("review goals weekly", today)).toEqual({
      title: "review goals",
      recurrence: { frequency: "weekly" },
      matchedPhrase: "weekly"
    });
  });

  it("parses 'every month' and 'monthly'", () => {
    expect(parseQuickAdd("pay rent every month", today).recurrence).toEqual({
      frequency: "monthly"
    });
    expect(parseQuickAdd("pay rent monthly", today).recurrence).toEqual({
      frequency: "monthly"
    });
  });

  it("parses 'every <weekday>' as weekly plus the next occurrence as due date", () => {
    expect(parseQuickAdd("team sync every monday", today)).toEqual({
      title: "team sync",
      dueDate: "2026-07-13",
      recurrence: { frequency: "weekly" },
      matchedPhrase: "every monday"
    });
  });

  it("parses 'every <weekday abbreviation>'", () => {
    expect(parseQuickAdd("trash out every weds", today)).toEqual({
      title: "trash out",
      dueDate: "2026-07-15",
      recurrence: { frequency: "weekly" },
      matchedPhrase: "every weds"
    });
  });

  it("prefers 'every monday' over the bare 'monday' inside it", () => {
    const result = parseQuickAdd("clean desk every monday", today);
    expect(result.matchedPhrase).toBe("every monday");
    expect(result.recurrence).toEqual({ frequency: "weekly" });
    expect(result.title).toBe("clean desk");
  });

  it("prefers a recurrence phrase over a separate date phrase", () => {
    // First-parse-wins: recurrence is parsed before dates.
    const result = parseQuickAdd("meditate tomorrow daily", today);
    expect(result.recurrence).toEqual({ frequency: "daily" });
    expect(result.dueDate).toBeUndefined();
    expect(result.matchedPhrase).toBe("daily");
  });
});

describe("parseQuickAdd — matching and stripping rules", () => {
  it("prefers the LAST date phrase so early weekday words are not eaten", () => {
    expect(parseQuickAdd("Friday retro prep tomorrow", today)).toEqual({
      title: "Friday retro prep",
      dueDate: "2026-07-10",
      matchedPhrase: "tomorrow"
    });
  });

  it("prefers the last weekday when several appear", () => {
    expect(parseQuickAdd("monday review notes friday", today)).toEqual({
      title: "monday review notes",
      dueDate: "2026-07-10",
      matchedPhrase: "friday"
    });
  });

  it("strips trailing prepositions pointing at the phrase", () => {
    expect(parseQuickAdd("submit report by friday", today).title).toBe("submit report");
    expect(parseQuickAdd("finish essay due tomorrow", today).title).toBe("finish essay");
    expect(parseQuickAdd("pay invoice due by friday", today).title).toBe("pay invoice");
  });

  it("collapses doubled spaces when the phrase sits mid-title", () => {
    expect(parseQuickAdd("pay rent tomorrow morning", today).title).toBe("pay rent morning");
  });

  it("only matches at word boundaries", () => {
    expect(parseQuickAdd("saturate the colors", today)).toEqual({
      title: "saturate the colors"
    });
    expect(parseQuickAdd("check monitor dashboards", today)).toEqual({
      title: "check monitor dashboards"
    });
    expect(parseQuickAdd("weekly-digest-generator refactor", today).recurrence).toBeUndefined();
  });

  it("keeps the raw title and drops the parse when stripping would empty it", () => {
    expect(parseQuickAdd("tomorrow", today)).toEqual({ title: "tomorrow" });
    expect(parseQuickAdd("every day", today)).toEqual({ title: "every day" });
    expect(parseQuickAdd("by friday", today)).toEqual({ title: "by friday" });
  });

  it("passes through titles with no phrases, trimmed", () => {
    expect(parseQuickAdd("  refactor auth module  ", today)).toEqual({
      title: "refactor auth module"
    });
  });

  it("returns an empty title for blank input", () => {
    expect(parseQuickAdd("   ", today)).toEqual({ title: "" });
  });
});

describe("chip formatting helpers", () => {
  it("formats an IsoDate as 'Fri · Jul 17'", () => {
    expect(formatParsedDate("2026-07-17")).toBe("Fri · Jul 17");
    expect(formatParsedDate("2027-01-05")).toBe("Tue · Jan 5");
  });

  it("formats recurrence labels", () => {
    expect(formatParsedRecurrence({ frequency: "daily" })).toBe("Daily");
    expect(formatParsedRecurrence({ frequency: "weekdays" })).toBe("Weekdays");
    expect(formatParsedRecurrence({ frequency: "weekly" })).toBe("Weekly");
    expect(formatParsedRecurrence({ frequency: "monthly" })).toBe("Monthly");
  });
});
