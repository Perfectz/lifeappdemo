import type {
  DailyPlan,
  DailyReport,
  EveningPostmortem,
  IsoDate,
  IsoDateTime,
  JournalEntry,
  MetricEntry,
  Task
} from "./types";

export const demoIdPrefix = "demo-";
export const demoModeStorageKey = "lifequest.demoMode.v1";
export const demoModeChangedEventName = "lifequest-demo-mode-changed";

export type DemoDataSet = {
  dailyPlans: DailyPlan[];
  dailyReports: DailyReport[];
  eveningPostmortems: EveningPostmortem[];
  journalEntries: JournalEntry[];
  metricEntries: MetricEntry[];
  tasks: Task[];
};

export type DemoDataCounts = {
  dailyPlans: number;
  dailyReports: number;
  eveningPostmortems: number;
  journalEntries: number;
  metricEntries: number;
  tasks: number;
};

export type DemoDataResetResult = {
  data: DemoDataSet;
  removed: DemoDataCounts;
};

function demoId(id: string): string {
  return `${demoIdPrefix}${id}`;
}

function isDemoId(id: string | undefined): boolean {
  return Boolean(id?.startsWith(demoIdPrefix));
}

function tomorrowFrom(date: IsoDate): IsoDate {
  const parsed = new Date(`${date}T12:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed.toISOString().slice(0, 10);
}

export function createDemoDataSet(
  today: IsoDate,
  now: IsoDateTime = new Date().toISOString()
): DemoDataSet {
  const tomorrow = tomorrowFrom(today);
  const tasks: Task[] = [
    {
      id: demoId("task-main"),
      title: "Ship the portfolio-ready LifeQuest walkthrough",
      description: "Record the core loop and capture screenshots for a public demo.",
      status: "todo",
      priority: "high",
      tags: ["work", "content"],
      plannedForDate: today,
      dueDate: today,
      createdAt: now,
      updatedAt: now
    },
    {
      id: demoId("task-health"),
      title: "Review imported sleep and step trends",
      description: "Use the health import preview to explain local-first data handling.",
      status: "todo",
      priority: "medium",
      tags: ["health"],
      plannedForDate: today,
      createdAt: now,
      updatedAt: now
    },
    {
      id: demoId("task-report"),
      title: "Polish daily report copy",
      description: "Make the Markdown preview easy to screenshot and paste elsewhere.",
      status: "done",
      priority: "medium",
      tags: ["content"],
      plannedForDate: today,
      completedAt: `${today}T18:10:00.000Z`,
      createdAt: now,
      updatedAt: now
    },
    {
      id: demoId("task-follow-up"),
      title: "Follow up with three LinkedIn comments",
      description: "Small social action to show how side quests stay bounded.",
      status: "todo",
      priority: "low",
      tags: ["social"],
      dueDate: tomorrow,
      createdAt: now,
      updatedAt: now
    }
  ];
  const dailyPlans: DailyPlan[] = [
    {
      id: demoId("plan-today"),
      date: today,
      mainQuestTaskId: demoId("task-main"),
      sideQuestTaskIds: [demoId("task-health"), demoId("task-report")],
      intention: "Show the app as a focused operating loop, not a generic tracker.",
      status: "planned",
      createdAt: now,
      updatedAt: now
    }
  ];
  const metricEntries: MetricEntry[] = [
    {
      id: demoId("metric-morning"),
      date: today,
      checkInType: "morning",
      source: "demo",
      sleepHours: 7.25,
      energyLevel: 4,
      moodLevel: 4,
      steps: 8420,
      recordedAt: `${today}T08:00:00.000Z`,
      createdAt: now,
      updatedAt: now
    },
    {
      id: demoId("metric-evening"),
      date: today,
      checkInType: "evening",
      source: "demo",
      energyLevel: 3,
      moodLevel: 5,
      steps: 11850,
      workoutSummary: "30 minute zone 2 walk",
      recordedAt: `${today}T20:30:00.000Z`,
      createdAt: now,
      updatedAt: now
    }
  ];
  const journalEntries: JournalEntry[] = [
    {
      id: demoId("journal-intention"),
      date: today,
      type: "morning_intention",
      prompt: "What makes today successful?",
      content: "A useful demo shows the planning loop, the import boundary, and the report handoff clearly.",
      source: "demo",
      linkedDailyPlanId: demoId("plan-today"),
      createdAt: now,
      updatedAt: now
    },
    {
      id: demoId("journal-lesson"),
      date: today,
      type: "lesson",
      prompt: "What did the system reveal?",
      content: "The strongest portfolio story is local-first execution plus AI boundaries that require confirmation.",
      source: "demo",
      createdAt: now,
      updatedAt: now
    }
  ];
  const eveningPostmortems: EveningPostmortem[] = [
    {
      id: demoId("postmortem-today"),
      date: today,
      dailyPlanId: demoId("plan-today"),
      taskOutcomes: [
        { taskId: demoId("task-main"), outcome: "left_open", note: "Demo recording queued." },
        { taskId: demoId("task-health"), outcome: "completed", note: "Import preview verified." },
        { taskId: demoId("task-report"), outcome: "completed", note: "Report copy tightened." }
      ],
      wins: "The core loop is visible from dashboard to report without needing private real data.",
      friction: "Keep demo data clearly marked so it cannot be confused with Patrick's real records.",
      lessonsLearned: "A portfolio demo needs opinionated constraints as much as visual polish.",
      tomorrowFollowUps: "Capture screenshots and write the public walkthrough.",
      createdAt: now,
      updatedAt: now
    }
  ];
  const dailyReports: DailyReport[] = [
    {
      id: demoId("report-today"),
      date: today,
      generatedBy: "deterministic",
      markdownContent: [
        `# LifeQuest Demo Report - ${today}`,
        "",
        "## Demo Data Notice",
        "",
        "- This report uses fake portfolio data only.",
        "- Demo records are removable without deleting real records.",
        "",
        "## Product Story",
        "",
        "- One Main Quest anchors the day.",
        "- Health import data is previewed before it is stored.",
        "- AI and voice flows hand off to confirmation-based text workflows.",
        "",
        "## Screenshot Notes",
        "",
        "- Dashboard shows a populated quest plan and latest metrics.",
        "- Reports preview is designed for copying or screenshotting."
      ].join("\n"),
      createdAt: now,
      updatedAt: now
    }
  ];

  return {
    dailyPlans,
    dailyReports,
    eveningPostmortems,
    journalEntries,
    metricEntries,
    tasks
  };
}

