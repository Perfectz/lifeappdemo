"use client";

import { useEffect, useState } from "react";

import {
  isThemeUnlocked,
  menuThemes,
  readStoredTheme,
  themeChangedEventName,
  writeStoredTheme,
  type MenuThemeId
} from "@/client/theme";
import { createLocalMetricRepository } from "@/data/metricRepository";
import { createLocalTaskRepository } from "@/data/taskRepository";
import { dataChangedEventName } from "@/data/createLocalRepository";
import { toLocalIsoDate } from "@/domain/dates";
import { getHeroStatus } from "@/domain/heroStatus";

export function ThemePicker() {
  const [theme, setTheme] = useState<MenuThemeId>("psx");
  const [level, setLevel] = useState(1);

  useEffect(() => {
    function syncTheme() {
      setTheme(readStoredTheme());
    }
    function syncLevel() {
      const storage = window.localStorage;
      const tasks = createLocalTaskRepository(storage).load();
      const metrics = createLocalMetricRepository(storage).load();
      setLevel(getHeroStatus(tasks, metrics, toLocalIsoDate()).level);
    }
    syncTheme();
    syncLevel();
    window.addEventListener(themeChangedEventName, syncTheme);
    window.addEventListener(dataChangedEventName, syncLevel);
    window.addEventListener("storage", syncTheme);
    window.addEventListener("storage", syncLevel);
    return () => {
      window.removeEventListener(themeChangedEventName, syncTheme);
      window.removeEventListener(dataChangedEventName, syncLevel);
      window.removeEventListener("storage", syncTheme);
      window.removeEventListener("storage", syncLevel);
    };
  }, []);

  function choose(next: MenuThemeId) {
    if (!isThemeUnlocked(next, level)) return;
    writeStoredTheme(next);
    setTheme(next);
  }

  return (
    <div className="theme-picker">
      <p className="theme-picker-help">
        The skin re-tints every menu surface — sidebar, tabs, command palette,
        and pop-over windows. Earn new skins by leveling up your hero.
      </p>
      <fieldset className="theme-picker-grid">
        <legend className="visually-hidden">Menu theme</legend>
        {menuThemes.map((option) => {
          const checked = option.id === theme;
          const unlocked = isThemeUnlocked(option.id, level);
          return (
            <label
              key={option.id}
              className={[
                "theme-picker-option",
                checked ? "theme-picker-option-active" : "",
                unlocked ? "" : "theme-picker-option-locked"
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <input
                type="radio"
                name="menu-theme"
                value={option.id}
                checked={checked}
                disabled={!unlocked}
                onChange={() => choose(option.id)}
              />
              <span
                className={`theme-picker-swatch theme-picker-swatch-${option.id}`}
                aria-hidden="true"
              >
                <span />
                <span />
                <span />
              </span>
              <span className="theme-picker-text">
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </span>
              {checked ? (
                <span className="theme-picker-active-tag" aria-hidden="true">
                  ▶ Active
                </span>
              ) : !unlocked ? (
                <span className="theme-picker-lock-tag">🔒 LV {option.unlockLevel}</span>
              ) : null}
            </label>
          );
        })}
      </fieldset>
    </div>
  );
}
