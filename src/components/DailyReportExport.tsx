"use client";

import { useEffect, useMemo, useState } from "react";

import { CharacterSprite } from "@/components/CharacterSprite";
import { SectionHeader } from "@/components/SectionHeader";
import { createLocalDailyPlanRepository } from "@/data/dailyPlanRepository";
import { createLocalDailyReportRepository } from "@/data/dailyReportRepository";
import { createLocalEveningPostmortemRepository } from "@/data/eveningPostmortemRepository";
import { createLocalJournalRepository } from "@/data/journalRepository";
import { createLocalMetricRepository } from "@/data/metricRepository";
import { createLocalTaskRepository } from "@/data/taskRepository";
import type { DailyPlan, DailyReport, EveningPostmortem, JournalEntry, MetricEntry, Task } from "@/domain";
import { getDailyPlanForDate } from "@/domain/dailyPlans";
import { toLocalIsoDate } from "@/domain/dates";
import { hasDemoData } from "@/domain/demoData";
import { getEveningPostmortemForDate } from "@/domain/eveningPostmortems";
import {
  generateDailyReport,
  getDailyReportFilename,
  getDailyReportForDate,
  upsertDailyReport
} from "@/domain/reports";

export function DailyReportExport() {
  const [selectedDate, setSelectedDate] = useState(toLocalIsoDate());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [plans, setPlans] = useState<DailyPlan[]>([]);
  const [postmortems, setPostmortems] = useState<EveningPostmortem[]>([]);
  const [metrics, setMetrics] = useState<MetricEntry[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const currentReport = useMemo(
    () => getDailyReportForDate(reports, selectedDate),
    [reports, selectedDate]
  );
  const markdownContent = currentReport?.markdownContent ?? "";
  const reportFilename = getDailyReportFilename(selectedDate);
  const isDemoReport = useMemo(
    () =>
      hasDemoData({
        dailyPlans: plans,
        dailyReports: reports,
        eveningPostmortems: postmortems,
        journalEntries,
        metricEntries: metrics,
        tasks
      }),
    [journalEntries, metrics, plans, postmortems, reports, tasks]
  );

  useEffect(() => {
    const loadedReports = createLocalDailyReportRepository(window.localStorage).load();

    setTasks(createLocalTaskRepository(window.localStorage).load());
    setPlans(createLocalDailyPlanRepository(window.localStorage).load());
    setPostmortems(createLocalEveningPostmortemRepository(window.localStorage).load());
    setMetrics(createLocalMetricRepository(window.localStorage).load());
    setJournalEntries(createLocalJournalRepository(window.localStorage).load());
    setReports(loadedReports);
    setSelectedDate((currentDate) =>
      getDailyReportForDate(loadedReports, currentDate) ? currentDate : loadedReports[0]?.date ?? currentDate
    );
    setHasLoaded(true);
  }, []);

  useEffect(() => {
    if (!hasLoaded) {
      return;
    }

    createLocalDailyReportRepository(window.localStorage).save(reports);
  }, [hasLoaded, reports]);

  function generatePreview() {
    const report = generateDailyReport({
      date: selectedDate,
      tasks,
      dailyPlan: getDailyPlanForDate(plans, selectedDate),
      eveningPostmortem: getEveningPostmortemForDate(postmortems, selectedDate),
      metricEntries: metrics,
      journalEntries
    });

    setReports((current) => upsertDailyReport(current, report));
    setMessage("Markdown report generated.");
  }

  async function copyReport() {
    if (!markdownContent) {
      return;
    }

    await navigator.clipboard.writeText(markdownContent);
    setMessage("Markdown report copied.");
  }

  function downloadReport() {
    if (!markdownContent) {
      return;
    }

    const blob = new Blob([markdownContent], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = reportFilename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setMessage("Markdown report downloaded.");
  }

  return (
    <section className="reports-page" aria-labelledby="reports-title">
      <header className="reports-hero">
        <div>
          <p className="eyebrow">Markdown Export</p>
          <h1 id="reports-title">Reports</h1>
          <p>Generate a deterministic daily report from stored quests, metrics, reflections, and lessons.</p>
          {isDemoReport ? <span className="demo-data-badge">Demo Data</span> : null}
        </div>
        <div className="page-sprite-frame reports-sprite" aria-hidden="true">
          <CharacterSprite className="page-sprite" pose="questComplete" />
        </div>
      </header>

      {message ? (
        <p className="standup-success" role="status">
          {message}
        </p>
      ) : null}

      <div className="reports-layout">
        <section className="dashboard-section" aria-label="Report controls">
          <SectionHeader eyebrow="Export" title="Daily Markdown" />
          <div className="reports-controls">
            <label>
              <span>Date</span>
              <input
                onChange={(event) => {
                  setSelectedDate(event.target.value);
                  setMessage(null);
                }}
                onInput={(event) => {
                  setSelectedDate(event.currentTarget.value);
                  setMessage(null);
                }}
                type="date"
                value={selectedDate}
              />
            </label>
            <button disabled={!hasLoaded} onClick={generatePreview} type="button">
              Generate Preview
            </button>
            <button disabled={!markdownContent} onClick={copyReport} type="button">
              Copy to Clipboard
            </button>
            <button disabled={!markdownContent} onClick={downloadReport} type="button">
              Download .md
            </button>
          </div>
          <p className="quest-empty">
            {currentReport
              ? `Latest deterministic report ready as ${reportFilename}.`
              : "No generated report for this date yet."}
          </p>
        </section>

        <section className="dashboard-section report-preview-section" aria-label="Markdown preview">
          <SectionHeader eyebrow="Preview" title="Markdown Preview" />
          {markdownContent ? (
            <pre className="markdown-preview">{markdownContent}</pre>
          ) : (
            <p className="quest-empty">Generate a preview to view the Markdown report.</p>
          )}
        </section>
      </div>
    </section>
  );
}
