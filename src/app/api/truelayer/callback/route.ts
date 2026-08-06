import { NextRequest, NextResponse } from "next/server";
import { completeAuthFlow } from "@/lib/truelayer";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const oauthError = request.nextUrl.searchParams.get("error");
  const home = new URL("/", request.nextUrl.origin);

  if (oauthError) {
    console.error("TrueLayer callback returned an error:", oauthError);
    home.searchParams.set("truelayer_error", oauthError);
    return NextResponse.redirect(home);
  }
  if (!code) {
    home.searchParams.set("truelayer_error", "missing_code");
    return NextResponse.redirect(home);
  }

  const redirectUri = new URL("/api/truelayer/callback", request.nextUrl.origin).toString();
  try {
    await completeAuthFlow(code, redirectUri);
  } catch (error) {
    console.error("TrueLayer callback failed", error);
    home.searchParams.set("truelayer_error", "link_failed");
    return NextResponse.redirect(home);
  }

  return NextResponse.redirect(home);
}
