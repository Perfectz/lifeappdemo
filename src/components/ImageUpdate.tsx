"use client";

import { useRef, useState } from "react";

import { SectionHeader } from "@/components/SectionHeader";
import { executeVoiceTool } from "@/client/voiceTools";
import { parseVisionResult, shouldRequestDetail, type VisionResult } from "@/domain/visionUpdates";

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

async function fileToDownscaledDataUrl(file: File, maxDim = 1024): Promise<string> {
  const original = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the image."));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("Could not decode the image."));
    element.src = original;
  });

  const scale = Math.min(1, maxDim / Math.max(image.width, image.height));
  if (scale >= 1) return original;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return original;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

type Applied = { okCount: number; outcomes: { label: string; ok: boolean; message: string }[] };

export function ImageUpdate() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<VisionResult | null>(null);
  const [note, setNote] = useState("");
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<Applied | null>(null);

  const speechSupported = getSpeechRecognitionCtor() !== null;

  async function analyze(imageUrl: string, context?: string) {
    setAnalyzing(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageUrl, context })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Couldn't analyze that image.");
      setResult(parseVisionResult(data));
    } catch (analyzeError) {
      setError(analyzeError instanceof Error ? analyzeError.message : "Image analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleFile(file: File) {
    setError(null);
    setResult(null);
    setApplied(null);
    setNote("");
    try {
      const dataUrl = await fileToDownscaledDataUrl(file);
      setImageDataUrl(dataUrl);
      await analyze(dataUrl);
    } catch {
      setError("Couldn't read that image. Try another.");
    }
  }

  function reanalyzeWithNote() {
    if (imageDataUrl) void analyze(imageDataUrl, note.trim() || undefined);
  }

  function confirmApply() {
    if (!result) return;
    const outcomes = result.proposals.map((proposal) => {
      const outcome = executeVoiceTool(proposal.tool, proposal.args);
      return { label: proposal.label, ok: outcome.ok, message: outcome.message };
    });
    setApplied({ okCount: outcomes.filter((o) => o.ok).length, outcomes });
    setResult(null);
  }

  function reset() {
    setImageDataUrl(null);
    setResult(null);
    setApplied(null);
    setNote("");
    setError(null);
  }

  function toggleDictation() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      setNote((prev) => (prev ? `${prev} ${transcript}` : transcript).trim());
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
  }

  const needsDetail = result ? shouldRequestDetail(result) : false;

  return (
    <section className="dashboard-section capture-panel" aria-label="Update from a photo">
      <SectionHeader eyebrow="Vision" title="Update from a photo" />
      <p className="reminders-help">
        Snap or upload a screenshot — walking/steps, a watch summary, a blood-pressure reading, a
        meal — and the assistant will read it and propose what to log. You confirm (and can correct
        by text or voice) before anything saves.
      </p>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="data-backup-actions">
        <button
          type="button"
          className="command-button"
          onClick={() => fileInputRef.current?.click()}
          disabled={analyzing}
        >
          <span>{imageDataUrl ? "Choose another image" : "Upload or take a photo"}</span>
        </button>
        {imageDataUrl ? (
          <button type="button" className="command-button" onClick={reset} disabled={analyzing}>
            <span>Start over</span>
          </button>
        ) : null}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="visually-hidden"
          aria-label="Choose an image to analyze"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
            event.target.value = "";
          }}
        />
      </div>

      {imageDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="capture-preview" src={imageDataUrl} alt="Selected upload preview" />
      ) : null}

      {analyzing ? <p className="reminders-help">Reading the image…</p> : null}

      {result ? (
        <div className="capture-result">
          <p className="capture-summary">{result.summary}</p>
          <span className={`capture-confidence capture-confidence-${result.confidence}`}>
            {result.confidence} confidence
          </span>

          {result.proposals.length > 0 ? (
            <ul className="capture-proposals">
              {result.proposals.map((proposal, index) => (
                <li key={`${proposal.tool}-${index}`}>{proposal.label}</li>
              ))}
            </ul>
          ) : (
            <p className="reminders-help">No clear updates yet — add a detail below.</p>
          )}

          {result.question ? <p className="capture-question">{result.question}</p> : null}

          <label className="fitness-label">
            {needsDetail ? "Add a detail or correction" : "Correct anything?"}
            <div className="capture-note-row">
              <input
                type="text"
                className="fitness-input"
                placeholder="e.g. that's 8,240 steps, not 8,240 calories"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
              {speechSupported ? (
                <button
                  type="button"
                  className={listening ? "capture-mic capture-mic-on" : "capture-mic"}
                  onClick={toggleDictation}
                  aria-label={listening ? "Stop dictation" : "Dictate a correction"}
                  aria-pressed={listening}
                >
                  🎙️
                </button>
              ) : null}
            </div>
          </label>

          <div className="data-backup-actions">
            <button
              type="button"
              className="command-button"
              onClick={reanalyzeWithNote}
              disabled={analyzing || !note.trim()}
            >
              <span>Re-analyze with my note</span>
            </button>
            <button
              type="button"
              className="login-submit"
              onClick={confirmApply}
              disabled={result.proposals.length === 0}
            >
              <span>Confirm &amp; apply</span>
            </button>
          </div>
        </div>
      ) : null}

      {applied ? (
        <div className="capture-result" role="status">
          <p className="capture-summary">
            Applied {applied.okCount} of {applied.outcomes.length} update(s).
          </p>
          <ul className="capture-proposals">
            {applied.outcomes.map((outcome, index) => (
              <li key={index} className={outcome.ok ? undefined : "form-error"}>
                {outcome.ok ? "✓" : "✗"} {outcome.message}
              </li>
            ))}
          </ul>
          <button type="button" className="command-button" onClick={reset}>
            <span>Capture another</span>
          </button>
        </div>
      ) : null}

      <p className="health-boundary">
        Nothing is saved until you tap Confirm. Health values are logged as-is, not as medical advice.
      </p>
    </section>
  );
}
