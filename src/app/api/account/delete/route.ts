import { NextResponse } from "next/server";
import { deleteProfile } from "@/lib/db";
import { SESSION_COOKIE, baseCookie, getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getSession();
  if (session) {
    try {
      await deleteProfile(session.sub);
    } catch (e) {
      console.error("deleteProfile", e);
    }
  }
  const res = NextResponse.redirect(new URL("/", new URL(req.url).origin), 303);
  res.cookies.set(SESSION_COOKIE, "", { ...baseCookie, maxAge: 0 });
  return res;
}
