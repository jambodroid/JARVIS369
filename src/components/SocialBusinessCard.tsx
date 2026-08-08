"use client";

import { useState } from "react";
import type { ContentItem, ContentStatus } from "@/lib/socialBusiness";
import Card from "@/components/Card";

// The first four accounts already post together daily (the existing
// "Post RS + Platinum/RK" calendar event) -- bundled into one "Personal"
// tab rather than four separate ones. One-line adjustment point if this
// grouping assumption is wrong; not a schema decision.
const PERSONAL_BUNDLE = ["Jambo369", "RS Cars", "RK Tyres", "Platinum Tan"];
const PERSONAL_TAB = "Personal";

const STATUS_ORDER: ContentStatus[] = ["idea", "scripted", "filmed", "edited", "scheduled", "posted"];
const STAGE_COLUMNS: ContentStatus[] = ["scripted", "filmed", "edited", "scheduled", "posted"];
const STAGE_LABEL: Record<ContentStatus, string> = {
  idea: "Idea",
  scripted: "Scripted",
  filmed: "Filmed",
  edited: "Edited",
  scheduled: "Scheduled",
  posted: "Posted",
};

function ordinal(n: number) {
  if (n % 10 === 1 && n !== 11) return `${n}st`;
  if (n % 10 === 2 && n !== 12) return `${n}nd`;
  if (n % 10 === 3 && n !== 13) return `${n}rd`;
  return `${n}th`;
}

// Locale is pinned (not `undefined`/`[]`) so server-rendered HTML always
// matches what the client renders on hydration, regardless of the server's
// or browser's OS locale settings.
function formatDueDate(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00`);
  const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
  const month = d.toLocaleDateString("en-US", { month: "short" });
  return `${weekday} ${ordinal(d.getDate())} ${month}`;
}

function stageReached(item: ContentItem, stage: ContentStatus): boolean {
  return STATUS_ORDER.indexOf(item.status) >= STATUS_ORDER.indexOf(stage);
}

function PipelineTable({ items }: { items: ContentItem[] }) {
  const sorted = [...items].sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1));

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="whitespace-nowrap py-1.5 pr-3 text-xs font-medium uppercase tracking-wide text-ink-3">
              Date
            </th>
            <th className="py-1.5 pr-3 text-xs font-medium uppercase tracking-wide text-ink-3">Post</th>
            {STAGE_COLUMNS.map((stage) => (
              <th
                key={stage}
                className="whitespace-nowrap px-2 py-1.5 text-center text-xs font-medium uppercase tracking-wide text-ink-3"
              >
                {STAGE_LABEL[stage]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((item) => (
            <tr key={item.id} className="border-b border-border/40">
              <td className="whitespace-nowrap py-2 pr-3 text-xs text-ink-3">{formatDueDate(item.due_date!)}</td>
              <td className="max-w-[140px] truncate py-2 pr-3 text-ink-0">{item.title}</td>
              {STAGE_COLUMNS.map((stage) => (
                <td key={stage} className="px-2 py-2 text-center">
                  {stageReached(item, stage) && <span className="text-accent">✓</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NotYetScheduled({ items, showClient }: { items: ContentItem[]; showClient: boolean }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-2">Not yet scheduled</p>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-surface-2/60 px-3 py-2"
          >
            <span className="min-w-0 truncate text-sm text-ink-0">{item.title}</span>
            {showClient && item.client_name && (
              <span className="shrink-0 font-mono text-xs text-ink-3">{item.client_name}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SocialBusinessCard({ items }: { items: ContentItem[] }) {
  const otherClients = Array.from(
    new Set(
      items
        .map((i) => i.client_name)
        .filter((name): name is string => name !== null && !PERSONAL_BUNDLE.includes(name)),
    ),
  ).sort();
  const tabs = [PERSONAL_TAB, ...otherClients];
  const [activeTab, setActiveTab] = useState<string>(PERSONAL_TAB);

  const tabItems = items.filter((i) =>
    activeTab === PERSONAL_TAB
      ? i.client_name === null || PERSONAL_BUNDLE.includes(i.client_name)
      : i.client_name === activeTab,
  );
  const scheduled = tabItems.filter((i) => i.due_date !== null);
  const unscheduled = tabItems.filter((i) => i.due_date === null);

  return (
    <Card title="Business" count={items.length}>
      {items.length === 0 ? (
        <p className="text-sm text-ink-3">Tell Jarvis about a client video or post to get started.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-1">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-full border px-2.5 py-0.5 font-mono text-xs uppercase tracking-wide transition-colors ${
                  activeTab === tab
                    ? "border-accent/60 bg-accent/15 text-accent"
                    : "border-border text-ink-3 hover:text-ink-1"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {scheduled.length > 0 ? (
            <PipelineTable items={scheduled} />
          ) : (
            <p className="text-sm text-ink-3">Nothing scheduled yet in {activeTab}.</p>
          )}

          <NotYetScheduled items={unscheduled} showClient={activeTab === PERSONAL_TAB} />
        </div>
      )}
    </Card>
  );
}
