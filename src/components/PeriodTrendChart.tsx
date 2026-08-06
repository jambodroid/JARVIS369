"use client";

import { useState } from "react";
import TrendChart from "@/components/TrendChart";

const PERIODS = [
  { label: "W", days: 7 },
  { label: "M", days: 30 },
  { label: "Q", days: 90 },
  { label: "Y", days: 365 },
] as const;

type Period = (typeof PERIODS)[number]["label"];

export default function PeriodTrendChart({
  data,
  formatValue,
}: {
  data: { date: string; value: number }[];
  formatValue: (n: number) => string;
}) {
  const [period, setPeriod] = useState<Period>("M");
  const days = PERIODS.find((p) => p.label === period)!.days;
  const filtered = data.slice(-days);

  return (
    <div>
      <div className="mb-2 flex justify-end gap-1">
        {PERIODS.map((p) => (
          <button
            key={p.label}
            onClick={() => setPeriod(p.label)}
            className={`rounded-full border px-2.5 py-0.5 font-mono text-xs uppercase tracking-wide transition-colors ${
              period === p.label
                ? "border-accent/60 bg-accent/15 text-accent"
                : "border-border text-ink-3 hover:text-ink-1"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <TrendChart data={filtered} formatValue={formatValue} />
    </div>
  );
}
