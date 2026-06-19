import { COACH_MODEL } from "@/config/ai";
import { AINotConfiguredError, buildOpenAIError, chatCompletionBody } from "@/server/ai/openaiClient";

/**
 * Turns the deterministic daily-brief facts into a short, personalized coach
 * message via GPT. The structured focus items + CTAs stay deterministic (so the
 * dashboard button is always reliable); this only writes the prose.
 */

export type BriefFacts = {
  timeOfDay: string;
  heroName?: string;
  allClear: boolean;
  items: string[];
  /** The user's profile + saved memories, for a personalized nudge. */
  aboutMe?: string;
};

export type BriefGenerator = (facts: BriefFacts) => Promise<string>;

let testGenerator: BriefGenerator | undefined;

export function setBriefGeneratorForTests(generator: BriefGenerator | undefined) {
  testGenerator = generator;
}

const SYSTEM_PROMPT = [
  "You are the user's personal coach — part trainer, part life coach, part assistant.",
  "Given today's status, write ONE short spoken-style briefing of 1-2 sentences.",
  "Address them by name if given, reference the open items naturally, and nudge action with warmth.",
  "If everything is done, give brief, genuine encouragement.",
  "If a profile/memory of the user is provided, ground the nudge in it — their name, stated top health priorities, and goals — but keep it to 1-2 sentences.",
  "No markdown, no bullet lists, no emojis — just the sentence(s)."
].join(" ");

function intFromEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function generateCoachBrief(facts: BriefFacts): Promise<string> {
  if (testGenerator) {
    return testGenerator(facts);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AINotConfiguredError();
  }

  const timeoutMs = intFromEnv("OPENAI_TIMEOUT_MS", 30_000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const userText = [
    `Time of day: ${facts.timeOfDay}.`,
    facts.heroName ? `Name: ${facts.heroName}.` : "",
    facts.allClear
      ? "Everything for today is handled."
      : `Open items: ${facts.items.join("; ")}.`,
    facts.aboutMe?.trim() ? `\n\nAbout the user (profile + memory):\n${facts.aboutMe.trim()}` : ""
  ]
    .filter(Boolean)
    .join(" ");

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
          maxCompletionTokens: 600,
          temperature: 0.6,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userText }
          ]
        })
      )
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Brief request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw await buildOpenAIError(response, "Brief request");
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
    throw new Error("Brief response was empty.");
  }

  return content.trim();
}
