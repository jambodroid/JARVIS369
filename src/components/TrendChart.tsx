// A minimal single-series trend line: thin accent line, soft area fill,
// direct end-label for the latest value. No categorical palette or
// interactive tooltip layer — this is a single-series magnitude-over-time
// glance, not a multi-series analytics view.
export default function TrendChart({
  data,
  formatValue,
}: {
  data: { date: string; value: number }[];
  formatValue: (n: number) => string;
}) {
  if (data.length < 2) {
    return <p className="text-sm text-ink-3">Not enough history yet — check back tomorrow.</p>;
  }

  const width = 300;
  const height = 80;
  const padding = 4;

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((d.value - min) / range) * (height - padding * 2);
    return { x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${height} L${points[0].x.toFixed(1)},${height} Z`;

  const latest = data[data.length - 1];
  const first = data[0];
  const change = latest.value - first.value;
  const changeColor = change >= 0 ? "text-ok" : "text-danger";

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#trend-fill)" />
        <path
          d={linePath}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: "drop-shadow(0 0 4px oklch(0.82 0.15 195 / 0.6))" }}
        />
        <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="3" fill="var(--accent)" />
      </svg>
      <div className="mt-1 flex items-center justify-between">
        <span className="font-mono text-xs text-ink-3">
          {new Date(`${first.date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          {" → "}
          {new Date(`${latest.date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </span>
        <span className={`font-mono text-xs font-medium ${changeColor}`}>
          {change >= 0 ? "+" : ""}
          {formatValue(change)}
        </span>
      </div>
    </div>
  );
}
