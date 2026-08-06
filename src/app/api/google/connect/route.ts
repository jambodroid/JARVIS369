import { NextRequest, NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/google";

export async function GET(request: NextRequest) {
  const redirectUri = new URL("/api/google/callback", request.nextUrl.origin).toString();
  return NextResponse.redirect(getAuthUrl(redirectUri));
}
