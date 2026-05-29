export const profileStorageKey = "lifequest.profile.v1";
export const profileChangedEventName = "lifequest:profile-changed";

export const defaultHeroName = "Patrick";
export const maxHeroNameLength = 24;

export type Profile = {
  heroName: string;
};

function safeStorage(storage?: Storage): Storage | undefined {
  if (storage) return storage;
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function sanitizeHeroName(value: unknown): string {
  if (typeof value !== "string") return defaultHeroName;
  const trimmed = value.trim().slice(0, maxHeroNameLength);
  return trimmed.length > 0 ? trimmed : defaultHeroName;
}

export function readProfile(storage?: Storage): Profile {
  const target = safeStorage(storage);
  if (!target) return { heroName: defaultHeroName };
  try {
    const raw = target.getItem(profileStorageKey);
    if (!raw) return { heroName: defaultHeroName };
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "heroName" in parsed) {
      return { heroName: sanitizeHeroName((parsed as { heroName: unknown }).heroName) };
    }
  } catch {
    // fall through to default
  }
  return { heroName: defaultHeroName };
}

export function writeHeroName(value: string, storage?: Storage): string {
  const heroName = sanitizeHeroName(value);
  const target = safeStorage(storage);
  if (target) {
    try {
      target.setItem(profileStorageKey, JSON.stringify({ heroName }));
    } catch {
      // Non-fatal — the storage-error toast covers real save failures elsewhere.
    }
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(profileChangedEventName));
  }
  return heroName;
}
