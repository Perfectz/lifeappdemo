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

async function seedPlan(page: Page) {
  const today = todayIsoDate();

  await page.goto("/dashboard");
  await page.evaluate(
    ({ plansKey, postmortemsKey, tasksKey, seededPlan, seededTasks }) => {
      window.localStorage.clear();
      window.localStorage.setItem(tasksKey, JSON.stringify(seededTasks));
      window.localStorage.setItem(plansKey, JSON.stringify([seededPlan]));
      window.localStorage.setItem(postmortemsKey, JSON.stringify([]));
    },
    {
      plansKey: dailyPlanStorageKey,
      postmortemsKey: eveningPostmortemStorageKey,
      tasksKey: taskStorageKey,
      seededPlan: {
        id: "plan-1",
        date: today,
        mainQuestTaskId: "main-task",
        sideQuestTaskIds: ["side-task"],
        intention: "Close the loop.",
        status: "planned",
        createdAt: `${today}T09:00:00.000Z`,
        updatedAt: `${today}T09:00:00.000Z`
      },
      seededTasks: [
        {
          id: "main-task",
          title: "Complete main quest",
          status: "todo",
          priority: "high",
          tags: [],
          plannedForDate: today,
          createdAt: `${today}T09:00:00.000Z`,
          updatedAt: `${today}T09:00:00.000Z`
        },
        {
          id: "side-task",
          title: "Defer side quest",
          status: "todo",
          priority: "medium",
          tags: [],
          plannedForDate: today,
          createdAt: `${today}T09:00:00.000Z`,
          updatedAt: `${today}T09:00:00.000Z`
        }
      ]
    }
  );
}

test.describe("V04 Evening Postmortem Manual", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
    await page.evaluate(() => window.localStorage.clear());
  });

  test("closes a planned day and updates completed dashboard count", async ({ page }) => {
    await seedPlan(page);
    await page.goto("/standup/evening");

    await expect(page.getByRole("heading", { name: "Evening Postmortem" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Complete main quest" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Defer side quest" })).toBeVisible();

    const mainTaskCard = page
      .locator(".outcome-card")
      .filter({ has: page.getByRole("heading", { name: "Complete main quest" }) });
    const sideTaskCard = page
      .locator(".outcome-card")
      .filter({ has: page.getByRole("heading", { name: "Defer side quest" }) });

    await mainTaskCard.getByRole("radio", { name: "completed" }).check();
    await sideTaskCard.getByRole("radio", { name: "deferred" }).check();
    await page.getByLabel("Wins").fill("Main quest landed.");
    await page.getByLabel("Friction").fill("Side quest moved.");
    await page.getByLabel("Lessons learned").fill("Plan fewer tasks.");
    await page.getByLabel("Tomorrow follow-ups").fill("Pick up the deferred item.");
    await page.getByRole("button", { name: "Save Postmortem" }).click();

    await expect(page.getByText("Today's Daily Plan is closed.")).toBeVisible();
    await expect(page.getByText("Main quest landed.")).toBeVisible();

    const state = await page.evaluate(
      ({ plansKey, postmortemsKey, tasksKey }) => ({
        plans: JSON.parse(window.localStorage.getItem(plansKey) ?? "[]"),
        postmortems: JSON.parse(window.localStorage.getItem(postmortemsKey) ?? "[]"),
        tasks: JSON.parse(window.localStorage.getItem(tasksKey) ?? "[]")
      }),
      {
        plansKey: dailyPlanStorageKey,
        postmortemsKey: eveningPostmortemStorageKey,
        tasksKey: taskStorageKey
      }
    );

    expect(state.plans[0].status).toBe("closed");
    expect(state.postmortems).toHaveLength(1);
    expect(state.postmortems[0].wins).toBe("Main quest landed.");
    expect(state.tasks.find((task: { id: string }) => task.id === "main-task").status).toBe(
      "done"
    );
    expect(state.tasks.find((task: { id: string }) => task.id === "side-task").status).toBe(
      "todo"
    );

    await page.goto("/dashboard");
    await expect(page.getByText("Completed Today")).toBeVisible();
    await expect(page.locator(".status-panel").filter({ hasText: "Completed Today" })).toContainText(
      "1"
    );
  });

  test("renders no-plan fallback instead of crashing", async ({ page }) => {
    await page.goto("/standup/evening");

    await expect(page.getByText("No Daily Plan exists for today.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Create Morning Plan" })).toBeVisible();

    await page.getByLabel("Wins").fill("Still reflected without a plan.");
    await page.getByRole("button", { name: "Save Postmortem" }).click();
    await expect(page.getByText("Evening postmortem saved. Daily Plan closed.")).toBeVisible();
  });
});

