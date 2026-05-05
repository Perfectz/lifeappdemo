import type { AIToolProposal } from "@/domain";
import { validateAIToolProposals } from "@/domain/aiTaskTools";

export type OpenAIChatCompletionInput = {
  message: string;
  mode: string;
  context: string;
};

export type OpenAICoachResult = {
  message: string;
  proposals?: AIToolProposal[];
};

export type OpenAIChatCompletion = (
  input: OpenAIChatCompletionInput
) => Promise<string | OpenAICoachResult>;

let testCompletion: OpenAIChatCompletion | undefined;

export function setOpenAIChatCompletionForTests(completion: OpenAIChatCompletion | undefined) {
  testCompletion = completion;
}

export async function completeReadOnlyCoachChat(
  input: OpenAIChatCompletionInput
): Promise<OpenAICoachResult> {
  if (testCompletion) {
    return normalizeCoachResult(await testCompletion(input));
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OpenAI API key is not configured.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: [
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
          ].join(" ")
        },
        {
          role: "user",
          content: `Mode: ${input.mode}\n\nApp context:\n${input.context}\n\nPatrick asks:\n${input.message}`
        }
      ],
      temperature: 0.4
    })
  });

  if (!response.ok) {
    throw new Error("OpenAI request failed.");
  }

  const payload: unknown = await response.json();

  if (
    payload &&
    typeof payload === "object" &&
    "choices" in payload &&
    Array.isArray(payload.choices)
  ) {
    const firstChoice = payload.choices[0] as
      | { message?: { content?: unknown } }
      | undefined;
    const content = firstChoice?.message?.content;

    if (typeof content === "string" && content.trim()) {
      return normalizeCoachResult(content.trim());
    }
  }

  throw new Error("OpenAI response was empty.");
}

function normalizeCoachResult(result: string | OpenAICoachResult): OpenAICoachResult {
  if (typeof result !== "string") {
    return {
      message: result.message,
      proposals: validateAIToolProposals(result.proposals)
    };
  }

  const trimmed = result.trim();

  try {
    const parsed: unknown = JSON.parse(trimmed);

    if (parsed && typeof parsed === "object" && "message" in parsed) {
      const message = (parsed as { message?: unknown }).message;
      const proposals = (parsed as { proposals?: unknown }).proposals;

      if (typeof message === "string" && message.trim()) {
        return {
          message: message.trim(),
          proposals: validateAIToolProposals(proposals)
        };
      }
    }
  } catch {
    return { message: trimmed };
  }

  return { message: trimmed };
}
