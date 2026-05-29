export const themeStorageKey = "lifequest.theme.v1";
export const themeChangedEventName = "lifequest:theme-changed";

export const menuThemes = [
  {
    id: "psx",
    label: "PSX Navy",
    description: "Default — dark navy windows with blue/mint/gold accents.",
    unlockLevel: 1
  },
  {
    id: "gameboy",
    label: "Game Boy LCD",
    description: "Four-shade green DMG palette. Dark green windows on bright LCD.",
    unlockLevel: 3
  },
  {
    id: "amber",
    label: "CRT Amber",
    description: "Phosphor amber on black — terminal-era arcade vibes.",
    unlockLevel: 5
  }
] as const;

export type MenuThemeId = (typeof menuThemes)[number]["id"];

export function isThemeUnlocked(themeId: MenuThemeId, level: number): boolean {
  const theme = menuThemes.find((entry) => entry.id === themeId);
  return level >= (theme?.unlockLevel ?? 1);
}

export function isMenuThemeId(value: unknown): value is MenuThemeId {
  return (
    typeof value === "string" &&
    menuThemes.some((theme) => theme.id === value)
  );
}

export function readStoredTheme(storage: Storage | undefined = undefinedSafeStorage()): MenuThemeId {
  if (!storage) return "psx";
  const raw = storage.getItem(themeStorageKey);
  return isMenuThemeId(raw) ? raw : "psx";
}

export function writeStoredTheme(
  theme: MenuThemeId,
  storage: Storage | undefined = undefinedSafeStorage()
): void {
  if (!storage) return;
  if (theme === "psx") {
    storage.removeItem(themeStorageKey);
  } else {
    storage.setItem(themeStorageKey, theme);
  }
  // Notify same-tab listeners (the storage event only fires across tabs).
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(themeChangedEventName));
  }
}

export function applyTheme(theme: MenuThemeId): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "psx") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", theme);
  }
}

function undefinedSafeStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
