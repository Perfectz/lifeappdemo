import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMock = vi.hoisted(() => ({
  client: null as unknown
}));

vi.mock("@/lib/supabase/client", () => ({
  isSupabaseConfigured: () => true,
  getSupabaseClient: () => supabaseMock.client
}));

import {
  getLastSyncedAt,
  hasLocalBackup,
  mergeWithCloud,
  pushSnapshot,
  sameInstant
} from "@/client/cloudSync";
import { backupAppId, backupSchemaVersion } from "@/client/dataBackup";
import { syncNoticeEventName, type SyncNoticeDetail } from "@/client/syncNotice";

const LAST_SYNCED_KEY = "lifequest.sync.lastSyncedAt";
const TASKS_KEY = "lifequest.tasks.v1";

type DbRow = { user_id: string; data: unknown; updated_at: string };

/**
 * Minimal fake of the Supabase PostgREST builder, faithful to the concurrency
 * semantics the sync code relies on:
 * - UPDATE applies only when every .eq() filter matches the current row
 *   (updated_at compared by instant, like timestamptz), atomically.
 * - The server "trigger" stamps updated_at with the next server timestamp,
 *   ignoring whatever the client sent.
 * - INSERT fails with 23505 when the row already exists.
 */
function makeFakeSupabase(options: { row?: DbRow | null; serverStamps: string[] }) {
  const state = { row: options.row ?? null };
  let stampIndex = 0;
  const nextStamp = () => {
    const stamp = options.serverStamps[stampIndex];
    stampIndex = Math.min(stampIndex + 1, options.serverStamps.length - 1);
    return stamp;
  };

  const matches = (row: DbRow, filters: { col: string; value: string }[]) =>
    filters.every((f) => {
      const actual = (row as unknown as Record<string, unknown>)[f.col];
      if (f.col === "updated_at") return sameInstant(String(actual), f.value);
      return actual === f.value;
    });

  function from() {
    const ctx = {
      op: "select" as "select" | "update" | "insert",
      payload: null as Record<string, unknown> | null,
      filters: [] as { col: string; value: string }[]
    };

    const exec = () => {
      if (ctx.op === "select") {
        const hit = state.row && matches(state.row, ctx.filters) ? state.row : null;
        return {
          data: hit ? { data: hit.data, updated_at: hit.updated_at } : null,
          error: null
        };
      }
      if (ctx.op === "update") {
        if (!state.row || !matches(state.row, ctx.filters)) return { data: [], error: null };
        state.row = {
          ...state.row,
          data: ctx.payload?.data,
          updated_at: nextStamp() // trigger overrides the client-sent value
        };
        return { data: [{ updated_at: state.row.updated_at }], error: null };
      }
      // insert
      if (state.row && state.row.user_id === ctx.payload?.user_id) {
        return {
          data: null,
          error: { code: "23505", message: "duplicate key value violates unique constraint" }
        };
      }
      state.row = {
        user_id: String(ctx.payload?.user_id),
        data: ctx.payload?.data,
        updated_at: nextStamp()
      };
      return { data: { updated_at: state.row.updated_at }, error: null };
    };

    const builder = {
      select: () => builder,
      update: (payload: Record<string, unknown>) => {
        ctx.op = "update";
        ctx.payload = payload;
        return builder;
      },
      insert: (payload: Record<string, unknown>) => {
        ctx.op = "insert";
        ctx.payload = payload;
        return builder;
      },
      eq: (col: string, value: string) => {
        ctx.filters.push({ col, value });
        return builder;
      },
      maybeSingle: () => Promise.resolve(exec()),
      single: () => Promise.resolve(exec()),
      // Awaiting the builder itself (update/insert chains) executes it.
      then: (
        resolve: (value: unknown) => unknown,
        reject?: (reason: unknown) => unknown
      ) => Promise.resolve(exec()).then(resolve, reject)
    };
    return builder;
  }

  const client = {
    from,
    auth: {
      getUser: async () => ({ data: { user: { id: "u1", email: "test@example.com" } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
    }
  };

  return { client, state };
}

function envelope(data: Record<string, unknown>) {
  return {
    app: backupAppId,
    schemaVersion: backupSchemaVersion,
    exportedAt: "2026-07-01T00:00:00.000Z",
    data
  };
}

function readLocalTasks(): { id: string; title?: string; updatedAt?: string }[] {
  return JSON.parse(window.localStorage.getItem(TASKS_KEY) ?? "[]");
}

beforeEach(() => {
  window.localStorage.clear();
  supabaseMock.client = null;
});

describe("cloud sync timestamp comparison", () => {
  it("treats the same instant in different formats as equal", () => {
    // What we store (Date.toISOString) vs what Supabase/PostgREST returns.
    expect(sameInstant("2026-06-21T13:52:58.992Z", "2026-06-21T13:52:58.992+00:00")).toBe(true);
    expect(sameInstant("2026-06-21T13:52:58.992+00:00", "2026-06-21T13:52:58.992Z")).toBe(true);
  });

  it("treats different instants as not equal", () => {
    expect(sameInstant("2026-06-21T13:52:58.992Z", "2026-06-21T13:52:59.100Z")).toBe(false);
  });

  it("returns false for null or unparseable values", () => {
    expect(sameInstant(null, "2026-06-21T13:52:58.992Z")).toBe(false);
    expect(sameInstant("2026-06-21T13:52:58.992Z", null)).toBe(false);
    expect(sameInstant("not-a-date", "also-bad")).toBe(false);
  });
});

describe("pushSnapshot", () => {
  it("inserts the first snapshot and stores the SERVER updated_at, not the client clock", async () => {
    const serverStamp = "2031-01-01T00:00:00.000+00:00"; // deliberately far from Date.now()
    const fake = makeFakeSupabase({ row: null, serverStamps: [serverStamp] });
    supabaseMock.client = fake.client;
    window.localStorage.setItem(TASKS_KEY, JSON.stringify([{ id: "t1", title: "Quest" }]));

    const result = await pushSnapshot();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.at).toBe(serverStamp);
    expect(getLastSyncedAt()).toBe(serverStamp);
    const stored = fake.state.row?.data as { data: Record<string, unknown> };
    expect(stored.data[TASKS_KEY]).toEqual([{ id: "t1", title: "Quest" }]);
  });

  it("updates conditionally when the cloud row is where we last saw it", async () => {
    const before = "2026-07-01T10:00:00.000+00:00";
    const after = "2026-07-02T09:00:00.000+00:00";
    const fake = makeFakeSupabase({
      row: { user_id: "u1", data: envelope({}), updated_at: before },
      serverStamps: [after]
    });
    supabaseMock.client = fake.client;
    // Stored in "Z" format while the row uses "+00:00" — must still match.
    window.localStorage.setItem(LAST_SYNCED_KEY, "2026-07-01T10:00:00.000Z");
    window.localStorage.setItem(TASKS_KEY, JSON.stringify([{ id: "t2" }]));

    const result = await pushSnapshot();
    expect(result.ok).toBe(true);
    expect(fake.state.row?.updated_at).toBe(after);
    expect(getLastSyncedAt()).toBe(after);
  });

  it("reports a conflict (and writes nothing) when another device advanced the row", async () => {
    const original = envelope({ [TASKS_KEY]: [{ id: "other-device" }] });
    const fake = makeFakeSupabase({
      row: { user_id: "u1", data: original, updated_at: "2026-07-02T08:00:00.000+00:00" },
      serverStamps: ["2026-07-02T09:00:00.000+00:00"]
    });
    supabaseMock.client = fake.client;
    window.localStorage.setItem(LAST_SYNCED_KEY, "2026-07-01T10:00:00.000Z"); // stale
    window.localStorage.setItem(TASKS_KEY, JSON.stringify([{ id: "mine" }]));

    const result = await pushSnapshot();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.conflict).toBe(true);
    // The cloud row is untouched and our sync marker didn't move.
    expect(fake.state.row?.data).toEqual(original);
    expect(getLastSyncedAt()).toBe("2026-07-01T10:00:00.000Z");
  });

  it("treats an insert race (row created by another device) as a conflict", async () => {
    const fake = makeFakeSupabase({
      row: { user_id: "u1", data: envelope({}), updated_at: "2026-07-02T08:00:00.000+00:00" },
      serverStamps: ["2026-07-02T09:00:00.000+00:00"]
    });
    supabaseMock.client = fake.client;
    // No lastSyncedAt — this device has never synced, so it tries to insert.
    window.localStorage.setItem(TASKS_KEY, JSON.stringify([{ id: "mine" }]));

    const result = await pushSnapshot();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.conflict).toBe(true);
  });
});

