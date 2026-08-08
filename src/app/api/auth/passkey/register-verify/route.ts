import { NextRequest, NextResponse } from "next/server";
import { verifyRegistrationResponse, type RegistrationResponseJSON } from "@simplewebauthn/server";
import { getRpConfig, saveCredential } from "@/lib/webauthn";

const CHALLENGE_COOKIE = "passkey_challenge";

// Gated by middleware.ts, same as register-options -- requires an
// existing valid session.
export async function POST(request: NextRequest) {
  const { rpID, origin } = getRpConfig();
  const expectedChallenge = request.cookies.get(CHALLENGE_COOKIE)?.value;
  if (!expectedChallenge) {
    return NextResponse.json({ error: "No pending registration challenge" }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as RegistrationResponseJSON | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const verification = await verifyRegistrationResponse({
    response: body,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
  });

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: "Verification failed" }, { status: 400 });
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  await saveCredential({
    id: credential.id,
    publicKey: credential.publicKey,
    counter: credential.counter,
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp,
    transports: credential.transports,
  });

  const response = NextResponse.json({ verified: true });
  response.cookies.delete(CHALLENGE_COOKIE);
  return response;
}
