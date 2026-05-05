import type { JrpgIconName } from "@/components/JrpgIcon";

export type NavigationItem = {
  label: string;
  href: string;
  description: string;
  icon: JrpgIconName;
};

export const navigationItems: NavigationItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    description: "Today command center",
    icon: "dashboard"
  },
  {
    label: "Quest Log",
    href: "/tasks",
    description: "Capture and clear quests",
    icon: "tasks"
  },
  {
    label: "Morning Stand-Up",
    href: "/standup/morning",
    description: "Plan the day",
    icon: "morning"
  },
  {
    label: "Evening Postmortem",
    href: "/standup/evening",
    description: "Close the day",
    icon: "evening"
  },
  {
    label: "Metrics",
    href: "/metrics",
    description: "Energy check-in",
    icon: "metrics"
  },
  {
    label: "Health Import",
    href: "/health-import",
    description: "Samsung export alpha",
    icon: "healthImport"
  },
  {
    label: "Journal",
    href: "/journal",
    description: "Lesson capture",
    icon: "journal"
  },
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
    icon: "coach"
  },
  {
    label: "Settings",
    href: "/settings",
    description: "Configuration",
    icon: "settings"
  }
];
