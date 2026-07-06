"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent
} from "react";

import { openCommandPaletteEventName } from "@/client/commandPalette";
import { openQuickAdd } from "@/client/quickAdd";
import { JrpgIcon } from "@/components/JrpgIcon";
import {
  navigationFooterItems,
  navigationGroups,
  type NavigationItem
} from "@/config/navigation";

type CommandEntry = {
  id: string;
  label: string;
  description: string;
  hint: string;
  icon: NavigationItem["icon"];
  groupCaption: string;
} & ({ href: string; action?: undefined } | { href?: undefined; action: () => void });

function buildEntries(): CommandEntry[] {
  const entries: CommandEntry[] = [
    {
      id: "action:new-quest",
      label: "New Quest",
      description: "Capture a quest without leaving this page",
      hint: "Add",
      icon: "tasks",
      groupCaption: "Action",
      action: () => openQuickAdd()
    }
  ];

  for (const group of navigationGroups) {
    for (const item of group.items) {
      entries.push({
        id: `nav:${item.href}`,
        label: item.label,
        description: item.description,
        hint: "Go",
        icon: item.icon,
        href: item.href,
        groupCaption: group.caption
      });
    }
  }
  for (const item of navigationFooterItems) {
    entries.push({
      id: `nav:${item.href}`,
      label: item.label,
      description: item.description,
      hint: "Go",
      icon: item.icon,
      href: item.href,
      groupCaption: "Account"
    });
  }

  return entries;
}

function score(entry: CommandEntry, query: string): number {
  if (!query) return 1;
  const haystack = `${entry.label} ${entry.description} ${entry.groupCaption}`.toLowerCase();
  const needle = query.trim().toLowerCase();
  if (!needle) return 1;
  if (haystack.includes(needle)) {
    return entry.label.toLowerCase().startsWith(needle) ? 3 : 2;
  }

  // Fall back to subsequence match — every needle char appears in order.
  let cursor = 0;
  for (const char of needle) {
    const next = haystack.indexOf(char, cursor);
    if (next === -1) return 0;
    cursor = next + 1;
  }
  return 1;
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const entries = useMemo(buildEntries, []);

  const results = useMemo(() => {
    const scored = entries
      .map((entry) => ({ entry, score: score(entry, query) }))
      .filter((row) => row.score > 0);
    scored.sort((a, b) => b.score - a.score);
    return scored.map((row) => row.entry);
  }, [entries, query]);

  // Reset active index whenever the result list changes.
  useEffect(() => {
    setActive(0);
  }, [query, open]);

  // Global hotkey.
  useEffect(() => {
    function onKey(event: globalThis.KeyboardEvent) {
      const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform);
      const modifier = isMac ? event.metaKey : event.ctrlKey;
      if (modifier && (event.key === "k" || event.key === "K")) {
        event.preventDefault();
        setOpen((value) => !value);
        return;
      }
      if (event.key === "Escape" && open) {
        event.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Visible triggers (sidebar button, More sheet) dispatch this event so the
  // palette isn't reachable only through the keyboard shortcut.
  useEffect(() => {
    function onOpenRequest() {
      setOpen(true);
    }
    window.addEventListener(openCommandPaletteEventName, onOpenRequest);
    return () => window.removeEventListener(openCommandPaletteEventName, onOpenRequest);
  }, []);

  // Focus input when opening.
  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const timer = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(timer);
  }, [open]);

  // Keep the active row in view.
  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    if (!list) return;
    const node = list.children.item(active);
    if (node instanceof HTMLElement) {
      node.scrollIntoView({ block: "nearest" });
    }
  }, [active, open]);

  const close = useCallback(() => setOpen(false), []);

  const choose = useCallback(
    (entry: CommandEntry) => {
      setOpen(false);
      if (entry.action) {
        entry.action();
      } else if (entry.href) {
        router.push(entry.href);
      }
    },
    [router]
  );

  function handleKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || (event.ctrlKey && event.key === "n")) {
      event.preventDefault();
      setActive((index) => (results.length === 0 ? 0 : (index + 1) % results.length));
    } else if (event.key === "ArrowUp" || (event.ctrlKey && event.key === "p")) {
      event.preventDefault();
      setActive((index) =>
        results.length === 0 ? 0 : (index - 1 + results.length) % results.length
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      const target = results[active];
      if (target) {
        choose(target);
      }
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div
      className="command-palette-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          close();
        }
      }}
    >
      <div
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command menu"
      >
        <header className="command-palette-header">
          <p className="eyebrow">Command</p>
          <kbd className="command-palette-kbd">Esc</kbd>
        </header>
        <div className="command-palette-input-row">
          <span className="command-palette-prompt" aria-hidden="true">
            ▶
          </span>
          <input
            ref={inputRef}
            type="text"
            spellCheck={false}
            autoComplete="off"
            className="command-palette-input"
            placeholder="Type a command or page name..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKey}
            aria-label="Command search"
            aria-controls="command-palette-list"
            aria-activedescendant={
              results[active] ? `command-palette-row-${results[active].id}` : undefined
            }
          />
        </div>
        {results.length === 0 ? (
          <p className="command-palette-empty">No match. Press Esc to close.</p>
        ) : (
          <ul
            ref={listRef}
            className="command-palette-list"
            id="command-palette-list"
            role="listbox"
          >
            {results.map((entry, index) => (
              <li
                key={entry.id}
                id={`command-palette-row-${entry.id}`}
                role="option"
                aria-selected={index === active}
                className={
                  index === active
                    ? "command-palette-row command-palette-row-active"
                    : "command-palette-row"
                }
                onMouseMove={() => setActive(index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(entry);
                }}
              >
                <span className="command-palette-cursor" aria-hidden="true">
                  {index === active ? "▶" : ""}
                </span>
                <JrpgIcon name={entry.icon} />
                <span className="command-palette-row-text">
                  <strong>{entry.label}</strong>
                  <small>
                    {entry.groupCaption} · {entry.description}
                  </small>
                </span>
                <span className="command-palette-row-hint">{entry.hint}</span>
              </li>
            ))}
          </ul>
        )}
        <footer className="command-palette-footer">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> navigate
          </span>
          <span>
            <kbd>Enter</kbd> open
          </span>
          <span>
            <kbd>Ctrl</kbd>+<kbd>K</kbd> toggle
          </span>
        </footer>
      </div>
    </div>
  );
}
