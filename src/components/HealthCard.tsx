import type { HealthEntry, HealthEntryType } from "@/lib/healthEntries";
import type { HealthMetricsDay } from "@/lib/healthMetrics";
import type { HealthPlanKind } from "@/lib/healthPlans";
import Card from "@/components/Card";

const PLAN_LABEL: Record<HealthPlanKind, string> = {
  gym: "Gym Plan",
  diet: "Diet Plan",
};

const PLAN_EMPTY: Record<HealthPlanKind, string> = {
  gym: "No gym plan set yet -- tell Jarvis your workout split to get started.",
  diet: "No diet plan set yet -- tell Jarvis your macro or meal targets to get started.",
};

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

function formatMetricsDate(dateKey: string): string {
  return formatEntryDate(`${dateKey}T12:00:00`);
}

function MacroLine({ entry }: { entry: HealthEntry }) {
  if (entry.kcal == null) return null;
  return (
    <p className="mt-0.5 font-mono text-[10px] text-ink-3">
      {Math.round(entry.kcal)} kcal
      {entry.protein_g != null && ` · ${Math.round(entry.protein_g)}g protein`}
      {entry.carbs_g != null && ` · ${Math.round(entry.carbs_g)}g carbs`}
      {entry.fat_g != null && ` · ${Math.round(entry.fat_g)}g fat`}
    </p>
  );
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
            {e.entry_type === "meal" && <MacroLine entry={e} />}
            <p className="mt-0.5 font-mono text-[10px] text-ink-3">{formatEntryDate(e.created_at)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AppleHealthSection({ metrics }: { metrics: HealthMetricsDay[] }) {
  const withData = metrics.filter((m) => m.steps != null || m.sleep_hours != null || (m.workouts?.length ?? 0) > 0);
  if (withData.length === 0) return null;

  return (
    <div>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-2">Apple Health</p>
      <ul className="flex flex-col gap-1.5">
        {withData.slice(0, 5).map((m) => (
          <li key={m.metric_date} className="rounded-xl border border-border/60 bg-surface-2/60 px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-ink-3">{formatMetricsDate(m.metric_date)}</span>
            </div>
            <p className="mt-0.5 text-sm text-ink-1">
              {[
                m.steps != null && `${m.steps.toLocaleString()} steps`,
                m.sleep_hours != null && `${m.sleep_hours.toFixed(1)}h sleep`,
                m.workouts && m.workouts.length > 0 && `${m.workouts.length} workout${m.workouts.length === 1 ? "" : "s"}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlanBlock({ kind, content }: { kind: HealthPlanKind; content: string | null }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-2">{PLAN_LABEL[kind]}</p>
      {content ? (
        <p className="whitespace-pre-wrap rounded-xl border border-border/60 bg-surface-2/60 px-3 py-2 text-sm text-ink-1">
          {content}
        </p>
      ) : (
        <p className="text-sm text-ink-3">{PLAN_EMPTY[kind]}</p>
      )}
    </div>
  );
}

export default function HealthCard({
  entries,
  metrics,
  plans,
}: {
  entries: HealthEntry[];
  metrics: HealthMetricsDay[];
  plans: Record<HealthPlanKind, string | null>;
}) {
  const hasAnything = entries.length > 0 || metrics.some((m) => m.steps != null || m.sleep_hours != null);

  return (
    <Card title="Health" count={entries.length}>
      <div className="flex flex-col gap-4">
        <PlanBlock kind="gym" content={plans.gym} />
        <PlanBlock kind="diet" content={plans.diet} />
        {!hasAnything ? (
          <p className="text-sm text-ink-3">
            Tell Jarvis about a meal, training session, or sleep to get started.
          </p>
        ) : (
          <>
            <AppleHealthSection metrics={metrics} />
            {TYPE_ORDER.map((type) => (
              <EntryGroup key={type} type={type} entries={entries.filter((e) => e.entry_type === type)} />
            ))}
          </>
        )}
      </div>
    </Card>
  );
}
