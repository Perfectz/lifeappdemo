# V15 — Health Import Alpha

## User outcome
Patrick can import exported Samsung Health/Galaxy Watch-style data files into the app and normalize supported records into MetricEntry data.

## Why this slice exists
Wearable sync is valuable, but direct native integration is a larger project. Manual export/import validates the data pipeline first.

## Scope
Implement health import page and parser foundation.

Supported MVP import concepts:

- Steps.
- Sleep duration.
- Heart rate summary, if available.
- Workout summary.
- Blood pressure, if available.

The parser should be tolerant because exported file names/fields may vary.

## Non-goals
No direct Samsung Health API integration. No Health Connect native bridge. No medical advice. No perfect parser for every export format.

## UI contract
Route: `/health-import`

Required UI:

- Explanation of manual import flow.
- File upload control.
- Dry-run preview before import.
- Field mapping preview.
- Confirm import button.
- Import result summary.
- Error handling for invalid files.

## Data contract

```ts
type HealthImportBatch = {
  id: string;
  source: 'samsung_export' | 'health_connect' | 'demo';
  fileNames: string[];
  status: 'previewed' | 'imported' | 'failed';
  recordsParsed: number;
  recordsImported: number;
  errors: string[];
  createdAt: string;
};

type ImportedHealthRecord = {
  id: string;
  batchId: string;
  sourceType: 'steps' | 'sleep' | 'heart_rate' | 'workout' | 'blood_pressure' | 'unknown';
  startTime?: string;
  endTime?: string;
  value?: number;
  unit?: string;
  raw: unknown;
};
```

Normalized supported records should create or update `MetricEntry` records with `source='samsung_export'`.

## API contract
Can be client-side parser for MVP, but prefer pure parser functions that can later move server-side.

## Acceptance criteria

### AC1: Upload file
Given Patrick opens `/health-import`, when he uploads a supported CSV/JSON-like file, then the app shows a dry-run preview.

### AC2: Preview before import
Given parsed records exist, when the preview is shown, then Patrick can see record type, date, value, and target metric mapping before importing.

### AC3: Confirm import
Given Patrick confirms import, then normalized supported records are stored as MetricEntry records with source `samsung_export`.

### AC4: Invalid file handling
Given Patrick uploads an invalid file, then the app shows a clear error and does not create metric records.

### AC5: Duplicate protection
Given the same import file is uploaded twice, then the app avoids obvious duplicate records or warns before duplicating.

### AC6: Dashboard update
Given imported steps/sleep records exist, when Patrick opens dashboard, then the latest metric snapshot can include imported values.

## Test criteria

### Unit tests
- Parser handles valid steps fixture.
- Parser handles valid sleep fixture.
- Parser handles invalid/missing-header fixture.
- Normalizer maps supported records to MetricEntry.
- Duplicate detection works for same source/time/value.

### Component tests
- Upload preview renders parsed records.
- Confirm import stores records.
- Invalid file shows error.

### E2E tests
- Upload fixture → preview → confirm → metrics page shows imported entries.

### Safety tests
- Imported health data does not trigger diagnosis or medical treatment advice.
- Raw uploaded data is not sent to AI unless user explicitly uses AI context flow.

## Codex prompt

```txt
Implement V15 Health Import Alpha only.

Build /health-import with manual file upload, dry-run preview, parser fixtures, confirmation, and normalization into MetricEntry records with source samsung_export.
Add duplicate detection and invalid-file handling.
Use pure parser functions with unit tests.
Do not implement direct Samsung Health API, Health Connect native bridge, medical advice, or automatic sync.
```

## Review checklist
- Can the parser handle sample files without crashing?
- Is import preview understandable before data is saved?
- Are imported records clearly labeled by source?
