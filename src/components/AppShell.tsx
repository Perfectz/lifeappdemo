"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";

import { celebrate } from "@/client/celebrate";
import { openQuickAdd } from "@/client/quickAdd";
import { CelebrationOverlay } from "@/components/CelebrationOverlay";
import { CharacterSprite } from "@/components/CharacterSprite";
import { CloudSyncBootstrap } from "@/components/CloudSyncBootstrap";
import { CommandPalette } from "@/components/CommandPalette";
import { JrpgIcon } from "@/components/JrpgIcon";
import { OnboardingWelcome } from "@/components/OnboardingWelcome";
import { QuickAddQuest } from "@/components/QuickAddQuest";
import { LevelUpToast } from "@/components/LevelUpToast";
import { ReminderManager } from "@/components/ReminderManager";
import { StorageErrorToast } from "@/components/StorageErrorToast";
import { ThemeBootstrap } from "@/components/ThemeBootstrap";
import { VoiceAgent } from "@/components/VoiceAgent";
import { navigationFooterItems, navigationGroups } from "@/config/navigation";
import { createLocalDailyPlanRepository } from "@/data/dailyPlanRepository";
import { isDemoModeEnabled, loadLocalDemoDataSet } from "@/data/demoDataRepository";
import { createLocalMetricRepository } from "@/data/metricRepository";
import { createLocalTaskRepository } from "@/data/taskRepository";
import { dataChangedEventName } from "@/data/createLocalRepository";
import { useHeroName } from "@/client/useHeroName";
import { toLocalIsoDate } from "@/domain/dates";
import { demoModeChangedEventName, hasDemoData } from "@/domain/demoData";
import { formatHpMp, getHeroStatus, type HeroStatus } from "@/domain/heroStatus";
import { getHeroRank, getStreakMilestone } from "@/domain/progression";
import {
  getNavStatusMap,
  type NavStatus,
  type NavStatusMap
} from "@/domain/navStatus";

function NavLinkStatusMarker({ status }: { status: NavStatus | undefined }) {
  if (!status) return null;
  if (status.badge !== undefined && status.badge > 0) {
    return (
      <span className="nav-link-badge" aria-label={status.hint}>
        {status.badge > 99 ? "99+" : status.badge}
      </span>
    );
  }
  if (status.pulse) {
    return (
      <span
        className="nav-link-pulse"
        aria-hidden="true"
        title={status.hint ?? "Attention needed"}
      />
    );
  }
  return null;
}

type AppShellProps = {
  children: ReactNode;
};

const emptyHeroStatus: HeroStatus = {
  level: 1,
  totalCompleted: 0,
  xpCurrent: 0,
  xpForNextLevel: 5,
  hp: undefined,
  mp: undefined,
  hpMax: 5,
  mpMax: 5,
  streakDays: 0,
  questsToday: { planned: 0, completed: 0 }
};

