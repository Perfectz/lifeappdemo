export const openCommandPaletteEventName = "lifequest:command-palette-open";

/** Open the global command palette from anywhere (visible triggers, menus). */
export function openCommandPalette(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(openCommandPaletteEventName));
}
