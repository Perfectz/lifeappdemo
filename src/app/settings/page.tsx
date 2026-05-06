import { DemoModePanel } from "@/components/DemoModePanel";
import { PlaceholderPage } from "@/components/PlaceholderPage";
import { InstallReadinessPanel } from "@/components/InstallReadinessPanel";
import { OpenAISettingsPanel } from "@/components/OpenAISettingsPanel";

export default function SettingsPage() {
  return (
    <PlaceholderPage
      title="Settings"
      kicker="Configuration"
      body="Install LifeQuest OS as a PWA, keep the local shell available when the network drops, and add your OpenAI token for on-device AI calls."
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
          <h2>OpenAI Access Token</h2>
          <OpenAISettingsPanel />
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
            fresh server HTML to avoid stale hydration. AI chat can run from the installed
            PWA when an OpenAI token is saved on the device; voice sessions and fresh server
            requests still require network access and are not cached by the service worker.
          </p>
        </section>
      </div>
    </PlaceholderPage>
  );
}
