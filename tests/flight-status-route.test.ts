import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/flight/status/route";
import { COACH_MODEL } from "@/config/ai";
import {
  buildFlightStatusBody,
  parseFlightStatusResponse,
  setFlightStatusLookupForTests,
  validateFlightStatusRequest
} from "@/server/ai/flightStatusClient";

const REQ = { flight: "AB123", date: "2026-10-02", from: "ATL", to: "AUH", scheduledDepartureLocal: "2026-10-02T20:20" };

function request(body: unknown): Request {
  return new Request("http://localhost/api/flight/status", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" }
  });
}

describe("validateFlightStatusRequest", () => {
  it("normalises valid input", () => {
    const r = validateFlightStatusRequest({ ...REQ, flight: "ab 123", from: "atl" });
    expect(r).toMatchObject({ ok: true, value: { flight: "AB123", from: "ATL" } });
  });

  it("rejects malformed flights, dates, airports and times", () => {
    expect(validateFlightStatusRequest({ ...REQ, flight: "hello world" }).ok).toBe(false);
    expect(validateFlightStatusRequest({ ...REQ, date: "Oct 2" }).ok).toBe(false);
    expect(validateFlightStatusRequest({ ...REQ, from: "Atlanta" }).ok).toBe(false);
    expect(validateFlightStatusRequest({ ...REQ, scheduledDepartureLocal: "8:20 PM" }).ok).toBe(false);
  });
});

describe("buildFlightStatusBody", () => {
  it("asks the coach model to web-search into a strict JSON schema", () => {
    const body = buildFlightStatusBody(REQ) as {
      model: string; tools: { type: string }[]; text: { format: { type: string; strict: boolean } }; input: { content: string }[];
    };
    expect(body.model).toBe(COACH_MODEL);
    expect(body.tools).toEqual([{ type: "web_search" }]);
    expect(body.text.format).toMatchObject({ type: "json_schema", strict: true });
    expect(body.input[1].content).toContain("AB123");
    expect(body.input[1].content).toContain("never guess");
  });
});

describe("parseFlightStatusResponse", () => {
  it("reads the JSON answer and merges url citations", () => {
    const answer = {
      status: "scheduled", statusText: "On time",
      departure: { airport: "ATL", terminal: "I", gate: "F7", scheduledLocal: "2026-10-02T20:20", estimatedLocal: null },
      arrival: { airport: "AUH", terminal: "A", gate: null, scheduledLocal: null, estimatedLocal: null, baggage: null },
      summary: "Departs gate F7.", confidence: "high",
      sources: [{ title: "Airport board", url: "https://example.com/board" }]
    };
    const payload = {
      output: [
        { type: "web_search_call" },
        { type: "message", content: [{ type: "output_text", text: JSON.stringify(answer), annotations: [{ type: "url_citation", url: "https://example.com/tracker", title: "Tracker" }] }] }
      ]
    };
    const parsed = parseFlightStatusResponse(payload, REQ, new Date("2026-10-02T18:00:00Z"));
    expect(parsed.departure.gate).toBe("F7");
    expect(parsed.confidence).toBe("high");
    expect(parsed.sources.map((s) => s.url)).toEqual(["https://example.com/board", "https://example.com/tracker"]);
    expect(parsed.checkedAt).toBe("2026-10-02T18:00:00.000Z");
  });

  it("keeps unknown gates null and coerces bad enums", () => {
    const payload = { output_text: JSON.stringify({ status: "flying", departure: { gate: "" }, arrival: {}, sources: [], confidence: "sure" }) };
    const parsed = parseFlightStatusResponse(payload, REQ);
    expect(parsed.status).toBe("unknown");
    expect(parsed.departure.gate).toBeNull();
    expect(parsed.departure.airport).toBe("ATL");
    expect(parsed.confidence).toBe("low");
  });

  it("throws on non-JSON output", () => {
    expect(() => parseFlightStatusResponse({ output_text: "not json" }, REQ)).toThrow();
  });
});

describe("/api/flight/status", () => {
  afterEach(() => {
    setFlightStatusLookupForTests(undefined);
    vi.restoreAllMocks();
  });

  it("rejects bad input before looking anything up", async () => {
    const lookup = vi.fn();
    setFlightStatusLookupForTests(lookup);
    const response = await POST(request({ flight: "??", date: "x" }));
    expect(response.status).toBe(400);
    expect(lookup).not.toHaveBeenCalled();
  });

  it("returns the lookup result", async () => {
    setFlightStatusLookupForTests(vi.fn().mockResolvedValue({ flight: "AB123", status: "scheduled" }));
    const response = await POST(request(REQ));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ flight: "AB123", status: "scheduled" });
  });
});
