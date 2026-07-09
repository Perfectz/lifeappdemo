import { toLocalIsoDate } from "@/domain/dates";
import type { IsoDate, TaskRecurrence } from "@/domain/types";

/**
 * Natural-language date capture for the quest Quick Add.
 *
 * `parseQuickAdd` scans a free-text quest title for a date phrase
 * ("tomorrow", "friday", "on jul 20", "in 3 days"…) or a recurrence
 * phrase ("every day", "weekly", "every monday"…), strips the phrase
 * from the title, and returns the structured fields ready to merge
 * into a TaskInput.
 *
 * Policy:
 * - Recurrence is parsed first — "every monday" wins over the bare
 *   "monday" inside it.
 * - Among date phrases the LAST occurrence wins, so a title that
 *   happens to start with a weekday word ("Friday retro prep tomorrow")
 *   keeps its title and honors the trailing phrase.
 * - If stripping the phrase would leave an empty title, the parse is
 *   dropped and the raw text is kept as the title.
 */
export type QuickAddParse = {
  title: string;
  dueDate?: IsoDate;
  plannedForDate?: IsoDate;
  recurrence?: TaskRecurrence;
  /** The raw text that was interpreted (and stripped from the title). */
  matchedPhrase?: string;
};

/* ----------------------------------------------------------------------------
 * Local-date helpers (IsoDate in, IsoDate out; device-timezone safe)
 * ------------------------------------------------------------------------- */

function fromIso(date: IsoDate): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date: IsoDate, days: number): IsoDate {
  const local = fromIso(date);
  local.setDate(local.getDate() + days);
  return toLocalIsoDate(local);
}

/** The next occurrence of `weekday` (0=Sun..6=Sat) strictly after `today`. */
function nextWeekday(today: IsoDate, weekday: number): IsoDate {
  const delta = (weekday - fromIso(today).getDay() + 7) % 7 || 7;
  return addDays(today, delta);
}

/**
 * The next occurrence of a month/day (this year if not yet past, else next
 * year). Returns undefined for impossible dates like Feb 30.
 */
function nextMonthDay(today: IsoDate, monthIndex: number, day: number): IsoDate | undefined {
  const startYear = fromIso(today).getFullYear();
  for (const year of [startYear, startYear + 1]) {
    const candidate = new Date(year, monthIndex, day);
    if (candidate.getMonth() !== monthIndex || candidate.getDate() !== day) {
      continue; // rolled over — invalid day for this month/year
    }
    const iso = toLocalIsoDate(candidate);
    if (iso >= today) {
      return iso;
    }
  }
  return undefined;
}

/* ----------------------------------------------------------------------------
 * Phrase grammar
 * ------------------------------------------------------------------------- */

const WEEKDAY_ALTERNATION =
  "sunday|monday|tuesday|wednesday|thursday|friday|saturday|thurs|tues|weds|thur|sun|mon|tue|wed|thu|fri|sat";

const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tues: 2,
  tue: 2,
  wednesday: 3,
  weds: 3,
  wed: 3,
  thursday: 4,
  thurs: 4,
  thur: 4,
  thu: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6
};

const MONTH_ALTERNATION =
  "january|february|march|april|june|july|august|september|october|november|december|sept|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec";

const MONTH_INDEX: Record<string, number> = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sept: 8,
  sep: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11
};

type PhraseFields = Pick<QuickAddParse, "dueDate" | "recurrence">;

type Matcher = {
  source: string;
  build(match: RegExpExecArray, today: IsoDate): PhraseFields | undefined;
};

// Stricter than \b: also refuses hyphen neighbors, so compound words like
// "weekly-digest-generator" or "mid-friday" are never parsed as phrases.
const EDGE_START = String.raw`(?<![\w-])`;
const EDGE_END = String.raw`(?![\w-])`;

const RECURRENCE_MATCHERS: Matcher[] = [
  {
    source: `${EDGE_START}every\\s+weekdays?${EDGE_END}`,
    build: () => ({ recurrence: { frequency: "weekdays" } })
  },
  {
    source: `${EDGE_START}(?:every\\s+day|daily)${EDGE_END}`,
    build: () => ({ recurrence: { frequency: "daily" } })
  },
  {
    source: `${EDGE_START}(?:every\\s+week|weekly)${EDGE_END}`,
    build: () => ({ recurrence: { frequency: "weekly" } })
  },
  {
    source: `${EDGE_START}(?:every\\s+month|monthly)${EDGE_END}`,
    build: () => ({ recurrence: { frequency: "monthly" } })
  },
  {
    source: `${EDGE_START}every\\s+(${WEEKDAY_ALTERNATION})${EDGE_END}`,
    build: (match, today) => ({
      recurrence: { frequency: "weekly" },
      dueDate: nextWeekday(today, WEEKDAY_INDEX[match[1].toLowerCase()])
    })
  }
];

