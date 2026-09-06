import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { redirectUri } from "@/lib/config";
import { upsertLogin } from "@/lib/db";
import { exchangeCode, fetchUserinfo } from "@/lib/linkedin";
import {
  SESSION_COOKIE,
  STATE_COOKIE,
  baseCookie,
  signSession,
} from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const fail = (msg: string) =>
    NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(msg)}`, url.origin),
    );

  const err = url.searchParams.get("error");
  if (err) return fail(`${err}: ${url.searchParams.get("error_description") ?? ""}`);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = (await cookies()).get(STATE_COOKIE)?.value;

  if (!code) return fail("código ausente");
  if (!state || state !== cookieState) return fail("state inválido");

  try {
    const { access_token } = await exchangeCode(code, redirectUri(url.origin));
    const u = await fetchUserinfo(access_token);
    const token = signSession({
      sub: u.sub,
      name: u.name,
      email: u.email,
      picture: u.picture,
      iat: Date.now(),
    });
    try {
      await upsertLogin({
        sub: u.sub,
        name: u.name,
        email: u.email,
        picture: u.picture,
      });
    } catch (e) {
      console.error("upsertLogin", e);
    }
    const res = NextResponse.redirect(new URL("/", url.origin));
    res.cookies.set(SESSION_COOKIE, token, { ...baseCookie, maxAge: 3600 });
    res.cookies.set(STATE_COOKIE, "", { ...baseCookie, maxAge: 0 });
    return res;
  } catch (e) {
    return fail(e instanceof Error ? e.message : "falha na autenticação");
  }
}
