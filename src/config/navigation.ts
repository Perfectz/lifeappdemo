import type { JrpgIconName } from "@/components/JrpgIcon";

export type NavigationItem = {
  label: string;
  href: string;
  description: string;
  icon: JrpgIconName;
  /** Optional shorter label for tight contexts (mobile tabbar, command palette). */
  shortLabel?: string;
  /** When true, surfaces in the mobile tabbar's primary 4 slots. */
  primaryMobile?: boolean;
};

export type NavigationGroup = {
  id: string;
  caption: string;
  items: NavigationItem[];
};

export const navigationGroups: NavigationGroup[] = [
  {
    id: "today",
    caption: "Today",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        description: "Today command center",
        icon: "dashboard",
        shortLabel: "Home",
        primaryMobile: true
      },
      {
        label: "Fitness",
        href: "/fitness",
        description: "Daily training sessions",
        icon: "metrics",
        shortLabel: "Train",
        primaryMobile: true
      },
      {
        label: "Quest Log",
        href: "/tasks",
        description: "Capture and clear quests",
        icon: "tasks",
        shortLabel: "Quests",
        primaryMobile: true
      },
      {
        label: "Morning Stand-Up",
        href: "/standup/morning",
        description: "Plan the day",
        icon: "morning",
        shortLabel: "Morning",
        primaryMobile: true
      },
      {
        label: "Evening Postmortem",
        href: "/standup/evening",
        description: "Close the day",
        icon: "evening",
        shortLabel: "Evening"
      }
    ]
  },
  {
    id: "reflect",
    caption: "Reflect",
    items: [
      {
        label: "Metrics",
        href: "/metrics",
        description: "Energy check-in",
        icon: "metrics"
      },
      {
        label: "Vitals",
        href: "/vitals",
        description: "Glucose, BP & weight",
        icon: "metrics"
      },
      {
        label: "Health Import",
        href: "/health-import",
        description: "Samsung export alpha",
        icon: "healthImport",
        shortLabel: "Health"
      },
      {
        label: "Journal",
        href: "/journal",
        description: "Lesson capture",
        icon: "journal"
      },
      {
        label: "Notes",
        href: "/notes",
        description: "Quick field notes",
        icon: "journal"
      },
      {
        label: "Trends",
        href: "/trends",
        description: "Patterns over time",
        icon: "trends"
      }
    ]
  },
  {
    id: "tools",
    caption: "Tools",
    items: [
      {
        label: "Reports",
        href: "/reports",
        description: "Daily report export",
        icon: "reports"
      },
      {
        label: "AI Coach",
        href: "/coach",
        description: "Read-only coach mode",
        icon: "coach",
        shortLabel: "Coach"
      },
      {
        label: "Capture",
        href: "/capture",
        description: "Log from a photo",
        icon: "healthImport"
      }
    ]
  }
];

export const navigationFooterItems: NavigationItem[] = [
  {
    label: "Settings",
    href: "/settings",
    description: "Configuration",
    icon: "settings"
  }
];

/**
 * Flat list of every navigable destination (primary + footer). Kept for
 * tests, command-palette indexing, and any consumer that needs the
 * pre-grouped shape.
 */
export const navigationItems: NavigationItem[] = [
  ...navigationGroups.flatMap((group) => group.items),
  ...navigationFooterItems
];
