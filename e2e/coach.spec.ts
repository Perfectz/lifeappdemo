import { expect, test } from "@playwright/test";

const taskStorageKey = "lifequest.tasks.v1";

test.describe("V08 AI Chat with Read-Only App Context", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
    await page.evaluate(() => window.localStorage.clear());
  });

  test("sends a message, shows mocked AI response, and does not mutate tasks", async ({
    page
  }) => {
    const now = "2026-05-04T10:00:00.000Z";
    await page.evaluate(
      ({ tasksKey, seededNow }) => {
        window.localStorage.setItem(
          tasksKey,
          JSON.stringify([
            {
              id: "focus-task",
              title: "Prepare the read-only coach demo",
              status: "todo",
              priority: "high",
              tags: ["work"],
              createdAt: seededNow,
              updatedAt: seededNow
            }
          ])
        );
      },
      { tasksKey: taskStorageKey, seededNow: now }
    );
    await page.route("**/api/ai/chat", async (route) => {
      const requestBody = route.request().postDataJSON() as {
        message: string;
        appData: { tasks: Array<{ title: string }> };
      };

      expect(requestBody.message).toBe("What should I focus on today?");
      expect(requestBody.appData.tasks[0].title).toBe("Prepare the read-only coach demo");

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Focus on Prepare the read-only coach demo, then review the report context.",
          mode: "general",
          usedContext: {
            openTaskCount: 1,
            recentMetricCount: 0,
            recentJournalEntryCount: 0
          }
        })
      });
    });

    await page.goto("/coach");
    await expect(
      page
        .getByRole("region", { name: "AI coach chat" })
        .getByText("Task changes require confirmation", { exact: true })
    ).toBeVisible();

    await page.getByLabel("Message").fill("What should I focus on today?");
    await page.getByRole("button", { name: "Send" }).click();

    await expect(
      page.getByText("Focus on Prepare the read-only coach demo, then review the report context.")
    ).toBeVisible();
    await expect(page.getByText("Open tasks used")).toBeVisible();

    const tasks = await page.evaluate((tasksKey) => {
      return JSON.parse(window.localStorage.getItem(tasksKey) ?? "[]");
    }, taskStorageKey);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      id: "focus-task",
      status: "todo",
      title: "Prepare the read-only coach demo"
    });
  });
});

test.describe("V09 AI Task Tools with Confirmation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
    await page.evaluate(() => window.localStorage.clear());
  });

  test("asks AI to create a task, confirms it, and sees it in Quest Log", async ({
    page
  }) => {
    await page.route("**/api/ai/chat", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          message: "I can create that after you confirm.",
          mode: "general",
          proposals: [
            {
              id: "proposal-create",
              toolName: "create_task",
              summary: "Create task: Walk on the treadmill tomorrow",
              payload: {
                title: "Walk on the treadmill tomorrow",
                tags: ["health"]
              },
              status: "pending",
              createdAt: "2026-05-04T10:00:00.000Z",
              updatedAt: "2026-05-04T10:00:00.000Z"
            }
          ],
          usedContext: {
            openTaskCount: 0,
            recentMetricCount: 0,
            recentJournalEntryCount: 0
          }
        })
      });
    });

    await page.goto("/coach");
    await page.getByLabel("Message").fill("Add a task to walk on the treadmill tomorrow.");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("Create task: Walk on the treadmill tomorrow")).toBeVisible();

    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(
      page.getByText("Applied change: Created task: Walk on the treadmill tomorrow")
    ).toBeVisible();

    await page.goto("/tasks");
    await expect(
      page.getByRole("heading", { name: "Walk on the treadmill tomorrow" })
    ).toBeVisible();
  });

  test("rejects a create-task proposal without applying it", async ({ page }) => {
    await page.route("**/api/ai/chat", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Review this proposed task.",
          proposals: [
            {
              id: "proposal-reject",
              toolName: "create_task",
              summary: "Create task: Do not add this quest",
              payload: {
                title: "Do not add this quest"
              },
              status: "pending",
              createdAt: "2026-05-04T10:00:00.000Z",
              updatedAt: "2026-05-04T10:00:00.000Z"
            }
          ]
        })
      });
    });

    await page.goto("/coach");
    await page.getByLabel("Message").fill("Add a task.");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("Create task: Do not add this quest")).toBeVisible();

    await page.getByRole("button", { name: "Reject" }).click();
    await expect(page.getByText("Rejected proposal: Create task: Do not add this quest")).toBeVisible();

    const tasks = await page.evaluate((tasksKey) => {
      return JSON.parse(window.localStorage.getItem(tasksKey) ?? "[]");
    }, taskStorageKey);
    expect(tasks).toHaveLength(0);
  });

  test("asks AI to complete a task, confirms it, and moves it to done", async ({
    page
  }) => {
    await page.evaluate(
      ({ tasksKey }) => {
        window.localStorage.setItem(
          tasksKey,
          JSON.stringify([
            {
              id: "task-complete",
              title: "Finish the confirmation queue",
              status: "todo",
              priority: "high",
              tags: ["work"],
              createdAt: "2026-05-04T10:00:00.000Z",
              updatedAt: "2026-05-04T10:00:00.000Z"
            }
          ])
        );
      },
      { tasksKey: taskStorageKey }
    );
    await page.route("**/api/ai/chat", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          message: "I can mark it complete after confirmation.",
          proposals: [
            {
              id: "proposal-complete",
              toolName: "complete_task",
              summary: "Complete task: Finish the confirmation queue",
              payload: {
                taskId: "task-complete"
              },
              status: "pending",
              createdAt: "2026-05-04T10:00:00.000Z",
              updatedAt: "2026-05-04T10:00:00.000Z"
            }
          ]
        })
      });
    });

    await page.goto("/coach");
    await page.getByLabel("Message").fill("Mark the confirmation queue task done.");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("Complete task: Finish the confirmation queue")).toBeVisible();

    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(
      page.getByText("Applied change: Completed task: Finish the confirmation queue")
    ).toBeVisible();

    const tasks = await page.evaluate((tasksKey) => {
      return JSON.parse(window.localStorage.getItem(tasksKey) ?? "[]");
    }, taskStorageKey);
    expect(tasks[0]).toMatchObject({
      id: "task-complete",
      status: "done"
    });
  });
});

