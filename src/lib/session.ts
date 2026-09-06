import crypto from "node:crypto";
import { cookies } from "next/headers";
import { IS_PROD, sessionSecret } from "./config";
import type { Session } from "./types";

export const SESSION_COOKIE = "li_session";
export const STATE_COOKIE = "li_oauth_state";

export const baseCookie = {
  httpOnly: true as const,
  sameSite: "lax" as const,
  path: "/",
  secure: IS_PROD,
};

export function signSession(payload: Session): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${hmac(body)}`;
}

export function verifySession(token: string | undefined | null): Session | null {
  if (!token || !token.includes(".")) return null;
  const [body, mac] = token.split(".");
  const expected = hmac(body);
  if (mac.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Session;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

function hmac(input: string) {
  return crypto
    .createHmac("sha256", sessionSecret())
    .update(input)
    .digest("base64url");
}
