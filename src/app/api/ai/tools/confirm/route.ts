import { NextResponse } from "next/server";

import { applyAITaskToolProposal, validateConfirmTaskToolRequest } from "@/domain/aiTaskTools";

export async function POST(request: Request) {
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
    validation.value.dailyReports,
    validation.value.eveningPostmortems
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    appliedChangeSummary: result.appliedChangeSummary,
    dailyPlans: result.dailyPlans,
    dailyReports: result.dailyReports,
    eveningPostmortems: result.eveningPostmortems,
    journalEntries: result.journalEntries,
    metricEntries: result.metricEntries,
    tasks: result.tasks
  });
}
