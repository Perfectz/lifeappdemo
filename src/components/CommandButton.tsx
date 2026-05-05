import Link from "next/link";
import type { ReactNode } from "react";

import { JrpgIcon, type JrpgIconName } from "@/components/JrpgIcon";

type CommandButtonProps = {
  children: ReactNode;
  href: string;
  icon?: JrpgIconName;
};

export function CommandButton({ children, href, icon }: CommandButtonProps) {
  return (
    <Link className="command-button" href={href}>
      {icon ? <JrpgIcon name={icon} /> : null}
      <span>{children}</span>
    </Link>
  );
}
