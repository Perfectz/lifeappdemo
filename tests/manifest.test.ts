import { describe, expect, it } from "vitest";

import manifest from "@/app/manifest";

describe("PWA manifest", () => {
  it("includes the installability basics", () => {
    const value = manifest();

    expect(value.name).toBe("LifeQuest OS");
    expect(value.short_name).toBe("LifeQuest");
    expect(value.start_url).toBe("/dashboard");
    expect(value.scope).toBe("/");
    expect(value.display).toBe("standalone");
    expect(value.theme_color).toBe("#101319");
    expect(value.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: "/icons/icon-192.png", type: "image/png" }),
        expect.objectContaining({ src: "/icons/icon-512.png", type: "image/png" }),
        expect.objectContaining({ src: "/icons/maskable-512.png", purpose: "maskable" }),
        expect.objectContaining({ src: "/icons/icon-192.svg" }),
        expect.objectContaining({ src: "/icons/icon-512.svg" })
      ])
    );
  });
});
