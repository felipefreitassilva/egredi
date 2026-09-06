export const IS_PROD = process.env.NODE_ENV === "production";

export const clientId = () => required("LINKEDIN_CLIENT_ID");
export const clientSecret = () => required("LINKEDIN_CLIENT_SECRET");
export const sessionSecret = () => required("SESSION_SECRET");

export function redirectUri(origin: string) {
  return process.env.LINKEDIN_REDIRECT_URI ?? `${origin}/api/auth/callback`;
}

function required(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`env ausente: ${name}`);
  return v;
}
