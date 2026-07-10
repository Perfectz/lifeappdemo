"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { hasOnboarded, markOnboarded } from "@/client/onboarding";
import { openQuickAdd } from "@/client/quickAdd";
import { CharacterSprite } from "@/components/CharacterSprite";
import { createLocalTaskRepository } from "@/data/taskRepository";

const STEPS = [
  { icon: "🧭", title: "Choose direction", text: "Set a goal that defines the future you are building." },
  { icon: "🌅", title: "Plan today", text: "Pick the quests, training, and health actions that matter now." },
  { icon: "⚔️", title: "Act and log", text: "Clear quests and capture food, vitals, training, and lessons." },
  { icon: "📈", title: "Review and adapt", text: "Use trends and weekly reviews to adjust the next plan." }
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
          Turn your long-term direction into a plan you can execute today:
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
          <Link
            href="/setup"
            className="command-button"
            onClick={dismiss}
          >
            <span>Personalize my plan</span>
          </Link>
          <button
            type="button"
            className="onboarding-secondary"
            onClick={() => {
              dismiss();
              openQuickAdd();
            }}
          >
            Add a quest first
          </button>
        </div>
        <button type="button" className="onboarding-skip" onClick={dismiss}>
          Skip for now
        </button>
      </div>
    </div>
  );
}
