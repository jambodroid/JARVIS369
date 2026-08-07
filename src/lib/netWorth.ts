import { getSupabaseClient, withTransientRetry } from "@/lib/supabase";

export type AccountKind = "asset" | "liability";
export type AccountSource = "manual" | "truelayer";

export type NetWorthAccount = {
  id: string;
  name: string;
  kind: AccountKind;
  source: AccountSource;
  external_account_id: string | null;
  balance: number;
  currency: string;
  updated_at: string;
};

export type NetWorthSnapshot = {
  snapshot_date: string;
  total: number;
  breakdown: Record<string, number> | null;
};

export async function getNetWorthAccounts(): Promise<NetWorthAccount[]> {
  return withTransientRetry(async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from("net_worth_accounts").select("*").order("kind");
    if (error) throw new Error(error.message);
    return (data ?? []) as NetWorthAccount[];
  });
}

export async function getNetWorthSnapshots(days = 366): Promise<NetWorthSnapshot[]> {
  return withTransientRetry(async () => {
    const supabase = getSupabaseClient();
    // Order descending to grab the most recent `days` rows, then reverse to
    // ascending for charting -- otherwise .limit() would keep the oldest rows.
    const { data, error } = await supabase
      .from("net_worth_snapshots")
      .select("snapshot_date, total, breakdown")
      .order("snapshot_date", { ascending: false })
      .limit(days);
    if (error) throw new Error(error.message);
    return ((data ?? []) as NetWorthSnapshot[]).reverse();
  });
}

export function computeTotal(accounts: NetWorthAccount[]): number {
  return accounts.reduce((sum, a) => sum + (a.kind === "asset" ? a.balance : -a.balance), 0);
}

export async function updateAccountBalance(nameOrId: string, balance: number): Promise<NetWorthAccount> {
  return withTransientRetry(async () => {
    const supabase = getSupabaseClient();
    const byId = nameOrId.includes("-") && nameOrId.length === 36; // crude uuid check
    const query = supabase
      .from("net_worth_accounts")
      .update({ balance, updated_at: new Date().toISOString() });

    const { data, error } = await (byId ? query.eq("id", nameOrId) : query.eq("name", nameOrId))
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as NetWorthAccount;
  });
}

export async function getAccountByName(name: string): Promise<NetWorthAccount | null> {
  return withTransientRetry(async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from("net_worth_accounts").select("*").eq("name", name).maybeSingle();
    if (error) throw new Error(error.message);
    return data as NetWorthAccount | null;
  });
}
