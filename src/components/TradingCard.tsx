"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { NetWorthAccount, NetWorthSnapshot } from "@/lib/netWorth";
import Card from "@/components/Card";

function formatMoney(n: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

export default function TradingCard({
  account,
  snapshots,
}: {
  account: NetWorthAccount | null;
  snapshots: NetWorthSnapshot[];
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!account) return null;

  const priorSnapshot = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null;
  const priorBalance = priorSnapshot?.breakdown?.[account.name];
  const pnl = typeof priorBalance === "number" ? account.balance - priorBalance : null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const balance = Number(value);
    if (!Number.isFinite(balance)) return;

    setSubmitting(true);
    await fetch(`/api/networth/accounts/${account?.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ balance }),
    });
    setSubmitting(false);
    setValue("");
    router.refresh();
  }

  return (
    <Card title="Trading">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-2xl font-semibold text-ink-0">
          {formatMoney(account.balance, account.currency)}
        </span>
        {pnl !== null && (
          <span className={`font-mono text-sm ${pnl >= 0 ? "text-ok" : "text-danger"}`}>
            {pnl >= 0 ? "+" : ""}
            {formatMoney(pnl, account.currency)}
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        <input
          type="number"
          step="0.01"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Update balance"
          className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-ink-0 placeholder-ink-3 outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={submitting || !value}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          Update
        </button>
      </form>
    </Card>
  );
}
