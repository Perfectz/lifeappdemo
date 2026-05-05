import type {
  HealthImportBatch,
  ImportedHealthRecord,
  ImportedHealthRecordSourceType,
  IsoDate,
  IsoDateTime,
  MetricEntry
} from "./types";

export type HealthImportRecordMapping = {
  targetMetric:
    | "steps"
    | "sleepHours"
    | "notes"
    | "workoutSummary"
    | "bloodPressure"
    | "ignored";
  summary: string;
};

export type HealthImportPreviewRow = {
  record: ImportedHealthRecord;
  date: IsoDate;
  displayValue: string;
  mapping: HealthImportRecordMapping;
  duplicate: boolean;
};

export type HealthImportParseResult = {
  batch: HealthImportBatch;
  records: ImportedHealthRecord[];
};

export type HealthImportConfirmResult = {
  entries: MetricEntry[];
  importedCount: number;
  duplicateCount: number;
  ignoredCount: number;
};

type RawRow = Record<string, unknown>;

const csvDelimiter = ",";

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function getValue(row: RawRow, names: string[]): unknown {
  const normalizedNames = names.map(normalizeKey);
  const match = Object.entries(row).find(([key]) => normalizedNames.includes(normalizeKey(key)));
  return match?.[1];
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toIsoDateTime(value: unknown): IsoDateTime | undefined {
  if (typeof value !== "string" && typeof value !== "number") {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function toIsoDate(value: unknown): IsoDate | undefined {
  const dateTime = toIsoDateTime(value);
  return dateTime?.slice(0, 10);
}

function createId(batchId: string, fileName: string, index: number): string {
  return `${batchId}-${fileName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${index}`;
}

function detectSourceType(fileName: string, row: RawRow): ImportedHealthRecordSourceType {
  const haystack = [fileName, ...Object.keys(row)].map(normalizeKey).join(" ");

  if (haystack.includes("blood_pressure") || haystack.includes("systolic")) {
    return "blood_pressure";
  }

  if (haystack.includes("sleep")) {
    return "sleep";
  }

  if (haystack.includes("heart_rate") || haystack.includes("heartrate") || haystack.includes("bpm")) {
    return "heart_rate";
  }

  if (haystack.includes("workout") || haystack.includes("exercise") || haystack.includes("activity")) {
    return "workout";
  }

  if (haystack.includes("step")) {
    return "steps";
  }

  return "unknown";
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let isQuoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && nextCharacter === '"') {
      current += '"';
      index += 1;
    } else if (character === '"') {
      isQuoted = !isQuoted;
    } else if (character === csvDelimiter && !isQuoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }

  cells.push(current.trim());
  return cells;
}

function parseCsv(text: string): RawRow[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  if (lines.length < 2) {
    throw new Error("CSV import needs a header row and at least one data row.");
  }

  const headers = parseCsvLine(lines[0]);

  if (headers.length < 2 || headers.every((header) => !header)) {
    throw new Error("CSV import is missing usable headers.");
  }

  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return headers.reduce<RawRow>((row, header, index) => {
      row[header] = cells[index] ?? "";
      return row;
    }, {});
  });
}

function parseJsonRows(text: string): RawRow[] {
  const parsed: unknown = JSON.parse(text);
  const rows = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object"
      ? Object.values(parsed).find((value) => Array.isArray(value)) ?? [parsed]
      : [];

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("JSON import did not contain any records.");
  }

  return rows.map((row) => (row && typeof row === "object" ? (row as RawRow) : { value: row }));
}

function parseRows(text: string): RawRow[] {
  const trimmed = text.trim();

  if (!trimmed) {
    throw new Error("Import file is empty.");
  }

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return parseJsonRows(trimmed);
  }

  return parseCsv(trimmed);
}

function buildRecord(batchId: string, fileName: string, row: RawRow, index: number): ImportedHealthRecord {
  const sourceType = detectSourceType(fileName, row);
  const startTime = toIsoDateTime(
    getValue(row, ["start_time", "startTime", "start", "date_time", "recorded_at", "time", "date"])
  );
  const endTime = toIsoDateTime(getValue(row, ["end_time", "endTime", "end"]));
  const unit = String(getValue(row, ["unit", "count_type", "type"]) ?? "").trim() || undefined;
  let value = toNumber(getValue(row, ["value", "count", "steps", "step_count", "heart_rate", "bpm"]));

  if (sourceType === "sleep") {
    const hours = toNumber(getValue(row, ["sleep_hours", "hours", "duration_hours"]));
    const minutes = toNumber(getValue(row, ["sleep_minutes", "duration_minutes", "duration"]));
    value = hours ?? (minutes !== undefined ? Math.round((minutes / 60) * 100) / 100 : value);
  }

  return {
    id: createId(batchId, fileName, index),
    batchId,
    sourceType,
    startTime,
    endTime,
    value,
    unit,
    raw: row
  };
}

export function parseHealthImportText(
  fileName: string,
  text: string,
  now: IsoDateTime = new Date().toISOString()
): HealthImportParseResult {
  const batchId = `health-import-${now}`;
  const batch: HealthImportBatch = {
    id: batchId,
    source: "samsung_export",
    fileNames: [fileName],
    status: "previewed",
    recordsParsed: 0,
    recordsImported: 0,
    errors: [],
    createdAt: now
  };

  try {
    const rows = parseRows(text);
    const records = rows.map((row, index) => buildRecord(batchId, fileName, row, index));
    const supportedRecords = records.filter((record) => record.sourceType !== "unknown");

    if (supportedRecords.length === 0) {
      throw new Error("No supported health records were found in this file.");
    }

    return {
      batch: {
        ...batch,
        recordsParsed: records.length,
        errors: records.length === supportedRecords.length ? [] : ["Some rows used unknown record types."]
      },
      records
    };
  } catch (error) {
    return {
      batch: {
        ...batch,
        status: "failed",
        errors: [error instanceof Error ? error.message : "Could not parse import file."]
      },
      records: []
    };
  }
}

