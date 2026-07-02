import type { Metadata } from "next";

import { CloudSyncPanel } from "@/components/CloudSyncPanel";
import { DataBackupPanel } from "@/components/DataBackupPanel";
import { DemoModePanel } from "@/components/DemoModePanel";
import { PushNotificationsPanel } from "@/components/PushNotificationsPanel";
import { pushNotificationsEnabled } from "@/config/features";
import { PlaceholderPage } from "@/components/PlaceholderPage";
import { InstallReadinessPanel } from "@/components/InstallReadinessPanel";
import { MemberApprovalPanel } from "@/components/MemberApprovalPanel";
import { ProfilePanel } from "@/components/ProfilePanel";
import { RemindersPanel } from "@/components/RemindersPanel";
import { SoundPanel } from "@/components/SoundPanel";
import { ThemePicker } from "@/components/ThemePicker";

export const metadata: Metadata = {
  title: "Settings"
};

export default function SettingsPage() {
  return (
    <PlaceholderPage
      title="Settings"
      kicker="Configuration"
      body="Install LifeQuest OS as a PWA and keep the local shell available when the network drops. AI still requires network access."
      icon="settings"
      pose="thinking"
      statusText="PWA install and stale-safe offline shell. No product sync or offline AI is enabled."
    >
      <div className="settings-install-grid">
        <MemberApprovalPanel />
        <section className="dashboard-section">
          <h2>Hero Profile</h2>
          <ProfilePanel />
        </section>
        <section className="dashboard-section">
          <h2>Reminders</h2>
          <RemindersPanel />
        </section>
        <section className="dashboard-section">
          <h2>Menu Theme</h2>
          <ThemePicker />
        </section>
        <section className="dashboard-section">
          <h2>Game Sound</h2>
          <SoundPanel />
        </section>
        <section className="dashboard-section">
          <h2>Cloud Sync</h2>
          <CloudSyncPanel />
        </section>
        {pushNotificationsEnabled ? (
          <section className="dashboard-section">
            <h2>Phone Reminders</h2>
            <PushNotificationsPanel />
          </section>
        ) : null}
        <section className="dashboard-section">
          <h2>Backup &amp; Restore</h2>
          <DataBackupPanel />
        </section>
        <section className="dashboard-section">
          <h2>Portfolio Demo Mode</h2>
          <DemoModePanel />
        </section>
        <section className="dashboard-section">
          <h2>Install Readiness</h2>
          <InstallReadinessPanel />
        </section>
        <section className="dashboard-section">
          <h2>Android Install Steps</h2>
          <ol className="settings-steps">
            <li>Open LifeQuest OS in Chrome on Android.</li>
            <li>Open the browser menu.</li>
            <li>Choose Add to Home screen or Install app.</li>
            <li>Launch from the home screen for standalone mode.</li>
          </ol>
        </section>
        <section className="dashboard-section">
          <h2>Offline Boundary</h2>
          <p>
            The offline shell and static assets are cached after first load. App routes use
            fresh server HTML to avoid stale hydration, while AI chat, AI tool confirmation,
            health APIs, and fresh server requests require network access and are not cached
            by the service worker.
          </p>
        </section>
      </div>
    </PlaceholderPage>
  );
}
