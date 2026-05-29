export const openQuickAddEventName = "lifequest:quick-add-open";

/** Open the global quick-add quest capture from anywhere. */
export function openQuickAdd(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(openQuickAddEventName));
}