function emptyCounts(): DemoDataCounts {
  return {
    dailyPlans: 0,
    dailyReports: 0,
    eveningPostmortems: 0,
    journalEntries: 0,
    metricEntries: 0,
    tasks: 0
  };
}

export function countDemoData(data: DemoDataSet): DemoDataCounts {
  return {
    dailyPlans: data.dailyPlans.filter((entry) => isDemoId(entry.id)).length,
    dailyReports: data.dailyReports.filter((entry) => isDemoId(entry.id)).length,
    eveningPostmortems: data.eveningPostmortems.filter((entry) => isDemoId(entry.id)).length,
    journalEntries: data.journalEntries.filter((entry) => entry.source === "demo" || isDemoId(entry.id)).length,
    metricEntries: data.metricEntries.filter((entry) => entry.source === "demo" || isDemoId(entry.id)).length,
    tasks: data.tasks.filter((entry) => isDemoId(entry.id)).length
  };
}

export function hasDemoData(data: DemoDataSet): boolean {
  return Object.values(countDemoData(data)).some((count) => count > 0);
}

export function removeDemoData(data: DemoDataSet): DemoDataResetResult {
  const removed = countDemoData(data);

  return {
    data: {
      dailyPlans: data.dailyPlans.filter((entry) => !isDemoId(entry.id)),
      dailyReports: data.dailyReports.filter((entry) => !isDemoId(entry.id)),
      eveningPostmortems: data.eveningPostmortems.filter((entry) => !isDemoId(entry.id)),
      journalEntries: data.journalEntries.filter((entry) => entry.source !== "demo" && !isDemoId(entry.id)),
      metricEntries: data.metricEntries.filter((entry) => entry.source !== "demo" && !isDemoId(entry.id)),
      tasks: data.tasks.filter((entry) => !isDemoId(entry.id))
    },
    removed
  };
}

export function seedDemoData(data: DemoDataSet, today: IsoDate): DemoDataSet {
  const realData = removeDemoData(data).data;
  const demoData = createDemoDataSet(today);

  return {
    dailyPlans: [...demoData.dailyPlans, ...realData.dailyPlans],
    dailyReports: [...demoData.dailyReports, ...realData.dailyReports],
    eveningPostmortems: [...demoData.eveningPostmortems, ...realData.eveningPostmortems],
    journalEntries: [...demoData.journalEntries, ...realData.journalEntries],
    metricEntries: [...demoData.metricEntries, ...realData.metricEntries],
    tasks: [...demoData.tasks, ...realData.tasks]
  };
}

export function addCounts(left: DemoDataCounts, right: DemoDataCounts): DemoDataCounts {
  const result = emptyCounts();

  for (const key of Object.keys(result) as Array<keyof DemoDataCounts>) {
    result[key] = left[key] + right[key];
  }

  return result;
}
