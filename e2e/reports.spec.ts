import { expect, type Page, test } from "@playwright/test";

const dailyPlanStorageKey = "lifequest.dailyPlans.v1";
const dailyReportStorageKey = "lifequest.dailyReports.v1";
const eveningPostmortemStorageKey = "lifequest.eveningPostmortems.v1";
const journalStorageKey = "lifequest.journalEntries.v1";
const metricStorageKey = "lifequest.metricEntries.v1";
const taskStorageKey = "lifequest.tasks.v1";

function todayIsoDate(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;
}

async function seedReportData(page: Page) {
  const date = todayIsoDate();
  const now = `${date}T20:00:00.000Z`;

  await page.goto("/dashboard");
  await page.evaluate(
    ({
      plansKey,
      reportsKey,
      postmortemsKey,
      journalsKey,
      metricsKey,
      tasksKey,
      seededDate,
      seededNow
    }) => {
      window.localStorage.clear();
      window.localStorage.setItem(
        tasksKey,
        JSON.stringify([
          {
            id: "report-task",
            title: "Complete the report export quest",
            status: "done",
            priority: "high",
            tags: ["content"],
            plannedForDate: seededDate,
            completedAt: seededNow,
            createdAt: seededNow,
            updatedAt: seededNow
          }
        ])
      );
      window.localStorage.setItem(
        plansKey,
        JSON.stringify([
          {
            id: "report-plan",
            date: seededDate,
            mainQuestTaskId: "report-task",
            sideQuestTaskIds: [],
            intention: "Make the day portable.",
            status: "closed",
            createdAt: seededNow,
            updatedAt: seededNow
          }
        ])
      );
      window.localStorage.setItem(
        postmortemsKey,
        JSON.stringify([
          {
            id: "report-postmortem",
            date: seededDate,
            dailyPlanId: "report-plan",
            taskOutcomes: [{ taskId: "report-task", outcome: "completed" }],
            wins: "The Markdown preview tells the truth.",
            friction: "Download needed browser proof.",
            lessonsLearned: "Deterministic reports are good AI context.",
            tomorrowFollowUps: "Start the read-only AI context slice.",
            createdAt: seededNow,
            updatedAt: seededNow
          }
        ])
      );
      window.localStorage.setItem(
        metricsKey,
        JSON.stringify([
          {
            id: "report-metric",
            date: seededDate,
            checkInType: "evening",
            source: "manual",
            energyLevel: 4,
            moodLevel: 5,
            steps: 9100,
            recordedAt: seededNow,
            createdAt: seededNow,
            updatedAt: seededNow
          }
        ])
      );
      window.localStorage.setItem(
        journalsKey,
        JSON.stringify([
          {
            id: "report-journal",
            date: seededDate,
            type: "lesson",
            prompt: "What might be worth sharing publicly?",
            content: "A simple daily report can become source material.",
            source: "manual",
            createdAt: seededNow,
            updatedAt: seededNow
          }
        ])
      );
      window.localStorage.setItem(reportsKey, JSON.stringify([]));
    },
    {
      plansKey: dailyPlanStorageKey,
      reportsKey: dailyReportStorageKey,
      postmortemsKey: eveningPostmortemStorageKey,
      journalsKey: journalStorageKey,
      metricsKey: metricStorageKey,
      tasksKey: taskStorageKey,
      seededDate: date,
      seededNow: now
    }
  );

  return date;
}

test.describe("V07 Markdown Daily Report Export", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
    await page.evaluate(() => window.localStorage.clear());
  });

  test("generates a report from stored tasks, metrics, journal, and postmortem", async ({
    page
  }) => {
    const date = await seedReportData(page);
    await page.goto("/reports");

    await page.getByLabel("Date").fill(date);
    await page.getByRole("button", { name: "Generate Preview" }).click();

    const preview = page.getByRole("region", { name: "Markdown preview" });
    await expect(preview.getByText(`# LifeQuest Daily Report - ${date}`)).toBeVisible();
    await expect(preview.getByText("Complete the report export quest")).toBeVisible();
    await expect(preview.getByText("energy 4/5")).toBeVisible();
    await expect(preview.getByText("The Markdown preview tells the truth.")).toBeVisible();
    await expect(preview.getByText("A simple daily report can become source material.")).toBeVisible();

    const reports = await page.evaluate((reportsKey) => {
      return JSON.parse(window.localStorage.getItem(reportsKey) ?? "[]");
    }, dailyReportStorageKey);
    expect(reports).toHaveLength(1);

    await page.reload();
    await expect(page.getByText(`Latest deterministic report ready as lifequest-report-${date}.md.`)).toBeVisible();
    await expect(preview.getByText("Complete the report export quest")).toBeVisible();
  });

  test("downloads the generated Markdown file", async ({ page }) => {
    const date = await seedReportData(page);
    await page.goto("/reports");
    await page.getByLabel("Date").fill(date);
    await page.getByRole("button", { name: "Generate Preview" }).click();
    await expect(page.getByText("Markdown report generated.")).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download .md" }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe(`lifequest-report-${date}.md`);
  });
});
