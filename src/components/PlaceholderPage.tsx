import { CharacterSprite } from "@/components/CharacterSprite";
import { JrpgIcon, type JrpgIconName } from "@/components/JrpgIcon";
import type { CharacterSpritePose } from "@/config/sprites";
import type { ReactNode } from "react";

type PlaceholderPageProps = {
  title: string;
  kicker: string;
  body: string;
  icon: JrpgIconName;
  pose?: CharacterSpritePose;
  children?: ReactNode;
  statusText?: string;
};

export function PlaceholderPage({
  title,
  kicker,
  body,
  icon,
  pose = "idleFront",
  children,
  statusText = "V00 placeholder. No product data is created or stored yet."
}: PlaceholderPageProps) {
  return (
    <section className="page-panel" aria-labelledby="page-title">
      <div className="page-heading">
        <JrpgIcon label={`${title} icon`} name={icon} />
        <div>
          <p className="eyebrow">{kicker}</p>
          <h1 id="page-title">{title}</h1>
        </div>
      </div>
      <div className="page-body">
        <p>{body}</p>
        <div className="page-sprite-frame" aria-hidden="true">
          <CharacterSprite className="page-sprite" pose={pose} />
        </div>
      </div>
      {children}
      <div className="status-line" role="status">
        <span className="status-gem" aria-hidden="true" />
        {statusText}
      </div>
    </section>
  );
}
