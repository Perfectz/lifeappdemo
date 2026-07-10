import { NextResponse } from "next/server";

import {
  exchangeGmailAuthorizationCode,
  saveGmailConnection,
  verifyGmailOAuthState
} from "@/server/integrations/gmail";

export const runtime = "nodejs";

function appOrigin(request: Request): string {
  return process.env.APP_URL?.replace(/\/$/, "") || new URL(request.url).origin;
}

function cookieValue(request: Request, name: string): string {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) ?? "";
}

function settingsRedirect(request: Request, outcome: "connected" | "error"): NextResponse {
  const response = NextResponse.redirect(`${appOrigin(request)}/settings?gmail=${outcome}`);
  response.cookies.set("lq_gmail_oauth", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/integrations/gmail/callback",
    maxAge: 0
  });
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const nonce = cookieValue(request, "lq_gmail_oauth");
  if (url.searchParams.has("error") || !code || !state || !nonce) return settingsRedirect(request, "error");
  try {
    const verified = verifyGmailOAuthState(state, nonce);
    if (!verified) return settingsRedirect(request, "error");
    const redirectUri = `${appOrigin(request)}/api/integrations/gmail/callback`;
    const tokens = await exchangeGmailAuthorizationCode(code, redirectUri);
    await saveGmailConnection({ userId: verified.userId, ...tokens });
    return settingsRedirect(request, "connected");
  } catch {
    return settingsRedirect(request, "error");
  }
}
