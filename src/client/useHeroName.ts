"use client";

import { useEffect, useState } from "react";

import { defaultHeroName, profileChangedEventName, readProfile } from "@/client/profile";

/**
 * Reactive hero name from the local profile. Updates when the profile
 * changes in this tab (custom event) or another tab (storage event).
 */
export function useHeroName(): string {
  const [heroName, setHeroName] = useState(defaultHeroName);

  useEffect(() => {
    function sync() {
      setHeroName(readProfile(window.localStorage).heroName);
    }
    sync();
    window.addEventListener(profileChangedEventName, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(profileChangedEventName, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return heroName;
}
