import { expect, type Page, test } from "@playwright/test";

const dailyPlanStorageKey = "lifequest.dailyPlans.v1";
const taskStorageKey = "lifequest.tasks.v1";

function todayIsoDate() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;
}

function makeTask(id: string, title: string) {
  return {
    id,
    title,
    status: "todo",
    priority: "medium",
    tags: [],
    createdAt: "2026-05-04T09:00:00.000Z",
    updatedAt: "2026-05-04T09:00:00.000Z"
  };
}

async function seedTasks(page: Page, tasks: unknown[]) {
  await page.goto("/dashboard");
  await page.evaluate(
    ({ plansKey, tasksKey, seededTasks }) => {
      window.localStorage.clear();
      window.localStorage.setItem(tasksKey, JSON.stringify(seededTasks));
      window.localStorage.setItem(plansKey, JSON.stringify([]));
    },
    { plansKey: dailyPlanStorageKey, tasksKey: taskStorageKey, seededTasks: tasks }
  );
}

test.describe("V03 Morning Stand-Up Manual", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tasks");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
  });

  test("creates a DailyPlan and reflects it on the dashboard", async ({ page }) => {
    await seedTasks(page, [
      makeTask("main-launch", "Main launch quest"),
      makeTask("side-prep", "Side prep quest")
    ]);

    await page.goto("/standup/morning");
    await expect(page.getByRole("heading", { name: "Morning Stand-Up" })).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Main Quest selection" }).getByText("Main launch quest")
    ).toBeVisible();

    await page.getByRole("radio", { name: /Main launch quest/ }).check();
    await page.getByRole("checkbox", { name: /Side prep quest/ }).check();
    await page.getByRole("textbox", { name: "Intention" }).fill("Ship the next useful slice.");
    await page.getByRole("button", { name: "Save Daily Plan" }).click();

    await expect(page.getByText("Today's quest plan is locked in.")).toBeVisible();

    await page.goto("/dashboard");
    await expect(page.getByText("Ship the next useful slice.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Main Quest" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Main launch quest" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Side prep quest" })).toBeVisible();
  });

  test("creates quick tasks during planning and blocks a fourth Side Quest", async ({ page }) => {
    await seedTasks(page, [
      makeTask("main-focus", "Main focus"),
      makeTask("side-one", "Side one"),
      makeTask("side-two", "Side two"),
      makeTask("side-three", "Side three"),
      makeTask("side-four", "Side four")
    ]);

    await page.goto("/standup/morning");
    await page.getByLabel("Quick Quest").fill("Captured during stand-up");
    await page.getByRole("button", { name: "Add Quick Quest" }).click();
    await expect(page.getByText("Quick quest added to planning options.")).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Main Quest selection" }).getByText("Captured during stand-up")
    ).toBeVisible();

    await page.getByRole("radio", { name: /Main focus/ }).check();
    await page.getByRole("checkbox", { name: /Side one/ }).check();
    await page.getByRole("checkbox", { name: /Side two/ }).check();
    await page.getByRole("checkbox", { name: /Side three/ }).check();
    await page.getByRole("checkbox", { name: /Side four/ }).click({ force: true });

    await expect(
      page.getByRole("region", { name: "Morning Stand-Up" }).getByRole("alert")
    ).toHaveText("Choose up to three Side Quests.");
    await expect(page.getByRole("checkbox", { name: /Side four/ })).not.toBeChecked();
  });

  test("reopens today's plan for editing instead of duplicating", async ({ page }) => {
    await seedTasks(page, [
      makeTask("first-main", "First main"),
      makeTask("second-main", "Second main")
    ]);

    await page.goto("/standup/morning");
    await page.getByRole("radio", { name: /First main/ }).check();
    await page.getByRole("textbox", { name: "Intention" }).fill("First intention.");
    await page.getByRole("button", { name: "Save Daily Plan" }).click();

    await page.goto("/standup/morning");
    await expect(page.getByText("Edit today's plan.")).toBeVisible();
    await page.getByRole("radio", { name: /Second main/ }).check();
    await page.getByRole("textbox", { name: "Intention" }).fill("Edited intention.");
    await page.getByRole("button", { name: "Save Daily Plan" }).click();

    const plans = await page.evaluate((key) => {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    }, dailyPlanStorageKey);

    expect(plans).toHaveLength(1);
    expect(plans[0].intention).toBe("Edited intention.");
  });
});

