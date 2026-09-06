import { NextResponse } from "next/server";
import { SESSION_COOKIE, baseCookie } from "@/lib/session";

export const runtime = "nodejs";

export function GET(req: Request) {
  const res = NextResponse.redirect(new URL("/", new URL(req.url).origin));
  res.cookies.set(SESSION_COOKIE, "", { ...baseCookie, maxAge: 0 });
  return res;
}
