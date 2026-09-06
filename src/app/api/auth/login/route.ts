import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { redirectUri } from "@/lib/config";
import { authUrl } from "@/lib/linkedin";
import { STATE_COOKIE, baseCookie } from "@/lib/session";

export const runtime = "nodejs";

export function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const state = crypto.randomUUID();
  const res = NextResponse.redirect(authUrl(state, redirectUri(origin)));
  res.cookies.set(STATE_COOKIE, state, { ...baseCookie, maxAge: 600 });
  return res;
}
