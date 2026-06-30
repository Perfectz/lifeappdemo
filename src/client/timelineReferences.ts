/**
 * Bridges reference-image metadata (localStorage) with the image bytes
 * (IndexedDB) so the check-in flow can ship the actual images to the AI route,
 * and the manager UI can render thumbnails.
 */

import { fileToDownscaledDataUrl } from "@/client/imageDownscale";
import { pushReferenceToCloud, deleteReferenceFromCloud } from "@/client/timelineCloud";
import {
  loadTimelineReferences,
  saveTimelineReferences
} from "@/data/timelineReferenceRepository";
import {
  deleteTimelineImage,
  loadTimelineImage,
  loadTimelineImages,
  saveTimelineImage
} from "@/data/timelineImageStore";
import type {
  PoseType,
  ReferenceImageRole,
  TimelineReferenceImage
} from "@/domain/timelineMirror";
import type { TimelineReferenceInput } from "@/server/ai/timelineMirrorClient";

function uid(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

export type HydratedReference = TimelineReferenceImage & { dataUrl: string };

/** All stored references with their thumbnail/data URLs resolved. */
export async function loadHydratedReferences(): Promise<HydratedReference[]> {
  const metas = loadTimelineReferences();
  const images = await loadTimelineImages(metas.map((m) => m.imageLocalId));
  return metas
    .map((meta) => {
      const dataUrl = images[meta.imageLocalId];
      return dataUrl ? { ...meta, dataUrl } : null;
    })
    .filter((x): x is HydratedReference => x !== null);
}

/** Reference inputs shaped for the AI route (uploaded photo + these refs). */
export async function loadReferenceInputs(): Promise<TimelineReferenceInput[]> {
  const hydrated = await loadHydratedReferences();
  return hydrated.map((ref) => ({
    role: ref.role,
    poseType: ref.poseType,
    dataUrl: ref.dataUrl
  }));
}

/** Save a new reference: bytes to IndexedDB, metadata to localStorage + cloud. */
export async function addReference(opts: {
  file: File;
  role: ReferenceImageRole;
  poseType: PoseType;
  notes?: string;
}): Promise<TimelineReferenceImage> {
  const dataUrl = await fileToDownscaledDataUrl(opts.file, 1024);
  const imageLocalId = uid("tlref");
  await saveTimelineImage(imageLocalId, dataUrl);

  const meta: TimelineReferenceImage = {
    id: uid("ref"),
    role: opts.role,
    poseType: opts.poseType,
    imageLocalId,
    notes: opts.notes?.trim() || undefined,
    createdAt: new Date().toISOString()
  };

  saveTimelineReferences([...loadTimelineReferences(), meta]);
  void pushReferenceToCloud(meta);
  return meta;
}

export async function removeReference(id: string): Promise<void> {
  const metas = loadTimelineReferences();
  const target = metas.find((m) => m.id === id);
  saveTimelineReferences(metas.filter((m) => m.id !== id));
  if (target) {
    await deleteTimelineImage(target.imageLocalId).catch(() => undefined);
  }
  void deleteReferenceFromCloud(id);
}

export { loadTimelineImage };
