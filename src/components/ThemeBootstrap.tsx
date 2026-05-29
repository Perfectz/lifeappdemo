"use client";

import { useEffect } from "react";

import { themeStorageKey, themeChangedEventName, readStoredTheme, applyTheme } from "@/client/theme";

/**
 * Applies the player's stored menu theme to <html data-theme="...">.
 * Mounts once near the top of the tree so every consumer sees the
 * tokens. Listens for cross-tab storage changes and the in-tab custom
 * event so the Settings switcher can update the chrome instantly.
 */
export function ThemeBootstrap() {
  useEffect(() => {
    function sync() {
      applyTheme(readStoredTheme());
    }
    sync();

    function onStorage(event: StorageEvent) {
      if (event.key === themeStorageKey) sync();
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener(themeChangedEventName, sync);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(themeChangedEventName, sync);
    };
  }, []);

  return null;
}
