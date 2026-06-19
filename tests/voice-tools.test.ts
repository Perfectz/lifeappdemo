import { beforeEach, describe, expect, it } from "vitest";

import { executeVoiceTool, voiceToolNames } from "@/client/voiceTools";
import { createLocalTaskRepository } from "@/data/taskRepository";
import { createLocalWorkoutRepository } from "@/data/workoutRepository";
import { createLocalMetricRepository } from "@/data/metricRepository";
import { createLocalJournalRepository } from "@/data/journalRepository";
import { createLocalNoteRepository } from "@/data/noteRepository";
import { createLocalFoodEntryRepository } from "@/data/foodEntryRepository";

describe("voice tool dispatcher", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("exposes the expected toolset", () => {
    expect(voiceToolNames).toEqual([
      "create_quest",
      "complete_quest",
      "log_cardio",
      "log_strength",
      "log_martial_arts",
      "log_metric",
      "log_food",
      "add_journal_entry",
      "save_note",
      "get_context",
      "list_quests",
      "list_recent_workouts",
      "read_notes",
      "read_about_me",
      "remember",
      "forget",
      "read_memory",
      "set_nutrition_goal",
      "set_health_goal",
      "navigate"
    ]);
  });

  it("sets nutrition and health goals", () => {
    expect(executeVoiceTool("set_nutrition_goal", { calorieTarget: 1800, proteinTargetG: 160 }).ok).toBe(true);
    const nutrition = JSON.parse(window.localStorage.getItem("lifequest.nutritionGoals.v1") ?? "{}");
    expect(nutrition.calorieTarget).toBe(1800);
    expect(nutrition.proteinTargetG).toBe(160);

    expect(executeVoiceTool("set_health_goal", { weightTargetLbs: 195, bpSystolicTarget: 120 }).ok).toBe(true);
    const health = JSON.parse(window.localStorage.getItem("lifequest.healthGoals.v1") ?? "{}");
    expect(health.weightTargetLbs).toBe(195);
    expect(health.bpSystolicTarget).toBe(120);

    expect(executeVoiceTool("set_nutrition_goal", {}).ok).toBe(false);
  });

  it("remembers and recalls a durable fact, then forgets it", () => {
    expect(executeVoiceTool("remember", { key: "favorite workouts", content: "Shidokan + kettlebell" }).ok).toBe(true);
    const recalled = executeVoiceTool("read_memory", { query: "favorite" });
    expect(recalled).toMatchObject({ ok: true, silent: true });
    expect(recalled.message).toContain("Shidokan");
    expect(executeVoiceTool("forget", { key: "favorite workouts" }).ok).toBe(true);
    expect(executeVoiceTool("read_memory", {}).message).toContain("No saved memories");
  });

  it("saves a note the user can read later", () => {
    const result = executeVoiceTool("save_note", {
      content: "Felt a twinge in the left shoulder during presses — go lighter next time.",
      tags: ["injury", "strength"]
    });
    expect(result.ok).toBe(true);
    const notes = createLocalNoteRepository(window.localStorage).load();
    expect(notes).toHaveLength(1);
    expect(notes[0].content).toContain("twinge");
    expect(notes[0].tags).toContain("injury");
  });

  it("reads context as a silent (non-action) tool", () => {
    executeVoiceTool("create_quest", { title: "Book physio" });
    const result = executeVoiceTool("get_context", {});
    expect(result).toMatchObject({ ok: true, silent: true });
    expect(result.message).toContain("Book physio");
  });

  it("reads notes back, optionally by query", () => {
    executeVoiceTool("save_note", { title: "Race plan", content: "Half marathon in September." });
    const result = executeVoiceTool("read_notes", { query: "marathon" });
    expect(result).toMatchObject({ ok: true, silent: true });
    expect(result.message).toContain("Race plan");
  });

  it("creates a quest", () => {
    const result = executeVoiceTool("create_quest", { title: "Call the dentist", priority: "high" });
    expect(result.ok).toBe(true);
    const tasks = createLocalTaskRepository(window.localStorage).load();
    expect(tasks[0]).toMatchObject({ title: "Call the dentist", priority: "high", status: "todo" });
  });

  it("completes a quest by fuzzy title match", () => {
    executeVoiceTool("create_quest", { title: "Submit the tax forms" });
    const result = executeVoiceTool("complete_quest", { title: "tax" });
    expect(result.ok).toBe(true);
    const tasks = createLocalTaskRepository(window.localStorage).load();
    expect(tasks[0].status).toBe("done");
  });

  it("reports when no matching quest exists", () => {
    const result = executeVoiceTool("complete_quest", { title: "nonexistent" });
    expect(result.ok).toBe(false);
  });

  it("logs cardio with distance and vest", () => {
    const result = executeVoiceTool("log_cardio", {
      activity: "run",
      minutes: 30,
      distanceMiles: 3,
      weightVestLbs: 20
    });
    expect(result.ok).toBe(true);
    const workouts = createLocalWorkoutRepository(window.localStorage).load();
    expect(workouts[0]).toMatchObject({
      type: "cardio",
      durationMinutes: 30,
      distanceMiles: 3,
      weightVestLbs: 20
    });
  });

  it("logs a strength split day with the chosen variant", () => {
    const result = executeVoiceTool("log_strength", { day: 3, variant: "Kettlebell" });
    expect(result.ok).toBe(true);
    const workouts = createLocalWorkoutRepository(window.localStorage).load();
    expect(workouts[0].type).toBe("strength");
    expect(workouts[0].title).toContain("Day 3");
    expect(workouts[0].title).toContain("Kettlebell");
    expect(workouts[0].sets?.length).toBe(5);
  });

  it("logs martial arts", () => {
    const result = executeVoiceTool("log_martial_arts", { session: "shidokan-karate", minutes: 60 });
    expect(result.ok).toBe(true);
    const workouts = createLocalWorkoutRepository(window.localStorage).load();
    expect(workouts[0]).toMatchObject({ type: "martial_arts", durationMinutes: 60 });
  });

  it("logs a metric check-in", () => {
    const result = executeVoiceTool("log_metric", {
      energyLevel: 4,
      bloodPressureSystolic: 122,
      bloodPressureDiastolic: 78
    });
    expect(result.ok).toBe(true);
    const metrics = createLocalMetricRepository(window.localStorage).load();
    expect(metrics[0]).toMatchObject({ energyLevel: 4, bloodPressureSystolic: 122, bloodPressureDiastolic: 78 });
  });

  it("rejects an invalid metric value without saving", () => {
    const result = executeVoiceTool("log_metric", { energyLevel: 99 });
    expect(result.ok).toBe(false);
    expect(createLocalMetricRepository(window.localStorage).load()).toHaveLength(0);
  });

  it("logs a food entry with macros", () => {
    const result = executeVoiceTool("log_food", {
      description: "Chicken and rice bowl",
      mealType: "lunch",
      calories: 620,
      proteinG: 48
    });
    expect(result.ok).toBe(true);
    const foods = createLocalFoodEntryRepository(window.localStorage).load();
    expect(foods).toHaveLength(1);
    expect(foods[0]).toMatchObject({
      mealType: "lunch",
      description: "Chicken and rice bowl",
      estimateSource: "photo_ai"
    });
    expect(foods[0].macros.calories).toBe(620);
  });

  it("rejects a food log without a description", () => {
    const result = executeVoiceTool("log_food", { calories: 200 });
    expect(result.ok).toBe(false);
    expect(createLocalFoodEntryRepository(window.localStorage).load()).toHaveLength(0);
  });

  it("adds a journal entry", () => {
    const result = executeVoiceTool("add_journal_entry", { content: "Felt strong today." });
    expect(result.ok).toBe(true);
    expect(createLocalJournalRepository(window.localStorage).load()[0].content).toBe("Felt strong today.");
  });

  it("returns a navigation target", () => {
    const result = executeVoiceTool("navigate", { page: "fitness" });
    expect(result).toMatchObject({ ok: true, navigateTo: "/fitness" });
  });

  it("never throws on an unknown tool", () => {
    expect(executeVoiceTool("explode", {})).toMatchObject({ ok: false });
  });
});
