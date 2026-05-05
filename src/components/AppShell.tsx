"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { CharacterSprite } from "@/components/CharacterSprite";
import { JrpgIcon } from "@/components/JrpgIcon";
import { navigationItems } from "@/config/navigation";
import { isDemoModeEnabled, loadLocalDemoDataSet } from "@/data/demoDataRepository";
import { demoModeChangedEventName, hasDemoData } from "@/domain/demoData";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [isDemoActive, setIsDemoActive] = useState(false);

  useEffect(() => {
    function updateDemoState() {
      const data = loadLocalDemoDataSet(window.localStorage);
      setIsDemoActive(isDemoModeEnabled(window.localStorage) || hasDemoData(data));
    }

    updateDemoState();
    window.addEventListener("storage", updateDemoState);
    window.addEventListener(demoModeChangedEventName, updateDemoState);

    return () => {
      window.removeEventListener("storage", updateDemoState);
      window.removeEventListener(demoModeChangedEventName, updateDemoState);
    };
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/dashboard" aria-label="LifeQuest OS dashboard">
          <span className="brand-mark" aria-hidden="true">
            LQ
          </span>
          <span>
            <span className="eyebrow">Walking Skeleton</span>
            <strong>LifeQuest OS</strong>
          </span>
        </Link>
        {isDemoActive ? <span className="demo-data-badge app-demo-badge">Demo Data</span> : null}
        <section className="avatar-card" aria-label="Hero status">
          <div className="avatar-card-portrait">
            <CharacterSprite className="avatar-card-image" pose="idleFront" />
          </div>
          <div className="avatar-card-stats">
            <span className="eyebrow">Hero</span>
            <strong>Patrick</strong>
            <dl>
              <div>
                <dt>LV</dt>
                <dd>00</dd>
              </div>
              <div>
                <dt>HP</dt>
                <dd>
                  <span className="stat-bar stat-bar-hp" />
                </dd>
              </div>
              <div>
                <dt>MP</dt>
                <dd>
                  <span className="stat-bar stat-bar-mp" />
                </dd>
              </div>
            </dl>
          </div>
        </section>
        <nav className="nav-list" aria-label="Primary">
          {navigationItems.map((item) => (
            <Link
              aria-current={pathname === item.href ? "page" : undefined}
              className={pathname === item.href ? "nav-link nav-link-active" : "nav-link"}
              href={item.href}
              key={item.href}
            >
              <JrpgIcon name={item.icon} />
              <span>
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
            </Link>
          ))}
        </nav>
        <span className="nav-scroll-hint" aria-hidden="true">
          Swipe for more &gt;
        </span>
      </aside>
      <main className="content" id="content">
        {children}
      </main>
    </div>
  );
}
