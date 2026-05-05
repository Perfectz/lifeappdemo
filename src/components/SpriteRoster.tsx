import { CharacterSprite } from "@/components/CharacterSprite";
import type { CharacterSpritePose } from "@/config/sprites";

const roster: Array<{ label: string; pose: CharacterSpritePose }> = [
  { label: "Idle", pose: "idleFront" },
  { label: "Victory", pose: "victory" },
  { label: "Quest", pose: "questComplete" },
  { label: "Focus", pose: "thinking" }
];

export function SpriteRoster() {
  return (
    <section className="sprite-roster" aria-label="Hero sprite poses">
      {roster.map((item) => (
        <figure className="sprite-roster-card" key={item.pose}>
          <CharacterSprite className="sprite-roster-image" pose={item.pose} />
          <figcaption>{item.label}</figcaption>
        </figure>
      ))}
    </section>
  );
}
