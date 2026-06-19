"use client";

import { useRef, useState } from "react";

import { createClientId } from "@/client/clientIds";
import { fileToDownscaledDataUrl } from "@/client/imageDownscale";
import { SectionHeader } from "@/components/SectionHeader";
import { createLocalFoodEntryRepository } from "@/data/foodEntryRepository";
import { createFoodEntry, mealTypes } from "@/domain/nutrition";
import { parseMealEstimate, sumEstimateCalories } from "@/domain/mealEstimate";
import type { MealType } from "@/domain";

type EditableItem = {
  id: string;
  description: string;
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  fiberG?: number;
};

const MEAL_LABEL: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks"
};

function defaultMealForNow(): MealType {
  const hour = new Date().getHours();
  if (hour < 11) return "breakfast";
  if (hour < 16) return "lunch";
  if (hour < 21) return "dinner";
  return "snack";
}

function numOrUndefined(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export function MealPhotoLogger({ date }: { date: string }) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [meal, setMeal] = useState<MealType>(defaultMealForNow());
  const [preview, setPreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [items, setItems] = useState<EditableItem[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [question, setQuestion] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  function reset() {
    setPreview(null);
    setItems([]);
    setSummary(null);
    setQuestion(null);
    setConfidence(null);
    setError(null);
  }

  async function analyze(file: File) {
    if (!navigator.onLine) {
      setError("Reading a meal photo needs a network connection.");
      return;
    }
    setError(null);
    setStatus(null);
    setItems([]);
    let dataUrl: string;
    try {
      dataUrl = await fileToDownscaledDataUrl(file, 1024);
    } catch {
      setError("Couldn't read that image.");
      return;
    }
    setPreview(dataUrl);
    setAnalyzing(true);
    try {
      const response = await fetch("/api/ai/meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Couldn't read that meal photo.");
      const estimate = parseMealEstimate(data);
      setSummary(estimate.summary);
      setConfidence(estimate.confidence);
      setQuestion(estimate.question ?? null);
      setItems(estimate.items.map((item) => ({ id: createClientId("meal"), ...item })));
      if (estimate.items.length === 0) {
        setError("The AI couldn't identify foods in that photo. Try a clearer shot or add items manually.");
      }
    } catch (analyzeError) {
      setError(analyzeError instanceof Error ? analyzeError.message : "Meal analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  }

  function updateItem(id: string, field: keyof EditableItem, value: string) {
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, [field]: field === "description" ? value : numOrUndefined(value) }
          : item
      )
    );
  }

  function removeItem(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  function addToDiary() {
    const valid = items.filter((item) => item.description.trim());
    if (valid.length === 0) {
      setError("Nothing to add.");
      return;
    }
    const repo = createLocalFoodEntryRepository(window.localStorage);
    const entries = valid.map((item) =>
      createFoodEntry({
        date,
        mealType: meal,
        description: item.description.trim(),
        macros: {
          calories: item.calories,
          proteinG: item.proteinG,
          carbsG: item.carbsG,
          fatG: item.fatG,
          fiberG: item.fiberG
        },
        estimateSource: "photo_ai",
        confidence:
          confidence === "high" || confidence === "medium" || confidence === "low"
            ? confidence
            : undefined
      })
    );
    repo.save([...entries, ...repo.load()]);
    setStatus(`Added ${entries.length} item${entries.length === 1 ? "" : "s"} to ${MEAL_LABEL[meal]}.`);
    reset();
  }

  const totalCalories = sumEstimateCalories(items);

  return (
    <section className="dashboard-section meal-photo" aria-label="Estimate a meal from a photo">
      <SectionHeader eyebrow="AI" title="Snap a meal → nutrition" />
      <p className="reminders-help">
        Take or upload a photo of your meal and the AI estimates the calories and macros. Review and
        edit before adding to your diary.
      </p>

      {status ? (
        <p className="standup-success" role="status">
          {status}
        </p>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="meal-photo-controls">
        <label className="fitness-label meal-photo-meal">
          Meal
          <select className="fitness-input" value={meal} onChange={(event) => setMeal(event.target.value as MealType)}>
            {mealTypes.map((option) => (
              <option key={option} value={option}>
                {MEAL_LABEL[option]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="login-submit meal-photo-snap"
          onClick={() => fileInputRef.current?.click()}
          disabled={analyzing}
        >
          <span>{analyzing ? "Reading photo…" : preview ? "Try another photo" : "Snap / upload meal photo"}</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="visually-hidden"
          aria-label="Choose a meal photo"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void analyze(file);
            event.target.value = "";
          }}
        />
      </div>

      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="meal-photo-preview" src={preview} alt="Meal preview" />
      ) : null}

      {summary ? (
        <p className="meal-photo-summary">
          {summary}
          {confidence ? <span className={`meal-photo-confidence meal-photo-confidence-${confidence}`}>{confidence} confidence</span> : null}
        </p>
      ) : null}
      {question ? <p className="reminders-help">{question}</p> : null}

      {items.length > 0 ? (
        <>
          <ul className="meal-photo-items">
            {items.map((item) => (
              <li className="meal-photo-item" key={item.id}>
                <input
                  className="fitness-input meal-photo-desc"
                  aria-label="Food description"
                  value={item.description}
                  onChange={(event) => updateItem(item.id, "description", event.target.value)}
                />
                <div className="meal-photo-macros">
                  <label>
                    cal
                    <input className="fitness-input" type="number" inputMode="numeric" min={0} value={item.calories ?? ""} onChange={(event) => updateItem(item.id, "calories", event.target.value)} />
                  </label>
                  <label>
                    P
                    <input className="fitness-input" type="number" inputMode="numeric" min={0} value={item.proteinG ?? ""} onChange={(event) => updateItem(item.id, "proteinG", event.target.value)} />
                  </label>
                  <label>
                    C
                    <input className="fitness-input" type="number" inputMode="numeric" min={0} value={item.carbsG ?? ""} onChange={(event) => updateItem(item.id, "carbsG", event.target.value)} />
                  </label>
                  <label>
                    F
                    <input className="fitness-input" type="number" inputMode="numeric" min={0} value={item.fatG ?? ""} onChange={(event) => updateItem(item.id, "fatG", event.target.value)} />
                  </label>
                  <button type="button" className="nutri-remove" aria-label={`Remove ${item.description}`} onClick={() => removeItem(item.id)}>
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <button type="button" className="login-submit" onClick={addToDiary}>
            <span>
              Add {items.length} item{items.length === 1 ? "" : "s"}
              {totalCalories > 0 ? ` (~${totalCalories} cal)` : ""} to {MEAL_LABEL[meal]}
            </span>
          </button>
        </>
      ) : null}

      <p className="health-boundary">
        AI estimates are approximate — adjust anything that looks off. Not medical or dietetic advice.
      </p>
    </section>
  );
}
