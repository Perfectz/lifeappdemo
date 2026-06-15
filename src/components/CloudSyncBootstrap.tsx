"use client";

import { useEffect } from "react";

import { startCloudSync } from "@/client/cloudSync";

/**
 * Mounts once in the app shell to start automatic cloud sync for the
 * session. No-ops when Supabase isn't configured. Renders nothing.
 */
export function CloudSyncBootstrap() {
  useEffect(() => startCloudSync(), []);
  return null;
}
