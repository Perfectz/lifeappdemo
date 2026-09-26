import { COACH_MODEL } from "@/config/ai";
import { openAIFetch } from "@/server/ai/modelFallback";
import { AINotConfiguredError, buildOpenAIError } from "@/server/ai/openaiClient";

/**
 * Live flight status / gate lookup via the Responses API + web_search.
 *
 * Airlines rarely expose public gate APIs, so the coach model searches live
 * web sources (airport departure boards, airline status pages, flight trackers)
 * and returns a strict-JSON summary with the sources it used. Gates for
 * international flights are often posted only a few hours before departure,
 * so "unknown" is a valid, expected answer.
 */

export type FlightStatusRequest = {
  flight: string;
  date: string;
  from?: string;
  to?: string;
  carrier?: string;
  scheduledDepartureLocal?: string;
  scheduledArrivalLocal?: string;
};

export type FlightEndpoint = {
  airport: string | null;
  terminal: string | null;
  gate: string | null;
  scheduledLocal: string | null;
  estimatedLocal: string | null;
};

export type FlightStatusResponse = {
  flight: string;
  date: string;
  status: string;
  statusText: string;
  departure: FlightEndpoint;
  arrival: FlightEndpoint & { baggage: string | null };
  summary: string;
  confidence: "high" | "medium" | "low";
  sources: { title: string; url: string }[];
  checkedAt: string;
};

export type FlightStatusValidation = { ok: true; value: FlightStatusRequest } | { ok: false; message: string };

const FLIGHT = /^[A-Z0-9]{2}\s?\d{1,4}[A-Z]?$/;
const IATA = /^[A-Z]{3}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const STATUSES = ["scheduled", "boarding", "departed", "delayed", "cancelled", "landed", "diverted", "unknown"];

export function validateFlightStatusRequest(body: unknown): FlightStatusValidation {
  if (!body || typeof body !== "object") return { ok: false, message: "Request body is required." };
  const b = body as Record<string, unknown>;
  const flight = typeof b.flight === "string" ? b.flight.trim().toUpperCase() : "";
  if (!FLIGHT.test(flight)) return { ok: false, message: "Flight must look like EY14." };
  if (typeof b.date !== "string" || !DATE.test(b.date)) return { ok: false, message: "Date must be yyyy-MM-dd." };
  const opt = (key: string, re: RegExp, upper = false): string | undefined | null => {
    const v = b[key];
    if (v === undefined || v === null || v === "") return undefined;
    if (typeof v !== "string") return null;
    const s = upper ? v.trim().toUpperCase() : v.trim();
    return re.test(s) ? s : null;
  };
  const from = opt("from", IATA, true);
  const to = opt("to", IATA, true);
  const dep = opt("scheduledDepartureLocal", LOCAL_DT);
  const arr = opt("scheduledArrivalLocal", LOCAL_DT);
  if (from === null || to === null) return { ok: false, message: "Airports must be 3-letter IATA codes." };
  if (dep === null || arr === null) return { ok: false, message: "Scheduled times must be yyyy-MM-ddTHH:mm." };
  const carrier = typeof b.carrier === "string" && b.carrier.trim().length <= 40 ? b.carrier.trim() : undefined;
  return {
    ok: true,
    value: { flight: flight.replace(/\s/g, ""), date: b.date, from, to, carrier, scheduledDepartureLocal: dep, scheduledArrivalLocal: arr }
  };
}

const nullableString = { type: ["string", "null"] };
const endpointSchema = {
  type: "object",
  additionalProperties: false,
  required: ["airport", "terminal", "gate", "scheduledLocal", "estimatedLocal"],
  properties: {
    airport: nullableString,
    terminal: nullableString,
    gate: nullableString,
    scheduledLocal: { type: ["string", "null"], description: "Local wall-clock time yyyy-MM-ddTHH:mm at that airport" },
    estimatedLocal: { type: ["string", "null"], description: "Latest estimated/actual local time yyyy-MM-ddTHH:mm" }
  }
};

/** Strict JSON schema for the model's answer. Exported for tests. */
export const FLIGHT_STATUS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["status", "statusText", "departure", "arrival", "summary", "confidence", "sources"],
  properties: {
    status: { type: "string", enum: STATUSES },
    statusText: { type: "string" },
    departure: endpointSchema,
    arrival: {
      ...endpointSchema,
      required: [...endpointSchema.required, "baggage"],
      properties: { ...endpointSchema.properties, baggage: nullableString }
    },
    summary: { type: "string", description: "One or two short sentences a traveler can act on." },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    sources: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "url"],
        properties: { title: { type: "string" }, url: { type: "string" } }
      }
    }
  }
};

