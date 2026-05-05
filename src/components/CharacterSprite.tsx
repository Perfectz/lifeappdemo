import Image from "next/image";

import {
  characterSprites,
  type CharacterSpritePose
} from "@/config/sprites";
import { withBasePath } from "@/config/site";

type CharacterSpriteProps = {
  className?: string;
  pose: CharacterSpritePose;
};

export function CharacterSprite({ className, pose }: CharacterSpriteProps) {
  const sprite = characterSprites[pose];

  return (
    <Image
      alt={sprite.alt}
      className={className ? `character-sprite ${className}` : "character-sprite"}
      height={sprite.height}
      priority={pose === "idleFront"}
      src={withBasePath(sprite.src)}
      unoptimized
      width={sprite.width}
    />
  );
}
