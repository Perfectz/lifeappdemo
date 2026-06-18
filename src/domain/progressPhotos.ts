import type { IsoDate, IsoDateTime } from "@/domain/types";

/**
 * Progress photos: a daily front / side-profile / face-close-up set the user
 * captures to track their physical transformation. These are highly sensitive,
 * so they live ONLY in on-device storage (IndexedDB) and are never written to
 * git or the cloud snapshot. The AI sees them only when the user explicitly
 * asks for an assessment.
 */

export const progressPhotoAngles = ["front", "profile", "face"] as const;
export type ProgressPhotoAngle = (typeof progressPhotoAngles)[number];

export const progressPhotoAngleLabel: Record<ProgressPhotoAngle, string> = {
  front: "Front",
  profile: "Side profile",
  face: "Face close-up"
};

export type ProgressPhoto = {
  id: string;
  date: IsoDate;
  angle: ProgressPhotoAngle;
  /** A downscaled JPEG data URL (data:image/...;base64,...). */
  dataUrl: string;
  createdAt: IsoDateTime;
};

export type ProgressPhotoInput = {
  date: IsoDate;
  angle: ProgressPhotoAngle;
  dataUrl: string;
};

export type ProgressPhotoValidationResult =
  | { ok: true; value: ProgressPhotoInput }
  | { ok: false; message: string };

export function isProgressPhotoAngle(value: unknown): value is ProgressPhotoAngle {
  return typeof value === "string" && progressPhotoAngles.includes(value as ProgressPhotoAngle);
}

function isImageDataUrl(value: unknown): value is string {
  return typeof value === "string" && /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(value);
}

export function validateProgressPhotoInput(input: ProgressPhotoInput): ProgressPhotoValidationResult {
  const date = input.date?.trim();
  if (!date) {
    return { ok: false, message: "Photo date is required." };
  }
  if (!isProgressPhotoAngle(input.angle)) {
    return { ok: false, message: "Photo angle is invalid." };
  }
  if (!isImageDataUrl(input.dataUrl)) {
    return { ok: false, message: "Photo must be an image data URL." };
  }
  return { ok: true, value: { date, angle: input.angle, dataUrl: input.dataUrl } };
}

export function createProgressPhoto(
  input: ProgressPhotoInput,
  now: IsoDateTime = new Date().toISOString()
): ProgressPhoto {
  const validation = validateProgressPhotoInput(input);
  if (!validation.ok) {
    throw new Error(validation.message);
  }
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `progress-photo-${now}`,
    date: validation.value.date,
    angle: validation.value.angle,
    dataUrl: validation.value.dataUrl,
    createdAt: now
  };
}

export function isProgressPhoto(value: unknown): value is ProgressPhoto {
  if (!value || typeof value !== "object") {
    return false;
  }
  const photo = value as Partial<ProgressPhoto>;
  return (
    typeof photo.id === "string" &&
    typeof photo.date === "string" &&
    isProgressPhotoAngle(photo.angle) &&
    isImageDataUrl(photo.dataUrl) &&
    typeof photo.createdAt === "string"
  );
}

export type ProgressPhotoDay = {
  date: IsoDate;
  byAngle: Record<ProgressPhotoAngle, ProgressPhoto | undefined>;
  count: number;
  isComplete: boolean;
};

/** Build the per-angle view of a single day's photos (most recent per angle wins). */
export function getPhotosForDate(photos: ProgressPhoto[], date: IsoDate): ProgressPhotoDay {
  const forDate = photos
    .filter((photo) => photo.date === date)
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
  const pick = (angle: ProgressPhotoAngle): ProgressPhoto | undefined =>
    forDate.find((photo) => photo.angle === angle);
  const byAngle: Record<ProgressPhotoAngle, ProgressPhoto | undefined> = {
    front: pick("front"),
    profile: pick("profile"),
    face: pick("face")
  };
  const count = progressPhotoAngles.filter((angle) => byAngle[angle]).length;
  return { date, byAngle, count, isComplete: count === progressPhotoAngles.length };
}

/** One entry per day that has at least one photo, newest day first. */
export function groupPhotosByDate(photos: ProgressPhoto[]): ProgressPhotoDay[] {
  const dates = [...new Set(photos.map((photo) => photo.date))].sort((a, b) =>
    a > b ? -1 : 1
  );
  return dates.map((date) => getPhotosForDate(photos, date));
}
