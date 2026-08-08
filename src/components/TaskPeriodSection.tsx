"use client";

import { useState } from "react";
import { getTasksForPeriod, type Task } from "@/lib/tasks";
import TaskRow from "@/components/TaskRow";
import Card from "@/components/Card";

const TABS = ["Day", "Week", "Month"] as const;
type Tab = (typeof TABS)[number];
const TAB_PERIOD: Record<Tab, "day" | "week" | "month"> = { Day: "day", Week: "week", Month: "month" };

export default function TaskPeriodSection({ tasks }: { tasks: Task[] }) {
  const [tab, setTab] = useState<Tab>("Day");
  const filtered = getTasksForPeriod(tasks, TAB_PERIOD[tab]);

  return (
    <Card title="Tasks" count={filtered.length}>
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

      {filtered.length === 0 ? (
        <p className="text-sm text-ink-3">Nothing here.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </ul>
      )}
    </Card>
  );
}
