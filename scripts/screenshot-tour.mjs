import { chromium } from "@playwright/test";

const baseUrl = process.env.SHELL_SHOT_BASE_URL ?? "http://127.0.0.1:3000";
const browser = await chromium.launch();

function seed() {
  // Runs in the page before app scripts.
  window.localStorage.setItem("lifequest.onboarded.v1", "true");
  window.localStorage.setItem("lifequest.suppressReminders", "true");
  window.localStorage.setItem("lifequest.profile.v1", JSON.stringify({ heroName: "Patrick" }));

  const today = new Date();
  const iso = (d) => d.toISOString();
  const dayStr = (offset) => {
    const d = new Date(today);
    d.setDate(d.getDate() - offset);
    return d.toISOString().slice(0, 10);
  };
  const at = (offset, hour) => {
    const d = new Date(today);
    d.setDate(d.getDate() - offset);
    d.setHours(hour, 0, 0, 0);
    return iso(d);
  };

  const tags = ["health", "work", "content", "admin", "learning"];
  const tasks = [];
  // 22 completed across the last 13 days -> hero ~LV5, streak, trends.
  for (let i = 0; i < 22; i += 1) {
    tasks.push({
      id: `done-${i}`,
      title: `Cleared quest ${i + 1}`,
      status: "done",
      priority: ["low", "medium", "high"][i % 3],
      tags: [tags[i % tags.length]],
      completedAt: at(i % 13, 9 + (i % 8)),
      createdAt: at((i % 13) + 1, 8),
      updatedAt: at(i % 13, 9 + (i % 8))
    });
  }
  // Today's planned quests (active).
  const todayIso = dayStr(0);
  const planned = [
    { id: "p1", title: "Ship the launch quest", tags: ["work"], priority: "high" },
    { id: "p2", title: "30-minute kettlebell session", tags: ["health"], priority: "medium" },
    { id: "p3", title: "Draft the dev-log post", tags: ["content"], priority: "medium" }
  ];
  for (const p of planned) {
    tasks.push({
      id: p.id,
      title: p.title,
      status: "todo",
      priority: p.priority,
      tags: p.tags,
      plannedForDate: todayIso,
      createdAt: at(0, 7),
      updatedAt: at(0, 7)
    });
  }
  window.localStorage.setItem("lifequest.tasks.v1", JSON.stringify(tasks));

  // Today's plan with a main quest + side quests.
  window.localStorage.setItem(
    "lifequest.dailyPlans.v1",
    JSON.stringify([
      {
        id: "plan-today",
        date: todayIso,
        mainQuestTaskId: "p1",
        sideQuestTaskIds: ["p2", "p3"],
        intention: "Protect deep-focus time before noon.",
        status: "planned",
        createdAt: at(0, 7),
        updatedAt: at(0, 7)
      }
    ])
  );

  // Metrics over the last 12 days.
  const metrics = [];
  for (let d = 0; d < 12; d += 1) {
    metrics.push({
      id: `m-${d}`,
      date: dayStr(d),
      checkInType: "morning",
      source: "manual",
      energyLevel: 2 + ((d + 1) % 4),
      moodLevel: 3 + (d % 3),
      sleepHours: 6 + (d % 3),
      steps: 5000 + d * 400,
      recordedAt: at(d, 7),
      createdAt: at(d, 7),
      updatedAt: at(d, 7)
    });
  }
  window.localStorage.setItem("lifequest.metricEntries.v1", JSON.stringify(metrics));

  // A couple of reports for history.
  window.localStorage.setItem(
    "lifequest.dailyReports.v1",
    JSON.stringify([
      {
        id: "r1",
        date: dayStr(0),
        generatedBy: "deterministic",
        markdownContent: "# Daily Report\n\nShipped the launch quest.",
        createdAt: at(0, 20),
        updatedAt: at(0, 20)
      },
      {
        id: "r2",
        date: dayStr(1),
        generatedBy: "deterministic",
        markdownContent: "# Daily Report\n\nSolid recovery day.",
        createdAt: at(1, 20),
        updatedAt: at(1, 20)
      }
    ])
  );
}

const shots = [
  { path: "/dashboard", file: "tour-dashboard.png", h: 900 },
  { path: "/tasks", file: "tour-quests.png", h: 1000 },
  { path: "/trends", file: "tour-trends.png", h: 1100 },
  { path: "/standup/morning", file: "tour-morning.png", h: 1000 },
  { path: "/settings", file: "tour-settings.png", h: 1100 }
];

for (const shot of shots) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: shot.h },
    deviceScaleFactor: 2
  });
  const page = await context.newPage();
  await page.addInitScript(seed);
  await page.goto(`${baseUrl}${shot.path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.screenshot({ path: shot.file });
  await context.close();
  console.log(`wrote ${shot.file}`);
}

// Mobile dashboard.
{
  const context = await browser.newContext({
    viewport: { width: 393, height: 851 },
    deviceScaleFactor: 2
  });
  const page = await context.newPage();
  await page.addInitScript(seed);
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.screenshot({ path: "tour-mobile-dashboard.png" });
  await context.close();
  console.log("wrote tour-mobile-dashboard.png");
}

await browser.close();
