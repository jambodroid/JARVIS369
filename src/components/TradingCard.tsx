import type { NetWorthAccount, NetWorthSnapshot } from "@/lib/netWorth";
import Card from "@/components/Card";
import PeriodTrendChart from "@/components/PeriodTrendChart";

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
  if (!account) return null;

  const priorSnapshot = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null;
  const priorBalance = priorSnapshot?.breakdown?.[account.name];
  const pnl = typeof priorBalance === "number" ? account.balance - priorBalance : null;

  const trend = snapshots
    .filter((s) => typeof s.breakdown?.[account.name] === "number")
    .map((s) => ({ date: s.snapshot_date, value: s.breakdown![account.name] }));

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

      <div className="mt-4">
        <PeriodTrendChart data={trend} formatValue={(n) => formatMoney(n, account.currency)} />
      </div>
    </Card>
  );
}
