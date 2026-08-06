import type { NetWorthAccount, NetWorthSnapshot } from "@/lib/netWorth";
import { computeTotal } from "@/lib/netWorth";
import Card from "@/components/Card";
import TrendChart from "@/components/TrendChart";

function formatMoney(n: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

export default function NetWorthCard({
  accounts,
  snapshots,
  truelayerConnected,
  truelayerError,
}: {
  accounts: NetWorthAccount[];
  snapshots: NetWorthSnapshot[];
  truelayerConnected: boolean;
  truelayerError?: string;
}) {
  const total = computeTotal(accounts);
  const trend = snapshots.map((s) => ({ date: s.snapshot_date, value: s.total }));

  return (
    <Card title="Net Worth">
      <div className="flex flex-col gap-2">
        {accounts.map((a) => (
          <div key={a.id} className="flex items-center justify-between text-sm">
            <span className="text-ink-1">{a.name}</span>
            <span className={`font-mono ${a.kind === "liability" ? "text-danger" : "text-ink-0"}`}>
              {a.kind === "liability" ? "-" : ""}
              {formatMoney(a.balance, a.currency)}
            </span>
          </div>
        ))}

        {!truelayerConnected && (
          <div className="rounded-lg border border-border bg-surface-2 p-3">
            <p className="mb-2 text-sm text-ink-2">
              Connect HSBC to add your current account and credit card.
            </p>
            {truelayerError && (
              <p className="mb-2 text-xs text-danger">Couldn&apos;t connect: {truelayerError}</p>
            )}
            <a
              href="/api/truelayer/connect"
              className="inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background"
            >
              Connect HSBC
            </a>
          </div>
        )}

        <div className="mt-1 flex items-center justify-between border-t border-border pt-2 text-sm font-semibold">
          <span className="text-ink-0">Total</span>
          <span className="font-mono text-accent">{formatMoney(total, "GBP")}</span>
        </div>
      </div>

      <div className="mt-4">
        <TrendChart data={trend} formatValue={(n) => formatMoney(n, "GBP")} />
      </div>
    </Card>
  );
}
