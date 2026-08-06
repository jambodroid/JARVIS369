import { NextRequest, NextResponse } from "next/server";
import { buildAuthLink } from "@/lib/truelayer";

export async function GET(request: NextRequest) {
  const redirectUri = new URL("/api/truelayer/callback", request.nextUrl.origin).toString();

  try {
    const link = buildAuthLink(redirectUri, crypto.randomUUID());
    return NextResponse.redirect(link);
  } catch (error) {
    console.error("TrueLayer connect failed", error);
    const home = new URL("/", request.nextUrl.origin);
    home.searchParams.set("truelayer_error", "connect_failed");
    return NextResponse.redirect(home);
  }
}