function formatDateChip(date: Date): string {
  const weekday = date
    .toLocaleDateString("en-US", { weekday: "short" })
    .toUpperCase();
  const month = date.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  return `${weekday} ${date.getDate()} ${month}`;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [isDemoActive, setIsDemoActive] = useState(false);
  const [heroStatus, setHeroStatus] = useState<HeroStatus>(emptyHeroStatus);
  const [navStatus, setNavStatus] = useState<NavStatusMap>({});
  const [now, setNow] = useState<Date | null>(null);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const heroName = useHeroName();
  const prevProgressRef = useRef<{ level: number; streakDays: number } | null>(null);
  const moreButtonRef = useRef<HTMLButtonElement | null>(null);
  const moreCloseRef = useRef<HTMLButtonElement | null>(null);

  const closeMore = useCallback(() => setIsMoreOpen(false), []);

  // Close the More sheet whenever route changes.
  useEffect(() => {
    setIsMoreOpen(false);
  }, [pathname]);

  // Close on Escape while the sheet is open.
  useEffect(() => {
    if (!isMoreOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMoreOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMoreOpen]);

  // Move focus into the dialog when it opens; return it to the More button
  // when it closes.
  useEffect(() => {
    if (!isMoreOpen) return;
    const timer = window.setTimeout(() => moreCloseRef.current?.focus(), 20);
    return () => {
      window.clearTimeout(timer);
      moreButtonRef.current?.focus();
    };
  }, [isMoreOpen]);

  const primaryMobileItems = useMemo(
    () =>
      navigationGroups
        .flatMap((group) => group.items)
        .filter((item) => item.primaryMobile),
    []
  );
  const overflowGroups = useMemo(
    () =>
      navigationGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => !item.primaryMobile)
        }))
        .filter((group) => group.items.length > 0),
    []
  );

  // Count of overflow nav items (those hidden behind "More") that need
  // the player's attention. Used to badge the More button on mobile.
  const overflowPulseCount = useMemo(() => {
    const primaryHrefs = new Set(primaryMobileItems.map((item) => item.href));
    return Object.entries(navStatus).reduce((sum, [href, status]) => {
      if (!status || primaryHrefs.has(href)) return sum;
      if (status.badge !== undefined && status.badge > 0) return sum + 1;
      if (status.pulse) return sum + 1;
      return sum;
    }, 0);
  }, [navStatus, primaryMobileItems]);

  useEffect(() => {
    let lastComputedDay = "";

    // Hot path: runs on every data change. Reads each repo exactly once.
    function updateStatus() {
      const storage = window.localStorage;
      const stamp = new Date();
      const today = toLocalIsoDate(stamp);
      lastComputedDay = today;
      const tasks = createLocalTaskRepository(storage).load();
      const metrics = createLocalMetricRepository(storage).load();
      const plans = createLocalDailyPlanRepository(storage).load();
      const nextStatus = getHeroStatus(tasks, metrics, today);

      // Celebrate progression milestones — but only after the first
      // snapshot, so opening the app mid-streak doesn't fire a party.
      const prev = prevProgressRef.current;
      if (prev) {
        if (nextStatus.level > prev.level) {
          celebrate({
            kind: "levelup",
            title: `LEVEL UP — LV ${nextStatus.level}`,
            subtitle: getHeroRank(nextStatus.level),
            pose: "victory"
          });
        } else {
          const prevMilestone = getStreakMilestone(prev.streakDays);
          const nextMilestone = getStreakMilestone(nextStatus.streakDays);
          if (nextMilestone && nextMilestone !== prevMilestone) {
            celebrate({
              kind: "streak",
              title: `${nextMilestone}-DAY STREAK`,
              subtitle: "Don't break the chain.",
              pose: "questComplete"
            });
          }
        }
      }
      prevProgressRef.current = {
        level: nextStatus.level,
        streakDays: nextStatus.streakDays
      };

      setHeroStatus(nextStatus);
      setNavStatus(
        getNavStatusMap({
          tasks,
          plans,
          today,
          hour: stamp.getHours()
        })
      );
      setNow(stamp);
    }

    // Demo detection is expensive (reads the full demo set) and rarely
    // changes, so it's gated behind its own event instead of every save.
    function updateDemo() {
      const storage = window.localStorage;
      setIsDemoActive(isDemoModeEnabled(storage) || hasDemoData(loadLocalDemoDataSet(storage)));
    }

    function onStorage() {
      updateStatus();
      updateDemo();
    }

    // Data events are the usual trigger, but an app left open overnight never
    // fires one — so re-run when the local date rolls past the last computed
    // "today" (checked on tab focus and on a slow interval).
    function refreshOnDateChange() {
      if (toLocalIsoDate(new Date()) !== lastComputedDay) {
        updateStatus();
      }
    }

    updateStatus();
    updateDemo();
    window.addEventListener("storage", onStorage);
    window.addEventListener(dataChangedEventName, updateStatus);
    window.addEventListener(demoModeChangedEventName, updateDemo);
    document.addEventListener("visibilitychange", refreshOnDateChange);
    const dayWatchId = window.setInterval(refreshOnDateChange, 60_000);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(dataChangedEventName, updateStatus);
      window.removeEventListener(demoModeChangedEventName, updateDemo);
      document.removeEventListener("visibilitychange", refreshOnDateChange);
      window.clearInterval(dayWatchId);
    };
  }, []);

  const dateChip = useMemo(() => (now ? formatDateChip(now) : null), [now]);
  const xpPercent = Math.max(
    0,
    Math.min(100, Math.round((heroStatus.xpCurrent / heroStatus.xpForNextLevel) * 100))
  );
  const hpPercent =
    heroStatus.hp === undefined ? 0 : Math.round((heroStatus.hp / heroStatus.hpMax) * 100);
  const mpPercent =
    heroStatus.mp === undefined ? 0 : Math.round((heroStatus.mp / heroStatus.mpMax) * 100);

  return (
    <div className="app-shell">
      <ThemeBootstrap />
      <a className="skip-link" href="#content">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link className="brand" href="/dashboard" aria-label="LifeQuest OS dashboard">
          <span className="brand-mark" aria-hidden="true">
            LQ
          </span>
          <span className="brand-text">
            <span className="eyebrow" suppressHydrationWarning>
              {dateChip ?? "MAIN MENU"}
            </span>
            <strong>LifeQuest OS</strong>
          </span>
        </Link>
        {isDemoActive ? <span className="demo-data-badge app-demo-badge">Demo Data</span> : null}
        <section className="avatar-card" aria-label="Hero status">
          <div className="avatar-card-portrait">
            <CharacterSprite className="avatar-card-image" pose="idleFront" />
          </div>
          <div className="avatar-card-stats">
            <span className="eyebrow" suppressHydrationWarning>
              {getHeroRank(heroStatus.level)}
            </span>
            <strong suppressHydrationWarning>{heroName}</strong>
            <dl className="hero-stat-grid">
              <div>
                <dt>LV</dt>
                <dd className="hero-stat-value">
                  {String(heroStatus.level).padStart(2, "0")}
                </dd>
              </div>
              <div>
                <dt>HP</dt>
                <dd className="hero-stat-value">
                  <span className="hero-stat-readout">
                    {formatHpMp(heroStatus.hp, heroStatus.hpMax)}
                  </span>
                  <span className="stat-bar stat-bar-hp" aria-hidden="true">
                    <span style={{ width: `${hpPercent}%` }} />
                  </span>
                </dd>
              </div>
              <div>
                <dt>MP</dt>
                <dd className="hero-stat-value">
                  <span className="hero-stat-readout">
                    {formatHpMp(heroStatus.mp, heroStatus.mpMax)}
                  </span>
                  <span className="stat-bar stat-bar-mp" aria-hidden="true">
                    <span style={{ width: `${mpPercent}%` }} />
                  </span>
                </dd>
              </div>
              <div>
                <dt>EXP</dt>
                <dd className="hero-stat-value">
                  <span className="hero-stat-readout">
                    {heroStatus.xpCurrent}/{heroStatus.xpForNextLevel}
                  </span>
                  <span className="stat-bar stat-bar-xp" aria-hidden="true">
                    <span style={{ width: `${xpPercent}%` }} />
                  </span>
                </dd>
              </div>
            </dl>
            <p className="hero-streak" aria-label="Quest streak" suppressHydrationWarning>
              {getStreakMilestone(heroStatus.streakDays) ? (
                <span className="hero-streak-flame" aria-hidden="true">
                  🔥
                </span>
              ) : null}
              <span>STREAK</span>
              <strong>×{heroStatus.streakDays}</strong>
              <span>·</span>
              <span>QUESTS</span>
              <strong>
                {heroStatus.questsToday.completed}/{heroStatus.questsToday.planned + heroStatus.questsToday.completed}
              </strong>
            </p>
          </div>
        </section>
        <button
          type="button"
          className="quick-add-trigger"
          onClick={() => openQuickAdd()}
        >
          <span aria-hidden="true">+</span>
          <span>New Quest</span>
        </button>
        <nav className="nav-list" aria-label="Primary">
          {navigationGroups.map((group, groupIndex) => (
            <div className="nav-group" key={group.id}>
              <p className="nav-group-caption" aria-hidden="true">
                <span>{group.caption}</span>
              </p>
              <ul
                className="nav-group-list"
                aria-label={group.caption}
                role={groupIndex === 0 ? undefined : "list"}
              >
                {group.items.map((item) => {
                  const status = navStatus[item.href];
                  return (
                    <li key={item.href}>
                      <Link
                        aria-current={pathname === item.href ? "page" : undefined}
                        className={
                          pathname === item.href ? "nav-link nav-link-active" : "nav-link"
                        }
                        href={item.href}
                        title={status?.hint}
                      >
                        <JrpgIcon name={item.icon} />
                        <span>
                          <strong>{item.label}</strong>
                          <small>{item.description}</small>
                        </span>
                        <NavLinkStatusMarker status={status} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <span className="nav-scroll-hint" aria-hidden="true">
          Swipe for more &gt;
        </span>
        <nav className="nav-footer" aria-label="Account">
          {navigationFooterItems.map((item) => {
            const status = navStatus[item.href];
            return (
              <Link
                aria-current={pathname === item.href ? "page" : undefined}
                className={
                  pathname === item.href ? "nav-link nav-link-active" : "nav-link"
                }
                href={item.href}
                key={item.href}
                title={status?.hint}
              >
                <JrpgIcon name={item.icon} />
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
                <NavLinkStatusMarker status={status} />
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="content" id="content">
        {children}
      </main>
      <nav className="mobile-tabbar" aria-label="Mobile primary">
        {primaryMobileItems.map((item) => {
          const status = navStatus[item.href];
          return (
            <Link
              aria-current={pathname === item.href ? "page" : undefined}
              className={
                pathname === item.href
                  ? "mobile-tabbar-link mobile-tabbar-link-active"
                  : "mobile-tabbar-link"
              }
              href={item.href}
              key={`mobile-${item.href}`}
              title={status?.hint}
            >
              <JrpgIcon name={item.icon} />
              <span>{item.shortLabel ?? item.label}</span>
              <NavLinkStatusMarker status={status} />
            </Link>
          );
        })}
        <button
          type="button"
          ref={moreButtonRef}
          aria-haspopup="dialog"
          aria-expanded={isMoreOpen}
          aria-controls="more-menu-sheet"
          className={
            isMoreOpen
              ? "mobile-tabbar-link mobile-tabbar-link-more mobile-tabbar-link-active"
              : "mobile-tabbar-link mobile-tabbar-link-more"
          }
          onClick={() => setIsMoreOpen((open) => !open)}
        >
          <span className="mobile-more-glyph" aria-hidden="true">
            ▤
          </span>
          <span>More</span>
          {overflowPulseCount > 0 ? (
            <span
              className="nav-link-badge"
              aria-label={`${overflowPulseCount} item${overflowPulseCount === 1 ? "" : "s"} need attention`}
            >
              {overflowPulseCount}
            </span>
          ) : null}
        </button>
      </nav>
      {isMoreOpen ? (
        <div
          className="more-sheet-backdrop"
          role="presentation"
          onClick={closeMore}
        />
      ) : null}
      <aside
        className={isMoreOpen ? "more-sheet more-sheet-open" : "more-sheet"}
        id="more-menu-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="More menu"
        aria-hidden={!isMoreOpen}
      >
        <header className="more-sheet-header">
          <p className="eyebrow">Main Menu</p>
          <button
            type="button"
            ref={moreCloseRef}
            className="more-sheet-close"
            onClick={closeMore}
            aria-label="Close menu"
          >
            ✕
          </button>
        </header>
        <div className="more-sheet-body">
          {overflowGroups.map((group) => (
            <section className="more-sheet-group" key={group.id}>
              <p className="nav-group-caption" aria-hidden="true">
                <span>{group.caption}</span>
              </p>
              <ul className="more-sheet-list">
                {group.items.map((item) => {
                  const status = navStatus[item.href];
                  return (
                    <li key={item.href}>
                      <Link
                        aria-current={pathname === item.href ? "page" : undefined}
                        className={
                          pathname === item.href ? "nav-link nav-link-active" : "nav-link"
                        }
                        href={item.href}
                        onClick={closeMore}
                        title={status?.hint}
                      >
                        <JrpgIcon name={item.icon} />
                        <span>
                          <strong>{item.label}</strong>
                          <small>{item.description}</small>
                        </span>
                        <NavLinkStatusMarker status={status} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          <section className="more-sheet-group">
            <p className="nav-group-caption" aria-hidden="true">
              <span>Account</span>
            </p>
            <ul className="more-sheet-list">
              {navigationFooterItems.map((item) => {
                const status = navStatus[item.href];
                return (
                  <li key={item.href}>
                    <Link
                      aria-current={pathname === item.href ? "page" : undefined}
                      className={
                        pathname === item.href ? "nav-link nav-link-active" : "nav-link"
                      }
                      href={item.href}
                      onClick={closeMore}
                      title={status?.hint}
                    >
                      <JrpgIcon name={item.icon} />
                      <span>
                        <strong>{item.label}</strong>
                        <small>{item.description}</small>
                      </span>
                      <NavLinkStatusMarker status={status} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </aside>
      <button
        type="button"
        className="quick-add-fab"
        aria-label="New quest"
        onClick={() => openQuickAdd()}
      >
        +
      </button>
      <CommandPalette />
      <QuickAddQuest />
      <OnboardingWelcome />
      <ReminderManager />
      <StorageErrorToast />
      <CelebrationOverlay />
      <LevelUpToast />
      <CloudSyncBootstrap />
      <VoiceAgent />
    </div>
  );
}