test.describe("V12 AI Evening Postmortem and Report", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
    await page.evaluate(() => window.localStorage.clear());
  });

  test("AI evening session confirms completion, lesson, follow-up, and report preview", async ({
    page
  }) => {
    const today = todayIsoDate();
    await seedPlan(page);
    await page.goto("/dashboard");
    await page.evaluate(
      ({ metricsKey, seededMetric }) => {
        window.localStorage.setItem(metricsKey, JSON.stringify([seededMetric]));
      },
      {
        metricsKey: metricStorageKey,
        seededMetric: {
          id: "metric-evening",
          date: today,
          checkInType: "evening",
          source: "manual",
          energyLevel: 3,
          moodLevel: 4,
          steps: 6200,
          recordedAt: `${today}T20:00:00.000Z`,
          createdAt: `${today}T20:00:00.000Z`,
          updatedAt: `${today}T20:00:00.000Z`
        }
      }
    );
    await page.route("**/api/ai/chat", async (route) => {
      const requestBody = route.request().postDataJSON() as { mode: string };
      expect(requestBody.mode).toBe("evening");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Let's close the completed work, capture the lesson, and prep tomorrow.",
          proposals: [
            {
              id: "proposal-complete-main",
              toolName: "complete_task",
              summary: "Complete task: Complete main quest",
              payload: { taskId: "main-task" },
              status: "pending",
              createdAt: `${today}T20:00:00.000Z`,
              updatedAt: `${today}T20:00:00.000Z`
            },
            {
              id: "proposal-lesson",
              toolName: "create_journal_entry",
              summary: "Capture lesson: fewer tasks works better",
              payload: {
                date: today,
                type: "lesson",
                content: "Planning fewer tasks made the evening review easier."
              },
              status: "pending",
              createdAt: `${today}T20:00:00.000Z`,
              updatedAt: `${today}T20:00:00.000Z`
            },
            {
              id: "proposal-follow-up",
              toolName: "create_task",
              summary: "Create follow-up: Draft tomorrow outline",
              payload: {
                title: "Draft tomorrow outline",
                priority: "medium",
                tags: ["work"],
                plannedForDate: "2026-05-05"
              },
              status: "pending",
              createdAt: `${today}T20:00:00.000Z`,
              updatedAt: `${today}T20:00:00.000Z`
            }
          ]
        })
      });
    });

    await page.goto("/standup/evening");
    await page.getByRole("button", { name: "AI-assisted mode" }).click();
    await expect(page.getByText(/Today's plan has 2 planned quests/)).toBeVisible();
    await page.getByLabel("Message").fill("I completed the main quest and learned fewer tasks works better.");
    await page.getByRole("button", { name: "Send" }).click();

    await expect(page.getByText("Complete task: Complete main quest")).toBeVisible();
    await page
      .locator(".tool-proposal-card")
      .filter({ hasText: "Complete task: Complete main quest" })
      .getByRole("button", { name: "Confirm" })
      .click();
    await expect(page.getByText("Applied change: Completed task: Complete main quest")).toBeVisible();

    await page
      .locator(".tool-proposal-card")
      .filter({ hasText: "Capture lesson: fewer tasks works better" })
      .getByRole("button", { name: "Confirm" })
      .click();
    await expect(page.getByText("Applied change: Created journal entry: lesson")).toBeVisible();

    await page
      .locator(".tool-proposal-card")
      .filter({ hasText: "Create follow-up: Draft tomorrow outline" })
      .getByRole("button", { name: "Confirm" })
      .click();
    await expect(page.getByText("Applied change: Created task: Draft tomorrow outline")).toBeVisible();

    await page.getByLabel("Reflection capture panel").getByLabel("Wins").fill("Main quest landed.");
    await page.getByLabel("Reflection capture panel").getByLabel("Lessons learned").fill("Fewer tasks improved focus.");
    await page.getByLabel("Reflection capture panel").getByLabel("Tomorrow follow-ups").fill("Draft tomorrow outline.");
    await page.getByRole("button", { name: "Save Postmortem & Close Plan" }).click();
    await expect(page.getByText("Evening postmortem saved. Daily Plan closed.")).toBeVisible();

    await page.getByRole("button", { name: "Generate Report" }).click();
    await expect(page.getByText("Generate AI-assisted daily report")).toBeVisible();
    await page
      .locator(".tool-proposal-card")
      .filter({ hasText: "Generate AI-assisted daily report" })
      .getByRole("button", { name: "Confirm" })
      .click();
    await expect(page.getByText(`Applied change: Generated ai-assisted report: ${today}`)).toBeVisible();

    const preview = page.getByRole("region", { name: "AI report preview" });
    await expect(preview.getByText("Complete main quest")).toBeVisible();
    await expect(preview.getByText("energy 3/5")).toBeVisible();
    await expect(preview.getByText("Main quest landed.")).toBeVisible();
    await expect(preview.getByText("Planning fewer tasks made the evening review easier.")).toBeVisible();
    await expect(preview.getByText("LinkedIn Source Material")).toBeVisible();

    const state = await page.evaluate(
      ({ reportsKey, journalKey, plansKey, tasksKey }) => ({
        reports: JSON.parse(window.localStorage.getItem(reportsKey) ?? "[]"),
        journalEntries: JSON.parse(window.localStorage.getItem(journalKey) ?? "[]"),
        plans: JSON.parse(window.localStorage.getItem(plansKey) ?? "[]"),
        tasks: JSON.parse(window.localStorage.getItem(tasksKey) ?? "[]")
      }),
      {
        reportsKey: dailyReportStorageKey,
        journalKey: journalStorageKey,
        plansKey: dailyPlanStorageKey,
        tasksKey: taskStorageKey
      }
    );

    expect(state.reports[0].generatedBy).toBe("ai");
    expect(state.journalEntries[0].type).toBe("lesson");
    expect(state.plans[0].status).toBe("closed");
    expect(state.tasks.find((task: { id: string }) => task.id === "main-task").status).toBe("done");
    expect(state.tasks.find((task: { title: string }) => task.title === "Draft tomorrow outline")).toBeTruthy();
  });
});
