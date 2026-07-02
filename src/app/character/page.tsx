import type { Metadata } from "next";

import { CharacterScreen } from "@/components/CharacterScreen";

export const metadata: Metadata = {
  title: "Character"
};

export default function CharacterPage() {
  return <CharacterScreen />;
}
