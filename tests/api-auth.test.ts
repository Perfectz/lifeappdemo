import { afterEach, describe, expect, it, vi } from "vitest";

import { POST as chatPost } from "@/app/api/ai/chat/route";
import { POST as confirmPost } from "@/app/api/ai/tools/confirm/route";
import { GET as foodSearchGet } from "@/app/api/food/search/route";
import { POST as realtimePost } from "@/app/api/realtime/session/route";
import { checkRateLimit, resetRateLimiter } from "@/server/ai/rateLimiter";
import { requireUser, setAuthUserForTests } from "@/server/auth/requireUser";

// Fake Supabase for the real verification path (used with NODE_ENV stubbed
// away from "test"). getUser validates the bearer token; the from() chain
// answers the app_members membership lookup.
const supabaseMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  maybeSingle: vi.fn()
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: supabaseMocks.getUser },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: supabaseMocks.maybeSingle })
      })
    })
  }))
}));

function post(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" }
  });
}

function bearerRequest(token?: string): Request {
  return new Request("http://localhost/api/ai/chat", {
    method: "POST",
    body: "{}",
    headers: token
      ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
      : { "Content-Type": "application/json" }
  });
}

afterEach(() => {
  setAuthUserForTests(undefined);
  resetRateLimiter();
  supabaseMocks.getUser.mockReset();
  supabaseMocks.maybeSingle.mockReset();
  vi.unstubAllEnvs();
});

describe("requireUser", () => {
  it("auto-passes in the test environment so route tests can call handlers directly", async () => {
    const result = await requireUser(post("http://localhost/api/ai/chat", {}));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.id).toBe("test-user");
    }
  });

  it("rejects when the test override simulates a signed-out caller", async () => {
    setAuthUserForTests(null);
    const result = await requireUser(post("http://localhost/api/ai/chat", {}));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
    }
  });

  it("resolves the injected user", async () => {
    setAuthUserForTests({ id: "user-42", email: "member@example.com" });
    const result = await requireUser(post("http://localhost/api/ai/chat", {}));
    expect(result).toEqual({ ok: true, user: { id: "user-42", email: "member@example.com" } });
  });
});

describe("requireUser real verification path", () => {
  // NODE_ENV=test short-circuits the guard; stub it away to exercise the
  // Bearer-token + membership pipeline against the mocked Supabase client.
  function enterProductionMode() {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_E2E", "");
  }

  it("rejects requests without an Authorization header", async () => {
    enterProductionMode();
    const result = await requireUser(bearerRequest());
    expect(result).toMatchObject({ ok: false, status: 401 });
    expect(supabaseMocks.getUser).not.toHaveBeenCalled();
  });

  it("rejects an invalid or expired token", async () => {
    enterProductionMode();
    supabaseMocks.getUser.mockResolvedValue({ data: { user: null }, error: { message: "bad" } });
    const result = await requireUser(bearerRequest("forged-token"));
    expect(result).toMatchObject({ ok: false, status: 401 });
    expect(supabaseMocks.getUser).toHaveBeenCalledWith("forged-token");
  });

  it("rejects a valid user who is not an approved member (invite-only)", async () => {
    enterProductionMode();
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-9", email: "stranger@example.com" } },
      error: null
    });
    supabaseMocks.maybeSingle.mockResolvedValue({ data: { status: "pending" }, error: null });
    const result = await requireUser(bearerRequest("valid-token"));
    expect(result).toMatchObject({ ok: false, status: 403 });
  });

  it("fails closed when the membership lookup errors", async () => {
    enterProductionMode();
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-9", email: "stranger@example.com" } },
      error: null
    });
    supabaseMocks.maybeSingle.mockResolvedValue({ data: null, error: { message: "down" } });
    const result = await requireUser(bearerRequest("valid-token"));
    expect(result).toMatchObject({ ok: false, status: 403 });
  });

  it("accepts an approved member", async () => {
    enterProductionMode();
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-7", email: "member@example.com" } },
      error: null
    });
    supabaseMocks.maybeSingle.mockResolvedValue({ data: { status: "approved" }, error: null });
    const result = await requireUser(bearerRequest("valid-token"));
    expect(result).toEqual({ ok: true, user: { id: "user-7", email: "member@example.com" } });
  });

  it("accepts the app creator without a membership row", async () => {
    enterProductionMode();
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "creator", email: "pzgambo@gmail.com" } },
      error: null
    });
    const result = await requireUser(bearerRequest("valid-token"));
    expect(result).toEqual({ ok: true, user: { id: "creator", email: "pzgambo@gmail.com" } });
    expect(supabaseMocks.maybeSingle).not.toHaveBeenCalled();
  });

  it("bypasses auth when the Playwright webserver sets NEXT_PUBLIC_E2E=1", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_E2E", "1");
    const result = await requireUser(bearerRequest());
    expect(result).toEqual({ ok: true, user: { id: "e2e", email: null } });
  });
});

describe("route auth enforcement", () => {
  it("returns 401 from the AI chat route without a valid user", async () => {
    setAuthUserForTests(null);
    const response = await chatPost(post("http://localhost/api/ai/chat", { message: "Hi", mode: "general" }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Sign in to use this feature." });
  });

  it("returns 401 from the realtime session route without a valid user", async () => {
    setAuthUserForTests(null);
    const response = await realtimePost(
      post("http://localhost/api/realtime/session", { mode: "general" })
    );
    expect(response.status).toBe(401);
  });

  it("returns 401 from the tools confirm route without a valid user", async () => {
    setAuthUserForTests(null);
    const response = await confirmPost(post("http://localhost/api/ai/tools/confirm", {}));
    expect(response.status).toBe(401);
  });

  it("returns 401 from the food search route without a valid user", async () => {
    setAuthUserForTests(null);
    const response = await foodSearchGet(new Request("http://localhost/api/food/search?q=oats"));
    expect(response.status).toBe(401);
  });
});

describe("per-user rate limiting", () => {
  it("keys buckets per user so one user's burst doesn't block another", () => {
    const t0 = 1_000;
    expect(checkRateLimit("ai-chat:user-a", 1, 60_000, t0).ok).toBe(true);
    expect(checkRateLimit("ai-chat:user-a", 1, 60_000, t0).ok).toBe(false);
    // Same route, different user — separate bucket.
    expect(checkRateLimit("ai-chat:user-b", 1, 60_000, t0).ok).toBe(true);
  });

  it("rate limits the chat route under the authenticated user's id", async () => {
    setAuthUserForTests({ id: "burst-user", email: null });
    // Exhaust the default 20-requests window (invalid bodies still count).
    for (let i = 0; i < 20; i += 1) {
      const response = await chatPost(post("http://localhost/api/ai/chat", {}));
      expect(response.status).toBe(400);
    }
    const blocked = await chatPost(post("http://localhost/api/ai/chat", {}));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBeTruthy();

    // A different signed-in user is unaffected.
    setAuthUserForTests({ id: "other-user", email: null });
    const other = await chatPost(post("http://localhost/api/ai/chat", {}));
    expect(other.status).toBe(400);
  });
});
