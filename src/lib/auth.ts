/**
 * Minimal shared-password auth. A correct password mints an HMAC-signed cookie;
 * the proxy verifies that signature on every protected request. No user
 * accounts, matching the "one shared team password" requirement.
 */

export const SESSION_COOKIE = "ll_session";
const MAX_AGE_DAYS = 30;

function secret(): string {
  return process.env.AUTH_SECRET || "dev-insecure-secret-change-me";
}

const encoder = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return b64url(new Uint8Array(sig));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Creates a signed session token (payload is the issue time in ms). */
export async function createSessionToken(): Promise<string> {
  const payload = String(Date.now());
  const sig = await hmac(payload);
  return `${payload}.${sig}`;
}

/** Verifies a session token's signature and age. */
export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;

  const expected = await hmac(payload);
  if (!timingSafeEqual(sig, expected)) return false;

  const issued = Number(payload);
  if (!Number.isFinite(issued)) return false;
  const ageMs = Date.now() - issued;
  return ageMs >= 0 && ageMs < MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}

/** Checks a submitted password against the configured one (constant-time). */
export function checkPassword(input: string): boolean {
  const expected = process.env.APP_PASSWORD || "";
  if (!expected) return false;
  return timingSafeEqual(input, expected);
}

export const COOKIE_MAX_AGE = MAX_AGE_DAYS * 24 * 60 * 60;
