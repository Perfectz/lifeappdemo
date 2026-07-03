"use client";

import { useEffect, useRef, useState } from "react";

import { SectionHeader } from "@/components/SectionHeader";
import { createLocalFoodEntryRepository } from "@/data/foodEntryRepository";
import { scaleMacros, type FoodSearchItem } from "@/domain/foodSearch";
import { createFoodEntry, mealTypes } from "@/domain/nutrition";
import type { MealType } from "@/domain";

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

type DetectorLike = { detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>> };

function barcodeDetectorSupported(): boolean {
  return typeof window !== "undefined" && "BarcodeDetector" in window;
}

export function FoodSearch({ date }: { date: string }) {
  const [meal, setMeal] = useState<MealType>(defaultMealForNow());
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodSearchItem[]>([]);
  const [grams, setGrams] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [barcode, setBarcode] = useState("");
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  // Monotonic id so an older, slower request can't overwrite newer results.
  const requestIdRef = useRef(0);

  const stopScan = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScanning(false);
  };

  useEffect(() => () => stopScan(), []);

  // Wire the camera + detect loop only AFTER the <video> mounts (when scanning
  // flips true). Doing this synchronously inside startScan failed because the
  // video ref isn't attached until the next render.
  useEffect(() => {
    if (!scanning) return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    let cancelled = false;
    video.srcObject = stream;

    let detector: DetectorLike;
    try {
      const Detector = (window as unknown as { BarcodeDetector: new (opts?: unknown) => DetectorLike })
        .BarcodeDetector;
      try {
        detector = new Detector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39"] });
      } catch {
        detector = new Detector();
      }
    } catch {
      setError("Barcode scanning isn't available here — type the number instead.");
      stopScan();
      return;
    }

    const tick = async () => {
      if (cancelled || !videoRef.current) return;
      try {
        const codes = await detector.detect(videoRef.current);
        if (codes.length > 0 && codes[0].rawValue) {
          const code = codes[0].rawValue;
          stopScan();
          setBarcode(code);
          void lookupBarcode(code);
          return;
        }
      } catch {
        // transient detect error — keep trying
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    video
      .play()
      .then(() => {
        rafRef.current = requestAnimationFrame(tick);
      })
      .catch(() => {
        setError("Couldn't start the camera preview.");
        stopScan();
      });

    return () => {
      cancelled = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  function showResults(items: FoodSearchItem[]) {
    setResults(items);
    setGrams(
      Object.fromEntries(items.map((item) => [item.code || item.name, String(item.servingSizeG ?? 100)]))
    );
  }

  async function search() {
    const q = query.trim();
    if (q.length < 2) {
      setError("Type at least two characters.");
      return;
    }
    setError(null);
    setStatus(null);
    setLoading(true);
    const requestId = ++requestIdRef.current;
    try {
      const response = await fetch(`/api/food/search?q=${encodeURIComponent(q)}`);
      const data = await response.json();
      if (requestId !== requestIdRef.current) return; // superseded by a newer request
      if (!response.ok) throw new Error(data.error ?? "Search failed.");
      showResults(Array.isArray(data.items) ? data.items : []);
      if (!data.items?.length) setError("No matches. Try different words or add it manually.");
    } catch (searchError) {
      if (requestId !== requestIdRef.current) return;
      setError(searchError instanceof Error ? searchError.message : "Search failed.");
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }

  async function lookupBarcode(code: string) {
    setError(null);
    setStatus(null);
    setLoading(true);
    const requestId = ++requestIdRef.current;
    try {
      const response = await fetch(`/api/food/barcode?code=${encodeURIComponent(code)}`);
      const data = await response.json();
      if (requestId !== requestIdRef.current) return; // superseded by a newer request
      if (!response.ok) throw new Error(data.error ?? "Lookup failed.");
      showResults(data.item ? [data.item] : []);
    } catch (lookupError) {
      if (requestId !== requestIdRef.current) return;
      setError(lookupError instanceof Error ? lookupError.message : "Lookup failed.");
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }

  async function startScan() {
    if (!barcodeDetectorSupported()) {
      setError("Barcode scanning isn't supported on this browser — type the number or search by name.");
      return;
    }
    setError(null);
    try {
      // Acquire the camera, then flip `scanning` on — the effect above wires up
      // the preview + detect loop once the <video> has mounted.
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      setScanning(true);
    } catch {
      setError("Couldn't open the camera — allow camera access, or type the barcode number instead.");
      stopScan();
    }
  }

  function addItem(item: FoodSearchItem) {
    const key = item.code || item.name;
    const g = Number(grams[key]);
    const amount = Number.isFinite(g) && g > 0 ? g : 100;
    const repo = createLocalFoodEntryRepository(window.localStorage);
    const entry = createFoodEntry({
      date,
      mealType: meal,
      description: `${item.name}${item.brand ? ` (${item.brand})` : ""} — ${amount}g`,
      macros: scaleMacros(item.per100g, amount),
      estimateSource: "barcode"
    });
    repo.save([entry, ...repo.load()]);
    setStatus(`Added ${item.name} to ${MEAL_LABEL[meal]}.`);
  }

  return (
    <section className="dashboard-section food-search" aria-label="Search the food database">
      <SectionHeader eyebrow="Database" title="Search foods or scan a barcode" />

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

      <label className="fitness-label">
        Add to
        <select className="fitness-input" value={meal} onChange={(e) => setMeal(e.target.value as MealType)}>
          {mealTypes.map((option) => (
            <option key={option} value={option}>
              {MEAL_LABEL[option]}
            </option>
          ))}
        </select>
      </label>

      <div className="food-search-row">
        <input
          className="fitness-input"
          aria-label="Search foods"
          placeholder="Search foods (e.g. greek yogurt)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void search();
            }
          }}
        />
        <button type="button" className="nutri-mini-btn" onClick={search} disabled={loading}>
          {loading ? "…" : "Search"}
        </button>
      </div>

      <div className="food-search-row">
        <input
          className="fitness-input"
          inputMode="numeric"
          aria-label="Barcode number"
          placeholder="Barcode number"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
        />
        <button type="button" className="nutri-mini-btn" onClick={() => lookupBarcode(barcode.trim())} disabled={loading || !barcode.trim()}>
          Look up
        </button>
        {barcodeDetectorSupported() ? (
          <button type="button" className="nutri-mini-btn" onClick={scanning ? stopScan : startScan}>
            {scanning ? "Stop" : "Scan"}
          </button>
        ) : null}
      </div>

      {scanning ? (
        <video ref={videoRef} className="food-search-video" muted playsInline aria-label="Barcode camera" />
      ) : null}

      {results.length > 0 ? (
        <ul className="food-search-results">
          {results.map((item) => {
            const key = item.code || item.name;
            return (
              <li className="food-search-result" key={key}>
                <div className="food-search-result-info">
                  <strong>{item.name}</strong>
                  <small>
                    {item.brand ? `${item.brand} · ` : ""}
                    {item.per100g.calories ?? "?"} cal / 100g
                  </small>
                </div>
                <div className="food-search-result-add">
                  <input
                    className="fitness-input"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    aria-label={`Grams of ${item.name}`}
                    value={grams[key] ?? "100"}
                    onChange={(e) => setGrams((current) => ({ ...current, [key]: e.target.value }))}
                  />
                  <span className="food-search-g">g</span>
                  <button type="button" className="nutri-mini-btn" onClick={() => addItem(item)}>
                    Add
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      <p className="health-boundary">
        Nutrition from Open Food Facts (community database) — values can vary; adjust if needed.
      </p>
    </section>
  );
}
