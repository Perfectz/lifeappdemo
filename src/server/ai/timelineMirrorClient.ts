import { COACH_MODEL } from "@/config/ai";
import {
  parseTimelineMirrorResult,
  poseTypeLabel,
  referenceImageRoleLabel,
  type PoseType,
  type ReferenceImageRole,
  type TimelineMirrorResult
} from "@/domain/timelineMirror";
import { AINotConfiguredError, buildOpenAIError, chatCompletionBody } from "@/server/ai/openaiClient";

/* ----------------------------------------------------------------- inputs -- */

export type TimelineReferenceInput = {
  role: ReferenceImageRole;
  poseType: PoseType;
  dataUrl: string;
};

export type TimelineMirrorInput = {
  /** The photo the user just uploaded for this check-in. */
  currentPhoto: {
    /** Optional hint; the AI still classifies the image itself. */
    poseHint?: PoseType;
    dataUrl: string;
  };
  /** Baseline / ideal / warning reference images (any subset, any poses). */
  references: TimelineReferenceInput[];
  /** Markdown rubric describing the Ideal Version ("Patrick 2.0"). */
  idealMarkdown?: string;
  /** Markdown rubric describing the Warning Version ("Shadow Patrick"). */
  warningMarkdown?: string;
  /** Free-text profile / goal context (about-me, goal weight, etc.). */
  profileContext?: string;
  /** Pre-formatted recent health/life-data summary built on the client. */
  lifeDataSummary?: string;
};

export type TimelineMirrorRun = (input: TimelineMirrorInput) => Promise<TimelineMirrorResult>;

let testRun: TimelineMirrorRun | undefined;

/** Inject a fake run for tests (no network), mirroring the progress client. */
export function setTimelineMirrorForTests(run: TimelineMirrorRun | undefined) {
  testRun = run;
}

/* ----------------------------------------------------------------- prompt -- */

const SYSTEM_PROMPT = [
  "You are the Timeline Mirror — a magical 90s-JRPG mirror crystal that judges which timeline the hero is currently feeding.",
  "The two poles are the IDEAL TIMELINE (their best self: leaner, stronger, better posture, better grooming, more disciplined, more martial-artist energy, consistent, healthy behaviours) and the WARNING TIMELINE (the self they do NOT want: letting their current weight become the floor and sliding heavier through neglect, poor posture, low energy, avoiding photos, inconsistent habits, low movement, poor nutrition, poor sleep, no training, 'tomorrow mode').",
  "IMPORTANT: the Warning Version is NOT simply the user at their current weight — they can look capable and healthy now. The Warning Version is the trajectory of neglect and backsliding, not a number on the scale.",
  "Blend three signals into one score: VISUAL PHOTO SIGNAL ~40% (compare the uploaded photo to the baseline/ideal/warning references: face leanness, jawline, posture, neck/chin, torso/waist direction, clothing fit, grooming, beard, glasses/style, overall energy, confidence/presence), APP DATA SIGNAL ~45% (weight trend, calorie/protein consistency, steps, workouts, sleep, hydration, habit streaks, missed check-ins, BP/glucose trends if present), and CONSISTENCY SIGNAL ~15% (are they still showing up: check-ins, logging, movement, training, imperfect progress beats none).",
  "Be FORGIVING about photos. Do NOT penalize different angle, lighting, outfit, camera height, background, or imperfect pose — compensate for reasonable differences. Only mark a photo unusable when no useful comparison is possible: no person visible, extremely blurry, too dark, body/face heavily obstructed, unrelated image, or so cropped nothing can be read.",
  "If exact-pose references exist, prefer them; otherwise use the closest references and lower your confidence accordingly.",
  "TONE: funny, playful, direct, encouraging, specific, slightly dramatic, 90s-JRPG flavoured. NEVER cruel, NEVER fake-positive, NEVER a medical diagnosis or body-rating. Think: a magical mirror, a fitness coach, and a roast-comic friend teamed up to keep the hero from becoming a cautionary side quest.",
  "Backslide warnings must be direct but playful (e.g. 'Shadow Patrick is gaining XP', 'the villain music has started', not 'you look terrible' or 'you failed').",
  "Give exactly ONE next quest: small, concrete, and achievable today.",
  "Scoring: timelineScore 0 = fully Warning Timeline, 50 = neutral/unclear, 100 = strongly Ideal Timeline. idealPercent should equal timelineScore; warningPercent = 100 - idealPercent.",
  "Respond with STRICT JSON ONLY, no prose outside the object, matching exactly:",
  '{"timelineScore":0-100,"idealPercent":0-100,"warningPercent":0-100,"direction":"toward_ideal|toward_warning|stable|unclear","backslideDetected":boolean,"confidence":"low|medium|high","photoTypeDetected":"front_full_body|right_side_full_body|face_upper_45|unknown","photoUsability":{"usable":boolean,"qualityScore":0-100,"issues":string[],"retakeRecommended":boolean,"retakeReason":string|null},"visualSummary":string,"dataSummary":string,"overallRead":string,"positiveSignal":string,"warningSignal":string,"nextQuest":{"title":string,"description":string,"difficulty":"easy|medium|hard","xpReward":number,"category":"movement|nutrition|sleep|grooming|training|mindset|recovery"},"jrpgMessage":string,"coachNote":string}'
].join(" ");

function intFromEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

type VisionContent =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

function buildUserContent(input: TimelineMirrorInput): VisionContent[] {
  const content: VisionContent[] = [];

  const intro: string[] = [];
  intro.push(
    "Judge which timeline this hero is feeding right now. The FIRST image is the uploaded check-in photo."
  );
  if (input.currentPhoto.poseHint) {
    intro.push(`The user thinks this photo is: ${poseTypeLabel[input.currentPhoto.poseHint]} (verify yourself).`);
  }
  if (input.references.length > 0) {
    intro.push(
      `Then ${input.references.length} labeled reference image(s) follow, in this order: ` +
        input.references
          .map(
            (ref, i) =>
              `#${i + 2} = ${referenceImageRoleLabel[ref.role]} (${poseTypeLabel[ref.poseType]})`
          )
          .join(", ") +
        "."
    );
  } else {
    intro.push("No reference images are stored yet — lean more on the app data and lower your confidence.");
  }
  content.push({ type: "text", text: intro.join(" ") });

  // 1) the uploaded photo first
  content.push({ type: "image_url", image_url: { url: input.currentPhoto.dataUrl } });

  // 2) the references, in the order announced above
  for (const ref of input.references) {
    content.push({ type: "image_url", image_url: { url: ref.dataUrl } });
  }

  // 3) the narrative + data context
  const ctx: string[] = [];
  if (input.profileContext?.trim()) {
    ctx.push(`PROFILE / GOAL CONTEXT:\n${input.profileContext.trim()}`);
  }
  if (input.idealMarkdown?.trim()) {
    ctx.push(`IDEAL VERSION RUBRIC (Markdown):\n${input.idealMarkdown.trim()}`);
  }
  if (input.warningMarkdown?.trim()) {
    ctx.push(`WARNING VERSION RUBRIC (Markdown):\n${input.warningMarkdown.trim()}`);
  }
  if (input.lifeDataSummary?.trim()) {
    ctx.push(`RECENT APP DATA (health / life signals):\n${input.lifeDataSummary.trim()}`);
  } else {
    ctx.push("RECENT APP DATA: none provided — base the score on the photo + consistency only and lower confidence.");
  }
  ctx.push("Return the strict JSON object now.");
  content.push({ type: "text", text: ctx.join("\n\n") });

  return content;
}

/* ------------------------------------------------------------------- call -- */

export async function assessTimelineMirror(
  input: TimelineMirrorInput
): Promise<TimelineMirrorResult> {
  if (testRun) {
    return testRun(input);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AINotConfiguredError();
  }

  const maxTokens = intFromEnv("OPENAI_MAX_TOKENS", 1_100);
  const timeoutMs = intFromEnv("OPENAI_TIMEOUT_MS", 45_000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(
        chatCompletionBody({
          model: COACH_MODEL,
          maxCompletionTokens: maxTokens,
          temperature: 0.6,
          responseFormat: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: buildUserContent(input) }
          ]
        })
      )
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Timeline Mirror reading timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw await buildOpenAIError(response, "Timeline Mirror");
  }

  const payload: unknown = await response.json();
  const content =
    payload &&
    typeof payload === "object" &&
    "choices" in payload &&
    Array.isArray((payload as { choices?: unknown[] }).choices)
      ? (((payload as { choices: { message?: { content?: unknown } }[] }).choices[0]?.message
          ?.content) ?? "")
      : "";

  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Timeline Mirror reading was empty.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Timeline Mirror returned an unreadable reading.");
  }

  return parseTimelineMirrorResult(parsed);
}
