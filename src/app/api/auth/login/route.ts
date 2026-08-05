import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  timingSafeEqual,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  const secret = process.env.AUTH_SECRET;
  const expectedPassword = process.env.DASHBOARD_PASSWORD;
  if (!secret || !expectedPassword) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as { password?: string } | null;
  const password = body?.password ?? "";

  if (!timingSafeEqual(password, expectedPassword)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const token = await createSessionToken(secret);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
