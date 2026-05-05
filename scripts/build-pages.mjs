import { spawnSync } from "node:child_process";
import { existsSync, renameSync } from "node:fs";
import { join } from "node:path";

const nextCliPath = join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const apiRoutesPath = join(process.cwd(), "src", "app", "api");
const disabledApiRoutesPath = join(process.cwd(), "src", "__pages_api_routes__");

if (existsSync(disabledApiRoutesPath)) {
  throw new Error(`${disabledApiRoutesPath} already exists. Restore or remove it before building Pages.`);
}

if (existsSync(apiRoutesPath)) {
  renameSync(apiRoutesPath, disabledApiRoutesPath);
}

try {
  const result = spawnSync(process.execPath, [nextCliPath, "build"], {
    env: {
      ...process.env,
      GITHUB_PAGES: "true",
      GITHUB_PAGES_REPO: process.env.GITHUB_PAGES_REPO ?? "lifeappdemo",
      NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH ?? "/lifeappdemo"
    },
    stdio: "inherit"
  });

  if (result.error) {
    throw result.error;
  }

  process.exitCode = result.status ?? 1;
} finally {
  if (existsSync(disabledApiRoutesPath)) {
    renameSync(disabledApiRoutesPath, apiRoutesPath);
  }
}