const DATE_MATCHERS: Matcher[] = [
  {
    source: `${EDGE_START}(?:today|tonight)${EDGE_END}`,
    build: (_match, today) => ({ dueDate: today })
  },
  {
    source: `${EDGE_START}(?:tomorrow|tmrw)${EDGE_END}`,
    build: (_match, today) => ({ dueDate: addDays(today, 1) })
  },
  {
    source: `${EDGE_START}next\\s+week${EDGE_END}`,
    build: (_match, today) => ({ dueDate: nextWeekday(today, 1) })
  },
  {
    source: `${EDGE_START}in\\s+(\\d{1,3})\\s+days?${EDGE_END}`,
    build: (match, today) => ({ dueDate: addDays(today, Number(match[1])) })
  },
  {
    source: `${EDGE_START}(?:(?:next|this)\\s+)?(${WEEKDAY_ALTERNATION})${EDGE_END}`,
    build: (match, today) => ({
      dueDate: nextWeekday(today, WEEKDAY_INDEX[match[1].toLowerCase()])
    })
  },
  {
    source: `${EDGE_START}(${MONTH_ALTERNATION})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?${EDGE_END}`,
    build: (match, today) => {
      const dueDate = nextMonthDay(today, MONTH_INDEX[match[1].toLowerCase()], Number(match[2]));
      return dueDate ? { dueDate } : undefined;
    }
  },
  {
    source: `${EDGE_START}(\\d{1,2})/(\\d{1,2})${EDGE_END}`,
    build: (match, today) => {
      const month = Number(match[1]);
      if (month < 1 || month > 12) {
        return undefined;
      }
      const dueDate = nextMonthDay(today, month - 1, Number(match[2]));
      return dueDate ? { dueDate } : undefined;
    }
  }
];

/* ----------------------------------------------------------------------------
 * Matching + stripping
 * ------------------------------------------------------------------------- */

type PhraseMatch = {
  index: number;
  length: number;
  phrase: string;
  fields: PhraseFields;
};

/** The last (right-most) match of `regex` in `input`. */
function lastMatch(regex: RegExp, input: string): RegExpExecArray | undefined {
  let found: RegExpExecArray | undefined;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(input)) !== null) {
    found = match;
    if (match.index === regex.lastIndex) {
      regex.lastIndex += 1; // never loop on a zero-width match
    }
  }
  return found;
}

/**
 * Runs every matcher over the input and keeps the right-most match
 * (ties broken by longest phrase, so "every weekday" beats "every week").
 */
function findBestMatch(input: string, matchers: Matcher[], today: IsoDate): PhraseMatch | undefined {
  let best: PhraseMatch | undefined;
  for (const matcher of matchers) {
    const match = lastMatch(new RegExp(matcher.source, "gi"), input);
    if (!match) {
      continue;
    }
    const fields = matcher.build(match, today);
    if (!fields) {
      continue;
    }
    const candidate: PhraseMatch = {
      index: match.index,
      length: match[0].length,
      phrase: match[0],
      fields
    };
    if (
      !best ||
      candidate.index > best.index ||
      (candidate.index === best.index && candidate.length > best.length)
    ) {
      best = candidate;
    }
  }
  return best;
}

/**
 * Removes the matched span from the title, trims dangling prepositions
 * that pointed at the phrase ("by", "on", "due"), and collapses the
 * leftover whitespace/punctuation.
 */
function stripPhrase(input: string, index: number, length: number): string {
  let prefix = input.slice(0, index);
  const suffix = input.slice(index + length);
  // "pay invoice due by friday" → strip "by", then "due".
  prefix = prefix.replace(/(?:\b(?:on|by|due)\s*)+$/i, "");
  return `${prefix} ${suffix}`
    .replace(/\s+/g, " ")
    .replace(/^[\s,.;:!-]+|[\s,.;:!-]+$/g, "")
    .trim();
}

/* ----------------------------------------------------------------------------
 * Public API
 * ------------------------------------------------------------------------- */

export function parseQuickAdd(input: string, today: IsoDate): QuickAddParse {
  const raw = input.trim();
  if (!raw) {
    return { title: "" };
  }

  // Recurrence first: "every monday" must win over the "monday" inside it.
  const match = findBestMatch(raw, RECURRENCE_MATCHERS, today) ?? findBestMatch(raw, DATE_MATCHERS, today);
  if (!match) {
    return { title: raw };
  }

  const title = stripPhrase(raw, match.index, match.length);
  if (!title) {
    // Stripping would leave nothing to do — keep the raw text, drop the parse.
    return { title: raw };
  }

  const result: QuickAddParse = {
    title,
    ...match.fields,
    matchedPhrase: match.phrase
  };
  if (result.dueDate === today) {
    result.plannedForDate = today;
  }
  return result;
}

/* ----------------------------------------------------------------------------
 * Chip formatting (kept here so the preview and tests share one source)
 * ------------------------------------------------------------------------- */

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec"
];

/** "2026-07-17" → "Fri · Jul 17" for the quick-add preview chip. */
export function formatParsedDate(date: IsoDate): string {
  const local = fromIso(date);
  return `${WEEKDAY_LABELS[local.getDay()]} · ${MONTH_LABELS[local.getMonth()]} ${local.getDate()}`;
}

const RECURRENCE_LABELS: Record<TaskRecurrence["frequency"], string> = {
  daily: "Daily",
  weekdays: "Weekdays",
  weekly: "Weekly",
  monthly: "Monthly"
};

/** { frequency: "weekly" } → "Weekly" for the quick-add preview chip. */
export function formatParsedRecurrence(recurrence: TaskRecurrence): string {
  return RECURRENCE_LABELS[recurrence.frequency];
}
