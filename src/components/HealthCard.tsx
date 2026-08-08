import type { HealthEntry, HealthEntryType } from "@/lib/healthEntries";
import Card from "@/components/Card";

const TYPE_LABEL: Record<HealthEntryType, string> = {
  meal: "Meals",
  training: "Training",
  sleep: "Sleep",
};

const TYPE_ORDER: HealthEntryType[] = ["meal", "training", "sleep"];

// Locale is pinned (not `undefined`/`[]`) so server-rendered HTML always
// matches what the client renders on hydration, regardless of the server's
// or browser's OS locale settings.
function formatEntryDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function EntryGroup({ type, entries }: { type: HealthEntryType; entries: HealthEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-2">{TYPE_LABEL[type]}</p>
      <ul className="flex flex-col gap-1.5">
        {entries.map((e) => (
          <li key={e.id} className="rounded-xl border border-border/60 bg-surface-2/60 px-3 py-2">
            <p className="text-sm text-ink-1">{e.content}</p>
            <p className="mt-0.5 font-mono text-[10px] text-ink-3">{formatEntryDate(e.created_at)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function HealthCard({ entries }: { entries: HealthEntry[] }) {
  return (
    <Card title="Health" count={entries.length}>
      {entries.length === 0 ? (
        <p className="text-sm text-ink-3">
          Tell Jarvis about a meal, training session, or sleep to get started.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {TYPE_ORDER.map((type) => (
            <EntryGroup key={type} type={type} entries={entries.filter((e) => e.entry_type === type)} />
          ))}
        </div>
      )}
    </Card>
  );
}
