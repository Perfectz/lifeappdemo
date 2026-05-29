export const onboardingStorageKey = "lifequest.onboarded.v1";

export function hasOnboarded(storage: Storage): boolean {
  try {
    return storage.getItem(onboardingStorageKey) === "true";
  } catch {
    return true; // If storage is unavailable, don't nag.
  }
}

export function markOnboarded(storage: Storage): void {
  try {
    storage.setItem(onboardingStorageKey, "true");
  } catch {
    // Non-fatal.
  }
}