test.describe("V11 AI Morning Stand-Up Agent", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
    await page.evaluate(() => window.localStorage.clear());
  });

  test("starts an AI stand-up, confirms a plan, and dashboard shows it", async ({ page }) => {
    const todayIso = todayIsoDate();
    await seedTasks(page, [
      makeTask("main-ai", "Ship the AI morning stand-up"),
      makeTask("side-ai", "Review the dashboard update")
    ]);
    await page.route("**/api/ai/chat", async (route) => {
      const requestBody = route.request().postDataJSON() as { mode: string };
      expect(requestBody.mode).toBe("morning");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Choose one focused Main Quest and one Side Quest today.",
          proposals: [
            {
              id: "proposal-daily-plan",
              toolName: "propose_daily_plan",
              summary: "Plan today around the AI morning stand-up",
              payload: {
                date: todayIso,
                mainQuestTaskId: "main-ai",
                sideQuestTaskIds: ["side-ai"],
                intention: "Ship the useful morning agent slice.",
                rationale: "One main quest plus one review keeps the day realistic."
              },
              status: "pending",
              createdAt: `${todayIso}T10:00:00.000Z`,
              updatedAt: `${todayIso}T10:00:00.000Z`
            }
          ]
        })
      });
    });

    await page.goto("/standup/morning");
    await page.getByRole("button", { name: "AI-assisted mode" }).click();
    await expect(page.getByText(/Good morning. I see 2 open quests/)).toBeVisible();
    await page.getByLabel("Message").fill("What should I prioritize today?");
    await page.getByRole("button", { name: "Send" }).click();

    await expect(page.getByText("Plan today around the AI morning stand-up")).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Proposed plan card" }).getByText("Ship the AI morning stand-up")
    ).toBeVisible();
    await page.getByRole("button", { name: "Confirm Plan" }).click();
    await expect(page.getByText(`Applied change: Saved DailyPlan: ${todayIso}`)).toBeVisible();

    await page.goto("/dashboard");
    await expect(page.getByText("Ship the useful morning agent slice.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ship the AI morning stand-up" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Review the dashboard update" })).toBeVisible();
  });

  test("rejects a proposed plan without mutating the dashboard", async ({ page }) => {
    const todayIso = todayIsoDate();
    await seedTasks(page, [makeTask("main-reject", "Do not plan this")]);
    await page.route("**/api/ai/chat", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Review this plan before saving.",
          proposals: [
            {
              id: "proposal-rejected-plan",
              toolName: "propose_daily_plan",
              summary: "Plan rejected work",
              payload: {
                date: todayIso,
                mainQuestTaskId: "main-reject",
                sideQuestTaskIds: [],
                intention: "This should not save.",
                rationale: "Rejected proposals must not mutate the plan."
              },
              status: "pending",
              createdAt: `${todayIso}T10:00:00.000Z`,
              updatedAt: `${todayIso}T10:00:00.000Z`
            }
          ]
        })
      });
    });

    await page.goto("/standup/morning");
    await page.getByRole("button", { name: "AI-assisted mode" }).click();
    await page.getByLabel("Message").fill("Suggest a plan.");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("Plan rejected work")).toBeVisible();
    await page.getByRole("button", { name: "Reject" }).click();
    await expect(page.getByText("Rejected proposal: Plan rejected work")).toBeVisible();

    const plans = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? "[]"), dailyPlanStorageKey);
    expect(plans).toHaveLength(0);
    await page.goto("/dashboard");
    await expect(page.getByText("Main Quest not chosen yet.")).toBeVisible();
  });

  test("confirms a new task proposal during AI stand-up and adds it to manual options", async ({
    page
  }) => {
    await seedTasks(page, []);
    await page.route("**/api/ai/chat", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          message: "I can add that quest after confirmation.",
          proposals: [
            {
              id: "proposal-create-task",
              toolName: "create_task",
              summary: "Create task: Draft the morning intro",
              payload: {
                title: "Draft the morning intro",
                priority: "medium",
                tags: ["content"]
              },
              status: "pending",
              createdAt: "2026-05-04T10:00:00.000Z",
              updatedAt: "2026-05-04T10:00:00.000Z"
            }
          ]
        })
      });
    });

    await page.goto("/standup/morning");
    await page.getByRole("button", { name: "AI-assisted mode" }).click();
    await page.getByLabel("Message").fill("Add a task to draft the morning intro.");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("Create task: Draft the morning intro")).toBeVisible();
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText("Applied change: Created task: Draft the morning intro")).toBeVisible();

    await page.getByRole("button", { name: "Manual mode" }).click();
    await expect(
      page.getByRole("region", { name: "Main Quest selection" }).getByText("Draft the morning intro")
    ).toBeVisible();
  });
});
