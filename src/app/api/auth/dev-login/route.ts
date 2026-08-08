import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  timingSafeEqual,
} from "@/lib/auth";

// Local-dev-only session mint for automated testing. Hard-refuses outright
// in production regardless of the secret -- this can never function on the
// deployed app, even if this route or DEV_AUTH_BYPASS_SECRET were somehow
// present there. Never touches the real DASHBOARD_PASSWORD.
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  const expected = process.env.DEV_AUTH_BYPASS_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "DEV_AUTH_BYPASS_SECRET is not set" }, { status: 500 });
  }

  const provided = request.headers.get("X-Dev-Bypass-Secret") ?? "";
  if (!timingSafeEqual(provided, expected)) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const token = await createSessionToken(secret);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
