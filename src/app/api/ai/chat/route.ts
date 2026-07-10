import { NextResponse } from "next/server";

import {
  buildAIAppContext,
  formatAIContextForPrompt,
  summarizeAIAppContext,
  validateAIChatRequestBody
} from "@/domain/aiContext";
import { toLocalIsoDate } from "@/domain/dates";
import { completeReadOnlyCoachChat } from "@/server/ai/openaiClient";
import { handleAIRoute } from "@/server/ai/aiRoute";
import { gmailContextForPrompt } from "@/server/integrations/gmail";

// Allow the coach response (OpenAI call) up to 60s on Vercel; the Hobby tier
// default is 10s, which would cut off the in-code 30s OpenAI timeout.
export const maxDuration = 60;

export async function POST(request: Request) {
  return handleAIRoute(
    request,
    {
      rateLimitKey: "ai-chat",
      rateLimitedError: "Too many AI requests. Please slow down for a moment.",
      notConfiguredError:
        "AI coach isn't configured. The deterministic app works fully without it — add an OpenAI API key to enable coaching.",
      unavailableError: "AI coach is unavailable right now. Try again in a moment."
    },
    async (body, user) => {
      const validation = validateAIChatRequestBody(body);

      if (!validation.ok) {
        return NextResponse.json({ error: validation.message }, { status: 400 });
      }

      const context = buildAIAppContext(validation.value.appData ?? {}, toLocalIsoDate());
      const usedContext = summarizeAIAppContext(context);

      const contextText = formatAIContextForPrompt(context);
      const baseContext = validation.value.aboutMe
        ? `About the user (their self-profile):\n${validation.value.aboutMe}\n\n${contextText}`
        : contextText;
      const gmailContext = await gmailContextForPrompt(user.id, validation.value.message);
      const fullContext = gmailContext ? `${baseContext}\n\n${gmailContext}` : baseContext;

      const completion = await completeReadOnlyCoachChat({
        message: validation.value.message,
        mode: validation.value.mode,
        context: fullContext,
        heroName: validation.value.heroName,
        history: validation.value.history
      });

      return NextResponse.json({
        message: completion.message,
        mode: validation.value.mode,
        proposals: completion.proposals,
        usedContext
      });
    }
  );
}
