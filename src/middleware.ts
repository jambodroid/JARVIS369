import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

const PUBLIC_PATHS = new Set([
  "/login",
  "/api/auth/login",
  "/api/auth/passkey/auth-options",
  "/api/auth/passkey/auth-verify",
]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Cron routes and the Health Auto Export webhook carry no session cookie
  // (they're invoked directly by an external caller) -- they authenticate
  // themselves via their own secret instead.
  if (
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith("/api/cron/") ||
    pathname === "/api/health/webhook"
  ) {
    return NextResponse.next();
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return new NextResponse("Server misconfigured: AUTH_SECRET is not set", { status: 500 });
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const valid = await verifySessionToken(token, secret);

  if (!valid) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
