import { SetupWizard } from "@/components/SetupWizard";

export default function SetupPage() {
  return (
    <section className="standup-page" aria-labelledby="setup-title">
      <header className="standup-hero">
        <div>
          <p className="eyebrow">Getting started</p>
          <h1 id="setup-title">Quick setup</h1>
          <p>Tell the app your goals so everything is tuned to you.</p>
        </div>
      </header>
      <SetupWizard />
    </section>
  );
}
