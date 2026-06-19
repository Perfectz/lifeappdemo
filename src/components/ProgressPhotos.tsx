"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fileToDownscaledDataUrl } from "@/client/imageDownscale";
import { SectionHeader } from "@/components/SectionHeader";
import { loadWiki } from "@/data/wikiRepository";
import {
  deleteProgressPhoto,
  loadProgressPhotos,
  progressPhotoChangedEvent,
  saveProgressPhoto
} from "@/data/progressPhotoStore";
import { formatWikiForPrompt, isWikiEmpty } from "@/domain/personalWiki";
import {
  parseProgressAssessment,
  progressAlignmentLabel,
  type ProgressAssessment
} from "@/domain/progressAssessment";
import { toLocalIsoDate } from "@/domain/dates";
import {
  createProgressPhoto,
  getPhotosForDate,
  groupPhotosByDate,
  progressPhotoAngleLabel,
  progressPhotoAngles,
  type ProgressPhoto,
  type ProgressPhotoAngle
} from "@/domain/progressPhotos";

export function ProgressPhotos() {
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [busyAngle, setBusyAngle] = useState<ProgressPhotoAngle | null>(null);
  const [assessing, setAssessing] = useState(false);
  const [assessment, setAssessment] = useState<ProgressAssessment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputs = useRef<Record<ProgressPhotoAngle, HTMLInputElement | null>>({
    front: null,
    profile: null,
    face: null
  });

  const today = toLocalIsoDate();

  const reload = useCallback(() => {
    void loadProgressPhotos().then(setPhotos);
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener(progressPhotoChangedEvent, reload);
    return () => window.removeEventListener(progressPhotoChangedEvent, reload);
  }, [reload]);

  const todayDay = useMemo(() => getPhotosForDate(photos, today), [photos, today]);
  const history = useMemo(
    () => groupPhotosByDate(photos).filter((day) => day.date !== today),
    [photos, today]
  );
  const compare = useMemo(() => {
    const fronts = photos
      .filter((photo) => photo.angle === "front")
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    if (fronts.length < 2 || fronts[0].date === fronts[fronts.length - 1].date) {
      return null;
    }
    return { first: fronts[0], latest: fronts[fronts.length - 1] };
  }, [photos]);

  async function handleFile(angle: ProgressPhotoAngle, file: File) {
    setError(null);
    setBusyAngle(angle);
    try {
      const dataUrl = await fileToDownscaledDataUrl(file, 1024);
      const photo = createProgressPhoto({ date: today, angle, dataUrl });
      await saveProgressPhoto(photo);
      setAssessment(null);
      reload();
    } catch (captureError) {
      setError(
        captureError instanceof Error ? captureError.message : "Couldn't save that photo."
      );
    } finally {
      setBusyAngle(null);
    }
  }

  async function removePhoto(id: string) {
    setError(null);
    try {
      await deleteProgressPhoto(id);
      setAssessment(null);
      reload();
    } catch {
      setError("Couldn't remove that photo.");
    }
  }

  async function assess() {
    const todays = progressPhotoAngles
      .map((angle) => todayDay.byAngle[angle])
      .filter((photo): photo is ProgressPhoto => Boolean(photo));
    if (todays.length === 0) {
      setError("Capture at least one photo first.");
      return;
    }
    setAssessing(true);
    setError(null);
    try {
      const wiki = loadWiki(window.localStorage);
      const goalContext = isWikiEmpty(wiki) ? undefined : formatWikiForPrompt(wiki);
      const response = await fetch("/api/ai/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: todays.map((photo) => ({ angle: photo.angle, dataUrl: photo.dataUrl })),
          goalContext
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Couldn't assess your photos.");
      }
      setAssessment(parseProgressAssessment(data));
    } catch (assessError) {
      setError(assessError instanceof Error ? assessError.message : "Assessment failed.");
    } finally {
      setAssessing(false);
    }
  }

  return (
    <section className="dashboard-section progress-photos" aria-label="Progress photos">
      <SectionHeader eyebrow="Patrick 2.0" title={`Today's progress photos — ${todayDay.count}/3`} />
      <p className="reminders-help">
        Capture the same three angles each day. Over time you&apos;ll see the change — and you can
        ask the AI to read your progress against your goal.
      </p>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="progress-photo-grid">
        {progressPhotoAngles.map((angle) => {
          const existing = todayDay.byAngle[angle];
          return (
            <div className="progress-photo-slot" key={angle}>
              <span className="progress-photo-angle">{progressPhotoAngleLabel[angle]}</span>
              {existing ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="progress-photo-thumb" src={existing.dataUrl} alt={`${progressPhotoAngleLabel[angle]} progress photo for ${today}`} />
                  <div className="progress-photo-actions">
                    <button
                      type="button"
                      className="command-button"
                      onClick={() => fileInputs.current[angle]?.click()}
                      disabled={busyAngle === angle}
                    >
                      <span>Retake</span>
                    </button>
                    <button
                      type="button"
                      className="command-button progress-photo-remove"
                      onClick={() => removePhoto(existing.id)}
                    >
                      <span>Remove</span>
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  className="progress-photo-empty"
                  onClick={() => fileInputs.current[angle]?.click()}
                  disabled={busyAngle === angle}
                >
                  {busyAngle === angle ? "Saving…" : "+ Capture"}
                </button>
              )}
              <input
                ref={(node) => {
                  fileInputs.current[angle] = node;
                }}
                type="file"
                accept="image/*"
                className="visually-hidden"
                aria-label={`Capture ${progressPhotoAngleLabel[angle]} progress photo`}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleFile(angle, file);
                  event.target.value = "";
                }}
              />
            </div>
          );
        })}
      </div>

      <button
        type="button"
        className="login-submit progress-photo-assess"
        onClick={assess}
        disabled={assessing || todayDay.count === 0}
      >
        <span>{assessing ? "Reading your photos…" : "Ask the AI to assess my progress"}</span>
      </button>

      {assessment ? (
        <div className="progress-assessment" role="status">
          <span className={`progress-alignment progress-alignment-${assessment.alignment}`}>
            {progressAlignmentLabel[assessment.alignment]}
          </span>
          <p className="progress-assessment-summary">{assessment.summary}</p>
          {assessment.observations.length > 0 ? (
            <ul className="progress-assessment-list">
              {assessment.observations.map((observation, index) => (
                <li key={index}>{observation}</li>
              ))}
            </ul>
          ) : null}
          {assessment.estimatedBodyFatRange ? (
            <p className="reminders-help">Rough visual range: {assessment.estimatedBodyFatRange}</p>
          ) : null}
          {assessment.encouragement ? (
            <p className="progress-assessment-encouragement">{assessment.encouragement}</p>
          ) : null}
        </div>
      ) : null}

      {compare ? (
        <div className="progress-compare">
          <h3 className="progress-history-title">Then vs. now (front)</h3>
          <div className="progress-compare-row">
            <figure className="progress-compare-item">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="progress-photo-thumb" src={compare.first.dataUrl} alt={`Front progress photo from ${compare.first.date}`} />
              <figcaption>{compare.first.date}</figcaption>
            </figure>
            <figure className="progress-compare-item">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="progress-photo-thumb" src={compare.latest.dataUrl} alt={`Front progress photo from ${compare.latest.date}`} />
              <figcaption>{compare.latest.date}</figcaption>
            </figure>
          </div>
        </div>
      ) : null}

      {history.length > 0 ? (
        <div className="progress-history">
          <h3 className="progress-history-title">Progress timeline</h3>
          <div className="progress-history-row">
            {history.map((day) => {
              const cover = day.byAngle.front ?? day.byAngle.profile ?? day.byAngle.face;
              if (!cover) return null;
              return (
                <figure className="progress-history-item" key={day.date}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="progress-photo-thumb" src={cover.dataUrl} alt={`Progress photo from ${day.date}`} />
                  <figcaption>
                    {day.date} · {day.count}/3
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </div>
      ) : null}

      <p className="health-boundary">
        Photos stay on this device (private, on-device storage) and are only sent to your AI when you
        tap assess. This is encouragement, not medical or body-composition advice.
      </p>
    </section>
  );
}
