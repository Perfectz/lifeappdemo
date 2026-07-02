import type { Metadata } from "next";

import { MemoryPanel } from "@/components/MemoryPanel";
import { PersonalWikiEditor } from "@/components/PersonalWikiEditor";

export const metadata: Metadata = {
  title: "Profile"
};

export default function ProfilePage() {
  return (
    <div className="profile-page">
      <PersonalWikiEditor />
      <MemoryPanel />
    </div>
  );
}