test.describe("V10 AI Metrics and Journal Tools", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
    await page.evaluate(() => window.localStorage.clear());
  });

  test("asks AI to log a metric, confirms it, and dashboard updates", async ({ page }) => {
    const today = new Date();
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
      today.getDate()
    ).padStart(2, "0")}`;

    await page.route("**/api/ai/chat", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          message: "I can log sleep and energy after confirmation.",
          proposals: [
            {
              id: "proposal-metric",
              toolName: "log_metric",
              summary: "Log metric: slept 6 hours, energy 2",
              payload: {
                date: todayIso,
                checkInType: "freeform",
                sleepHours: 6,
                energyLevel: 2
              },
              status: "pending",
              createdAt: `${todayIso}T10:00:00.000Z`,
              updatedAt: `${todayIso}T10:00:00.000Z`
            }
          ]
        })
      });
    });

    await page.goto("/coach");
    await page.getByLabel("Message").fill("I slept 6 hours and my energy is 2.");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("Log metric: slept 6 hours, energy 2")).toBeVisible();
    await expect(page.getByText(/sleep 6h/)).toBeVisible();

    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(
      page.getByText(`Applied change: Logged metric entry: ${todayIso} freeform`)
    ).toBeVisible();

    await page.goto("/metrics");
    await expect(page.getByText(`${todayIso} - freeform`)).toBeVisible();
    await expect(page.getByText("Energy 2 | Sleep 6h")).toBeVisible();

    await page.goto("/dashboard");
    const metricsSection = page.getByRole("complementary", { name: "Dashboard actions" });
    await expect(metricsSection.getByText("Energy")).toBeVisible();
    await expect(metricsSection.getByText("2/5")).toBeVisible();
    await expect(metricsSection.getByText("Sleep")).toBeVisible();
    await expect(metricsSection.getByText("6h")).toBeVisible();
  });

  test("rejects a metric proposal without creating a metric entry", async ({ page }) => {
    await page.route("**/api/ai/chat", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Review this metric proposal.",
          proposals: [
            {
              id: "proposal-metric-reject",
              toolName: "log_metric",
              summary: "Log metric: rejected energy",
              payload: {
                date: "2026-05-04",
                checkInType: "freeform",
                energyLevel: 2
              },
              status: "pending",
              createdAt: "2026-05-04T10:00:00.000Z",
              updatedAt: "2026-05-04T10:00:00.000Z"
            }
          ]
        })
      });
    });

    await page.goto("/coach");
    await page.getByLabel("Message").fill("I am tired.");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("Log metric: rejected energy")).toBeVisible();
    await page.getByRole("button", { name: "Reject" }).click();
    await expect(page.getByText("Rejected proposal: Log metric: rejected energy")).toBeVisible();

    const entries = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem("lifequest.metricEntries.v1") ?? "[]")
    );
    expect(entries).toHaveLength(0);
  });

  test("asks AI to create a lesson journal entry, confirms it, and journal updates", async ({
    page
  }) => {
    const today = new Date();
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
      today.getDate()
    ).padStart(2, "0")}`;

    await page.route("**/api/ai/chat", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          message: "I can capture that lesson after confirmation.",
          proposals: [
            {
              id: "proposal-journal",
              toolName: "create_journal_entry",
              summary: "Create lesson: starting earlier helps",
              payload: {
                date: todayIso,
                type: "lesson",
                content: "Starting earlier helps me avoid rushing."
              },
              status: "pending",
              createdAt: `${todayIso}T10:00:00.000Z`,
              updatedAt: `${todayIso}T10:00:00.000Z`
            }
          ]
        })
      });
    });

    await page.goto("/coach");
    await page.getByLabel("Message").fill("I learned that starting earlier helps me avoid rushing.");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("Create lesson: starting earlier helps")).toBeVisible();
    await expect(page.getByText("lesson: Starting earlier helps me avoid rushing.")).toBeVisible();

    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText("Applied change: Created journal entry: lesson")).toBeVisible();

    await page.goto("/journal");
    await expect(page.getByText("Starting earlier helps me avoid rushing.")).toBeVisible();
  });
});
