export const remindersStorageKey = "lifequest.reminders.v1";
export const remindersChangedEventName = "lifequest:reminders-changed";

type ReminderState = {
  /** Browser (OS) notifications opt-in. In-app banners always show. */
  browserEnabled: boolean;
  /** ISO date of the last day we fired a browser notification. */
  lastNotifiedDate?: string;
};

function read(storage: Storage): ReminderState {
  try {
    const raw = storage.getItem(remindersStorageKey);
    if (!raw) return { browserEnabled: false };
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const value = parsed as Partial<ReminderState>;
      return {
        browserEnabled: value.browserEnabled === true,
        lastNotifiedDate:
          typeof value.lastNotifiedDate === "string" ? value.lastNotifiedDate : undefined
      };
    }
  } catch {
    // fall through
  }
  return { browserEnabled: false };
}

function write(storage: Storage, state: ReminderState): void {
  try {
    storage.setItem(remindersStorageKey, JSON.stringify(state));
  } catch {
    // Non-fatal.
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(remindersChangedEventName));
  }
}

export function areBrowserRemindersEnabled(storage: Storage): boolean {
  return read(storage).browserEnabled;
}

export function setBrowserRemindersEnabled(storage: Storage, enabled: boolean): void {
  write(storage, { ...read(storage), browserEnabled: enabled });
}

export function shouldFireBrowserReminder(storage: Storage, today: string): boolean {
  const state = read(storage);
  return state.browserEnabled && state.lastNotifiedDate !== today;
}

export function markBrowserReminderFired(storage: Storage, today: string): void {
  write(storage, { ...read(storage), lastNotifiedDate: today });
}
