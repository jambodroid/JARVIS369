import { getSupabaseClient, withTransientRetry } from "@/lib/supabase";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";

export type StoredCredential = {
  id: string;
  publicKey: Uint8Array<ArrayBuffer>;
  counter: number;
  deviceType: "singleDevice" | "multiDevice";
  backedUp: boolean;
  transports?: AuthenticatorTransportFuture[];
};

type CredentialRow = {
  id: string;
  public_key: string;
  counter: number;
  device_type: string;
  backed_up: boolean;
  transports: string[] | null;
};

function rowToCredential(row: CredentialRow): StoredCredential {
  return {
    id: row.id,
    publicKey: new Uint8Array(Buffer.from(row.public_key, "base64")) as Uint8Array<ArrayBuffer>,
    counter: Number(row.counter),
    deviceType: row.device_type as StoredCredential["deviceType"],
    backedUp: row.backed_up,
    transports: (row.transports ?? undefined) as AuthenticatorTransportFuture[] | undefined,
  };
}

export async function getCredentials(): Promise<StoredCredential[]> {
  return withTransientRetry(async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from("webauthn_credentials").select("*");
    if (error) throw new Error(error.message);
    return ((data ?? []) as CredentialRow[]).map(rowToCredential);
  });
}

export async function getCredentialById(id: string): Promise<StoredCredential | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("webauthn_credentials").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToCredential(data as CredentialRow) : null;
}

export async function saveCredential(cred: StoredCredential): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("webauthn_credentials").insert({
    id: cred.id,
    public_key: Buffer.from(cred.publicKey).toString("base64"),
    counter: cred.counter,
    device_type: cred.deviceType,
    backed_up: cred.backedUp,
    transports: cred.transports ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function updateCredentialCounter(id: string, counter: number): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("webauthn_credentials").update({ counter }).eq("id", id);
  if (error) throw new Error(error.message);
}

// rpID must exactly match the domain the page is actually loaded from --
// the stable Vercel alias in production, "localhost" for local dev.
export function getRpConfig(): { rpID: string; rpName: string; origin: string } {
  const rpID = process.env.WEBAUTHN_RP_ID || "localhost";
  const origin = rpID === "localhost" ? "http://localhost:3000" : `https://${rpID}`;
  return { rpID, rpName: "Personal OS", origin };
}
