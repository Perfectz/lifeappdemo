import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const scannedRoots = ["src", "public", ".env.example", "next.config.mjs"];
const ignoredDirectories = new Set([
  ".next",
  "node_modules",
  "playwright-report",
  "test-results"
]);

function collectTextFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = join(directory, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      return ignoredDirectories.has(entry) ? [] : collectTextFiles(fullPath);
    }

    return stats.isFile() ? [fullPath] : [];
  });
}

describe("secret hygiene baseline", () => {
  it("does not use a public OpenAI API key variable", () => {
    const publicKeyPattern = ["NEXT_PUBLIC", "OPENAI_API_KEY"].join("_");
    const files = scannedRoots.flatMap((entry) => {
      const fullPath = join(root, entry);
      const stats = statSync(fullPath);
      return stats.isDirectory() ? collectTextFiles(fullPath) : [fullPath];
    });

    const matches = files.filter((filePath) => {
      const contents = readFileSync(filePath, "utf8");
      return contents.includes(publicKeyPattern);
    });

    expect(matches.map((match) => relative(root, match))).toEqual([]);
  });

  it("documents server-side key usage only", () => {
    expect(existsSync(join(root, ".env.example"))).toBe(true);

    const envExample = readFileSync(join(root, ".env.example"), "utf8");
    expect(envExample).toContain("Server-side only");
    expect(envExample).toContain("OPENAI_API_KEY=");
  });

  it("keeps health AI guidance bounded away from diagnosis", () => {
    const openAiClient = readFileSync(
      join(root, "src", "server", "ai", "openaiClient.ts"),
      "utf8"
    );
    const healthImport = readFileSync(
      join(root, "src", "components", "HealthImport.tsx"),
      "utf8"
    );

    expect(openAiClient).toContain("without diagnosis or treatment advice");
    expect(openAiClient).toContain("healthcare professional");
    expect(healthImport).toContain("does not provide medical diagnosis or treatment advice");
  });

  it("does not send raw uploaded health import data to AI routes", () => {
    const healthImport = readFileSync(
      join(root, "src", "components", "HealthImport.tsx"),
      "utf8"
    );
    const healthImportDomain = readFileSync(
      join(root, "src", "domain", "healthImport.ts"),
      "utf8"
    );

    expect(healthImport).not.toContain("/api/ai/chat");
    expect(healthImport).not.toContain("/api/ai/tools/confirm");
    expect(healthImportDomain).not.toContain("fetch(");
  });

  it("keeps morning AI planning bounded to one main and three side quests", () => {
    const openAiClient = readFileSync(
      join(root, "src", "server", "ai", "openaiClient.ts"),
      "utf8"
    );

    expect(openAiClient).toContain("one Main Quest");
    expect(openAiClient).toContain("no more than three Side Quests");
    expect(openAiClient).toContain("realistic workload");
    expect(openAiClient).toContain("one or two focused planning questions");
  });

  it("keeps evening AI report behavior grounded in stored facts", () => {
    const openAiClient = readFileSync(
      join(root, "src", "server", "ai", "openaiClient.ts"),
      "utf8"
    );

    expect(openAiClient).toContain("focused reflection questions");
    expect(openAiClient).toContain("realistic tomorrow follow-ups");
    expect(openAiClient).toContain("only from stored facts");
    expect(openAiClient).toContain("Do not invent missing metrics");
  });

  it("keeps the service worker away from AI and sensitive API caches", () => {
    const serviceWorker = readFileSync(join(root, "public", "sw.js"), "utf8");

    expect(serviceWorker).toContain('url.pathname.startsWith("/api/")');
    expect(serviceWorker).toContain('url.pathname.startsWith("/_next/")');
    expect(serviceWorker).toContain('url.pathname.includes("ai")');
    expect(serviceWorker).toContain('url.pathname.includes("realtime")');
    expect(serviceWorker).toContain("shouldNeverCache");
    expect(serviceWorker).not.toContain('"/standup/morning"');
    expect(serviceWorker).not.toContain("caches.open(APP_SHELL_CACHE).then((cache) => cache.put(request");
    expect(serviceWorker).not.toContain("/api/ai/chat");
    expect(serviceWorker).not.toContain("/api/ai/tools/confirm");
    expect(serviceWorker).not.toContain("/api/realtime/session");
    expect(serviceWorker).not.toContain("OPENAI_API_KEY");
  });

  it("keeps realtime permanent keys on the server side", () => {
    const realtimeClient = readFileSync(
      join(root, "src", "server", "ai", "realtimeClient.ts"),
      "utf8"
    );
    const voicePanel = readFileSync(
      join(root, "src", "components", "VoiceSessionPanel.tsx"),
      "utf8"
    );

    expect(realtimeClient).toContain("process.env.OPENAI_API_KEY");
    expect(realtimeClient).toContain("/v1/realtime/client_secrets");
    expect(voicePanel).not.toContain("OPENAI_API_KEY");
    expect(voicePanel).not.toContain("localStorage");
  });

  it("does not place secrets in static offline assets", () => {
    const staticAssets = [
      readFileSync(join(root, "public", "sw.js"), "utf8"),
      readFileSync(join(root, "public", "offline.html"), "utf8")
    ].join("\n");

    expect(staticAssets).not.toContain("OPENAI_API_KEY");
    expect(staticAssets).not.toContain("clientSecret");
    expect(staticAssets).not.toContain("Authorization");
  });
});
