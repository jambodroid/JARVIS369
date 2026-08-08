import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { getCredentials, getRpConfig } from "@/lib/webauthn";

const CHALLENGE_COOKIE = "passkey_auth_challenge";

// Public -- this IS the login path, so it must work with no session yet.
// Added to middleware.ts's PUBLIC_PATHS.
export async function POST() {
  const { rpID } = getRpConfig();
  const credentials = await getCredentials();

  if (credentials.length === 0) {
    return NextResponse.json({ error: "No passkey registered yet" }, { status: 404 });
  }

  const options = await generateAuthenticationOptions({
    rpID,
    // Explicit list rather than relying on discoverable/resident-key
    // support -- for a single passkey this makes Face ID prompt directly,
    // no separate credential-picker step.
    allowCredentials: credentials.map((c) => ({ id: c.id, transports: c.transports })),
    userVerification: "preferred",
  });

  const response = NextResponse.json(options);
  response.cookies.set(CHALLENGE_COOKIE, options.challenge, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 300,
  });
  return response;
}
