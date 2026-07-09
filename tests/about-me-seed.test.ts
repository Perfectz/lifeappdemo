import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadWiki, saveWiki } from "@/data/wikiRepository";
import { emptyWiki, isWikiEmpty } from "@/domain/personalWiki";

const cloud = vi.hoisted(() => ({
  isCloudSyncConfigured: vi.fn<() => boolean>(() => true),
  getCurrentCloudUser: vi.fn<() => Promise<{ id: string; email: string | null } | null>>(
    async () => ({ id: "u1", email: "pzgambo@gmail.com" })
  )
}));

vi.mock("@/client/cloudSync", () => cloud);

const SEED_FLAG = "lifequest.aboutMeSeed.v1";

/**
 * The seed module keeps a module-level in-flight guard, so each test gets a
 * fresh copy via resetModules + dynamic import (the cloudSync mock survives).
 */
async function importSeed() {
  vi.resetModules();
  return import("@/client/aboutMeSeed");
}

describe("seedAboutMeForPatrick", () => {
  beforeEach(() => {
    window.localStorage.clear();
    cloud.isCloudSyncConfigured.mockReturnValue(true);
    cloud.getCurrentCloudUser.mockResolvedValue({ id: "u1", email: "pzgambo@gmail.com" });
  });

  it("seeds an empty wiki when Patrick is signed in, and sets the flag", async () => {
    const { seedAboutMeForPatrick } = await importSeed();
    const result = await seedAboutMeForPatrick();
    expect(result.seeded).toBe(true);
    expect(isWikiEmpty(loadWiki(window.localStorage))).toBe(false);
    expect(window.localStorage.getItem(SEED_FLAG)).toBeTruthy();
  });

  it("lands facts in the right sections", async () => {
    const { seedAboutMeForPatrick } = await importSeed();
    await seedAboutMeForPatrick();
    const wiki = loadWiki(window.localStorage);
    expect(wiki.sections.profile).toMatch(/GitHub: Perfectz/);
    expect(wiki.sections.health).toMatch(/fasting glucose/i);
    expect(wiki.sections.training).toMatch(/Bulgarian bag/);
    expect(wiki.sections.preferences).toMatch(/no fluff/);
    expect(wiki.sections.people).toMatch(/Vinny/);
  });

  it("never overwrites a non-empty wiki", async () => {
    const wiki = emptyWiki();
    wiki.sections.goals = "My own words.";
    saveWiki(window.localStorage, wiki);

    const { seedAboutMeForPatrick } = await importSeed();
    const result = await seedAboutMeForPatrick();
    expect(result.seeded).toBe(false);
    const after = loadWiki(window.localStorage);
    expect(after.sections.goals).toBe("My own words.");
    expect(after.sections.profile).toBe("");
    // Marked done so it doesn't keep re-checking forever.
    expect(window.localStorage.getItem(SEED_FLAG)).toBeTruthy();
  });

  it("does not re-seed once the flag is set", async () => {
    window.localStorage.setItem(SEED_FLAG, new Date().toISOString());
    const { seedAboutMeForPatrick } = await importSeed();
    const result = await seedAboutMeForPatrick();
    expect(result.seeded).toBe(false);
    expect(isWikiEmpty(loadWiki(window.localStorage))).toBe(true);
  });

  it("does not seed for another account, and leaves the flag unset", async () => {
    cloud.getCurrentCloudUser.mockResolvedValue({ id: "u2", email: "someone@else.com" });
    const { seedAboutMeForPatrick } = await importSeed();
    const result = await seedAboutMeForPatrick();
    expect(result.seeded).toBe(false);
    expect(isWikiEmpty(loadWiki(window.localStorage))).toBe(true);
    expect(window.localStorage.getItem(SEED_FLAG)).toBeNull();
  });

  it("retries after a signed-out visit once Patrick signs in", async () => {
    cloud.getCurrentCloudUser.mockResolvedValueOnce(null);
    const { seedAboutMeForPatrick } = await importSeed();

    const first = await seedAboutMeForPatrick();
    expect(first.seeded).toBe(false);
    expect(window.localStorage.getItem(SEED_FLAG)).toBeNull();

    // Same module instance — the in-flight guard must have been released.
    const second = await seedAboutMeForPatrick();
    expect(second.seeded).toBe(true);
    expect(isWikiEmpty(loadWiki(window.localStorage))).toBe(false);
  });
});
