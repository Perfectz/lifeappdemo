import { NextResponse } from "next/server";

import { applyAITaskToolProposal, validateConfirmTaskToolRequest } from "@/domain/aiTaskTools";
import { requireUser } from "@/server/auth/requireUser";

export async function POST(request: Request) {
  // No OpenAI call happens here (applying a proposal is deterministic), but
  // the route still ingests user data, so it requires the same signed-in user
  // as the rest of the AI surface.
  const auth = await requireUser(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const validation = validateConfirmTaskToolRequest(body);

  if (!validation.ok) {
    return NextResponse.json({ error: validation.message }, { status: 400 });
  }

  const result = applyAITaskToolProposal(
    validation.value.proposal,
    validation.value.tasks,
    new Date().toISOString(),
    validation.value.metricEntries,
    validation.value.journalEntries,
    validation.value.dailyPlans,
    validation.value.dailyReports
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    appliedChangeSummary: result.appliedChangeSummary,
    dailyPlans: result.dailyPlans,
    dailyReports: result.dailyReports,
    journalEntries: result.journalEntries,
    metricEntries: result.metricEntries,
    tasks: result.tasks
  });
}
