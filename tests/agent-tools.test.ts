import { describe, expect, it } from "vitest";

import {
  AGENT_ACTION_TOOL_NAMES,
  AGENT_TOOL_SPECS,
  getAgentToolSpec
} from "@/ai/agentTools";

describe("shared agent tool registry", () => {
  it("has unique tool names", () => {
    const names = AGENT_TOOL_SPECS.map((spec) => spec.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("exposes the expected action tools", () => {
    expect(AGENT_ACTION_TOOL_NAMES).toEqual([
      "log_food",
      "update_food",
      "remove_food",
      "log_metric",
      "log_cardio",
      "log_strength",
      "log_martial_arts",
      "create_quest",
      "complete_quest",
      "add_journal_entry",
      "save_note",
      "set_nutrition_goal",
      "set_health_goal",
      "save_memory"
    ]);
  });

  it("validates a good log_food payload and rejects a missing description", () => {
    const spec = getAgentToolSpec("log_food");
    expect(spec?.kind).toBe("action");
    expect(spec?.inputSchema.safeParse({ description: "Oatmeal", calories: 320 }).success).toBe(true);
    expect(spec?.inputSchema.safeParse({ calories: 320 }).success).toBe(false);
  });

  it("constrains enum fields (cardio activity)", () => {
    const spec = getAgentToolSpec("log_cardio");
    expect(spec?.inputSchema.safeParse({ activity: "run" }).success).toBe(true);
    expect(spec?.inputSchema.safeParse({ activity: "swimming" }).success).toBe(false);
  });

  it("marks context tools as read-only", () => {
    expect(getAgentToolSpec("get_context")?.kind).toBe("read");
    expect(getAgentToolSpec("read_memory")?.kind).toBe("read");
  });
});