export function flightStatusPrompt(req: FlightStatusRequest): string {
  const parts = [
    `Flight ${req.flight}${req.carrier ? ` (${req.carrier})` : ""} departing on ${req.date}`,
    req.from || req.to ? `route ${req.from ?? "?"} → ${req.to ?? "?"}` : null,
    req.scheduledDepartureLocal ? `scheduled departure ${req.scheduledDepartureLocal} local` : null,
    req.scheduledArrivalLocal ? `scheduled arrival ${req.scheduledArrivalLocal} local` : null
  ].filter(Boolean);
  return [
    `Find the live status of: ${parts.join(", ")}.`,
    "Search current sources (the departure airport's official departures board, the airline's flight status page, and flight trackers such as FlightAware or FlightStats).",
    "Report the departure terminal and gate and the arrival terminal/gate/baggage belt only if a current source states them for this exact flight and date. Otherwise use null — never guess or reuse a gate from another date.",
    "Use status 'unknown' if you cannot confirm it. Times are local wall-clock at each airport in yyyy-MM-ddTHH:mm.",
    "Confidence: high only if an official airport/airline source for this date confirms it; low if sources conflict or are stale.",
    "List the pages you used in sources."
  ].join("\n");
}

/** POST /v1/responses body. Exported for tests. */
export function buildFlightStatusBody(req: FlightStatusRequest): Record<string, unknown> {
  return {
    model: COACH_MODEL,
    reasoning: { effort: "low" },
    tools: [{ type: "web_search" }],
    tool_choice: "auto",
    max_output_tokens: 2000,
    input: [
      {
        role: "system",
        content: "You are a precise flight-status researcher for a traveler's app. You only report facts found in current sources."
      },
      { role: "user", content: flightStatusPrompt(req) }
    ],
    text: { format: { type: "json_schema", name: "flight_status", strict: true, schema: FLIGHT_STATUS_SCHEMA } }
  };
}

type ResponsesOutput = {
  output_text?: unknown;
  output?: { type?: string; content?: { type?: string; text?: unknown; annotations?: { type?: string; url?: unknown; title?: unknown }[] }[] }[];
};

/** Extract the JSON answer + url citations from a Responses API payload. Exported for tests. */
export function parseFlightStatusResponse(payload: unknown, req: FlightStatusRequest, now = new Date()): FlightStatusResponse {
  const p = (payload ?? {}) as ResponsesOutput;
  let text = typeof p.output_text === "string" ? p.output_text : "";
  const cited: { title: string; url: string }[] = [];
  for (const item of p.output ?? []) {
    if (item.type !== "message") continue;
    for (const c of item.content ?? []) {
      if (c.type === "output_text" && typeof c.text === "string") text = text || c.text;
      for (const a of c.annotations ?? []) {
        if (a.type === "url_citation" && typeof a.url === "string") {
          cited.push({ title: typeof a.title === "string" ? a.title : a.url, url: a.url });
        }
      }
    }
  }
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("Flight status response was not valid JSON.");
  }
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const endpoint = (v: unknown, fallbackAirport?: string): FlightEndpoint => {
    const e = (v ?? {}) as Record<string, unknown>;
    return {
      airport: str(e.airport) ?? fallbackAirport ?? null,
      terminal: str(e.terminal),
      gate: str(e.gate),
      scheduledLocal: str(e.scheduledLocal),
      estimatedLocal: str(e.estimatedLocal)
    };
  };
  const arrivalRaw = (data.arrival ?? {}) as Record<string, unknown>;
  const sources = [
    ...(Array.isArray(data.sources) ? (data.sources as { title?: unknown; url?: unknown }[]) : [])
      .filter((s) => typeof s?.url === "string" && /^https?:\/\//.test(s.url as string))
      .map((s) => ({ title: typeof s.title === "string" ? s.title : (s.url as string), url: s.url as string })),
    ...cited
  ];
  const seen = new Set<string>();
  const status = typeof data.status === "string" && STATUSES.includes(data.status) ? data.status : "unknown";
  const confidence = data.confidence === "high" || data.confidence === "medium" ? data.confidence : "low";
  return {
    flight: req.flight,
    date: req.date,
    status,
    statusText: str(data.statusText) ?? (status === "unknown" ? "Status not confirmed yet" : status),
    departure: endpoint(data.departure, req.from),
    arrival: { ...endpoint(data.arrival, req.to), baggage: str(arrivalRaw.baggage) },
    summary: str(data.summary) ?? "",
    confidence,
    sources: sources.filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true))).slice(0, 6),
    checkedAt: now.toISOString()
  };
}

export type LookupFlightStatus = (req: FlightStatusRequest) => Promise<FlightStatusResponse>;

let testLookup: LookupFlightStatus | undefined;

export function setFlightStatusLookupForTests(fn: LookupFlightStatus | undefined) {
  testLookup = fn;
}

export async function lookupFlightStatus(req: FlightStatusRequest): Promise<FlightStatusResponse> {
  if (testLookup) return testLookup(req);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AINotConfiguredError();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 50_000);
  try {
    const response = await openAIFetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildFlightStatusBody(req)),
      signal: controller.signal
    });
    if (!response.ok) throw await buildOpenAIError(response, "Flight status lookup");
    return parseFlightStatusResponse(await response.json(), req);
  } finally {
    clearTimeout(timer);
  }
}
