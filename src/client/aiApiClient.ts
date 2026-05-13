import type {
  AIChatMode,
  AIStoredAppData,
  AIToolProposal,
  ConfirmTaskToolRequestInput
} from "@/domain";

export type AIChatResponse = {
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

export type ConfirmToolResponse = {
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

type AIChatRequest = {
  appData: AIStoredAppData;
  message: string;
  mode: AIChatMode;
};

async function readApiJson<T extends { error?: string }>(
  response: Response,
  fallbackError: string
): Promise<T> {
  const contentType = response.headers?.get("content-type") ?? "";

  if (contentType.includes("application/json") || !contentType) {
    try {
      return (await response.json()) as T;
    } catch {
      if (contentType.includes("application/json")) {
        return { error: fallbackError } as T;
      }
    }
  }

  const text = typeof response.text === "function" ? (await response.text()).trim() : "";
  const isHtmlError = contentType.includes("text/html") || text.startsWith("<");
  return { error: isHtmlError ? fallbackError : text || fallbackError } as T;
}

export async function sendAIChatRequest(input: AIChatRequest): Promise<AIChatResponse> {
  const fallbackError = "AI coach is unavailable right now.";
  const response = await fetch("/api/ai/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });
  const payload = await readApiJson<AIChatResponse>(response, fallbackError);

  if (!response.ok || !payload.message) {
    throw new Error(payload.error ?? fallbackError);
  }

  return payload;
}

export async function confirmAIToolProposal(
  input: ConfirmTaskToolRequestInput
): Promise<ConfirmToolResponse> {
  const fallbackError = "AI proposal could not be applied.";
  const response = await fetch("/api/ai/tools/confirm", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });
  const payload = await readApiJson<ConfirmToolResponse>(response, fallbackError);

  if (!response.ok || !payload.ok || !payload.appliedChangeSummary) {
    throw new Error(payload.error ?? fallbackError);
  }

  return payload;
}
