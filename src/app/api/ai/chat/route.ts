import { NextResponse } from "next/server";

import {
  buildAIAppContext,
  formatAIContextForPrompt,
  summarizeAIAppContext,
  validateAIChatRequestBody
} from "@/domain/aiContext";
import { toLocalIsoDate } from "@/domain/dates";
import { completeReadOnlyCoachChat } from "@/server/ai/openaiClient";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const validation = validateAIChatRequestBody(body);

  if (!validation.ok) {
    return NextResponse.json({ error: validation.message }, { status: 400 });
  }

  const context = buildAIAppContext(validation.value.appData ?? {}, toLocalIsoDate());
  const usedContext = summarizeAIAppContext(context);

  try {
    const completion = await completeReadOnlyCoachChat({
      message: validation.value.message,
      mode: validation.value.mode,
      context: formatAIContextForPrompt(context)
    });

    return NextResponse.json({
      message: completion.message,
      mode: validation.value.mode,
      proposals: completion.proposals,
      usedContext
    });
  } catch {
    return NextResponse.json(
      {
        error: "AI coach is unavailable right now. Try again in a moment."
      },
      { status: 502 }
    );
  }
}
