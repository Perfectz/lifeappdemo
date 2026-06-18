"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { hasOnboarded, markOnboarded } from "@/client/onboarding";
import { openQuickAdd } from "@/client/quickAdd";
import { CharacterSprite } from "@/components/CharacterSprite";
import { createLocalTaskRepository } from "@/data/taskRepository";

const STEPS = [
  { icon: "🌅", title: "Plan", text: "Open a Morning Stand-Up and pick one Main Quest." },
  { icon: "⚔️", title: "Clear", text: "Work your Quest Log and complete quests to earn XP." },
  { icon: "🌙", title: "Reflect", text: "Close the day by journaling wins and lessons." },
  { icon: "📈", title: "Grow", text: "Watch Trends reveal your patterns over time." }
];

export function OnboardingWelcome() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const storage = window.localStorage;
    // First run = never onboarded AND no quests captured yet.
    const tasks = createLocalTaskRepository(storage).load();
    if (!hasOnboarded(storage) && tasks.length === 0) {
      setOpen(true);
    }
  }, []);

  function dismiss() {
    markOnboarded(window.localStorage);
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="onboarding-backdrop" role="presentation">
      <div
        className="onboarding-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
      >
        <div className="onboarding-sprite" aria-hidden="true">
          <CharacterSprite pose="idleFront" className="onboarding-sprite-img" />
        </div>
        <p className="eyebrow">Welcome, hero</p>
        <h2 id="onboarding-title" className="onboarding-title">
          LifeQuest OS
        </h2>
        <p className="onboarding-lead">
          Turn your day into a quest log. Here&apos;s the loop:
        </p>
        <ol className="onboarding-steps">
          {STEPS.map((step) => (
            <li key={step.title}>
              <span className="onboarding-step-icon" aria-hidden="true">
                {step.icon}
              </span>
              <span>
                <strong>{step.title}</strong>
                <small>{step.text}</small>
              </span>
            </li>
          ))}
        </ol>
        <div className="onboarding-actions">
          <button
            type="button"
            className="command-button"
            onClick={() => {
              dismiss();
              openQuickAdd();
            }}
          >
            <span>Add your first quest</span>
          </button>
          <Link
            href="/standup/morning"
            className="onboarding-secondary"
            onClick={dismiss}
          >
            Start a morning stand-up
          </Link>
        </div>
        <button type="button" className="onboarding-skip" onClick={dismiss}>
          Skip for now
        </button>
      </div>
    </div>
  );
}
