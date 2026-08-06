import { getSupabaseClient } from "@/lib/supabase";

const IS_SANDBOX = process.env.TRUELAYER_ENV !== "production";
const AUTH_BASE = IS_SANDBOX ? "https://auth.truelayer-sandbox.com" : "https://auth.truelayer.com";
const API_BASE = IS_SANDBOX ? "https://api.truelayer-sandbox.com" : "https://api.truelayer.com";
// uk-cs-mock is TrueLayer's mock bank for sandbox testing; uk-ob-all/uk-oauth-all cover real UK banks in production.
const PROVIDERS = IS_SANDBOX ? "uk-cs-mock" : "uk-ob-all uk-oauth-all";
const SCOPE = "info accounts cards balance offline_access";

export class TrueLayerNotConnectedError extends Error {
  constructor() {
    super("HSBC is not connected yet");
    this.name = "TrueLayerNotConnectedError";
  }
}

function getSecrets() {
  const clientId = process.env.TRUELAYER_CLIENT_ID;
  const clientSecret = process.env.TRUELAYER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing TRUELAYER_CLIENT_ID or TRUELAYER_CLIENT_SECRET");
  }
  return { clientId, clientSecret };
}

export function buildAuthLink(redirectUri: string, state: string): string {
  const { clientId } = getSecrets();
  const url = new URL(AUTH_BASE);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("providers", PROVIDERS);
  url.searchParams.set("state", state);
  return url.toString();
}

async function tlFetch(path: string, accessToken: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`TrueLayer ${path} failed: ${await res.text()}`);
  }
  return res.json();
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
};

async function requestTokens(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${AUTH_BASE}/connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  if (!res.ok) {
    throw new Error(`TrueLayer token request failed: ${await res.text()}`);
  }
  return res.json();
}

async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = getSecrets();
  return requestTokens({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });
}

async function refreshTokens(refreshToken: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = getSecrets();
  return requestTokens({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });
}

type AuthRow = {
  access_token: string;
  refresh_token: string | null;
  access_token_expires_at: string | null;
};

async function getStoredAuth(): Promise<AuthRow | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("truelayer_app_auth")
    .select("access_token, refresh_token, access_token_expires_at")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as AuthRow | null;
}

async function storeAuth(tokens: TokenResponse) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("truelayer_app_auth").upsert({
    id: 1,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    access_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

async function getValidAccessToken(): Promise<string> {
  const stored = await getStoredAuth();
  if (!stored) throw new TrueLayerNotConnectedError();

  const expiresAt = stored.access_token_expires_at ? new Date(stored.access_token_expires_at).getTime() : 0;
  if (stored.access_token && expiresAt > Date.now() + 60_000) {
    return stored.access_token;
  }

  if (!stored.refresh_token) throw new TrueLayerNotConnectedError();
  const tokens = await refreshTokens(stored.refresh_token);
  await storeAuth({ ...tokens, refresh_token: tokens.refresh_token ?? stored.refresh_token });
  return tokens.access_token;
}

export async function isTrueLayerConnected(): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("net_worth_accounts")
    .select("id")
    .eq("source", "truelayer")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data !== null;
}

type TrueLayerAccount = { account_id: string; display_name: string; currency: string };
type TrueLayerBalance = { results: Array<{ available?: number; current: number; currency: string }> };

async function linkHsbcAccounts(accessToken: string): Promise<void> {
  const supabase = getSupabaseClient();

  const accountsResp = (await tlFetch("/data/v1/accounts", accessToken)) as { results: TrueLayerAccount[] };
  for (const account of accountsResp.results) {
    const balance = (await tlFetch(
      `/data/v1/accounts/${account.account_id}/balance`,
      accessToken,
    )) as TrueLayerBalance;
    const current = balance.results[0]?.current ?? 0;
    const { error } = await supabase.from("net_worth_accounts").upsert(
      {
        name: "HSBC Current Account",
        kind: "asset",
        source: "truelayer",
        external_account_id: account.account_id,
        balance: current,
        currency: balance.results[0]?.currency ?? account.currency ?? "GBP",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "name" },
    );
    if (error) throw new Error(error.message);
  }

  const cardsResp = (await tlFetch("/data/v1/cards", accessToken)) as { results: TrueLayerAccount[] };
  for (const card of cardsResp.results) {
    const balance = (await tlFetch(`/data/v1/cards/${card.account_id}/balance`, accessToken)) as TrueLayerBalance;
    // Cards: a positive `current` is money owed to the provider -- that's our liability amount directly.
    const current = balance.results[0]?.current ?? 0;
    const { error } = await supabase.from("net_worth_accounts").upsert(
      {
        name: "HSBC Credit Card",
        kind: "liability",
        source: "truelayer",
        external_account_id: card.account_id,
        balance: Math.abs(current),
        currency: balance.results[0]?.currency ?? card.currency ?? "GBP",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "name" },
    );
    if (error) throw new Error(error.message);
  }
}

export async function completeAuthFlow(code: string, redirectUri: string): Promise<void> {
  const tokens = await exchangeCodeForTokens(code, redirectUri);
  await storeAuth(tokens);
  await linkHsbcAccounts(tokens.access_token);
}

export async function refreshTrueLayerBalance(
  externalAccountId: string,
  kind: "asset" | "liability",
): Promise<number> {
  const accessToken = await getValidAccessToken();
  const path =
    kind === "liability"
      ? `/data/v1/cards/${externalAccountId}/balance`
      : `/data/v1/accounts/${externalAccountId}/balance`;
  const balance = (await tlFetch(path, accessToken)) as TrueLayerBalance;
  const current = balance.results[0]?.current ?? 0;
  return kind === "liability" ? Math.abs(current) : current;
}
