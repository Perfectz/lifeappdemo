"use client";

import { type ChangeEvent, useEffect, useMemo, useState } from "react";

import { CharacterSprite } from "@/components/CharacterSprite";
import { SectionHeader } from "@/components/SectionHeader";
import { createLocalMetricRepository } from "@/data/metricRepository";
import type { HealthImportBatch, ImportedHealthRecord, MetricEntry } from "@/domain";
import {
  buildHealthImportPreview,
  confirmHealthImport,
  parseHealthImportText
} from "@/domain/healthImport";

const healthImportBoundaryCopy =
  "Imported health data is sensitive. LifeQuest labels imported records by source and does not provide medical diagnosis or treatment advice.";

async function readFileAsText(file: File): Promise<string> {
  return file.text();
}

export function HealthImport() {
  const [metricEntries, setMetricEntries] = useState<MetricEntry[]>([]);
  const [batch, setBatch] = useState<HealthImportBatch | null>(null);
  const [records, setRecords] = useState<ImportedHealthRecord[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const previewRows = useMemo(
    () => buildHealthImportPreview(records, metricEntries),
    [metricEntries, records]
  );
  const importableCount = previewRows.filter(
    (row) => row.mapping.targetMetric !== "ignored" && !row.duplicate
  ).length;

  useEffect(() => {
    setMetricEntries(createLocalMetricRepository(window.localStorage).load());
    setHasLoaded(true);
  }, []);

  useEffect(() => {
    if (!hasLoaded) {
      return;
    }

    createLocalMetricRepository(window.localStorage).save(metricEntries);
  }, [hasLoaded, metricEntries]);

  async function parseFile(file: File) {
    setIsParsing(true);
    setMessage(null);
    setError(null);

    try {
      const text = await readFileAsText(file);
      const result = parseHealthImportText(file.name, text);

      setBatch(result.batch);
      setRecords(result.records);

      if (result.batch.status === "failed") {
        setError(result.batch.errors.join(" "));
      } else {
        setMessage(`Dry-run preview ready: ${result.batch.recordsParsed} record(s) parsed.`);
      }
    } catch {
      setBatch(null);
      setRecords([]);
      setError("Could not read that file. Choose a CSV or JSON export and try again.");
    } finally {
      setIsParsing(false);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    void parseFile(file);
  }

  function handleConfirmImport() {
    if (!batch || records.length === 0) {
      return;
    }

    const result = confirmHealthImport(records, metricEntries);
    createLocalMetricRepository(window.localStorage).save(result.entries);
    setMetricEntries(result.entries);
    setBatch({
      ...batch,
      status: "imported",
      recordsImported: result.importedCount,
      errors:
        result.duplicateCount > 0
          ? [`Skipped ${result.duplicateCount} likely duplicate record(s).`]
          : []
    });
    setMessage(
      `Import complete: ${result.importedCount} metric entr${result.importedCount === 1 ? "y" : "ies"} saved.`
    );
    setError(null);
  }

  return (
    <section className="health-import-page" aria-labelledby="health-import-title">
      <header className="metrics-hero">
        <div>
          <p className="eyebrow">Health Import Alpha</p>
          <h1 id="health-import-title">Health Import</h1>
          <p>
            Import exported Samsung Health or Galaxy Watch-style CSV/JSON files,
            preview the mapping, then confirm before saving metrics.
          </p>
        </div>
        <div className="page-sprite-frame metrics-sprite" aria-hidden="true">
          <CharacterSprite className="page-sprite" pose="idleSide" />
        </div>
      </header>

      <p className="health-boundary">{healthImportBoundaryCopy}</p>

      {message ? (
        <p className="standup-success" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="health-import-layout">
        <section className="dashboard-section" aria-label="Health import upload">
          <SectionHeader eyebrow="Step 1" title="Upload Export File" />
          <p className="standup-helper">
            Choose one CSV or JSON-like export. Supported alpha mappings include
            steps, sleep duration, heart rate summary, workout summary, and blood pressure.
          </p>
          <label className="health-import-upload">
            <span>Health export file</span>
            <input
              accept=".csv,.json,.txt"
              aria-label="Health export file"
              disabled={isParsing}
              onChange={handleFileChange}
              type="file"
            />
          </label>
          {batch ? (
            <dl className="health-import-summary">
              <div>
                <dt>Source</dt>
                <dd>{batch.source}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{batch.status}</dd>
              </div>
              <div>
                <dt>Records parsed</dt>
                <dd>{batch.recordsParsed}</dd>
              </div>
              <div>
                <dt>Ready to import</dt>
                <dd>{importableCount}</dd>
              </div>
            </dl>
          ) : null}
        </section>

        <section className="dashboard-section" aria-label="Health import preview">
          <SectionHeader eyebrow="Step 2" title="Dry-Run Preview" />
          {previewRows.length === 0 ? (
            <p className="quest-empty">Upload a file to preview health records before import.</p>
          ) : (
            <div className="health-import-preview-list">
              {previewRows.map((row) => (
                <article className="health-import-preview-card" key={row.record.id}>
                  <div>
                    <h3>{row.record.sourceType.replaceAll("_", " ")}</h3>
                    <p>
                      {row.date} - {row.displayValue}
                    </p>
                  </div>
                  <dl>
                    <div>
                      <dt>Target</dt>
                      <dd>{row.mapping.summary}</dd>
                    </div>
                    <div>
                      <dt>Duplicate</dt>
                      <dd>{row.duplicate ? "Likely duplicate" : "No match found"}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          )}
          <div className="standup-actions">
            <button
              disabled={!batch || batch.status === "failed" || importableCount === 0}
              onClick={handleConfirmImport}
              type="button"
            >
              Confirm Import
            </button>
          </div>
        </section>

        {batch?.status === "imported" ? (
          <section className="dashboard-section" aria-label="Health import result">
            <SectionHeader eyebrow="Result" title="Import Summary" />
            <p>
              Imported {batch.recordsImported} metric{" "}
              {batch.recordsImported === 1 ? "entry" : "entries"} from{" "}
              {batch.fileNames.join(", ")}.
            </p>
            {batch.errors.length > 0 ? (
              <ul className="health-import-errors">
                {batch.errors.map((batchError) => (
                  <li key={batchError}>{batchError}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}
      </div>
    </section>
  );
}

export { healthImportBoundaryCopy };