describe("mergeWithCloud", () => {
  it("unions records by id, lets the newest win, notifies about discards, and stashes a backup", async () => {
    const cloudAt = "2026-07-02T09:00:00.000+00:00";
    const fake = makeFakeSupabase({
      row: {
        user_id: "u1",
        data: envelope({
          [TASKS_KEY]: [
            { id: "a", title: "cloud edit", updatedAt: "2026-07-02T08:00:00.000Z" },
            { id: "c", title: "cloud only", updatedAt: "2026-07-01T00:00:00.000Z" }
          ]
        }),
        updated_at: cloudAt
      },
      serverStamps: ["2026-07-02T10:00:00.000+00:00"]
    });
    supabaseMock.client = fake.client;
    window.localStorage.setItem(
      TASKS_KEY,
      JSON.stringify([
        { id: "a", title: "stale local edit", updatedAt: "2026-07-01T08:00:00.000Z" },
        { id: "b", title: "local only", updatedAt: "2026-07-01T09:00:00.000Z" }
      ])
    );

    const notices: string[] = [];
    const onNotice = (event: Event) => {
      notices.push((event as CustomEvent<SyncNoticeDetail>).detail.message);
    };
    window.addEventListener(syncNoticeEventName, onNotice);
    try {
      const result = await mergeWithCloud();
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const tasks = readLocalTasks();
      expect(tasks.map((t) => t.id).sort()).toEqual(["a", "b", "c"]);
      expect(tasks.find((t) => t.id === "a")?.title).toBe("cloud edit");

      expect(result.localDiscarded).toBe(1); // the stale local "a"
      expect(result.cloudNeedsPush).toBe(true); // cloud is missing "b"
      expect(result.localChanged).toBe(true);
      expect(result.at).toBe(cloudAt);
      expect(getLastSyncedAt()).toBe(cloudAt);

      // Conflict resolution must never be silent, and must be undoable.
      expect(notices).toHaveLength(1);
      expect(notices[0]).toContain("older item");
      expect(hasLocalBackup()).toBe(true);
    } finally {
      window.removeEventListener(syncNoticeEventName, onNotice);
    }
  });

  it("is a no-op (no rewrite, no push, no notice) when both sides already match", async () => {
    const cloudAt = "2026-07-02T09:00:00.000+00:00";
    const tasks = [{ id: "a", title: "same", updatedAt: "2026-07-01T08:00:00.000Z" }];
    const fake = makeFakeSupabase({
      row: { user_id: "u1", data: envelope({ [TASKS_KEY]: tasks }), updated_at: cloudAt },
      serverStamps: ["2026-07-02T10:00:00.000+00:00"]
    });
    supabaseMock.client = fake.client;
    window.localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));

    const notices: string[] = [];
    const onNotice = (event: Event) => {
      notices.push((event as CustomEvent<SyncNoticeDetail>).detail.message);
    };
    window.addEventListener(syncNoticeEventName, onNotice);
    try {
      const result = await mergeWithCloud();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.localChanged).toBe(false);
      expect(result.cloudNeedsPush).toBe(false);
      expect(result.localDiscarded).toBe(0);
      expect(result.cloudDiscarded).toBe(0);
      expect(getLastSyncedAt()).toBe(cloudAt);
      expect(notices).toHaveLength(0);
      expect(hasLocalBackup()).toBe(false);
    } finally {
      window.removeEventListener(syncNoticeEventName, onNotice);
    }
  });

  it("asks the caller to push when no cloud row exists yet", async () => {
    const fake = makeFakeSupabase({ row: null, serverStamps: ["2026-07-02T10:00:00.000+00:00"] });
    supabaseMock.client = fake.client;
    window.localStorage.setItem(TASKS_KEY, JSON.stringify([{ id: "t1" }]));

    const result = await mergeWithCloud();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cloudNeedsPush).toBe(true);
    expect(result.localChanged).toBe(false);
    expect(result.at).toBeNull();
  });
});
