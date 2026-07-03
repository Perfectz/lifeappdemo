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
        label: "Morning Stand-Up",
        href: "/standup/morning",
        description: "Vitals, training & intention",
        icon: "morning",
        shortLabel: "Morning"
      },
      {
        label: "Vitals",
        href: "/vitals",
        description: "Glucose, BP & weight",
        icon: "metrics",
        shortLabel: "Vitals",
        primaryMobile: true
      },
      {
        label: "Food Diary",
        href: "/nutrition",
        description: "Calories & macros",
        icon: "metrics",
        shortLabel: "Food",
        primaryMobile: true
      },
      {
        label: "Fitness",
        href: "/fitness",
        description: "Daily training sessions",
        icon: "metrics",
        shortLabel: "Fitness",
        primaryMobile: true
      }
    ]
  },
  {
    id: "progress",
    caption: "Progress",
    items: [
      {
        label: "Character Sheet",
        href: "/character",
        description: "Level, stats & boss battles",
        icon: "trends",
        shortLabel: "Character"
      },
      {
        label: "Progress Photos",
        href: "/progress",
        description: "Front, profile & face — track the change",
        icon: "trends",
        shortLabel: "Progress"
      },
      {
        label: "Timeline Mirror",
        href: "/timeline-mirror",
        description: "Ideal Self vs Shadow Self — RPG timeline read",
        icon: "trends",
        shortLabel: "Mirror"
      },
      {
        label: "Metrics",
        href: "/metrics",
        description: "Energy & mood check-in",
        icon: "metrics"
      },
      {
        label: "Trends",
        href: "/trends",
        description: "Patterns over time",
        icon: "trends"
      },
      {
        label: "Health Import",
        href: "/health-import",
        description: "Sleep & device data",
        icon: "healthImport",
        shortLabel: "Health"
      }
    ]
  },
  {
    id: "coach",
    caption: "Coach",
    items: [
      {
        label: "AI Coach",
        href: "/coach",
        description: "Chat, photo & voice coaching",
        icon: "coach",
        shortLabel: "Coach"
      },
      {
        label: "About Me",
        href: "/profile",
        description: "Personal context for the AI",
        icon: "journal"
      }
    ]
  },
  {
    id: "more",
    caption: "More",
    items: [
      {
        label: "Quest Log",
        href: "/tasks",
        description: "Capture and clear quests",
        icon: "tasks",
        shortLabel: "Quests"
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
        label: "Reports",
        href: "/reports",
        description: "Daily report export",
        icon: "reports"
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
