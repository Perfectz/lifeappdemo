import { DemoModePanel } from "@/components/DemoModePanel";
import { PlaceholderPage } from "@/components/PlaceholderPage";
import { InstallReadinessPanel } from "@/components/InstallReadinessPanel";

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
