import { NextRequest, NextResponse } from "next/server";
import { verifyAuthenticationResponse, type AuthenticationResponseJSON } from "@simplewebauthn/server";
import { getCredentialById, getRpConfig, updateCredentialCounter } from "@/lib/webauthn";
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/auth";

const CHALLENGE_COOKIE = "passkey_auth_challenge";

// Public -- this IS the login path. Added to middleware.ts's PUBLIC_PATHS.
// On success it issues the exact same session cookie password login does,
// so nothing downstream (middleware, every other route) needs to know or
// care which method was used to get it.
export async function POST(request: NextRequest) {
  const { rpID, origin } = getRpConfig();
  const expectedChallenge = request.cookies.get(CHALLENGE_COOKIE)?.value;
  if (!expectedChallenge) {
    return NextResponse.json({ error: "No pending login challenge" }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as AuthenticationResponseJSON | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const stored = await getCredentialById(body.id);
  if (!stored) {
    return NextResponse.json({ error: "Unknown passkey" }, { status: 400 });
  }

  const verification = await verifyAuthenticationResponse({
    response: body,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      id: stored.id,
      publicKey: stored.publicKey,
      counter: stored.counter,
      transports: stored.transports,
    },
  });

  if (!verification.verified) {
    return NextResponse.json({ error: "Verification failed" }, { status: 400 });
  }

  await updateCredentialCounter(stored.id, verification.authenticationInfo.newCounter);

  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const token = await createSessionToken(secret);
  const response = NextResponse.json({ verified: true });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  response.cookies.delete(CHALLENGE_COOKIE);
  return response;
}
