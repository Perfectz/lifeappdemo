import { describe, expect, it } from "vitest";

import {
  createProgressPhoto,
  getPhotosForDate,
  groupPhotosByDate,
  isProgressPhoto,
  validateProgressPhotoInput,
  type ProgressPhoto
} from "@/domain/progressPhotos";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function photo(overrides: Partial<ProgressPhoto>): ProgressPhoto {
  return {
    id: overrides.id ?? "p1",
    date: overrides.date ?? "2026-06-18",
    angle: overrides.angle ?? "front",
    dataUrl: overrides.dataUrl ?? PNG,
    createdAt: overrides.createdAt ?? "2026-06-18T08:00:00.000Z",
    ...overrides
  };
}

describe("progress photos", () => {
  it("validates and rejects non-image data URLs", () => {
    expect(validateProgressPhotoInput({ date: "2026-06-18", angle: "front", dataUrl: PNG }).ok).toBe(true);
    expect(validateProgressPhotoInput({ date: "2026-06-18", angle: "front", dataUrl: "nope" }).ok).toBe(false);
    expect(
      validateProgressPhotoInput({ date: "", angle: "front", dataUrl: PNG }).ok
    ).toBe(false);
  });

  it("creates a valid photo and round-trips the guard", () => {
    const created = createProgressPhoto({ date: "2026-06-18", angle: "profile", dataUrl: PNG });
    expect(created.angle).toBe("profile");
    expect(created.id).toBeTruthy();
    expect(isProgressPhoto(created)).toBe(true);
    expect(isProgressPhoto({ ...created, angle: "back" })).toBe(false);
  });

  it("throws when creating from an invalid input", () => {
    expect(() => createProgressPhoto({ date: "2026-06-18", angle: "front", dataUrl: "x" })).toThrow();
  });

  it("groups a day's photos by angle, newest per angle winning", () => {
    const photos = [
      photo({ id: "a", angle: "front", createdAt: "2026-06-18T07:00:00.000Z" }),
      photo({ id: "b", angle: "front", createdAt: "2026-06-18T09:00:00.000Z" }),
      photo({ id: "c", angle: "profile", createdAt: "2026-06-18T08:00:00.000Z" })
    ];
    const day = getPhotosForDate(photos, "2026-06-18");
    expect(day.byAngle.front?.id).toBe("b");
    expect(day.byAngle.profile?.id).toBe("c");
    expect(day.byAngle.face).toBeUndefined();
    expect(day.count).toBe(2);
    expect(day.isComplete).toBe(false);
  });

  it("marks a day complete when all three angles are present", () => {
    const photos = [
      photo({ id: "a", angle: "front" }),
      photo({ id: "b", angle: "profile" }),
      photo({ id: "c", angle: "face" })
    ];
    expect(getPhotosForDate(photos, "2026-06-18").isComplete).toBe(true);
  });

  it("groups across dates newest-first", () => {
    const photos = [
      photo({ id: "a", date: "2026-06-16" }),
      photo({ id: "b", date: "2026-06-18" }),
      photo({ id: "c", date: "2026-06-17" })
    ];
    const days = groupPhotosByDate(photos);
    expect(days.map((day) => day.date)).toEqual(["2026-06-18", "2026-06-17", "2026-06-16"]);
  });
});
