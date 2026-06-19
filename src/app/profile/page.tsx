import { MemoryPanel } from "@/components/MemoryPanel";
import { PersonalWikiEditor } from "@/components/PersonalWikiEditor";

export default function ProfilePage() {
  return (
    <div className="profile-page">
      <PersonalWikiEditor />
      <MemoryPanel />
    </div>
  );
}
