import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { getCredentials, getRpConfig } from "@/lib/webauthn";

const CHALLENGE_COOKIE = "passkey_challenge";

// Gated by middleware.ts -- this path isn't in PUBLIC_PATHS, so only a
// request carrying a valid session cookie ever reaches here. That's the
// whole point: only someone already logged in can register a new passkey.
export async function POST() {
  const { rpID, rpName } = getRpConfig();
  const existing = await getCredentials();

  const options = await generateRegistrationOptions({
    rpID,
    rpName,
    userName: "personal-os",
    attestationType: "none",
    excludeCredentials: existing.map((c) => ({ id: c.id, transports: c.transports })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
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
