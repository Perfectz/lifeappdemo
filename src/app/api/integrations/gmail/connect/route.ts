import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/requireUser";
import {
  buildGmailAuthorizationUrl,
  createGmailOAuthState,
  missingGmailConfiguration
} from "@/server/integrations/gmail";

export const runtime = "nodejs";

function appOrigin(request: Request): string {
  return process.env.APP_URL?.trim().replace(/\/+$/, "") || new URL(request.url).origin;
}

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const missing = missingGmailConfiguration();
  if (missing.length > 0) {
    return NextResponse.json(
      { error: "Gmail needs deployment configuration before it can connect.", missing },
      { status: 503 }
    );
  }
  const nonce = randomBytes(24).toString("base64url");
  const state = createGmailOAuthState(auth.user.id, nonce);
  const redirectUri = `${appOrigin(request)}/api/integrations/gmail/callback`;
  const response = NextResponse.json({ authorizationUrl: buildGmailAuthorizationUrl(redirectUri, state) });
  response.cookies.set("lq_gmail_oauth", nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/integrations/gmail/callback",
    maxAge: 600
  });
  return response;
}
