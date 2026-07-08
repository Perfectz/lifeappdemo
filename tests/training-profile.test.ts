import { beforeEach, describe, expect, it } from "vitest";

import {
  loadTrainingProfile,
  saveTrainingProfile,
  trainingProfileStorageKey
} from "@/data/trainingProfileRepository";
import {
  defaultTrainingProfile,
  formatTrainingProfileForPrompt,
  isTrainingProfile
} from "@/domain/trainingProfile";

describe("trainingProfile domain", () => {
  it("seeds defaults to the user's setup: KBs, DBs, bands + gym access, Vinny split", () => {
    const profile = defaultTrainingProfile("2026-07-07T08:00:00.000Z");
    expect(profile.equipment).toEqual({
      kettlebells: true,
      dumbbells: true,
      bands: true,
      barbell: true,
      machines: true,
      pullupBar: false
    });
    expect(profile.gymAccess).toBe(true);
    expect(profile.coachStyle).toBe("vinny_split");
    expect(profile.updatedAt).toBe("2026-07-07T08:00:00.000Z");
  });

  it("guards the shape", () => {
    expect(isTrainingProfile(defaultTrainingProfile())).toBe(true);
    expect(isTrainingProfile(null)).toBe(false);
    expect(isTrainingProfile({ gymAccess: true })).toBe(false);
    expect(
      isTrainingProfile({ ...defaultTrainingProfile(), coachStyle: "chaos_mode" })
    ).toBe(false);
    const missingEquipmentKey = defaultTrainingProfile() as unknown as Record<string, unknown>;
    missingEquipmentKey.equipment = { kettlebells: true };
    expect(isTrainingProfile(missingEquipmentKey)).toBe(false);
  });

  it("formats a prompt block with equipment, gym access and style", () => {
    const text = formatTrainingProfileForPrompt({
      ...defaultTrainingProfile("2026-07-07T08:00:00.000Z"),
      strengthDaysPerWeek: 3,
      notes: "karate Tue/Thu"
    });
    expect(text).toContain("kettlebells, dumbbells, resistance bands, barbell, machines");
    expect(text).toContain("Gym access: yes");
    expect(text).toContain("Coach's split");
    expect(text).toContain("Vinny");
    expect(text).toContain("Strength days per week: 3");
    expect(text).toContain("karate Tue/Thu");
  });
});

describe("trainingProfileRepository", () => {
  beforeEach(() => window.localStorage.clear());

  it("uses the versioned key and returns defaults when empty", () => {
    expect(trainingProfileStorageKey).toBe("lifequest.training-profile.v1");
    const profile = loadTrainingProfile(window.localStorage);
    expect(profile.coachStyle).toBe("vinny_split");
    expect(profile.gymAccess).toBe(true);
  });

  it("round-trips edits", () => {
    const profile = loadTrainingProfile(window.localStorage);
    saveTrainingProfile(window.localStorage, {
      ...profile,
      gymAccess: false,
      equipment: { ...profile.equipment, barbell: false },
      notes: "home only this month"
    });
    const reloaded = loadTrainingProfile(window.localStorage);
    expect(reloaded.gymAccess).toBe(false);
    expect(reloaded.equipment.barbell).toBe(false);
    expect(reloaded.notes).toBe("home only this month");
  });

  it("falls back to defaults on corrupt data", () => {
    window.localStorage.setItem(trainingProfileStorageKey, "{broken");
    expect(loadTrainingProfile(window.localStorage).coachStyle).toBe("vinny_split");
  });
});
