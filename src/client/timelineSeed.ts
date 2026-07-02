/**
 * One-time seed of Patrick's personal Timeline Mirror references + identity
 * rubrics. The assets live under /public/timeline-seed (gitignored, so the
 * personal physique photos never get committed) and are loaded into the
 * on-device store at runtime the first time the Mirror is opened.
 *
 * Idempotent: a localStorage flag means a user who later deletes a reference or
 * edits a rubric won't have it silently re-created.
 */

import { getCurrentCloudUser, isCloudSyncConfigured } from "@/client/cloudSync";
import { fetchToDownscaledDataUrl } from "@/client/imageDownscale";
import { pushIdentityDocToCloud } from "@/client/timelineCloud";
import { saveTimelineImage } from "@/data/timelineImageStore";
import {
  loadTimelineReferences,
  saveTimelineReferences
} from "@/data/timelineReferenceRepository";
import {
  loadTimelineIdentityDocs,
  upsertTimelineIdentityDoc
} from "@/data/timelineIdentityRepository";
import { withBasePath } from "@/config/site";
import {
  timelineIdentityDocTypeLabel,
  type PoseType,
  type ReferenceImageRole,
  type TimelineIdentityDoc,
  type TimelineIdentityDocType,
  type TimelineReferenceImage
} from "@/domain/timelineMirror";

const SEED_FLAG = "lifequest.timelineSeed.patrick.v1";
const SEED_DIR = "/timeline-seed";

// These personal references + rubrics belong to exactly one account. The seed
// only ever runs when this user is signed in — never for any other account, and
// never in local-only mode.
const SEED_ACCOUNT_EMAIL = "pzgambo@gmail.com";

type SeedImage = { file: string; role: ReferenceImageRole; poseType: PoseType };

// Clean reference photos only — the composite "badpatrick.png" poster is left
// out of the visual comparison set so it can't muddy the read.
const SEED_IMAGES: SeedImage[] = [
  { file: "img2.png", role: "ideal", poseType: "front_full_body" },
  { file: "img1.png", role: "ideal", poseType: "right_side_full_body" },
  { file: "img3.png", role: "ideal", poseType: "face_upper_45" },
  { file: "badimg1.png", role: "warning", poseType: "front_full_body" },
  { file: "badimg2.png", role: "warning", poseType: "right_side_full_body" },
  { file: "badimg3.png", role: "warning", poseType: "face_upper_45" }
];

const SEED_DOCS: { file: string; docType: TimelineIdentityDocType }[] = [
  { file: "best_version_of_me_patrick_2_0.md", docType: "ideal_version" },
  { file: "worst_version_of_me_warning_version.md", docType: "warning_version" }
];

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function assetUrl(file: string): string {
  return withBasePath(`${SEED_DIR}/${file}`);
}

/** Whether the seed assets are actually present (i.e. this is Patrick's machine). */
async function seedAssetsAvailable(): Promise<boolean> {
  try {
    const response = await fetch(assetUrl(SEED_DOCS[0].file), { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}

async function seedIdentityDocs(): Promise<number> {
  if (loadTimelineIdentityDocs().length > 0) return 0;
  let count = 0;
  for (const doc of SEED_DOCS) {
    try {
      const res = await fetch(assetUrl(doc.file));
      if (!res.ok) continue;
      const markdown = await res.text();
      const now = new Date().toISOString();
      const record: TimelineIdentityDoc = {
        id: uid("doc"),
        docType: doc.docType,
        title: timelineIdentityDocTypeLabel[doc.docType],
        markdownContent: markdown,
        createdAt: now,
        updatedAt: now
      };
      upsertTimelineIdentityDoc(record);
      void pushIdentityDocToCloud(record);
      count += 1;
    } catch {
      // Skip a doc that can't be loaded; others still seed.
    }
  }
  return count;
}

async function seedReferences(): Promise<number> {
  if (loadTimelineReferences().length > 0) return 0;
  const metas: TimelineReferenceImage[] = [];
  for (const img of SEED_IMAGES) {
    try {
      const dataUrl = await fetchToDownscaledDataUrl(assetUrl(img.file), 1024);
      const imageLocalId = uid("tlref");
      await saveTimelineImage(imageLocalId, dataUrl);
      metas.push({
        id: uid("ref"),
        role: img.role,
        poseType: img.poseType,
        imageLocalId,
        createdAt: new Date().toISOString()
      });
    } catch {
      // Skip an image that can't be loaded; others still seed.
    }
  }
  if (metas.length > 0) {
    saveTimelineReferences([...loadTimelineReferences(), ...metas]);
  }
  return metas.length;
}

export type TimelineSeedResult = { seeded: boolean; references: number; docs: number };

// Module-level guard so React StrictMode's double-invoked effect (and any
// concurrent mounts) share a single seed run instead of racing.
let inFlight: Promise<TimelineSeedResult> | null = null;

async function isSeedAccount(): Promise<boolean> {
  // Require a configured + signed-in Supabase session whose email matches.
  if (!isCloudSyncConfigured()) return false;
  try {
    const user = await getCurrentCloudUser();
    return user?.email?.trim().toLowerCase() === SEED_ACCOUNT_EMAIL;
  } catch {
    return false;
  }
}

async function runSeed(): Promise<TimelineSeedResult> {
  if (window.localStorage.getItem(SEED_FLAG)) {
    return { seeded: false, references: 0, docs: 0 };
  }
  // Gate strictly to the owning account — do NOT set the flag when it's another
  // user (or signed out), so the seed still runs later if Patrick signs in.
  if (!(await isSeedAccount())) {
    return { seeded: false, references: 0, docs: 0 };
  }
  if (!(await seedAssetsAvailable())) {
    return { seeded: false, references: 0, docs: 0 };
  }
  const docs = await seedIdentityDocs();
  const references = await seedReferences();
  window.localStorage.setItem(SEED_FLAG, new Date().toISOString());
  return { seeded: docs + references > 0, references, docs };
}

/**
 * Seed Patrick's references + rubrics once. Returns counts so callers can
 * refresh the UI. Safe to call on every mount — it no-ops after the first run
 * or when the seed assets aren't present.
 */
export async function seedTimelineForPatrick(): Promise<TimelineSeedResult> {
  if (typeof window === "undefined") return { seeded: false, references: 0, docs: 0 };
  if (inFlight) return inFlight;
  inFlight = runSeed()
    .catch(() => ({ seeded: false, references: 0, docs: 0 }))
    .then((result) => {
      // If the run bailed before setting the flag (signed out, wrong account,
      // assets missing, or an error), release the guard so a later call — e.g.
      // right after Patrick signs in — retries instead of returning this no-op.
      if (!window.localStorage.getItem(SEED_FLAG)) inFlight = null;
      return result;
    });
  return inFlight;
}