function dateForRecord(record: ImportedHealthRecord): IsoDate {
  return (
    toIsoDate(record.startTime) ??
    toIsoDate(record.endTime) ??
    toIsoDate((record.raw as RawRow).date) ??
    new Date().toISOString().slice(0, 10)
  );
}

function rawNumber(record: ImportedHealthRecord, names: string[]): number | undefined {
  return getValue(record.raw as RawRow, names) !== undefined
    ? toNumber(getValue(record.raw as RawRow, names))
    : undefined;
}

export function getRecordMapping(record: ImportedHealthRecord): HealthImportRecordMapping {
  switch (record.sourceType) {
    case "steps":
      return { targetMetric: "steps", summary: "Steps -> MetricEntry.steps" };
    case "sleep":
      return { targetMetric: "sleepHours", summary: "Sleep -> MetricEntry.sleepHours" };
    case "heart_rate":
      return { targetMetric: "notes", summary: "Heart rate summary -> MetricEntry.notes" };
    case "workout":
      return { targetMetric: "workoutSummary", summary: "Workout -> MetricEntry.workoutSummary" };
    case "blood_pressure":
      return { targetMetric: "bloodPressure", summary: "Blood pressure -> MetricEntry blood pressure" };
    default:
      return { targetMetric: "ignored", summary: "Unsupported record type" };
  }
}

function metricSignature(entry: MetricEntry): string {
  return [
    entry.source,
    entry.recordedAt,
    entry.steps ?? "",
    entry.sleepHours ?? "",
    entry.workoutSummary ?? "",
    entry.bloodPressureSystolic ?? "",
    entry.bloodPressureDiastolic ?? "",
    entry.notes ?? ""
  ].join("|");
}

export function metricEntryFromImportedRecord(
  record: ImportedHealthRecord,
  now: IsoDateTime = new Date().toISOString()
): MetricEntry | undefined {
  const date = dateForRecord(record);
  const recordedAt = record.startTime ?? record.endTime ?? `${date}T00:00:00.000Z`;
  const base = {
    id: `metric-${record.id}`,
    date,
    checkInType: "freeform" as const,
    source: "samsung_export" as const,
    recordedAt,
    createdAt: now,
    updatedAt: now
  };

  switch (record.sourceType) {
    case "steps":
      return record.value !== undefined
        ? { ...base, steps: Math.round(record.value), notes: "Imported from Samsung Health export." }
        : undefined;
    case "sleep":
      return record.value !== undefined
        ? { ...base, sleepHours: record.value, notes: "Imported from Samsung Health export." }
        : undefined;
    case "heart_rate":
      return record.value !== undefined
        ? { ...base, notes: `Imported heart rate summary: ${record.value} bpm.` }
        : undefined;
    case "workout": {
      const activity = String(getValue(record.raw as RawRow, ["activity", "workout", "exercise", "type"]) ?? "Workout");
      const duration = rawNumber(record, ["duration_minutes", "duration", "minutes"]);
      const suffix = duration !== undefined ? `, ${duration} minutes` : "";
      return { ...base, workoutSummary: `${activity}${suffix}` };
    }
    case "blood_pressure": {
      const systolic = rawNumber(record, ["systolic", "blood_pressure_systolic", "bp_systolic"]);
      const diastolic = rawNumber(record, ["diastolic", "blood_pressure_diastolic", "bp_diastolic"]);
      return systolic !== undefined && diastolic !== undefined
        ? {
            ...base,
            bloodPressureSystolic: Math.round(systolic),
            bloodPressureDiastolic: Math.round(diastolic),
            notes: "Imported blood pressure reading."
          }
        : undefined;
    }
    default:
      return undefined;
  }
}

export function isDuplicateImportedMetric(entry: MetricEntry, existingEntries: MetricEntry[]): boolean {
  const signature = metricSignature(entry);
  return existingEntries.some((existingEntry) => metricSignature(existingEntry) === signature);
}

export function buildHealthImportPreview(
  records: ImportedHealthRecord[],
  existingEntries: MetricEntry[] = []
): HealthImportPreviewRow[] {
  return records.map((record) => {
    const metricEntry = metricEntryFromImportedRecord(record);
    return {
      record,
      date: dateForRecord(record),
      displayValue: record.value !== undefined ? `${record.value}${record.unit ? ` ${record.unit}` : ""}` : "n/a",
      mapping: getRecordMapping(record),
      duplicate: metricEntry ? isDuplicateImportedMetric(metricEntry, existingEntries) : false
    };
  });
}

export function confirmHealthImport(
  records: ImportedHealthRecord[],
  existingEntries: MetricEntry[] = [],
  now: IsoDateTime = new Date().toISOString()
): HealthImportConfirmResult {
  const importedEntries: MetricEntry[] = [];
  let duplicateCount = 0;
  let ignoredCount = 0;

  for (const record of records) {
    const entry = metricEntryFromImportedRecord(record, now);

    if (!entry) {
      ignoredCount += 1;
      continue;
    }

    if (isDuplicateImportedMetric(entry, [...existingEntries, ...importedEntries])) {
      duplicateCount += 1;
      continue;
    }

    importedEntries.push(entry);
  }

  return {
    entries: [...importedEntries, ...existingEntries],
    importedCount: importedEntries.length,
    duplicateCount,
    ignoredCount
  };
}
