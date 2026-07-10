import { describe, expect, it } from "vitest";

import { toolCallsToProposals } from "@/server/ai/openaiClient";

function toolCall(name: string, args: unknown) {
  return { type: "function", function: { name, arguments: JSON.stringify(args) } };
}

describe("coach tool calls → proposals", () => {
  it("turns a log_food tool call into a proposal with its payload", () => {
    const proposals = toolCallsToProposals([
      toolCall("log_food", { description: "Oatmeal", mealType: "breakfast", calories: 320, sodiumMg: 120 })
    ]);
    expect(proposals).toHaveLength(1);
    expect(proposals[0].toolName).toBe("log_food");
    expect(proposals[0].summary).toContain("Oatmeal");
    expect(proposals[0].payload).toMatchObject({ description: "Oatmeal", calories: 320, sodiumMg: 120 });
  });

  it("accepts log_metric even without a date (lenient, runs via the voice layer)", () => {
    const proposals = toolCallsToProposals([
      toolCall("log_metric", { bloodPressureSystolic: 122, bloodPressureDiastolic: 78 })
    ]);
    expect(proposals).toHaveLength(1);
    expect(proposals[0].toolName).toBe("log_metric");
    expect(proposals[0].payload).toMatchObject({ bloodPressureSystolic: 122 });
  });

  it("handles multiple tool calls and skips unknown tools", () => {
    const proposals = toolCallsToProposals([
      toolCall("set_health_goal", { weightTargetLbs: 195 }),
      toolCall("totally_unknown_tool", { x: 1 }),
      toolCall("save_memory", { key: "diet", content: "low sodium" })
    ]);
    expect(proposals.map((p) => p.toolName)).toEqual(["set_health_goal", "save_memory"]);
  });

  it("tolerates malformed arguments", () => {
    const proposals = toolCallsToProposals([{ type: "function", function: { name: "remove_food", arguments: "{bad json" } }]);
    // remove_food needs a description; malformed args → empty payload → no description.
    // It still validates as a coach action (pass-through), so the client handler reports the miss.
    expect(proposals.length).toBeLessThanOrEqual(1);
  });

  it("returns nothing for non-array input", () => {
    expect(toolCallsToProposals(undefined)).toEqual([]);
    expect(toolCallsToProposals(null)).toEqual([]);
  });

  it("turns strategic goal creation into a confirmable proposal", () => {
    const proposals = toolCallsToProposals([
      toolCall("create_goal", { title: "Finish the launch", pillar: "professional", horizon: "quarterly" })
    ]);
    expect(proposals[0]).toMatchObject({
      toolName: "create_goal",
      summary: "Create a strategic goal"
    });
  });

  it("turns assistant task maintenance into confirmable proposals", () => {
    const proposals = toolCallsToProposals([
      toolCall("defer_task", { taskId: "task-1", plannedForDate: "2026-05-08" }),
      toolCall("archive_task", { taskId: "task-2" })
    ]);

    expect(proposals).toHaveLength(2);
    expect(proposals[0]).toMatchObject({
      toolName: "defer_task",
      payload: { taskId: "task-1", plannedForDate: "2026-05-08" }
    });
    expect(proposals[1]).toMatchObject({
      toolName: "archive_task",
      payload: { taskId: "task-2" }
    });
  });

  it("turns a planned day into an approval-gated proposal", () => {
    const proposals = toolCallsToProposals([
      toolCall("propose_daily_plan", {
        date: "2026-05-04",
        mainQuestTaskId: "task-1",
        sideQuestTaskIds: ["task-2"],
        intention: "Finish the important work before adding more.",
        rationale: "The launch task is the highest-leverage commitment."
      })
    ]);

    expect(proposals[0]).toMatchObject({
      toolName: "propose_daily_plan",
      summary: "Propose a daily plan"
    });
  });
});
