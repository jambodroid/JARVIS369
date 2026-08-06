import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/google";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const home = new URL("/", request.nextUrl.origin);

  if (!code) {
    home.searchParams.set("google_error", "missing_code");
    return NextResponse.redirect(home);
  }

  const redirectUri = new URL("/api/google/callback", request.nextUrl.origin).toString();

  try {
    await exchangeCodeForTokens(code, redirectUri);
  } catch (error) {
    console.error("Google OAuth callback failed", error);
    home.searchParams.set("google_error", "exchange_failed");
    return NextResponse.redirect(home);
  }

  return NextResponse.redirect(home);
}
