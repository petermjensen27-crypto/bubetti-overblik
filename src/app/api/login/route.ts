import { NextResponse } from "next/server";
import {
  checkPassword,
  COOKIE_MAX_AGE,
  createSessionToken,
  SESSION_COOKIE,
} from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { password?: string };
  if (!checkPassword(String(body.password ?? ""))) {
    return NextResponse.json({ error: "Forkert adgangskode" }, { status: 401 });
  }

  const token = await createSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return res;
}
