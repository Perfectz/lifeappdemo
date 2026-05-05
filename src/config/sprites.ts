export type CharacterSpritePose =
  | "idleFront"
  | "idleSide"
  | "idleBack"
  | "walkFrontOne"
  | "walkFrontTwo"
  | "walkSideOne"
  | "walkSideTwo"
  | "victory"
  | "questComplete"
  | "thinking"
  | "lowEnergy";

export type CharacterSpriteAsset = {
  alt: string;
  height: number;
  src: string;
  width: number;
};

export const characterSprites: Record<CharacterSpritePose, CharacterSpriteAsset> = {
  idleFront: {
    alt: "Pixel JRPG hero standing front-facing in a red jacket",
    height: 324,
    src: "/assets/sprites/patrick-idle-front.png",
    width: 220
  },
  idleSide: {
    alt: "Pixel JRPG hero standing side-facing in a red jacket",
    height: 318,
    src: "/assets/sprites/patrick-idle-side.png",
    width: 196
  },
  idleBack: {
    alt: "Pixel JRPG hero standing back-facing in a red jacket",
    height: 318,
    src: "/assets/sprites/patrick-idle-back.png",
    width: 218
  },
  walkFrontOne: {
    alt: "Pixel JRPG hero walking toward the viewer",
    height: 314,
    src: "/assets/sprites/patrick-walk-front-1.png",
    width: 216
  },
  walkFrontTwo: {
    alt: "Pixel JRPG hero walking alternate front frame",
    height: 314,
    src: "/assets/sprites/patrick-walk-front-2.png",
    width: 222
  },
  walkSideOne: {
    alt: "Pixel JRPG hero walking side frame",
    height: 310,
    src: "/assets/sprites/patrick-walk-side-1.png",
    width: 212
  },
  walkSideTwo: {
    alt: "Pixel JRPG hero walking alternate side frame",
    height: 310,
    src: "/assets/sprites/patrick-walk-side-2.png",
    width: 212
  },
  victory: {
    alt: "Pixel JRPG hero celebrating victory",
    height: 314,
    src: "/assets/sprites/patrick-victory.png",
    width: 308
  },
  questComplete: {
    alt: "Pixel JRPG hero holding a completed quest scroll",
    height: 314,
    src: "/assets/sprites/patrick-quest-complete.png",
    width: 296
  },
  thinking: {
    alt: "Pixel JRPG hero thinking with one hand on chin",
    height: 314,
    src: "/assets/sprites/patrick-thinking.png",
    width: 250
  },
  lowEnergy: {
    alt: "Pixel JRPG hero kneeling in low energy pose",
    height: 278,
    src: "/assets/sprites/patrick-low-energy.png",
    width: 256
  }
};
