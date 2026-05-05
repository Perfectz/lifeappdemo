import Link from "next/link";

import { CharacterSprite } from "@/components/CharacterSprite";
import { SectionHeader } from "@/components/SectionHeader";

export default function OfflinePage() {
  return (
    <section className="page-panel" aria-labelledby="offline-title">
      <div className="page-heading">
        <div className="brand-mark" aria-hidden="true">
          LQ
        </div>
        <div>
          <p className="eyebrow">Offline Shell</p>
          <h1 id="offline-title">LifeQuest OS</h1>
        </div>
      </div>
      <div className="page-body">
        <div>
          <p>
            The app shell is available offline. Local data already stored on this device
            remains in the browser, but AI coaching and fresh server requests need network access.
          </p>
          <section className="dashboard-section offline-route-list" aria-label="Offline route shortcuts">
            <SectionHeader eyebrow="Cached shell" title="Try a Core Route" />
            <div className="command-list">
              <Link className="command-button" href="/dashboard">
                Dashboard
              </Link>
              <Link className="command-button" href="/tasks">
                Quest Log
              </Link>
              <Link className="command-button" href="/settings">
                Install Settings
              </Link>
            </div>
          </section>
        </div>
        <div className="page-sprite-frame" aria-hidden="true">
          <CharacterSprite className="page-sprite" pose="thinking" />
        </div>
      </div>
    </section>
  );
}
