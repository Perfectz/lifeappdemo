import Image from "next/image";

import { withBasePath } from "@/config/site";

export type JrpgIconName =
  | "dashboard"
  | "tasks"
  | "morning"
  | "evening"
  | "healthImport"
  | "metrics"
  | "journal"
  | "reports"
  | "coach"
  | "settings";

type JrpgIconProps = {
  name: JrpgIconName;
  label?: string;
};

const iconAssets: Record<JrpgIconName, string> = {
  dashboard: "/assets/sprites/lifequest-nav-icons/01-dashboard.png",
  tasks: "/assets/sprites/lifequest-nav-icons/02-quest-log.png",
  morning: "/assets/sprites/lifequest-nav-icons/03-morning-standup.png",
  evening: "/assets/sprites/lifequest-nav-icons/04-evening-postmortem.png",
  healthImport: "/assets/sprites/lifequest-nav-icons/05-metrics.png",
  metrics: "/assets/sprites/lifequest-nav-icons/05-metrics.png",
  journal: "/assets/sprites/lifequest-nav-icons/06-journal.png",
  reports: "/assets/sprites/lifequest-nav-icons/07-reports.png",
  coach: "/assets/sprites/lifequest-nav-icons/07-reports.png",
  settings: "/assets/sprites/lifequest-nav-icons/08-settings.png"
};

export function JrpgIcon({ name, label }: JrpgIconProps) {
  return (
    <Image
      alt={label ?? ""}
      aria-hidden={label ? undefined : true}
      className="jrpg-icon"
      height={512}
      src={withBasePath(iconAssets[name])}
      unoptimized
      width={512}
    />
  );
}
