"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  areBrowserRemindersEnabled,
  markBrowserReminderFired,
  shouldFireBrowserReminder
} from "@/client/reminders";
import { dataChangedEventName } from "@/data/createLocalRepository";
import { createLocalDailyPlanRepository } from "@/data/dailyPlanRepository";
import { createLocalEveningPostmortemRepository } from "@/data/eveningPostmortemRepository";
import { createLocalTaskRepository } from "@/data/taskRepository";
import { toLocalIsoDate } from "@/domain/dates";
import { getNavStatusMap } from "@/domain/navStatus";

type PendingReminder = {
  href: string;
  label: string;
  glyph: string;
};

function computePending(): PendingReminder | null {
  const storage = window.localStorage;
  const now = new Date();
  const today = toLocalIsoDate(now);
  const statusMap = getNavStatusMap({
    tasks: createLocalTaskRepository(storage).load(),
    plans: createLocalDailyPlanRepository(storage).load(),
    postmortems: createLocalEveningPostmortemRepository(storage).load(),
    today,
    hour: now.getHours()
  });

  if (statusMap["/standup/morning"]?.pulse) {
    return { href: "/standup/morning", label: "Morning stand-up isn't logged yet.", glyph: "🌅" };
  }
  if (statusMap["/standup/evening"]?.pulse) {
    return { href: "/standup/evening", label: "Evening postmortem is still open.", glyph: "🌙" };
  }
  return null;
}

export function ReminderManager() {
  const [pending, setPending] = useState<PendingReminder | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Test/integration escape hatch — the banner is wall-clock driven.
    try {
      if (window.localStorage.getItem("lifequest.suppressReminders") === "true") {
        return;
      }
    } catch {
      // ignore
    }
    function refresh() {
      setPending(computePending());
    }
    refresh();
    window.addEventListener(dataChangedEventName, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(dataChangedEventName, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  // Fire an opt-in browser notification at most once per day.
  useEffect(() => {
    if (!pending) return;
    const storage = window.localStorage;
    const today = toLocalIsoDate();
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "granted" &&
      areBrowserRemindersEnabled(storage) &&
      shouldFireBrowserReminder(storage, today)
    ) {
      try {
        new Notification("LifeQuest OS", { body: pending.label });
        markBrowserReminderFired(storage, today);
      } catch {
        // Notification construction can throw on some platforms — ignore.
      }
    }
  }, [pending]);

  if (!pending || dismissed) return null;

  return (
    <div className="reminder-banner" role="status">
      <span className="reminder-banner-glyph" aria-hidden="true">
        {pending.glyph}
      </span>
      <p>{pending.label}</p>
      <Link href={pending.href} className="reminder-banner-cta" onClick={() => setDismissed(true)}>
        Open
      </Link>
      <button
        type="button"
        className="reminder-banner-close"
        aria-label="Dismiss reminder"
        onClick={() => setDismissed(true)}
      >
        ✕
      </button>
    </div>
  );
}
