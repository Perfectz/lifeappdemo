import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/health/route";

describe("/api/health", () => {
  it("returns the expected health payload", async () => {
    const response = GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      ok: true,
      app: "LifeQuest OS"
    });
  });
});
