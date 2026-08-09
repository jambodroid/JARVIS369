import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { refreshTrueLayerBalance } from "@/lib/truelayer";
import { applyDueRecurringPayments } from "@/lib/recurringPayments";
import { localDateKey } from "@/lib/tasks";

type AccountRow = {
  id: string;
  name: string;
  kind: "asset" | "liability";
  source: "manual" | "truelayer";
  external_account_id: string | null;
  balance: number;
};

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseClient();

  try {
    await applyDueRecurringPayments();
  } catch (err) {
    console.error("Failed to apply due recurring payments", err);
  }

  const { data, error } = await supabase.from("net_worth_accounts").select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const accounts = (data ?? []) as AccountRow[];

  for (const account of accounts) {
    if (account.source === "truelayer" && account.external_account_id) {
      try {
        const balance = await refreshTrueLayerBalance(account.external_account_id, account.kind);
        await supabase
          .from("net_worth_accounts")
          .update({ balance, updated_at: new Date().toISOString() })
          .eq("id", account.id);
        account.balance = balance;
      } catch (err) {
        console.error(`Failed to refresh balance for ${account.name}`, err);
      }
    }
  }

  const total = accounts.reduce(
    (sum, a) => sum + (a.kind === "asset" ? Number(a.balance) : -Number(a.balance)),
    0,
  );
  const breakdown = Object.fromEntries(accounts.map((a) => [a.name, Number(a.balance)]));

  const { error: snapshotError } = await supabase
    .from("net_worth_snapshots")
    .upsert({ snapshot_date: localDateKey(new Date()), total, breakdown }, { onConflict: "snapshot_date" });

  if (snapshotError) return NextResponse.json({ error: snapshotError.message }, { status: 500 });

  return NextResponse.json({ ok: true, total });
}
