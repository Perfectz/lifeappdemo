"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { dataChangedEventName } from "@/data/createLocalRepository";
import { loadBodyProfile } from "@/data/bodyProfileRepository";
import { hasCompletedSetup } from "@/domain/bodyProfile";

/** Nudge to finish first-run setup; disappears once setup is completed. */
export function SetupPrompt() {
  const [needsSetup, setNeedsSetup] = useState(false);

  const reload = useCallback(() => {
    setNeedsSetup(!hasCompletedSetup(loadBodyProfile(window.localStorage)));
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener(dataChangedEventName, reload);
    return () => window.removeEventListener(dataChangedEventName, reload);
  }, [reload]);

  if (!needsSetup) {
    return null;
  }

  return (
    <Link href="/setup" className="setup-prompt">
      <div>
        <strong>Finish setting up (2 min)</strong>
        <p>Set your weight goal and calorie budget so the dashboard works for you.</p>
      </div>
      <span aria-hidden="true">→</span>
    </Link>
  );
}
