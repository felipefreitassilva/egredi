import { clientId, clientSecret } from "./config";

const AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const USERINFO_URL = "https://api.linkedin.com/v2/userinfo";
const SCOPE = "openid profile email";

export function authUrl(state: string, redirectUri: string) {
  const url = new URL(AUTH_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId());
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("state", state);
  return url;
}

export async function exchangeCode(code: string, redirectUri: string) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId(),
      client_secret: clientSecret(),
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`token ${res.status}: ${text}`);
  return JSON.parse(text) as { access_token: string; expires_in: number };
}

export type LinkedInUser = {
  sub: string;
  name: string;
  email: string;
  email_verified?: boolean;
  picture?: string;
  locale?: string;
};

export async function fetchUserinfo(accessToken: string): Promise<LinkedInUser> {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`userinfo ${res.status}: ${text}`);
  return JSON.parse(text) as LinkedInUser;
}
