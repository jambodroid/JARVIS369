"use client";

import { useState } from "react";
import type { JournalEntry } from "@/lib/tradingJournal";
import { groupByMonth, groupByWeek } from "@/lib/tradingJournal";
import Card from "@/components/Card";

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
}

function formatDay(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function weekLabel(startDate: string): string {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

function monthLabel(startDate: string): string {
  return new Date(`${startDate}T00:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function PnlText({ pnl }: { pnl: number | null }) {
  if (pnl === null) return <span className="font-mono text-sm text-ink-3">--</span>;
  const color = pnl >= 0 ? "text-ok" : "text-danger";
  return (
    <span className={`font-mono text-sm font-medium ${color}`}>
      {pnl >= 0 ? "+" : ""}
      {formatMoney(pnl)}
    </span>
  );
}

function TradedBadge({ traded }: { traded: boolean }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${
        traded ? "bg-accent/15 text-accent" : "bg-surface-2 text-ink-3"
      }`}
    >
      {traded ? "Traded" : "No trade"}
    </span>
  );
}

function DayRow({ entry }: { entry: JournalEntry }) {
  return (
    <li className="rounded-xl border border-border/60 bg-surface-2/60 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-ink-3">{formatDay(entry.entry_date)}</span>
          <TradedBadge traded={entry.traded} />
        </div>
        <PnlText pnl={entry.pnl} />
      </div>
      {entry.summary && <p className="mt-1 text-sm text-ink-1">{entry.summary}</p>}
    </li>
  );
}

function GroupBlock({
  label,
  tradingDays,
  totalPnl,
  entries,
}: {
  label: string;
  tradingDays: number;
  totalPnl: number | null;
  entries: JournalEntry[];
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-surface-2/60 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-ink-0">{label}</span>
        <PnlText pnl={totalPnl} />
      </div>
      <p className="mt-0.5 font-mono text-xs text-ink-3">
        {tradingDays} trading day{tradingDays === 1 ? "" : "s"}
      </p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {entries.map((e) => (
          <li key={e.id} className="text-xs">
            <span className="font-mono text-ink-3">{formatDay(e.entry_date)}</span>
            {e.summary && <span className="text-ink-2"> &middot; {e.summary}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

const TABS = ["Day", "Week", "Month"] as const;
type Tab = (typeof TABS)[number];

export default function TradingJournalCard({ entries }: { entries: JournalEntry[] }) {
  const [tab, setTab] = useState<Tab>("Day");

  return (
    <Card title="Trading Journal" count={entries.length}>
      <div className="mb-3 flex justify-end gap-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full border px-2.5 py-0.5 font-mono text-xs uppercase tracking-wide transition-colors ${
              tab === t ? "border-accent/60 bg-accent/15 text-accent" : "border-border text-ink-3 hover:text-ink-1"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-ink-3">No entries yet &mdash; paste a summary to Jarvis to log one.</p>
      ) : tab === "Day" ? (
        <ul className="flex flex-col gap-2">
          {entries.map((e) => (
            <DayRow key={e.id} entry={e} />
          ))}
        </ul>
      ) : tab === "Week" ? (
        <div className="flex flex-col gap-2">
          {groupByWeek(entries).map((g) => (
            <GroupBlock
              key={g.startDate}
              label={weekLabel(g.startDate)}
              tradingDays={g.tradingDays}
              totalPnl={g.totalPnl}
              entries={g.entries}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {groupByMonth(entries).map((g) => (
            <GroupBlock
              key={g.startDate}
              label={monthLabel(g.startDate)}
              tradingDays={g.tradingDays}
              totalPnl={g.totalPnl}
              entries={g.entries}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
