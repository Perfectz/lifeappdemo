import {
  applyAITaskToolProposal,
  type ConfirmTaskToolRequestInput,
  validateAIToolProposals
} from "@/domain/aiTaskTools";
import {
  buildAIAppContext,
  formatAIContextForPrompt,
  summarizeAIAppContext,
  validateAIChatRequestBody,
  type AIChatRequestInput
} from "@/domain/aiContext";
import { toLocalIsoDate } from "@/domain/dates";
import type { AIToolProposal } from "@/domain/types";
import { loadOpenAIClientSettings } from "@/client/openaiSettings";

export type AIChatResponsePayload = {
  error?: string;
  message?: string;
  mode?: string;
  proposals?: AIToolProposal[];
  usedContext?: {
    openTaskCount: number;
    recentMetricCount: number;
    recentJournalEntryCount: number;
  };
};

export type ConfirmToolResponsePayload = {
  ok?: boolean;
  error?: string;
  appliedChangeSummary?: string;
  dailyPlans?: ConfirmTaskToolRequestInput["dailyPlans"];
  dailyReports?: ConfirmTaskToolRequestInput["dailyReports"];
  eveningPostmortems?: ConfirmTaskToolRequestInput["eveningPostmortems"];
  journalEntries?: ConfirmTaskToolRequestInput["journalEntries"];
  metricEntries?: ConfirmTaskToolRequestInput["metricEntries"];
  tasks?: ConfirmTaskToolRequestInput["tasks"];
};

const coachInstructions = [
  "You are the LifeQuest OS coach.",
  "Use the supplied app context to answer concisely.",
  "For task changes, only propose actions; never claim they are already applied.",
  "When proposing task changes, return JSON with message and proposals.",
  "Supported toolName values are create_task, update_task, complete_task, defer_task, archive_task, log_metric, create_journal_entry, propose_daily_plan, generate_daily_report.",
  "In morning mode, ask no more than one or two focused planning questions when enough context exists, then propose one Main Quest and no more than three Side Quests with rationale.",
  "When recent sleep or energy is low, recommend a realistic workload and avoid overload.",
  "In evening mode, ask focused reflection questions, propose realistic tomorrow follow-ups, and generate reports only from stored facts.",
  "Do not invent missing metrics, reflections, lessons, or outcomes; label absent data clearly.",
  "For health metrics, log values without diagnosis or treatment advice.",
  "For concerning health values, use bounded language like consider discussing with a healthcare professional.",
  "If data is missing, say so directly."
].join(" ");

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readOutputText(payload: unknown): string {
  if (!isRecord(payload)) {
    return "";
  }

  if (typeof payload.output_text === "string") {
    return payload.output_text.trim();
  }

  const output = payload.output;

  if (!Array.isArray(output)) {
    return "";
  }

  return output
    .flatMap((item) => (isRecord(item) && Array.isArray(item.content) ? item.content : []))
    .flatMap((content) => {
      if (!isRecord(content)) {
        return [];
      }

      if (typeof content.text === "string") {
        return [content.text];
      }

      if (typeof content.output_text === "string") {
        return [content.output_text];
      }

      return [];
    })
    .join("\n")
    .trim();
}

function normalizeCoachResult(content: string): Pick<AIChatResponsePayload, "message" | "proposals"> {
  const trimmed = content.trim();

  try {
    const parsed: unknown = JSON.parse(trimmed);

    if (isRecord(parsed) && typeof parsed.message === "string" && parsed.message.trim()) {
      return {
        message: parsed.message.trim(),
        proposals: validateAIToolProposals(parsed.proposals)
      };
    }
  } catch {
    return { message: trimmed };
  }

  return { message: trimmed };
}

async function sendToServer(input: AIChatRequestInput): Promise<AIChatResponsePayload> {
  const response = await fetch("/api/ai/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });
  const contentType = response.headers?.get("content-type") ?? "application/json";
  const payload = contentType.includes("application/json")
    ? ((await response.json()) as AIChatResponsePayload)
    : ({ error: await response.text() } satisfies AIChatResponsePayload);

  if (!response.ok || !payload.message) {
    throw new Error(payload.error ?? "AI coach is unavailable right now.");
  }

  return payload;
}

async function sendToOpenAI(
  input: AIChatRequestInput,
  storage: Storage
): Promise<AIChatResponsePayload> {
  const settings = loadOpenAIClientSettings(storage);

  if (!settings.apiKey) {
    throw new Error(
      "Add your OpenAI API key in Settings to use AI from the installed PWA."
    );
  }

  const context = buildAIAppContext(input.appData ?? {}, toLocalIsoDate());
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      input: `Mode: ${input.mode}\n\nApp context:\n${formatAIContextForPrompt(context)}\n\nPatrick asks:\n${input.message}`,
      instructions: coachInstructions,
      max_output_tokens: 900,
      model: settings.model,
      store: false,
      temperature: 0.4
    })
  });
  const payload: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    const message =
      isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === "string"
        ? payload.error.message
        : "OpenAI request failed.";
    throw new Error(message);
  }

  const result = normalizeCoachResult(readOutputText(payload));

  if (!result.message) {
    throw new Error("OpenAI response was empty.");
  }

  return {
    ...result,
    mode: input.mode,
    usedContext: summarizeAIAppContext(context)
  };
}

export async function sendAIChatRequest(
  input: AIChatRequestInput,
  storage: Storage
): Promise<AIChatResponsePayload> {
  const validation = validateAIChatRequestBody(input);

  if (!validation.ok) {
    throw new Error(validation.message);
  }

  if (loadOpenAIClientSettings(storage).apiKey) {
    return sendToOpenAI(validation.value, storage);
  }

  try {
    return await sendToServer(validation.value);
  } catch (error) {
    if (window.location.hostname.endsWith("github.io")) {
      throw new Error(
        "Add your OpenAI API key in Settings to use AI from the installed PWA."
      );
    }

    throw error;
  }
}

export function confirmAIToolProposalLocally(
  input: ConfirmTaskToolRequestInput
): ConfirmToolResponsePayload {
  const result = applyAITaskToolProposal(
    input.proposal,
    input.tasks,
    new Date().toISOString(),
    input.metricEntries,
    input.journalEntries,
    input.dailyPlans,
    input.dailyReports,
    input.eveningPostmortems
  );

  if (!result.ok) {
    return { error: result.message };
  }

  return {
    ok: true,
    appliedChangeSummary: result.appliedChangeSummary,
    dailyPlans: result.dailyPlans,
    dailyReports: result.dailyReports,
    eveningPostmortems: result.eveningPostmortems,
    journalEntries: result.journalEntries,
    metricEntries: result.metricEntries,
    tasks: result.tasks
  };
}
