"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { NetWorthAccount, NetWorthSnapshot } from "@/lib/netWorth";
import Card from "@/components/Card";
import PeriodTrendChart from "@/components/PeriodTrendChart";

function formatMoney(n: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

function AccountRow({ account }: { account: NetWorthAccount }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(account.balance));
  const [submitting, setSubmitting] = useState(false);

  async function handleSave() {
    const balance = Number(value);
    if (!Number.isFinite(balance)) return;
    setSubmitting(true);
    await fetch(`/api/networth/accounts/${account.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ balance }),
    });
    setSubmitting(false);
    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-ink-1">{account.name}</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            step="0.01"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
            className="w-24 rounded-lg border border-border bg-surface-2 px-2 py-1 text-right font-mono text-sm text-ink-0 outline-none focus:border-accent"
          />
          <button
            onClick={handleSave}
            disabled={submitting}
            className="rounded-lg bg-accent px-2 py-1 text-xs font-medium text-background disabled:opacity-50"
          >
            Save
          </button>
          <button
            onClick={() => {
              setEditing(false);
              setValue(String(account.balance));
            }}
            className="text-xs text-ink-3 hover:text-ink-1"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-ink-1">{account.name}</span>
      <div className="flex items-center gap-2">
        <span className={`font-mono ${account.kind === "liability" ? "text-danger" : "text-ok"}`}>
          {account.kind === "liability" ? "-" : ""}
          {formatMoney(account.balance, account.currency)}
        </span>
        {account.source === "manual" && (
          <button onClick={() => setEditing(true)} className="text-xs text-ink-3 hover:text-accent">
            Edit
          </button>
        )}
      </div>
    </div>
  );
}

export default function NetWorthCard({
  accounts,
  snapshots,
}: {
  accounts: NetWorthAccount[];
  snapshots: NetWorthSnapshot[];
}) {
  const [tab, setTab] = useState<"networth" | "debts">("networth");

  const assets = accounts.filter((a) => a.kind === "asset");
  const liabilities = accounts.filter((a) => a.kind === "liability");
  // The credit card is day-to-day spending, not a tracked loan -- it stays
  // visible on the Net Worth tab (netted against assets) alongside the
  // long-term debts (Oodle, Lendable, MBNA), which only live on the Debts tab.
  const creditCard = liabilities.find((a) => a.name.toLowerCase().includes("credit card"));
  const assetsTotal = assets.reduce((sum, a) => sum + Number(a.balance), 0);
  const netWorthTotal = assetsTotal - Number(creditCard?.balance ?? 0);
  const debtsTotal = liabilities.reduce((sum, a) => sum + Number(a.balance), 0);

  // Historical snapshots store a per-account breakdown -- sum the accounts
  // that are assets today, minus the credit card, so the trend matches the
  // Net Worth tab's total above instead of the old assets-minus-all-liabilities figure.
  const assetNames = new Set(assets.map((a) => a.name));
  const trend = snapshots.map((s) => {
    if (!s.breakdown) return { date: s.snapshot_date, value: s.total };
    const assetsSum = Object.entries(s.breakdown).reduce(
      (sum, [name, value]) => (assetNames.has(name) ? sum + value : sum),
      0,
    );
    const creditCardValue = creditCard ? (s.breakdown[creditCard.name] ?? 0) : 0;
    return { date: s.snapshot_date, value: assetsSum - creditCardValue };
  });

  return (
    <Card title="Net Worth">
      <div className="mb-3 flex justify-end gap-1">
        {(["networth", "debts"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setTab(mode)}
            className={`rounded-full border px-2.5 py-0.5 font-mono text-xs uppercase tracking-wide transition-colors ${
              tab === mode ? "border-accent/60 bg-accent/15 text-accent" : "border-border text-ink-3 hover:text-ink-1"
            }`}
          >
            {mode === "networth" ? "Net Worth" : "Debts"}
          </button>
        ))}
      </div>

      {tab === "networth" ? (
        <>
          <div className="flex flex-col gap-2">
            {assets.length === 0 ? (
              <p className="text-sm text-ink-3">No assets tracked yet.</p>
            ) : (
              assets.map((a) => <AccountRow key={a.id} account={a} />)
            )}
            {creditCard && <AccountRow key={creditCard.id} account={creditCard} />}

            <div className="mt-1 flex items-center justify-between border-t border-border pt-2 text-sm font-semibold">
              <span className="text-ink-0">Total</span>
              <span className="font-mono text-accent">{formatMoney(netWorthTotal, "GBP")}</span>
            </div>
          </div>

          <div className="mt-4">
            <PeriodTrendChart data={trend} formatValue={(n) => formatMoney(n, "GBP")} />
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          {liabilities.length === 0 ? (
            <p className="text-sm text-ink-3">No debts tracked yet.</p>
          ) : (
            liabilities.map((a) => <AccountRow key={a.id} account={a} />)
          )}

          <div className="mt-1 flex items-center justify-between border-t border-border pt-2 text-sm font-semibold">
            <span className="text-ink-0">Total debts</span>
            <span className="font-mono text-danger">-{formatMoney(debtsTotal, "GBP")}</span>
          </div>
        </div>
      )}
    </Card>
  );
}
